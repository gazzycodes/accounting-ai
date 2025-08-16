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
import { ReportingService } from './reportingService.js'
import { PostingService } from './src/services/posting.service.js'
import { ExpenseAccountResolver } from './src/services/expense-account-resolver.service.js'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })
const prisma = new PrismaClient()
const PORT = process.env.PORT || 4000

// Removed legacy UnifiedFinancialDataSource and wrapper – all reports use ReportingService now

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

// AI Proxy endpoint with integrated system prompt
app.post('/api/ai/generate', async (req, res) => {
  try {
    const { prompt } = req.body
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' })
    }

    // Load EZE Ledger system prompt for CPA-level expertise
    let systemPrompt = '';
    try {
      const systemPromptPath = path.resolve(process.cwd(), 'SystemPrompt_Gemini_2.0_Flash.md');
      if (fs.existsSync(systemPromptPath)) {
        systemPrompt = fs.readFileSync(systemPromptPath, 'utf-8');
      }
    } catch (error) {
      console.warn('Could not load system prompt file for /api/ai/generate');
    }

    // Combine system prompt with user prompt
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n---\n\nUser Request:\n${prompt}` : prompt;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: fullPrompt }] }]
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

// Universal Posting Preview - Handles both expenses and invoices
app.post('/api/posting/preview', async (req, res) => {
  console.log(`🔍 POST /api/posting/preview - Universal account preview request received`);
  
  try {
    // Step 1: Validate JSON structure
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        code: 'MALFORMED_JSON',
        message: 'Request body must be valid JSON',
        details: 'Invalid or missing request body'
      });
    }

    // Step 2: Detect document type based on request data
    const documentType = detectDocumentTypeFromRequest(req.body);
    console.log(`📋 Document type detected: ${documentType}`);

    if (documentType === 'invoice') {
      // Handle invoice preview
      const invoiceData = {
        customerName: req.body.vendorName || req.body.customerName || '',
        categoryKey: req.body.categoryKey || 'OFFICE_SUPPLIES',
        amount: req.body.amount || '0.00',
        amountPaid: req.body.amountPaid || req.body.amount || '0.00',
        balanceDue: req.body.balanceDue || '0.00',
        paymentStatus: req.body.paymentStatus || 'paid',
        date: req.body.date || new Date().toISOString().split('T')[0],
        description: req.body.notes || req.body.description || ''
      };

      console.log(`💰 Invoice preview for: ${invoiceData.customerName} - $${invoiceData.amountPaid} paid on $${invoiceData.amount} invoice`);

      // Calculate amounts
      const totalInvoice = parseFloat(invoiceData.amount);
      const amountPaid = parseFloat(invoiceData.amountPaid);
      const overpaidAmount = amountPaid > totalInvoice ? amountPaid - totalInvoice : 0;

      // Get revenue account mapping
      const revenueAccountCode = PostingService.mapCategoryToRevenueAccount(invoiceData.categoryKey);
      
      // Get account details
      const cashAccount = await prisma.account.findUnique({ where: { code: '1010' } });
      const revenueAccount = await prisma.account.findUnique({ where: { code: revenueAccountCode } });
      const creditsAccount = overpaidAmount > 0 ? await prisma.account.findUnique({ where: { code: '2050' } }) : null;

      if (!cashAccount || !revenueAccount) {
        throw new Error(`Required accounts not found: Cash (1010) or Revenue (${revenueAccountCode})`);
      }

      // Return invoice preview format
      return res.json({
        documentType: 'invoice',
        dateUsed: invoiceData.date,
        policy: 'REVENUE_RECOGNITION',
        totalInvoice: totalInvoice,
        amountPaid: amountPaid,
        overpaidAmount: overpaidAmount,
        entries: [
          {
            type: 'debit',
            accountCode: '1010',
            accountName: cashAccount.name,
            amount: amountPaid,
            description: `Cash received from ${invoiceData.customerName}`
          },
          {
            type: 'credit',
            accountCode: revenueAccountCode,
            accountName: revenueAccount.name,
            amount: totalInvoice,
            description: `Revenue from ${invoiceData.customerName}`
          },
          ...(overpaidAmount > 0 && creditsAccount ? [{
            type: 'credit',
            accountCode: '2050',
            accountName: creditsAccount.name,
            amount: overpaidAmount,
            description: `Customer credit - overpaid by $${overpaidAmount.toFixed(2)}`
          }] : [])
        ]
      });

    } else {
      // Handle expense preview (enhanced for overpaid scenarios)
      const expenseData = {
        categoryKey: req.body.categoryKey || null,
        vendorName: req.body.vendorName || '',
        description: req.body.notes || req.body.description || '',
        paymentStatus: req.body.paymentStatus || 'unpaid',
        amount: req.body.amount || '0.00',
        date: req.body.date || new Date().toISOString().split('T')[0],
        datePaid: req.body.datePaid || null,
        // 🔥 CRITICAL: Include overpaid detection fields
        amountPaid: req.body.amountPaid || req.body.amount,
        balanceDue: req.body.balanceDue || '0.00'
      };

      // Check for overpaid expense scenario
      const totalExpense = parseFloat(expenseData.amount) || 0;
      const amountPaid = parseFloat(expenseData.amountPaid) || 0;
      const balanceDue = parseFloat(expenseData.balanceDue) || 0;
      const overpaidAmount = amountPaid - totalExpense;
      const isOverpaid = overpaidAmount > 0.01 || balanceDue < -0.01;

      console.log(`💸 Expense preview for: ${expenseData.vendorName} - $${expenseData.amount} (${expenseData.categoryKey || 'AUTO'})`);
      console.log(`💰 Overpaid check: Total=$${totalExpense}, Paid=$${amountPaid}, Overpaid=$${overpaidAmount}, IsOverpaid=${isOverpaid}`);

      if (isOverpaid) {
        // 🔥 ENHANCED: Handle overpaid expense with 3-line posting
        console.log(`💎 Processing overpaid expense: $${overpaidAmount.toFixed(2)} overpaid`);
        
        // Step 3a: Resolve expense account (debit)
        const resolution = await ExpenseAccountResolver.resolveExpenseAccounts(expenseData);
        
        // Step 3b: Get required accounts for overpaid scenario
        const cashAccount = await prisma.account.findFirst({ where: { code: '1010' } });
        const creditsAccount = await prisma.account.findFirst({ where: { code: '2050' } });
        
        if (!cashAccount || !creditsAccount) {
          throw new Error('Required accounts not found: Cash (1010) or Customer Credits Payable (2050)');
        }

        // Step 4: Return overpaid expense format (3-line)
        return res.json({
          documentType: 'expense',
          dateUsed: resolution.dateUsed,
          policy: resolution.policy,
          totalExpense: totalExpense,
          amountPaid: amountPaid,
          overpaidAmount: overpaidAmount,
          entries: [
            {
              type: 'debit',
              accountCode: resolution.debit.accountCode,
              accountName: resolution.debit.accountName,
              amount: totalExpense,
              description: `${resolution.debit.accountName} from ${expenseData.vendorName}`
            },
            {
              type: 'credit',
              accountCode: '1010',
              accountName: cashAccount.name,
              amount: amountPaid,
              description: `Cash paid to ${expenseData.vendorName}`
            },
            {
              type: 'debit',
              accountCode: '2050',
              accountName: creditsAccount.name,
              amount: overpaidAmount,
              description: `Prepaid/Vendor credit - overpaid by $${overpaidAmount.toFixed(2)}`
            }
          ]
        });

      } else {
        // 🔥 STANDARD: Handle normal expense with 2-line posting
        console.log(`💸 Processing standard expense`);
        
        // Step 3: Resolve accounts using unified resolver (NO DB WRITES)
        const resolution = await ExpenseAccountResolver.resolveExpenseAccounts(expenseData);
        
        console.log(`✅ Expense preview resolved: Dr ${resolution.debit.accountCode} (${resolution.debit.source}), Cr ${resolution.credit.accountCode} (${resolution.credit.source})`);

        // Step 4: Return standard expense format (2-line)
        return res.json({
          documentType: 'expense',
          dateUsed: resolution.dateUsed,
          policy: resolution.policy,
          debit: {
            accountCode: resolution.debit.accountCode,
            accountName: resolution.debit.accountName,
            amount: resolution.debit.amount,
            source: resolution.debit.source
          },
          credit: {
            accountCode: resolution.credit.accountCode,
            accountName: resolution.credit.accountName,
            amount: resolution.credit.amount,
            source: resolution.credit.source
          },
          isFallback: resolution.isFallback
        });
      }
    }

  } catch (error) {
    console.error('❌ Preview error:', error);

    // Handle missing account errors (should not create accounts)
    if (error.message.includes('not found in Chart of Accounts')) {
      return res.status(422).json({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Required account not found in Chart of Accounts',
        details: error.message
      });
    }

    // Default server error
    return res.status(500).json({
      code: 'PREVIEW_ERROR',
      message: 'Failed to preview account mapping',
      details: error.message
    });
  }
});

// Helper function to detect document type from request
function detectDocumentTypeFromRequest(requestBody) {
  const text = (requestBody.ocrText || requestBody.description || requestBody.notes || '').toLowerCase();
  const vendorName = (requestBody.vendorName || '').toLowerCase();
  
  // Strong indicators this is an invoice we're SENDING (revenue document)
  const invoiceKeywords = [
    'bill to:', 'billed to:', 'invoice date:', 'due date:', 'payment terms:',
    'revenue recognition date:', 'net 15', 'net 30', 'customer:', 'client:'
  ];
  
  // Check for invoice indicators
  const hasInvoiceKeywords = invoiceKeywords.some(keyword => text.includes(keyword));
  const hasBillTo = text.includes('bill to:') || text.includes('billed to:');
  const hasInvoiceDate = text.includes('invoice date:');
  const hasPaymentTerms = text.includes('payment terms:') || text.includes('net 15') || text.includes('net 30');
  
  // Check if this looks like an overpaid scenario (common with invoices)
  const isOverpaid = requestBody.paymentStatus === 'overpaid';
  const hasNegativeBalance = parseFloat(requestBody.balanceDue || '0') < -0.01;
  
  console.log(`📋 Document Type Analysis:`)
  console.log(`  Request data:`, JSON.stringify({
    paymentStatus: requestBody.paymentStatus,
    amount: requestBody.amount,
    amountPaid: requestBody.amountPaid,
    balanceDue: requestBody.balanceDue,
    vendorName: requestBody.vendorName
  }, null, 2))
  console.log(`  Has invoice keywords: ${hasInvoiceKeywords}`)
  console.log(`  Has "Bill To": ${hasBillTo}`)
  console.log(`  Has Invoice Date: ${hasInvoiceDate}`)
  console.log(`  Has Payment Terms: ${hasPaymentTerms}`)
  console.log(`  Is Overpaid: ${isOverpaid}`)
  console.log(`  Has Negative Balance: ${hasNegativeBalance}`)
  
  // Additional checks for strong invoice indicators
  const hasRevenueRecognition = text.includes('revenue recognition');
  const hasNet15or30 = text.includes('net 15') || text.includes('net 30') || text.includes('net15') || text.includes('net30');
  
  console.log(`  Has Revenue Recognition: ${hasRevenueRecognition}`)
  console.log(`  Has Net 15/30: ${hasNet15or30}`)
  
  // 🔥 SMARTER LOGIC: Detect if we're SENDING vs RECEIVING an invoice
  
  // Check if we're the RECIPIENT of an invoice (expense) vs SENDER (revenue)
  // Use simple string search and line-by-line parsing
  let billToCompany = '';
  
  if (text.toLowerCase().includes('bill to')) {
    const lines = text.split('\n');
    const billToLineIndex = lines.findIndex(line => 
      line.toLowerCase().includes('bill to')
    );
    
    if (billToLineIndex >= 0 && billToLineIndex + 1 < lines.length) {
      // Get the next line which should contain the company name
      const nextLine = lines[billToLineIndex + 1].trim();
      
      // Extract company name (letters and spaces only, before any dates/numbers)
      const companyMatch = nextLine.match(/^([a-zA-Z\s]+?)(?:\s+date|\s+\d|$)/i);
      if (companyMatch) {
        billToCompany = companyMatch[1]
          .replace(/\s*(date\s+of\s+service|invoice\s+date|due\s+date).*$/i, '')
          .trim()
          .toLowerCase();
      }
    }
  }
  
  // If vendor name and "Bill To" are different, we're probably the recipient
  const isInvoiceRecipient = billToCompany && billToCompany !== vendorName && billToCompany.length > 2;
  
  console.log(`  Bill To Company: "${billToCompany}"`)
  console.log(`  Vendor Name: "${vendorName}"`)
  console.log(`  Is Invoice Recipient: ${isInvoiceRecipient}`)
  
  // Decision logic - prioritize recipient detection
  const invoiceIndicators = [
    hasBillTo,
    hasInvoiceDate, 
    hasPaymentTerms,
    hasNet15or30,
    hasRevenueRecognition,
    (isOverpaid && hasNegativeBalance),
    hasInvoiceKeywords
  ];
  
  const invoiceScore = invoiceIndicators.filter(Boolean).length;
  console.log(`  Invoice indicators count: ${invoiceScore}`)
  
  if (invoiceScore >= 1) {
    if (isInvoiceRecipient) {
      console.log(`🎯 DECISION: EXPENSE (received invoice) - Bill To: "${billToCompany}" vs Vendor: "${vendorName}"`)
      return 'expense'  // We received this invoice = our expense
    } else {
      console.log(`🎯 DECISION: INVOICE (revenue document) - ${invoiceScore} indicators`)
      return 'invoice'  // We sent this invoice = our revenue
    }
  } else {
    console.log(`🎯 DECISION: EXPENSE (cost document) - ${invoiceScore} indicators`)
    return 'expense'
  }
}

// Emergency: Ensure required accounts exist for posting (quick fix for demos)
app.post('/api/setup/ensure-core-accounts', async (req, res) => {
  try {
    const coreAccounts = [
      { code: '1010', name: 'Cash and Cash Equivalents', type: 'ASSET', normalBalance: 'DEBIT' },
      { code: '2010', name: 'Accounts Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
      { code: '1350', name: 'Deposits & Advances', type: 'ASSET', normalBalance: 'DEBIT' },
      { code: '6020', name: 'Office Supplies Expense', type: 'EXPENSE', normalBalance: 'DEBIT' },
      { code: '6030', name: 'Software Subscriptions', type: 'EXPENSE', normalBalance: 'DEBIT' },
      { code: '6110', name: 'Insurance', type: 'EXPENSE', normalBalance: 'DEBIT' }
    ];

    const created = [];
    for (const a of coreAccounts) {
      const existing = await prisma.account.findUnique({ where: { code: a.code } });
      if (!existing) {
        await prisma.account.create({ data: a });
        created.push(a.code);
      }
    }

    return res.json({ success: true, created, message: created.length ? `Created accounts: ${created.join(', ')}` : 'All core accounts already exist' });
  } catch (e) {
    console.error('ensure-core-accounts error:', e);
    return res.status(500).json({ success: false, error: String(e) });
  }
});

// Expense endpoints - Phase 2: PostingEngine Integration
app.post('/api/expenses', async (req, res) => {
  console.log(`📝 POST /api/expenses - Expense posting request received`);
  
  try {
    // Step 1: Validate JSON structure
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        code: 'MALFORMED_JSON',
        message: 'Request body must be valid JSON',
        details: 'Invalid or missing request body'
      });
    }

    // Step 2: Validate canonical expense payload using PostingService
    const validation = PostingService.validateExpensePayload(req.body);
    if (!validation.isValid) {
      console.log(`❌ Validation failed:`, validation.errors);
      return res.status(422).json({
        code: 'VALIDATION_FAILED',
        message: 'Invalid expense data provided',
        details: validation.errors
      });
    }

    const expenseData = validation.normalizedData;
    console.log(`✅ Payload validated for: ${expenseData.vendorName} - $${expenseData.amount}`);

    // Step 3: Call PostingEngine to create transaction (handles idempotency internally)
    const result = await PostingService.postTransaction(expenseData);
    
    // Step 4: Success response (matches canonical format)
    console.log(`🎉 Expense posted successfully: ${result.transactionId}`);
    
    // Add legacy fields for backward compatibility if needed
    const response = {
      ...result,
      success: true,
      message: result.isExisting 
        ? `🔄 Expense already exists (idempotent): $${result.amount} for ${expenseData.vendorName}`
        : `💾 Expense posted successfully: $${result.amount} for ${expenseData.vendorName}`
    };

    return res.status(result.isExisting ? 200 : 201).json(response);

  } catch (error) {
    console.error(`❌ POST /api/expenses failed:`, error);

    // Step 5: Error handling with proper HTTP status codes
    if (error.message.includes('duplicate key') || error.message.includes('UNIQUE constraint')) {
      // Database-level duplicate detection (backup to application-level idempotency)
      return res.status(409).json({
        code: 'DUPLICATE_REFERENCE',
        message: 'Transaction with this reference already exists',
        details: error.message
      });
    }

    if (error.message.includes('Missing accounts')) {
      return res.status(422).json({
        code: 'ACCOUNTS_NOT_FOUND',
        message: 'Required accounts missing from Chart of Accounts',
        details: error.message
      });
    }

    if (error.message.includes('BALANCED JOURNAL INVARIANT')) {
      return res.status(500).json({
        code: 'ACCOUNTING_ERROR',
        message: 'Double-entry bookkeeping invariant failed',
        details: error.message
      });
    }

    // Default server error
    return res.status(500).json({
      code: 'POSTING_ENGINE_ERROR',
      message: 'Unexpected error in posting engine',
      details: error.message
    });
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

// Invoice endpoints - Phase 3: Revenue/Invoice Posting
app.post('/api/invoices', async (req, res) => {
  console.log(`💰 POST /api/invoices - Invoice posting request received`);
  
  try {
    // Step 1: Validate JSON structure
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        code: 'MALFORMED_JSON',
        message: 'Request body must be valid JSON',
        details: 'Invalid or missing request body'
      });
    }

    // Step 2: Validate invoice payload
    const validation = PostingService.validateInvoicePayload(req.body);
    if (!validation.isValid) {
      console.log(`❌ Validation failed:`, validation.errors);
      return res.status(422).json({
        code: 'VALIDATION_FAILED',
        message: 'Invalid invoice data provided',
        details: validation.errors
      });
    }

    const invoiceData = validation.normalizedData;
    console.log(`✅ Payload validated for: ${invoiceData.customerName} - $${invoiceData.amountPaid}`);

    // Step 3: Call PostingEngine to create invoice transaction
    const result = await PostingService.postInvoiceTransaction(invoiceData);
    
    // Step 4: Success response
    console.log(`🎉 Invoice posted successfully: ${result.transactionId}`);
    
    const response = {
      ...result,
      success: true,
      message: result.isExisting 
        ? `🔄 Invoice already exists (idempotent): $${result.amountPaid} from ${invoiceData.customerName}`
        : `💰 Invoice posted successfully: $${result.amountPaid} from ${invoiceData.customerName}${result.overpaidAmount > 0 ? ` (Overpaid by $${result.overpaidAmount})` : ''}`
    };

    return res.status(result.isExisting ? 200 : 201).json(response);

  } catch (error) {
    console.error(`❌ POST /api/invoices failed:`, error);

    // Step 5: Error handling with proper HTTP status codes
    if (error.message.includes('duplicate key') || error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({
        code: 'DUPLICATE_REFERENCE',
        message: 'Invoice with this reference already exists',
        details: error.message
      });
    }

    if (error.message.includes('Missing accounts')) {
      return res.status(422).json({
        code: 'ACCOUNTS_NOT_FOUND',
        message: 'Required accounts missing from Chart of Accounts',
        details: error.message
      });
    }

    if (error.message.includes('BALANCED JOURNAL INVARIANT')) {
      return res.status(500).json({
        code: 'ACCOUNTING_ERROR',
        message: 'Double-entry bookkeeping invariant failed',
        details: error.message
      });
    }

    // Default server error
    return res.status(500).json({
      code: 'INVOICE_POSTING_ERROR',
      message: 'Unexpected error in invoice posting engine',
      details: error.message
    });
  }
})

app.get('/api/invoices', async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { transaction: true },
      orderBy: { date: 'desc' }
    })
    res.json(invoices)
  } catch (error) {
    console.error('Get invoices error:', error)
    res.status(500).json({ error: 'Failed to fetch invoices' })
  }
})

// DEBUG ENDPOINT: Check last transaction entries
app.get('/api/debug/last-transaction', async (req, res) => {
  try {
    const lastTransaction = await prisma.transaction.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        entries: {
          include: {
            debitAccount: true,
            creditAccount: true
          }
        }
      }
    });
    
    if (!lastTransaction) {
      return res.json({ message: 'No transactions found' });
    }
    
    const totalDebits = lastTransaction.entries
      .filter(e => e.debitAccountId)
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const totalCredits = lastTransaction.entries
      .filter(e => e.creditAccountId)
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    res.json({
      transaction: {
        id: lastTransaction.id,
        amount: lastTransaction.amount,
        description: lastTransaction.description,
        date: lastTransaction.date
      },
      entries: lastTransaction.entries.map(entry => ({
        id: entry.id,
        amount: entry.amount,
        description: entry.description,
        debitAccount: entry.debitAccount ? `${entry.debitAccount.code} - ${entry.debitAccount.name}` : null,
        creditAccount: entry.creditAccount ? `${entry.creditAccount.code} - ${entry.creditAccount.name}` : null
      })),
      balance: {
        totalDebits: totalDebits,
        totalCredits: totalCredits,
        balanced: Math.abs(totalDebits - totalCredits) < 0.01
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Debug endpoint failed' });
  }
})

// Dashboard KPI endpoint - Phase 1: Database-driven
app.get('/api/dashboard', async (req, res) => {
  try {
    const dashboardData = await ReportingService.getDashboard()
    
    res.json({
      metrics: dashboardData.metrics,
      sparklineData: dashboardData.sparklineData,
      aiInsights: [], // Will be populated later
      healthChecks: dashboardData.healthChecks // Optional: include health status
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    res.status(500).json({ 
      error: 'Failed to fetch dashboard data', 
      details: error.message,
      // Fallback empty structure for UI compatibility
      metrics: {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        transactionCount: 0
      },
      sparklineData: [],
      aiInsights: []
    })
  }
})

// Balance Sheet Report - Phase 1: Database-driven
app.get('/api/reports/balance-sheet', async (req, res) => {
  try {
    const balanceSheetData = await ReportingService.getBalanceSheet()
    res.json(balanceSheetData)
  } catch (error) {
    console.error('Balance Sheet error:', error)
    res.status(500).json({ 
      error: 'Failed to fetch balance sheet data',
      details: error.message,
      // Fallback empty structure for UI compatibility
      asOf: new Date().toISOString().slice(0, 10),
      assets: [],
      liabilities: [],
      equity: [],
      currentAssets: [],
      nonCurrentAssets: [],
      currentLiabilities: [],
      longTermLiabilities: [],
      totals: {
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        liabilitiesAndEquity: 0,
        equationOK: false
      }
    })
  }
})

// Profit & Loss Report - Phase 1: Database-driven
app.get('/api/reports/pnl', async (req, res) => {
  try {
    const pnlData = await ReportingService.getProfitAndLoss()
    res.json(pnlData)
  } catch (error) {
    console.error('P&L report error:', error)
    res.status(500).json({ 
      error: 'Failed to fetch P&L data',
      details: error.message,
      // Fallback empty structure for UI compatibility
      period: {
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10)
      },
      revenue: [],
      expenses: [],
      cogs: [],
      operatingExpenses: [],
      totals: {
        revenue: 0,
        expenses: 0,
        cogs: 0,
        grossProfit: 0,
        operatingExpenses: 0,
        netIncome: 0,
        netProfit: 0
      }
    })
  }
})

// Trial Balance Report - Phase 1: Database-driven
app.get('/api/reports/trial-balance', async (req, res) => {
  try {
    const trialBalanceData = await ReportingService.getTrialBalance()
    
    console.log('🔍 Trial Balance - Database driven:')
    console.log('Total accounts:', trialBalanceData.summary.totalAccounts)
    console.log('Active accounts:', trialBalanceData.summary.activeAccounts)
    console.log('Debits:', trialBalanceData.totals.debit, 'Credits:', trialBalanceData.totals.credit)
    console.log('Balanced:', trialBalanceData.totals.isBalanced)
    
    res.json(trialBalanceData)
  } catch (error) {
    console.error('Trial Balance error:', error)
    res.status(500).json({ 
      error: 'Failed to fetch trial balance data',
      details: error.message,
      // Fallback empty structure for UI compatibility
      asOf: new Date().toISOString().slice(0, 10),
      rows: [],
      totals: {
        debit: 0,
        credit: 0,
        difference: 0,
        isBalanced: true
      },
      summary: {
        totalAccounts: 0,
        activeAccounts: 0,
        zeroBalanceAccounts: 0,
        totalTransactions: 0
      }
    })
  }
})

// Chart of Accounts Report - Phase 1: Database-driven
app.get('/api/reports/chart-of-accounts', async (req, res) => {
  try {
    const chartOfAccountsData = await ReportingService.getChartOfAccounts()
    res.json(chartOfAccountsData)
  } catch (error) {
    console.error('Chart of Accounts error:', error)
    res.status(500).json({ 
      error: 'Failed to fetch chart of accounts data',
      details: error.message,
      // Fallback empty structure for UI compatibility
      accounts: [],
      hierarchy: {},
      summary: {
        totalAccounts: 0,
        activeAccounts: 0,
        inactiveAccounts: 0,
        accountsByType: {
          ASSET: 0,
          LIABILITY: 0,
          EQUITY: 0,
          REVENUE: 0,
          EXPENSE: 0
        },
        totalTransactions: 0,
        accountsWithActivity: 0
      }
    })
  }
})

// Account Transactions endpoint - Get transactions for specific account
app.get('/api/accounts/:accountCode/transactions', async (req, res) => {
  try {
    const { accountCode } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    console.log(`🔍 Fetching transactions for account ${accountCode}`);
    
    // Get account details
    const account = await prisma.account.findUnique({
      where: { code: accountCode },
      select: { id: true, code: true, name: true, type: true, normalBalance: true }
    });
    
    if (!account) {
      return res.status(404).json({ error: `Account ${accountCode} not found` });
    }
    
    // Get all transaction entries for this account (both debit and credit)
    const entries = await prisma.transactionEntry.findMany({
      where: {
        OR: [
          { debitAccountId: account.id },
          { creditAccountId: account.id }
        ]
      },
      include: {
        transaction: {
          select: {
            id: true,
            date: true,
            description: true,
            reference: true,
            amount: true
          }
        },
        debitAccount: {
          select: { code: true, name: true }
        },
        creditAccount: {
          select: { code: true, name: true }
        }
      },
      orderBy: {
        transaction: {
          date: 'desc'
        }
      },
      take: limit
    });
    
    // Transform entries to transaction format with running balance
    let runningBalance = 0;
    const transactions = [];
    
    // Calculate current balance first (we need to go through all entries)
    const allEntries = await prisma.transactionEntry.findMany({
      where: {
        OR: [
          { debitAccountId: account.id },
          { creditAccountId: account.id }
        ]
      },
      include: {
        transaction: {
          select: { date: true }
        }
      },
      orderBy: {
        transaction: {
          date: 'asc'
        }
      }
    });
    
    // Calculate final balance
    for (const entry of allEntries) {
      if (entry.debitAccountId === account.id) {
        runningBalance += parseFloat(entry.amount);
      } else {
        runningBalance -= parseFloat(entry.amount);
      }
    }
    
    // For normal balance calculation
    let displayBalance = runningBalance;
    if (account.normalBalance === 'CREDIT') {
      displayBalance = -runningBalance; // Flip sign for credit normal accounts
    }
    
    // Process entries in reverse chronological order for display
    let tempBalance = displayBalance;
    for (const entry of entries) {
      const isDebit = entry.debitAccountId === account.id;
      const amount = parseFloat(entry.amount);
      
      // Determine transaction type and amount for this account
      const transactionType = isDebit ? 'debit' : 'credit';
      
      transactions.push({
        id: entry.transaction.id,
        date: entry.transaction.date.toISOString(),
        description: entry.description || entry.transaction.description,
        amount: amount,
        type: transactionType,
        balance: tempBalance,
        reference: entry.transaction.reference,
        debitAmount: isDebit ? amount : 0,
        creditAmount: isDebit ? 0 : amount
      });
      
      // Calculate previous balance (going backwards in time)
      if (account.normalBalance === 'DEBIT') {
        tempBalance -= isDebit ? amount : -amount;
      } else {
        tempBalance -= isDebit ? -amount : amount;
      }
    }
    
    // Calculate totals
    const totalDebits = transactions.reduce((sum, t) => sum + t.debitAmount, 0);
    const totalCredits = transactions.reduce((sum, t) => sum + t.creditAmount, 0);
    const netChange = account.normalBalance === 'DEBIT' 
      ? totalDebits - totalCredits 
      : totalCredits - totalDebits;
    
    res.json({
      account: {
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
        currentBalance: displayBalance
      },
      transactions,
      summary: {
        totalTransactions: transactions.length,
        totalDebits: totalDebits,
        totalCredits: totalCredits,
        netChange: netChange,
        currentBalance: displayBalance
      }
    });
    
  } catch (error) {
    console.error(`❌ Error fetching account transactions:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch account transactions',
      details: error.message 
    });
  }
})

