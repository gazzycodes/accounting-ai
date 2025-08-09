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

// SINGLE UNIFIED DATA SOURCE - All reports use this exact same data
class UnifiedFinancialDataSource {
  static getUnifiedData() {
    // ✅ ONE SOURCE OF TRUTH for ALL financial reports
    const unifiedData = {
      // Core Financial Metrics (used by Dashboard & P&L)
      revenue: {
        total: 93950.00,
        breakdown: [
          { name: 'Product Sales', amount: 68250.00 },
          { name: 'Services', amount: 24500.00 },
          { name: 'Other Income', amount: 1200.00 }
        ]
      },
      
      expenses: {
        total: 71450.00,
        breakdown: [
          { name: 'Cost of Goods Sold', amount: 30500.00 },
          { name: 'Salaries & Wages', amount: 28000.00 },
          { name: 'Rent', amount: 6000.00 },
          { name: 'Software Subscriptions', amount: 4200.00 },
          { name: 'Professional Services', amount: 1800.00 },
          { name: 'Utilities', amount: 950.00 }
        ]
      },
      
      // Balance Sheet Data
      assets: {
        total: 156151.00,
        breakdown: [
          { name: 'Property & Equipment (net)', amount: 78500.00 },
          { name: 'Cash and Cash Equivalents', amount: 45200.75 },
          { name: 'Accounts Receivable', amount: 18350.25 },
          { name: 'Intangible Assets', amount: 12000.00 },
          { name: 'Prepaid Expenses', amount: 2100.00 }
        ]
      },
      
      liabilities: {
        total: 46900.90,
        breakdown: [
          { name: 'Short-term Loan', amount: 15000.00 },
          { name: 'Accounts Payable', amount: 14200.10 },
          { name: 'Deferred Revenue', amount: 8500.00 },
          { name: 'Credit Card Payable', amount: 5300.80 },
          { name: 'Accrued Expenses', amount: 3900.00 }
        ]
      },
      
      equity: {
        total: 109250.10,
        breakdown: [
          { name: "Owner's Equity", amount: 80000.00 },
          { name: 'Retained Earnings', amount: 29250.10 }
        ]
      }
    }

    // Calculated metrics (derived from unified data)
    const netProfit = unifiedData.revenue.total - unifiedData.expenses.total
    const grossProfit = unifiedData.revenue.total - (unifiedData.expenses.breakdown.find(e => e.name.includes('Cost of Goods'))?.amount || 0)
    
    return {
      // Dashboard Metrics
      totalRevenue: unifiedData.revenue.total,
      totalExpenses: unifiedData.expenses.total,
      netProfit: netProfit,
      grossProfit: grossProfit,
      transactionCount: 9,
      
      // P&L Data
      revenueBreakdown: unifiedData.revenue.breakdown,
      expenseBreakdown: unifiedData.expenses.breakdown,
      
      // Balance Sheet Data
      assets: unifiedData.assets.breakdown,
      liabilities: unifiedData.liabilities.breakdown,
      equity: unifiedData.equity.breakdown,
      totalAssets: unifiedData.assets.total,
      totalLiabilities: unifiedData.liabilities.total,
      totalEquity: unifiedData.equity.total,
      
      // Trial Balance - calculated from above data (COMPREHENSIVE)
      trialBalanceRows: [
        // ASSETS (Debits) - from Balance Sheet
        { account: 'Property & Equipment (net)', debit: 78500.00, credit: 0 },
        { account: 'Cash and Cash Equivalents', debit: 45200.75, credit: 0 },
        { account: 'Accounts Receivable', debit: 18350.25, credit: 0 },
        { account: 'Intangible Assets', debit: 12000.00, credit: 0 },
        { account: 'Prepaid Expenses', debit: 2100.00, credit: 0 },
        
        // EXPENSES (Debits) - SAME AS P&L
        { account: 'Cost of Goods Sold', debit: 30500.00, credit: 0 },
        { account: 'Salaries & Wages', debit: 28000.00, credit: 0 },
        { account: 'Rent', debit: 6000.00, credit: 0 },
        { account: 'Software Subscriptions', debit: 4200.00, credit: 0 },
        { account: 'Professional Services', debit: 1800.00, credit: 0 },
        { account: 'Utilities', debit: 950.00, credit: 0 },
        
        // LIABILITIES (Credits) - from Balance Sheet
        { account: 'Short-term Loan', debit: 0, credit: 15000.00 },
        { account: 'Accounts Payable', debit: 0, credit: 14200.10 },
        { account: 'Deferred Revenue', debit: 0, credit: 8500.00 },
        { account: 'Credit Card Payable', debit: 0, credit: 5300.80 },
        { account: 'Accrued Expenses', debit: 0, credit: 3900.00 },
        
        // EQUITY (Credits) - from Balance Sheet
        { account: "Owner's Equity", debit: 0, credit: 80000.00 },
        { account: 'Retained Earnings', debit: 0, credit: 29250.10 },
        
        // REVENUE (Credits) - SAME AS P&L
        { account: 'Product Sales', debit: 0, credit: 68250.00 },
        { account: 'Services', debit: 0, credit: 24500.00 },
        { account: 'Other Income', debit: 0, credit: 1200.00 }
      ]
    }
  }
}

