import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import axios from 'axios'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })
const prisma = new PrismaClient()
const PORT = process.env.PORT || 4000

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`
    cb(null, uniqueName)
  }
})

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'), false)
    }
  }
})

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established')
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString())
      
      if (data.type === 'chat') {
        const aiResponse = await processAIChat(data.message, data.context)
        ws.send(JSON.stringify({
          type: 'chat_response',
          message: aiResponse.content,
          action: aiResponse.action
        }))
      }
    } catch (error) {
      console.error('WebSocket error:', error)
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }))
    }
  })

  ws.on('close', () => {
    console.log('WebSocket connection closed')
  })
})

// AI Proxy endpoint
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { prompt } = req.body
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' })
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      { headers: { 'Content-Type': 'application/json' } }
    )

    const content = response.data.candidates[0]?.content?.parts[0]?.text || 'No response generated'
    
    res.json({ content, usage: response.data.usageMetadata })
  } catch (error) {
    console.error('Gemini API error:', error.response?.data || error.message)
    res.status(500).json({ 
      error: 'Failed to generate AI response',
      details: error.response?.data?.error?.message || error.message
    })
  }
})

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    geminiKey: process.env.GEMINI_API_KEY ? 'set' : 'missing'
  })
})

// OCR endpoint (PDF server-side text, images via upload info)
app.post('/api/ocr', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    console.log('[OCR] Received file:', {
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    })

    let extractedText = ''
    if (req.file.mimetype === 'application/pdf') {
      const absolutePath = path.resolve(req.file.path)
      const pdfBuffer = fs.readFileSync(absolutePath)
      // Import library module directly to avoid index.js demo side-effects in ESM
      const mod = await import('pdf-parse/lib/pdf-parse.js')
      const pdfParse = (mod && (mod.default || mod))
      const pdfData = await pdfParse(pdfBuffer)
      extractedText = pdfData.text || ''
    }

    res.json({
      message: 'File uploaded successfully',
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      extractedText
    })
  } catch (error) {
    console.error('OCR error:', error)
    next(error)
  }
})

// Expense endpoints
app.post('/api/expenses', async (req, res) => {
  try {
    const { vendor, category, date, amount, description, receiptUrl, customFields } = req.body
    
    const expenseAccount = await prisma.account.findFirst({ where: { type: 'EXPENSE' } })
    const cashAccount = await prisma.account.findFirst({ where: { type: 'ASSET', name: { contains: 'Cash' } } })
    
    if (!expenseAccount || !cashAccount) {
      return res.status(500).json({ error: 'Required accounts not found' })
    }
    
    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(date),
        description: description || `Expense: ${vendor}`,
        amount: parseFloat(amount),
        reference: `EXP-${Date.now()}`,
        customFields: customFields && Array.isArray(customFields) ? customFields : undefined
      }
    })

    const expense = await prisma.expense.create({
      data: {
        transactionId: transaction.id,
        vendor,
        category: category.toUpperCase(),
        date: new Date(date),
        amount: parseFloat(amount),
        description,
        receiptUrl,
        customFields: customFields && Array.isArray(customFields) ? customFields : undefined
      },
      include: { transaction: true }
    })

    await prisma.transactionEntry.create({
      data: {
        transactionId: transaction.id,
        debitAccountId: expenseAccount.id,
        amount: parseFloat(amount),
        description: `Expense: ${vendor}`
      }
    })

    await prisma.transactionEntry.create({
      data: {
        transactionId: transaction.id,
        creditAccountId: cashAccount.id,
        amount: parseFloat(amount),
        description: `Payment to: ${vendor}`
      }
    })

    res.json({ success: true, expense, message: `💾 Expense saved successfully! $${amount} for ${vendor}` })
  } catch (error) {
    console.error('Create expense error:', error)
    res.status(500).json({ error: 'Failed to create expense', details: error.message })
  }
})

app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      include: { transaction: true },
      orderBy: { date: 'desc' }
    })
    res.json(expenses)
  } catch (error) {
    console.error('Get expenses error:', error)
    res.status(500).json({ error: 'Failed to fetch expenses' })
  }
})

// Dashboard KPI endpoint
app.get('/api/dashboard', async (req, res) => {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const expenses = await prisma.expense.aggregate({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true }
    })

    const invoices = await prisma.invoice.aggregate({
      where: { date: { gte: startOfMonth, lte: endOfMonth }, status: 'PAID' },
      _sum: { amount: true }
    })

    const totalRevenue = invoices._sum.amount || 0
    const totalExpenses = expenses._sum.amount || 0
    const netProfit = totalRevenue - totalExpenses

    const recentTransactions = await prisma.transaction.findMany({
      where: { date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      orderBy: { date: 'asc' },
      take: 30
    })

    res.json({
      metrics: { totalRevenue, totalExpenses, netProfit, transactionCount: recentTransactions.length },
      sparklineData: recentTransactions.map(t => ({ date: t.date, amount: t.amount }))
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    res.status(500).json({ error: 'Failed to fetch dashboard data', details: (error && (error.stack || error.message)) || String(error) })
  }
})

async function processAIChat(message, context = {}) {
  try {
    const systemPrompt = `You are an AI accounting assistant for EZE Ledger, a cutting-edge AI-first accounting platform. You're helpful, friendly, and knowledgeable about financial matters.