// Customer/Client Management Endpoints - Phase 3: Client Integration
app.get('/api/customers', async (req, res) => {
  console.log('👥 GET /api/customers - Fetching all customers');
  
  try {
    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            status: true,
            date: true
          }
        }
      }
    });

    console.log(`✅ Found ${customers.length} active customers`);
    
    res.json({
      success: true,
      customers: customers
    });

  } catch (error) {
    console.error('❌ GET /api/customers failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customers',
      details: error.message
    });
  }
});

app.post('/api/customers', async (req, res) => {
  console.log('👥 POST /api/customers - Creating new customer');
  
  try {
    const { name, company, email, phone, address, city, state, zipCode, notes } = req.body;

    // Validation
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required'
      });
    }

    // Check for duplicate email
    const existingCustomer = await prisma.customer.findUnique({
      where: { email: email }
    });

    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        error: 'Customer with this email already exists'
      });
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        company: company?.trim() || null,
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        zipCode: zipCode?.trim() || null,
        notes: notes?.trim() || null
      }
    });

    console.log(`✅ Customer created: ${customer.name} (${customer.email})`);
    
    res.status(201).json({
      success: true,
      customer: customer,
      message: `Customer ${customer.name} created successfully`
    });

  } catch (error) {
    console.error('❌ POST /api/customers failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create customer',
      details: error.message
    });
  }
});