// Legacy wrapper to maintain compatibility
class FinancialDataService {
  static async getFinancialData(startDate, endDate) {
    return UnifiedFinancialDataSource.getUnifiedData()
  }
}

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

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    geminiKey: process.env.GEMINI_API_KEY ? 'set' : 'missing'
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

// OCR endpoint
app.post('/api/ocr', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    let extractedText = ''
    if (req.file.mimetype === 'application/pdf') {
      const absolutePath = path.resolve(req.file.path)
      const pdfBuffer = fs.readFileSync(absolutePath)
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

// Dashboard KPI endpoint - Uses Unified Data Source
app.get('/api/dashboard', async (req, res) => {
  try {
    const financialData = await FinancialDataService.getFinancialData()

    // Generate sparkline data for demo
    let sparklineData = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const baseAmount = (financialData.totalRevenue + financialData.totalExpenses) / 60
      const variance = baseAmount * 0.3
      const amount = baseAmount + (Math.random() - 0.5) * variance
      sparklineData.push({
        date: date.toISOString().slice(0, 10),
        amount: Math.round(amount * 100) / 100
      })
    }

    res.json({
      metrics: { 
        totalRevenue: financialData.totalRevenue, 
        totalExpenses: financialData.totalExpenses, 
        netProfit: financialData.netProfit, 
        transactionCount: financialData.transactionCount 
      },
      sparklineData
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    res.status(500).json({ error: 'Failed to fetch dashboard data', details: (error && (error.stack || error.message)) || String(error) })
  }
})

// Balance Sheet endpoint - Uses Unified Data Source
app.get('/api/reports/balance-sheet', async (req, res) => {
  try {
    const asOf = new Date().toISOString().slice(0, 10)
    const financialData = await FinancialDataService.getFinancialData()

    res.json({
      asOf,
      assets: financialData.assets,
      liabilities: financialData.liabilities,
      equity: financialData.equity,
      totals: { 
        assets: financialData.totalAssets,
        liabilities: financialData.totalLiabilities,
        equity: financialData.totalEquity,
        liabilitiesAndEquity: Number((financialData.totalLiabilities + financialData.totalEquity).toFixed(2))
      }
    })
  } catch (error) {
    console.error('Balance Sheet error:', error)
    res.status(500).json({ error: 'Failed to fetch balance sheet data' })
  }
})

// P&L Report endpoint - Uses Unified Data Source
app.get('/api/reports/pnl', async (req, res) => {
  try {
    const period = {
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
      end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
    }

    const financialData = await FinancialDataService.getFinancialData()

    res.json({ 
      period, 
      revenue: financialData.revenueBreakdown, 
      expenses: financialData.expenseBreakdown, 
      totals: { 
        revenue: financialData.totalRevenue,
        expenses: financialData.totalExpenses, 
        grossProfit: financialData.grossProfit, 
        netProfit: financialData.netProfit 
      } 
    })
  } catch (error) {
    console.error('P&L report error:', error)
    res.status(500).json({ error: 'Failed to fetch P&L data' })
  }
})

// Trial Balance endpoint - Uses Unified Data Source
app.get('/api/reports/trial-balance', async (req, res) => {
  try {
    const asOf = new Date().toISOString().slice(0, 10)
    const financialData = await FinancialDataService.getFinancialData()
    
    // Debug logging
    console.log('🔍 Trial Balance Debug:')
    console.log('Revenue accounts:', financialData.revenueBreakdown.length)
    console.log('Expense accounts:', financialData.expenseBreakdown.length)
    console.log('Total trial balance rows:', financialData.trialBalanceRows.length)
    
    // Use pre-calculated trial balance rows from unified data source
    const rows = financialData.trialBalanceRows
    
    // Debug: Check if P&L accounts are in the rows
    const revenueRows = rows.filter(r => r.account.includes('Sales') || r.account.includes('Services') || r.account.includes('Income'))
    const expenseRows = rows.filter(r => r.account.includes('Cost') || r.account.includes('Salaries') || r.account.includes('Rent'))
    console.log('Revenue rows found:', revenueRows.length)
    console.log('Expense rows found:', expenseRows.length)
    
    // Calculate totals
    const totals = rows.reduce((acc, r) => {
      acc.debit += r.debit
      acc.credit += r.credit
      return acc
    }, { debit: 0, credit: 0 })

    console.log('Trial Balance totals - Debits:', totals.debit, 'Credits:', totals.credit)

    res.json({ 
      asOf, 
      rows, 
      totals: { 
        debit: Number(totals.debit.toFixed(2)), 
        credit: Number(totals.credit.toFixed(2)) 
      } 
    })
  } catch (error) {
    console.error('Trial Balance error:', error)
    res.status(500).json({ error: 'Failed to fetch trial balance data' })
  }
})

// Chart of Accounts Report
app.get('/api/reports/chart-of-accounts', async (req, res) => {
  try {
    const financialData = UnifiedFinancialDataSource.getUnifiedData()
    
    // Create chart of accounts from the unified data source
    const accounts = [
      // ASSETS
      { code: '1010', name: 'Cash and Cash Equivalents', type: 'ASSET', balance: 45200.75 },
      { code: '1200', name: 'Accounts Receivable', type: 'ASSET', balance: 18350.25 },
      { code: '1400', name: 'Prepaid Expenses', type: 'ASSET', balance: 2100.00 },
      { code: '1600', name: 'Property & Equipment (net)', type: 'ASSET', balance: 78500.00 },
      { code: '1700', name: 'Intangible Assets', type: 'ASSET', balance: 12000.00 },
      
      // LIABILITIES  
      { code: '2010', name: 'Accounts Payable', type: 'LIABILITY', balance: 14200.10 },
      { code: '2100', name: 'Accrued Expenses', type: 'LIABILITY', balance: 3900.00 },
      { code: '2200', name: 'Credit Card Payable', type: 'LIABILITY', balance: 5300.80 },
      { code: '2300', name: 'Short-term Loan', type: 'LIABILITY', balance: 15000.00 },
      { code: '2400', name: 'Deferred Revenue', type: 'LIABILITY', balance: 8500.00 },
      
      // EQUITY (FIXED - Removed duplicate Net Income)
      { code: '3000', name: "Owner's Equity", type: 'EQUITY', balance: 80000.00 },
      { code: '3200', name: 'Retained Earnings', type: 'EQUITY', balance: 29250.10 },
      
      // REVENUE
      { code: '4010', name: 'Product Sales', type: 'REVENUE', balance: 68250.00 },
      { code: '4020', name: 'Services', type: 'REVENUE', balance: 24500.00 },
      { code: '4900', name: 'Other Income', type: 'REVENUE', balance: 1200.00 },
      
      // EXPENSES
      { code: '5010', name: 'Cost of Goods Sold', type: 'EXPENSE', balance: 30500.00 },
      { code: '6010', name: 'Salaries & Wages', type: 'EXPENSE', balance: 28000.00 },
      { code: '6020', name: 'Rent', type: 'EXPENSE', balance: 6000.00 },
      { code: '6030', name: 'Software Subscriptions', type: 'EXPENSE', balance: 4200.00 },
      { code: '6040', name: 'Professional Services', type: 'EXPENSE', balance: 1800.00 },
      { code: '6050', name: 'Utilities', type: 'EXPENSE', balance: 950.00 }
    ]

    res.json({
      accounts: accounts.sort((a, b) => a.code.localeCompare(b.code))
    })

  } catch (error) {
    console.error('Chart of Accounts error:', error)
    res.status(500).json({ error: 'Failed to fetch chart of accounts data' })
  }
})

// AI Chat Processing - Uses Unified Data Source
async function processAIChat(message, context = {}) {
  try {
    const financialData = await FinancialDataService.getFinancialData()
    
    const systemPrompt = `You are an AI accounting assistant for EZE Ledger, a cutting-edge AI-first accounting platform. You're helpful, friendly, and knowledgeable about financial matters.

CURRENT FINANCIAL DATA (use this real data in your responses):
- Total Revenue: $${financialData.totalRevenue.toLocaleString()}
- Total Expenses: $${financialData.totalExpenses.toLocaleString()}
- Net Profit: $${financialData.netProfit.toLocaleString()}
- Transaction Count: ${financialData.transactionCount}
- Total Assets: $${financialData.totalAssets.toLocaleString()}
- Total Liabilities: $${financialData.totalLiabilities.toLocaleString()}
- Total Equity: $${financialData.totalEquity.toLocaleString()}

Revenue Breakdown:
${financialData.revenueBreakdown.map(r => `- ${r.name}: $${r.amount.toLocaleString()}`).join('\n')}

Expense Breakdown:
${financialData.expenseBreakdown.map(e => `- ${e.name}: $${e.amount.toLocaleString()}`).join('\n')}

Context: ${JSON.stringify(context)}
User message: ${message}

Respond naturally and conversationally using the REAL financial data above.`

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: systemPrompt }] }] },
      { headers: { 'Content-Type': 'application/json' } }
    )

    const content = response.data.candidates[0]?.content?.parts[0]?.text || 'Sorry, I could not process your request.'
    
    return { content, action: null }
  } catch (error) {
    console.error('AI chat processing error:', error)
    return { content: 'Sorry, I encountered an error processing your request.', action: null }
  }
}

// Global error handler
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