When users ask you to create transactions, respond in natural, conversational language and also provide the action for processing.

Examples:
User: "Add a $200 software expense for Adobe"
Response: "✅ **Perfect!** I've added a $200 software expense for Adobe to your records. This will be categorized under Software expenses and posted to your expense account."

User: "How's my cash flow looking?"
Response: "Based on your current data, you have $558.88 in revenue and $1,298.87 in expenses, resulting in a net loss of $739.99. I'd recommend reviewing your largest expense categories to identify potential cost savings."

Available actions (only include if user wants to create something):
- createExpense(vendor, amount, category, date, description)
- createInvoice(customer, amount, description, dueDate)
- getFinancialSummary()

Context: ${JSON.stringify(context)}
User message: ${message}

Respond naturally and conversationally. If creating a transaction, include the ACTION at the end in this format:
ACTION: actionName(parameters)`

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: systemPrompt }] }] },
      { headers: { 'Content-Type': 'application/json' } }
    )

    const content = response.data.candidates[0]?.content?.parts[0]?.text || 'Sorry, I could not process your request.'
    const actionMatch = content.match(/ACTION: (\w+)\((.*)\)/)
    let action = null
    let cleanContent = content
    if (actionMatch) {
      action = { type: actionMatch[1], parameters: actionMatch[2] }
      cleanContent = content.replace(/\n?ACTION: (\w+)\((.*)\)/, '').trim()
    }

    return { content: cleanContent, action }
  } catch (error) {
    console.error('AI chat processing error:', error)
    return { content: 'Sorry, I encountered an error processing your request.', action: null }
  }
}

// Global error handler: return JSON bodies for all errors (incl. Multer)
// Place AFTER routes
app.use((err, req, res, next) => {
  const isMulter = err && (err.name === 'MulterError')
  const status = isMulter && err.code === 'LIMIT_FILE_SIZE' ? 413 : 500
  const details = (err && (err.stack || err.message)) || String(err)
  console.error('[UNHANDLED]', details)
  res.status(status).json({ error: 'Internal Server Error', type: err?.name || 'Error', code: err?.code, details })
})

server.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`)
  try { await initializeSampleData() } catch {}
})

async function initializeSampleData() {
  try {
    const existingExpenses = await prisma.expense.count()
    if (existingExpenses > 0) {
      console.log('Sample data already exists')
      return
    }
    console.log('Creating sample data...')
    const vendors = ['Acme Software', 'Office Depot', 'Uber', 'AWS', 'Adobe', 'Microsoft']
    const customers = ['Tech Corp', 'Design Studio', 'Startup Inc', 'Enterprise LLC']
    const categories = ['SOFTWARE', 'OFFICE_SUPPLIES', 'TRAVEL', 'UTILITIES', 'PROFESSIONAL_SERVICES']
    for (let i = 0; i < 10; i++) {
      const vendor = vendors[Math.floor(Math.random() * vendors.length)]
      const category = categories[Math.floor(Math.random() * categories.length)]
      const amount = Math.round((Math.random() * 500 + 50) * 100) / 100
      const date = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      const transaction = await prisma.transaction.create({ data: { date, description: `Expense: ${vendor}`, amount } })
      await prisma.expense.create({ data: { transactionId: transaction.id, vendor, category, date, amount, description: `Payment to ${vendor}` } })
    }
    for (let i = 0; i < 5; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)]
      const amount = Math.round((Math.random() * 2000 + 500) * 100) / 100
      const date = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      const transaction = await prisma.transaction.create({ data: { date, description: `Invoice: ${customer}`, amount } })
      await prisma.invoice.create({ data: { transactionId: transaction.id, customer, invoiceNumber: `INV-${Date.now()}-${i}`, date, amount, description: `Services for ${customer}`, status: Math.random() > 0.3 ? 'PAID' : 'SENT' } })
    }
    console.log('Sample data created successfully!')
  } catch (error) {
    console.error('Error creating sample data:', error)
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...')
  await prisma.$disconnect()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
}) 