// PUT /api/customers/:id - Update existing customer
app.put('/api/customers/:id', async (req, res) => {
  console.log('✏️ PUT /api/customers/:id - Updating customer', req.params.id);
  
  try {
    const customerId = req.params.id;
    const { name, company, email, phone, address, city, state, zipCode, country, notes } = req.body;

    // Validation
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required fields'
      });
    }

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Check for duplicate email (excluding current customer)
    const duplicateEmail = await prisma.customer.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        id: { not: customerId }
      }
    });

    if (duplicateEmail) {
      return res.status(409).json({
        success: false,
        error: 'A customer with this email address already exists'
      });
    }

    // Update customer
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        name: name.trim(),
        company: company?.trim() || null,
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        zipCode: zipCode?.trim() || null,
        country: country?.trim() || 'USA',
        notes: notes?.trim() || null,
        updatedAt: new Date()
      }
    });

    console.log(`✅ Customer updated: ${customer.name} (${customer.email})`);

    res.json({
      success: true,
      customer: customer,
      message: `Customer ${customer.name} updated successfully`
    });

  } catch (error) {
    console.error('❌ PUT /api/customers/:id failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update customer',
      details: error.message
    });
  }
});

// Health Check Endpoint - Phase 1: Accounting Integrity Validation
app.get('/api/health', async (req, res) => {
  try {
    const healthStatus = await ReportingService.healthCheck()
    res.json(healthStatus)
  } catch (error) {
    console.error('Health check error:', error)
    res.status(500).json({
      status: 'ERROR',
      issues: [{
        type: 'SYSTEM_ERROR',
        message: error.message,
        severity: 'CRITICAL'
      }]
    })
  }
})

async function processAIChat(message, context = {}) {
  try {
    // Get dashboard metrics from ReportingService as AI context
    const dashboardData = await ReportingService.getDashboard()
    const financialData = dashboardData.metrics  // 🔧 FIX: Extract metrics from dashboard data
    
    // 🔧 FIX: Add safety check for missing financial data
    if (!financialData) {
      console.warn('⚠️ No financial data available for AI chat context')
      return { content: 'I can help you with accounting questions, but I need some financial data first. Try adding a few transactions and ask me again!', action: null }
    }
    
    const systemPrompt = `You are an AI accounting assistant for EZE Ledger, a cutting-edge AI-first accounting platform. You're helpful, friendly, and knowledgeable about financial matters.

When users ask you to create transactions, respond in natural, conversational language and also provide the action for processing.

CURRENT FINANCIAL DATA (use this real data in your responses):
- Total Revenue: $${financialData.totalRevenue.toLocaleString()}
- Total Expenses: $${financialData.totalExpenses.toLocaleString()}
- Net Profit: $${financialData.netProfit.toLocaleString()}
- Transaction Count: ${financialData.transactionCount}
- Total Assets: $${financialData.totalAssets.toLocaleString()}
- Total Liabilities: $${financialData.totalLiabilities.toLocaleString()}
- Total Equity: $${financialData.totalEquity.toLocaleString()}

RECENT ACTIVITY SUMMARY:
Your business shows total expenses of $${financialData.totalExpenses.toLocaleString()} and revenue of $${financialData.totalRevenue.toLocaleString()}, resulting in a ${financialData.netProfit >= 0 ? 'profit' : 'loss'} of $${Math.abs(financialData.netProfit).toLocaleString()}.

Current financial position: $${financialData.totalAssets.toLocaleString()} in assets, $${financialData.totalLiabilities.toLocaleString()} in liabilities.

Examples:
User: "Add a $200 software expense for Adobe"
Response: "✅ **Perfect!** I've added a $200 software expense for Adobe to your records. This will be categorized under Software expenses and posted to your expense account."

User: "How's my cash flow looking?" or "What's my profit this month?"
Response: "Based on your current data, you have $${financialData.totalRevenue.toLocaleString()} in revenue and $${financialData.totalExpenses.toLocaleString()} in expenses, resulting in a ${financialData.netProfit >= 0 ? 'net profit' : 'net loss'} of $${Math.abs(financialData.netProfit).toLocaleString()}. ${financialData.netProfit < 0 ? "I'd recommend reviewing your largest expense categories to identify potential cost savings." : "Great performance this month!"}"

Available actions (only include if user wants to create something):
- createExpense(vendor, amount, category, date, description)
- createInvoice(customer, amount, description, dueDate)
- getFinancialSummary()

Context: ${JSON.stringify(context)}
User message: ${message}

Respond naturally and conversationally using the REAL financial data above. If creating a transaction, include the ACTION at the end in this format:
ACTION: actionName(parameters)`

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

// Revenue Transaction endpoint - Record customer payments and revenue
app.post('/api/transactions/revenue', async (req, res) => {
  try {
    const { 
      customer, 
      amount, 
      date, 
      revenueAccount = '4020', 
      cashAccount = '1010', 
      description, 
      paymentMethod = 'CASH',
      invoiceNumber,
      reference
    } = req.body;

    console.log('💰 Creating revenue transaction:', { customer, amount, revenueAccount, cashAccount });

    // Validation
    if (!customer || !amount || !description) {
      return res.status(400).json({ 
        error: 'Customer, amount, and description are required' 
      });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ 
        error: 'Amount must be greater than zero' 
      });
    }

    // Create revenue transaction
    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(date),
        description: description,
        reference: reference || `REV-${Date.now()}`,
        amount: parseFloat(amount),
        customFields: { 
          type: 'revenue',
          customer,
          paymentMethod,
          invoiceNumber
        }
      }
    });

    // Get account IDs
    const cashAcc = await prisma.account.findUnique({ where: { code: cashAccount } });
    const revenueAcc = await prisma.account.findUnique({ where: { code: revenueAccount } });
    
    if (!cashAcc || !revenueAcc) {
      throw new Error(`Required accounts not found. Cash: ${cashAccount}, Revenue: ${revenueAccount}`);
    }

    // Create double-entry: Cash (DR) = Revenue (CR)
    await prisma.transactionEntry.create({
      data: {
        transactionId: transaction.id,
        debitAccountId: cashAcc.id,
        creditAccountId: null,
        amount: parseFloat(amount),
        description: `Revenue from ${customer}`,
      }
    });

    await prisma.transactionEntry.create({
      data: {
        transactionId: transaction.id,
        debitAccountId: null,
        creditAccountId: revenueAcc.id,
        amount: parseFloat(amount),
        description: `Revenue from ${customer}`,
      }
    });

    res.json({ 
      success: true, 
      message: `Revenue of $${amount} from ${customer} recorded successfully`,
      transactionId: transaction.id,
      journalEntries: [
        { account: cashAcc.name, type: 'DEBIT', amount: parseFloat(amount) },
        { account: revenueAcc.name, type: 'CREDIT', amount: parseFloat(amount) }
      ]
    });

  } catch (error) {
    console.error('Revenue transaction error:', error);
    res.status(500).json({ 
      error: 'Failed to record revenue transaction',
      details: error.message 
    });
  }
});

// Capital Contribution endpoint - Record owner investments
app.post('/api/transactions/capital', async (req, res) => {
  try {
    const { 
      contributor, 
      amount, 
      date, 
      contributionType = 'CASH',
      debitAccount = '1010', 
      equityAccount = '3000', 
      description, 
      reference,
      notes
    } = req.body;

    console.log('🏛️ Creating capital contribution:', { contributor, amount, debitAccount, equityAccount });

    // Validation
    if (!contributor || !amount || !description) {
      return res.status(400).json({ 
        error: 'Contributor, amount, and description are required' 
      });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ 
        error: 'Amount must be greater than zero' 
      });
    }

    // Create capital contribution transaction
    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(date),
        description: description,
        reference: reference || `CAP-${Date.now()}`,
        amount: parseFloat(amount),
        customFields: { 
          type: 'capital',
          contributor,
          contributionType,
          notes
        }
      }
    });

    // Get account IDs
    const debitAcc = await prisma.account.findUnique({ where: { code: debitAccount } });
    const equityAcc = await prisma.account.findUnique({ where: { code: equityAccount } });
    
    if (!debitAcc || !equityAcc) {
      throw new Error(`Required accounts not found. Asset: ${debitAccount}, Equity: ${equityAccount}`);
    }

    // Create double-entry: Asset (DR) = Owner's Equity (CR)
    await prisma.transactionEntry.create({
      data: {
        transactionId: transaction.id,
        debitAccountId: debitAcc.id,
        creditAccountId: null,
        amount: parseFloat(amount),
        description: `Capital contribution from ${contributor}`,
      }
    });

    await prisma.transactionEntry.create({
      data: {
        transactionId: transaction.id,
        debitAccountId: null,
        creditAccountId: equityAcc.id,
        amount: parseFloat(amount),
        description: `Capital contribution from ${contributor}`,
      }
    });

    res.json({ 
      success: true, 
      message: `Capital contribution of $${amount} from ${contributor} recorded successfully`,
      transactionId: transaction.id,
      journalEntries: [
        { account: debitAcc.name, type: 'DEBIT', amount: parseFloat(amount) },
        { account: equityAcc.name, type: 'CREDIT', amount: parseFloat(amount) }
      ]
    });

  } catch (error) {
    console.error('Capital contribution error:', error);
    res.status(500).json({ 
      error: 'Failed to record capital contribution',
      details: error.message 
    });
  }
});

// Setup endpoints for initial capital and sample revenue
app.post('/api/setup/initial-capital', async (req, res) => {
  try {
    const { amount = 10000, reference = 'INITIAL-CAPITAL' } = req.body;
    
    // Create initial capital transaction
    const transaction = await prisma.transaction.create({
      data: {
        date: new Date('2025-01-01'),
        description: 'Initial Owner Investment',
        reference: reference,
        amount: parseFloat(amount),
        customFields: { type: 'initial_capital' }
      }
    });

    // Get account IDs
    const cashAccount = await prisma.account.findUnique({ where: { code: '1010' } }); // Cash
    const equityAccount = await prisma.account.findUnique({ where: { code: '3000' } }); // Owner's Equity
    
    if (!cashAccount || !equityAccount) {
      throw new Error('Required accounts not found');
    }

    // Create journal entries: Cash (DR) = Owner's Equity (CR)
    await prisma.transactionEntry.create({
      data: {
        transactionId: transaction.id,
        debitAccountId: cashAccount.id,
        creditAccountId: null,
        amount: parseFloat(amount),
        description: 'Initial capital investment'
      }
    });

    await prisma.transactionEntry.create({
      data: {
        transactionId: transaction.id,
        debitAccountId: null,
        creditAccountId: equityAccount.id,
        amount: parseFloat(amount),
        description: 'Initial capital investment'
      }
    });

    res.json({ 
      success: true, 
      message: `Initial capital of $${amount} added successfully`,
      transactionId: transaction.id 
    });
  } catch (error) {
    console.error('Initial capital error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/setup/sample-revenue', async (req, res) => {
  try {
    const { amount = 5000, reference = 'SAMPLE-REVENUE' } = req.body;
    
    // Create revenue transaction
    const transaction = await prisma.transaction.create({
      data: {
        date: new Date('2025-01-15'),
        description: 'Sample Revenue - Web Development Services',
        reference: reference,
        amount: parseFloat(amount),
        customFields: { type: 'sample_revenue' }
      }
    });

    // Get account IDs
    const cashAccount = await prisma.account.findUnique({ where: { code: '1010' } }); // Cash
    const revenueAccount = await prisma.account.findUnique({ where: { code: '4020' } }); // Services Revenue
    
    if (!cashAccount || !revenueAccount) {
      throw new Error('Required accounts not found');
    }

    // Create journal entries: Cash (DR) = Revenue (CR)
    await prisma.transactionEntry.create({
      data: {
        transactionId: transaction.id,
        debitAccountId: cashAccount.id,
        creditAccountId: null,
        amount: parseFloat(amount),
        description: 'Web development services revenue'
      }
    });

    await prisma.transactionEntry.create({
      data: {
        transactionId: transaction.id,
        debitAccountId: null,
        creditAccountId: revenueAccount.id,
        amount: parseFloat(amount),
        description: 'Web development services revenue'
      }
    });

    res.json({ 
      success: true, 
      message: `Sample revenue of $${amount} added successfully`,
      transactionId: transaction.id 
    });
  } catch (error) {
    console.error('Sample revenue error:', error);
    res.status(500).json({ error: error.message });
  }
});

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
      const transaction = await prisma.transaction.create({ data: { date, description: `Expense: ${vendor}`, amount, reference: `DEMO-EXP-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}` } })
      await prisma.expense.create({ data: { transactionId: transaction.id, vendor, categoryKey: category, date, amount, description: `Payment to ${vendor}` } })
    }
    for (let i = 0; i < 5; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)]
      const amount = Math.round((Math.random() * 2000 + 500) * 100) / 100
      const date = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      const transaction = await prisma.transaction.create({ data: { date, description: `Invoice: ${customer}`, amount, reference: `DEMO-INV-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}` } })
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