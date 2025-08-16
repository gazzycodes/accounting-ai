import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createWorker } from 'tesseract.js'
import Lottie from 'react-lottie-player'
import { FinancialDataService } from '../services/financialDataService'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import ExpenseForm from './ExpenseForm'
import AiSuggestionButton from './AiSuggestionButton'

interface AiImportModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ExtractedField {
  name: string
  value: string
  confidence: number
}

// Suggestion type passed to ExpenseForm
type SuggestionType = 'text' | 'number' | 'currency' | 'date' | 'dropdown'
interface AiSuggestion {
  name: string
  type: SuggestionType
  confidence?: number
  value?: string
  options?: string[]
}

const AiImportModal = ({ isOpen, onClose }: AiImportModalProps) => {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([])
  const [customFields, setCustomFields] = useState<ExtractedField[]>([])
  const [isFieldAnimating, setIsFieldAnimating] = useState(false)
  const [extractedExpenseData, setExtractedExpenseData] = useState<{
    vendor: string; 
    amount: string; 
    date: string; 
    category: string; 
    description: string; 
    paymentStatus: 'paid' | 'invoice' | 'overpaid' | 'partial';
    // 🔥 CRITICAL: Include overpaid detection fields
    amountPaid?: string;
    balanceDue?: string;
    invoiceNumber?: string;
    dueDate?: string;
    recurring?: boolean;
    overdue?: boolean;
    docType?: 'invoice' | 'receipt' | 'statement';
  } | null>(null)
  const [extractedText, setExtractedText] = useState<string>('')
  const [stage, setStage] = useState<'picker' | 'form'>('picker')
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([])
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [suggestionError, setSuggestionError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add QueryClient for cache invalidation
  const queryClient = useQueryClient()

  // Default fields to extract
  const defaultFields = [
    { name: 'vendor', label: 'Vendor/Company', placeholder: 'e.g., Adobe Systems' },
    { name: 'amount', label: 'Amount', placeholder: 'e.g., 299.99' },
    { name: 'date', label: 'Date', placeholder: 'e.g., 2024-01-15' },
    { name: 'description', label: 'Description', placeholder: 'e.g., Software subscription' },
    { name: 'category', label: 'Category', placeholder: 'e.g., SOFTWARE' },
    { name: 'invoiceNumber', label: 'Invoice Number', placeholder: 'e.g., INV-2024-001' },
  ]

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFileSelection(files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0])
    }
  }

  const handleFileSelection = (file: File) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/jpg',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

    if (!allowedTypes.includes(file.type)) {
      alert('Please select a valid file type (JPG, PNG, PDF, DOCX, XLSX)')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }

    setSelectedFile(file)
  }

  const processDocument = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setOcrProgress(0)
    setErrorMsg('')
    setSuggestionError('')

    try {
      // Step 1: OCR Processing (for images)
      let ocrText = ''
      
      if (selectedFile.type.startsWith('image/')) {
        const worker = await createWorker('eng')
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/$@#%-:() ',
        })
        const { data } = await worker.recognize(selectedFile)
        setOcrProgress(50)
        ocrText = data.text
        setExtractedText(data.text)
        await worker.terminate()
      } else {
        const formData = new FormData()
        formData.append('file', selectedFile)
        const uploadResponse = await axios.post('/api/ocr', formData)
        ocrText = uploadResponse.data?.extractedText || `Document uploaded: ${uploadResponse.data.originalName}`
        setExtractedText(ocrText)
        setOcrProgress(50)
      }

      // Step 2: AI Processing with Gemini - Enhanced Payment Status Detection
      setOcrProgress(75)
      const aiPrompt = `You are an expert accountant analyzing document text. Extract expense information and determine payment status with high precision.

DOCUMENT TEXT:
"${ocrText}"

REQUIRED OUTPUT: JSON format only with these exact fields:
{
  "vendor": "Company name (clean, no extra text)",
  "amount": "Total amount as number only (no currency symbols)", 
  "amountPaid": "Amount paid as number only or null",
  "balanceDue": "Balance due as number only or null",
  "date": "Date in YYYY-MM-DD format",
  "dueDate": "Due date in YYYY-MM-DD format if present",
  "description": "Brief description of purchase",
  "category": "One of: SOFTWARE, OFFICE_SUPPLIES, TRAVEL, MEALS, UTILITIES, RENT, PROFESSIONAL_SERVICES, MARKETING, EQUIPMENT, INSURANCE, LEGAL, TRAINING, ENTERTAINMENT, TELECOMMUNICATIONS, PHONE, INTERNET, BANK_FEES, SALARIES, SUBSCRIPTIONS, SUPPLIES, INVENTORY, DEPOSITS, OTHER",
  "invoiceNumber": "Invoice/receipt number if available",
  "docType": "invoice | receipt | statement",
  "recurring": "true | false",
  "overdue": "true | false",
  "paymentStatus": "CRITICAL ANALYSIS REQUIRED - See rules below"
}

🎯 PAYMENT STATUS DETECTION - NUMERICAL EVIDENCE OVERRIDES TEXT:

⚠️ CRITICAL: NUMERICAL EVIDENCE ALWAYS WINS OVER TEXT KEYWORDS ⚠️

STEP 1: NUMERICAL EVIDENCE (ABSOLUTE PRIORITY - OVERRIDES ALL TEXT)
- Extract: "Total Amount", "Amount Paid", "Balance Due", "Amount Due", "Outstanding"
- RULE: If Balance Due = $0.00 OR Amount Paid = Total Amount → ALWAYS "paid" (ignore conflicting text)
- RULE: If Amount Paid > Total Amount → ALWAYS "overpaid" (ignore conflicting text)
- RULE: If 0 < Amount Paid < Total AND Balance Due > $5 → "partial" 
- RULE: If Balance Due > $5.00 AND no payment shown → "invoice"

⚠️ IGNORE TEXT KEYWORDS IF NUMBERS CONTRADICT THEM ⚠️
Example: Text says "partial payment" but Balance Due = $0.00 → RESULT = "paid" (not partial)
Example: Text says "unpaid" but Amount Paid = Total → RESULT = "paid" (not invoice)

STEP 2: TEXT KEYWORDS (ONLY IF NO CLEAR NUMERICAL EVIDENCE)
🟢 PAID indicators: "PAID", "Receipt", "Payment Complete", "Thank you", "Transaction Successful", "Confirmation #", "Card ending in", "Payment Processed", "Date Paid", "Amount Paid", "Paid in Full"
🔴 UNPAID indicators: "Invoice", "Bill To", "Due Date", "Net 30", "Payment Due", "Please Remit", "Unpaid", "Outstanding Balance", "Remit Payment"
💎 OVERPAID indicators: "Overpaid", "Credit Balance", "Refund Due", "Excess Payment"
📊 PARTIAL indicators: "Partial Payment", "Payment on Account", "Balance Remaining"

STEP 3: DOCUMENT TYPE (ONLY IF NO NUMBERS OR KEYWORDS)
- Receipt/Purchase → usually "paid"
- Invoice/Bill → usually "invoice"

RETURN OPTIONS: "paid", "invoice", "overpaid", "partial"
DEFAULT: If unclear → "invoice" (safer for accounting)

Return ONLY valid JSON. No explanations.`

      let extractedData:
        | {
            vendor: string
            amount: string
            amountPaid?: string
            balanceDue?: string
            date: string
            dueDate?: string
            description: string
            category: string
            invoiceNumber?: string
            paymentStatus?: string
            docType?: string
            recurring?: boolean | string
            overdue?: boolean | string
          }
        | null = null

      try {
        const aiResponse = await axios.post('/api/ai/generate', { prompt: aiPrompt })
        const jsonMatch = aiResponse.data.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No valid JSON found in AI response')
        }
      } catch (e: any) {
        const details = e?.response?.data?.details || e?.message || 'Unknown error'
        setErrorMsg(`🚨 Unable to contact AI service. ${details}. Please check your API key or network and try again.`)
        return // Do not advance to Stage 2
      }

      // Build fields and expense from real AI output
      const fields: ExtractedField[] = Object.entries(extractedData!).map(([key, value]) => ({
        name: key,
        value: String(value || ''),
        confidence: 0.85
      }))

      setExtractedFields(fields)
      
      // 🤖 AI-FIRST DETECTION with Custom Logic Fallback
      console.log('🤖 AI-FIRST PAYMENT DETECTION - STARTING ANALYSIS')
      console.log('=================================================')
      console.log('📄 FULL OCR TEXT (First 1000 chars):')
      console.log(ocrText.substring(0, 1000))
      console.log('=================================================')
      console.log('🧠 AI GEMINI DETECTED:', extractedData?.paymentStatus)
      
      // Use AI result as primary, with validation
      let finalPaymentStatus = extractedData?.paymentStatus
      
      // Validate AI result - fallback to custom logic if AI gives invalid result
      const validStatuses = ['paid', 'invoice', 'overpaid', 'partial']
      if (!finalPaymentStatus || !validStatuses.includes(finalPaymentStatus)) {
        console.log('⚠️ AI returned invalid status, using custom fallback detection')
        finalPaymentStatus = detectPaymentStatus(ocrText)
      } else {
        console.log('✅ AI STATUS ACCEPTED:', finalPaymentStatus)
      }
      
      // Optional: Cross-check with custom logic for debugging
      const customDetectedStatus = detectPaymentStatus(ocrText)
      if (finalPaymentStatus !== customDetectedStatus) {
        console.log('🔍 COMPARISON - AI vs Custom:')
        console.log('   AI Result:', finalPaymentStatus)
        console.log('   Custom Result:', customDetectedStatus)
        console.log('   Using AI Result ✅')
      }
      
      console.log('🎯 FINAL STATUS (AI-First):', finalPaymentStatus)
      console.log('=====================================')
      
      // Also test with our quick test pattern to compare
      if (ocrText.toLowerCase().includes('overpaid') || ocrText.toLowerCase().includes('balance due') || ocrText.toLowerCase().includes('amount paid')) {
        console.log('🔍 INVOICE CONTAINS RELEVANT KEYWORDS - Should detect overpaid/partial/paid')
        console.log('Looking for: overpaid, balance due, amount paid, credit balance')
        const keywords = ['overpaid', 'balance due', 'amount paid', 'credit balance', 'customer credit']
        keywords.forEach(keyword => {
          if (ocrText.toLowerCase().includes(keyword)) {
            console.log(`✅ Found keyword: "${keyword}"`)
          }
        })
      } else {
        console.log('❌ INVOICE MISSING KEY FINANCIAL KEYWORDS - OCR might be poor quality')
      }
      
      // 🔥 CALCULATE BALANCE DUE MANUALLY from extracted amounts
      const totalAmount = parseFloat(extractedData!.amount) || 0;
      const amountPaidNum = parseFloat(extractedData!.amountPaid || '0') || 0;
      const calculatedBalanceDue = totalAmount - amountPaidNum;
      
      console.log(`💰 AMOUNT CALCULATION:`)
      console.log(`  Total: $${totalAmount}`)
      console.log(`  Amount Paid: $${amountPaidNum}`)
      console.log(`  Calculated Balance Due: $${calculatedBalanceDue}`)
      
      setExtractedExpenseData({
        vendor: extractedData!.vendor || '',
        amount: extractedData!.amount || '',
        date: extractedData!.date || new Date().toISOString().split('T')[0],
        category: extractedData!.category || 'OTHER',
        description: extractedData!.description || '',
        paymentStatus: finalPaymentStatus as 'paid' | 'invoice' | 'overpaid' | 'partial', // 🤖 AI-First Detection Result!
        // 🔥 CRITICAL: Properly extract and calculate payment amounts for overpaid detection
        amountPaid: extractedData!.amountPaid || undefined,
        balanceDue: calculatedBalanceDue !== 0 ? calculatedBalanceDue.toString() : undefined,
        invoiceNumber: extractedData!.invoiceNumber || undefined,
        dueDate: extractedData!.dueDate || undefined,
        recurring: typeof extractedData!.recurring === 'string' ? extractedData!.recurring === 'true' : !!extractedData!.recurring,
        overdue: typeof extractedData!.overdue === 'string' ? extractedData!.overdue === 'true' : !!extractedData!.overdue,
        docType: extractedData!.docType as 'invoice' | 'receipt' | 'statement' | undefined
      })

      // Step 3: Fetch AI Suggestions (custom fields)
      try {
        const sugPrompt = `You are assisting with expense data entry. Based on the following OCR/document text, suggest the top 2-4 additional fields that would be helpful to capture.\nRequirements:\n- Confidence must be >= 0.70\n- Each suggestion must include: name, type, confidence, and options (only if type is dropdown) and optional default value\n- Allowed types: text, number, currency, date, dropdown\n- For dropdowns, if appropriate, use one of: Status [Paid, Pending, Overdue], Priority [High, Medium, Low], Payment Method [Credit Card, Cash, Bank Transfer, ACH, Other]\n- Do NOT include fields already present by default (vendor, amount, date, category, description)\nReturn ONLY a JSON array of objects: [{ name, type, confidence, value?, options? }].\n\nText:\n${ocrText}`
        const sugRes = await axios.post('/api/ai/generate', { prompt: sugPrompt })
        const text = sugRes.data?.content || ''
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        const parsed: AiSuggestion[] = jsonMatch ? JSON.parse(jsonMatch[0]) : []
        const cleaned = (parsed || [])
          .filter(s => (s.confidence ?? 0) >= 0.7)
          .slice(0, 4)
        setAiSuggestions(cleaned)
      } catch (e: any) {
        const details = e?.response?.data?.details || e?.message
        setSuggestionError(`⚠️ Unable to fetch AI suggestions. ${details || ''}`)
        setAiSuggestions([])
      }

      // Step 4: Move to form stage and animate
      setStage('form')
      setIsFieldAnimating(true)
      animateFieldPopulation(fields)

      setOcrProgress(100)
    } catch (error) {
      const msg = (error as any)?.message || 'Unexpected error'
      setErrorMsg(`🚨 Processing failed: ${msg}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const animateFieldPopulation = (fields: ExtractedField[]) => {
    fields.forEach((_, index) => {
      setTimeout(() => {
        const fieldElement = document.getElementById(`field-${index}`)
        if (fieldElement) {
          fieldElement.classList.add('typewriter')
        }
      }, index * 300)
    })
    setTimeout(() => {
      setIsFieldAnimating(false)
    }, fields.length * 300 + 1000)
  }

  const addCustomField = () => {
    const newField: ExtractedField = {
      name: `custom_${Date.now()}`,
      value: '',
      confidence: 1.0
    }
    setCustomFields([...customFields, newField])
  }

  // For removing a consumed suggestion (when clicked in the form)
  const handleConsumeSuggestion = (name: string) => {
    setAiSuggestions(prev => prev.filter(s => s.name.toLowerCase() !== name.toLowerCase()))
  }

  const updateFieldValue = (fieldName: string, value: string, isCustom = false) => {
    if (isCustom) {
      setCustomFields(customFields.map(field => 
        field.name === fieldName ? { ...field, value } : field
      ))
    } else {
      setExtractedFields(extractedFields.map(field => 
        field.name === fieldName ? { ...field, value } : field
      ))
    }
  }

  // Document type detection: Invoice (revenue) vs Expense
  const detectDocumentType = (ocrText: string, expenseData: any): 'invoice' | 'expense' => {
    const text = ocrText.toLowerCase()
    
    // Strong indicators this is an invoice we're SENDING (revenue document)
    const invoiceKeywords = [
      'bill to:', 'billed to:', 'customer:', 'client:',
      'invoice date:', 'due date:', 'payment terms:',
      'revenue recognition date:', 'terms:', 'net 15', 'net 30'
    ]
    
    // Strong indicators this is an expense we're PAYING
    const expenseKeywords = [
      'remit to:', 'pay to:', 'vendor:', 'supplier:',
      'amount due:', 'please pay:', 'payment due'
    ]
    
    // Count keyword matches
    const invoiceScore = invoiceKeywords.reduce((score, keyword) => 
      score + (text.includes(keyword) ? 1 : 0), 0)
    const expenseScore = expenseKeywords.reduce((score, keyword) => 
      score + (text.includes(keyword) ? 1 : 0), 0)
    
    // Check for specific indicators
    const hasBillTo = text.includes('bill to:') || text.includes('billed to:')
    const hasInvoiceDate = text.includes('invoice date:')
    const hasPaymentTerms = text.includes('payment terms:') || text.includes('net 15') || text.includes('net 30')
    
    console.log('📋 Document Type Analysis:')
    console.log('  Invoice keywords found:', invoiceScore, invoiceKeywords.filter(k => text.includes(k)))
    console.log('  Expense keywords found:', expenseScore, expenseKeywords.filter(k => text.includes(k)))
    console.log('  Has "Bill To":', hasBillTo)
    console.log('  Has Invoice Date:', hasInvoiceDate)
    console.log('  Has Payment Terms:', hasPaymentTerms)
    
    // Decision logic
    if (hasBillTo || (invoiceScore >= 2) || (hasInvoiceDate && hasPaymentTerms)) {
      console.log('🎯 DECISION: INVOICE (revenue document)')
      return 'invoice'
    } else {
      console.log('🎯 DECISION: EXPENSE (cost document)')
      return 'expense'
    }
  }

  const saveTransaction = async () => {
    const allFields = [...extractedFields, ...customFields]
    const transactionData = allFields.reduce((acc, field) => {
      acc[field.name] = field.value
      return acc
    }, {} as Record<string, string>)

    try {
      // Detect document type: Invoice (revenue) vs Expense
      const documentType = detectDocumentType(extractedText, extractedExpenseData)
      console.log('📋 Document type detected:', documentType)

      let result;
      
      if (documentType === 'invoice') {
        // This is an invoice we're sending (revenue transaction)
        console.log('💰 Processing as INVOICE (revenue) - money coming in')
        result = await FinancialDataService.addInvoiceTransaction({
          customerName: transactionData.vendor || 'Unknown Customer',
          category: transactionData.category || 'OTHER',
          date: transactionData.date || new Date().toISOString().split('T')[0],
          amount: parseFloat(transactionData.amount) || 0,
          description: transactionData.description || 'Invoice imported via AI',
          receiptUrl: selectedFile?.name,
          paymentStatus: extractedExpenseData?.paymentStatus || 'paid',
          amountPaid: extractedExpenseData?.amountPaid ? parseFloat(extractedExpenseData.amountPaid) : undefined,
          balanceDue: extractedExpenseData?.balanceDue ? parseFloat(extractedExpenseData.balanceDue) : undefined,
          invoiceNumber: extractedExpenseData?.invoiceNumber,
          dueDate: extractedExpenseData?.dueDate,
          recurring: extractedExpenseData?.recurring,
          overdue: extractedExpenseData?.overdue
        })
      } else {
        // This is an expense we need to pay (expense transaction)
        console.log('💸 Processing as EXPENSE - money going out')
        result = await FinancialDataService.addExpenseTransaction({
          vendor: transactionData.vendor || 'Unknown Vendor',
          category: transactionData.category || 'OTHER',
          date: transactionData.date || new Date().toISOString().split('T')[0],
          amount: parseFloat(transactionData.amount) || 0,
          description: transactionData.description || 'Expense imported via AI',
          receiptUrl: selectedFile?.name,
          paymentStatus: extractedExpenseData?.paymentStatus || 'paid', // 🔥 CRITICAL FIX: Use AI-detected payment status
          // 🔥 CRITICAL FIX: Pass numeric fields required for overpaid/partial logic
          amountPaid: extractedExpenseData?.amountPaid ? parseFloat(extractedExpenseData.amountPaid) : undefined,
          balanceDue: extractedExpenseData?.balanceDue ? parseFloat(extractedExpenseData.balanceDue) : undefined,
          invoiceNumber: extractedExpenseData?.invoiceNumber,
          dueDate: extractedExpenseData?.dueDate,
          recurring: extractedExpenseData?.recurring,
          overdue: extractedExpenseData?.overdue
        })
      }

      console.log('✅ Expense save result:', result);

      // Invalidate all relevant queries to trigger real-time updates
      console.log('🔄 Invalidating React Query cache...');
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['reports'] })
      await queryClient.invalidateQueries({ queryKey: ['expenses'] })
      await queryClient.invalidateQueries({ queryKey: ['trial-balance'] })
      await queryClient.invalidateQueries({ queryKey: ['balance-sheet'] })
      await queryClient.invalidateQueries({ queryKey: ['pnl'] })
      await queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
      console.log('✅ Cache invalidated, reports should refresh');

      // Show success message and close modal
      if (result.success) {
        alert(result.message || '✅ Expense saved successfully!')
      } else {
        alert(result.message || '❌ Failed to save expense')
      }
      onClose()
    } catch (error) {
      console.error('Error saving transaction:', error)
      alert('Error saving transaction. Please try again.')
    }
  }

  const lottieOptions = {
    loop: true,
    autoplay: true,
    animationData: {
      v: "5.7.4",
      fr: 30,
      ip: 0,
      op: 90,
      w: 200,
      h: 200,
      nm: "AI Brain",
      ddd: 0,
      assets: [],
      layers: []
    }
  }

  // BULLETPROOF AI Payment Status Detection - Numeric Dominance with Enterprise Telemetry
  const detectPaymentStatus = (ocrText: string): 'paid' | 'invoice' | 'overpaid' | 'partial' => {
    // Multi-page concatenation support (future: concat all pages before detection)
    const text = ocrText.toLowerCase().replace(/\s+/g, ' ').trim()
    
    // === CONFIGURABLE TOLERANCES ===
    const TOLERANCE = {
      ZERO_BALANCE: 0.01,     // ±$0.01 for "balance ≈ 0"
      UNPAID_THRESHOLD: 5.00, // >$5.00 for "definitely unpaid"
      PAYMENT_COVERAGE: 0.999 // 99.9% coverage for "paid in full"
    }
    
    // === TELEMETRY INITIALIZATION ===
    const telemetry = {
      parsed: {} as any,
      hits: {} as any,
      math: {} as any,
      decisionPath: [] as string[],
      final: 'invoice' as 'paid' | 'invoice' | 'overpaid' | 'partial'
    }
    
    telemetry.decisionPath.push('DETECTION_START')
    console.log('🔍 BULLETPROOF AI Analysis - Document Text:', text.substring(0, 400))
    
    // === STEP 1: MULTI-CURRENCY FINANCIAL EXTRACTION ===
    telemetry.decisionPath.push('STEP1_EXTRACT_AMOUNTS')
    
    // Enhanced regex with multi-currency support: $, €, £, ₹, ¥
    const currencyPattern = '[\\$€£₹¥]?'
    const amountPattern = '([0-9]{1,3}(?:[, .\']*[0-9]{3})*(?:[.,][0-9]{1,2})?)'
    
    const totalAmountMatch = text.match(new RegExp(`total[:\\s]*${currencyPattern}\\s*${amountPattern}`, 'i'))
    const balanceDueMatch = text.match(new RegExp(`balance\\s+due[:\\s]*[-]?${currencyPattern}\\s*${amountPattern}`, 'i'))
    const amountDueMatch = text.match(new RegExp(`amount\\s+due[:\\s]*[-]?${currencyPattern}\\s*${amountPattern}`, 'i'))
    const amountPaidMatch = text.match(new RegExp(`amount\\s+paid[:\\s]*${currencyPattern}\\s*${amountPattern}`, 'i'))
    const paymentReceivedMatch = text.match(new RegExp(`payment\\s+received[:\\s]*${currencyPattern}\\s*${amountPattern}`, 'i'))
    const outstandingMatch = text.match(new RegExp(`outstanding[:\\s]*[-]?${currencyPattern}\\s*${amountPattern}`, 'i'))
    
    // Parse amounts with locale-aware thousand separators
    const parseAmount = (match: RegExpMatchArray | null): number | null => {
      if (!match) return null
      let numStr = match[1]
      // Handle both 1,234.56 (US) and 1 234,56 (EU) formats
      if (numStr.includes(',') && numStr.includes('.')) {
        // US format: 1,234.56
        numStr = numStr.replace(/,/g, '')
      } else if (numStr.includes(' ')) {
        // EU format with spaces: 1 234,56 or 1 234.56
        numStr = numStr.replace(/\s/g, '').replace(',', '.')
      } else if (numStr.includes(',') && !numStr.includes('.')) {
        // Could be 1234,56 (EU) or 1,234 (US thousands)
        const parts = numStr.split(',')
        if (parts[parts.length - 1].length <= 2) {
          // Likely decimal: 1234,56
          numStr = numStr.replace(',', '.')
        } else {
          // Likely thousands: 1,234
          numStr = numStr.replace(/,/g, '')
        }
      }
      return parseFloat(numStr)
    }
    
    const totalAmount = parseAmount(totalAmountMatch) || 0
    const balanceDue = (() => {
      if (!balanceDueMatch) return null
      const amount = parseAmount(balanceDueMatch) || 0
      return balanceDueMatch[0].includes('-') ? -amount : amount
    })()
    const amountDue = (() => {
      if (!amountDueMatch) return null
      const amount = parseAmount(amountDueMatch) || 0
      return amountDueMatch[0].includes('-') ? -amount : amount
    })()
    const amountPaid = parseAmount(amountPaidMatch)
    const paymentReceived = parseAmount(paymentReceivedMatch)
    const outstanding = (() => {
      if (!outstandingMatch) return null
      const amount = parseAmount(outstandingMatch) || 0
      return outstandingMatch[0].includes('-') ? -amount : amount
    })()
    
    telemetry.parsed = { totalAmount, balanceDue, amountDue, amountPaid, paymentReceived, outstanding }
    console.log('💰 PARSED AMOUNTS:', telemetry.parsed)
    
    // Debug: Show what regex patterns matched
    console.log('🔍 REGEX MATCHING DEBUG:')
    console.log('  totalAmountMatch:', totalAmountMatch ? totalAmountMatch[0] : 'NOT FOUND')
    console.log('  balanceDueMatch:', balanceDueMatch ? balanceDueMatch[0] : 'NOT FOUND')
    console.log('  amountPaidMatch:', amountPaidMatch ? amountPaidMatch[0] : 'NOT FOUND')
    console.log('  paymentReceivedMatch:', paymentReceivedMatch ? paymentReceivedMatch[0] : 'NOT FOUND')
    console.log('  outstandingMatch:', outstandingMatch ? outstandingMatch[0] : 'NOT FOUND')
    
    // === STEP 2: KEYWORD ANALYSIS FOR TELEMETRY ===
    telemetry.decisionPath.push('STEP2_KEYWORD_ANALYSIS')
    
    const explicitUnpaidKeywords = [
      'billed but not paid', 'not paid', 'unpaid', 'overdue', 'past due', 
      'payment pending', 'awaiting payment', 'please remit'
    ]
    
    const explicitPaidKeywords = [
      'paid in full', 'payment complete', 'payment successful', 'fully paid',
      'transaction complete', 'payment processed', 'thank you for your payment'
    ]
    
    const overpaidKeywords = [
      'overpaid', 'overpayment', 'excess payment', 'payment received in advance',
      'prepayment', 'advance payment', 'credit balance', 'customer credit', 'credit memo'
    ]
    
    const partialKeywords = [
      'partial payment', 'installment', 'payment plan', 'minimum payment due'
    ]
    
    // Weak hints (DO NOT determine final status)
    const receiptKeywords = ['receipt', 'payment receipt', 'transaction receipt', 'proof of payment']
    const paymentMethodKeywords = ['card ending in', 'visa', 'mastercard', 'paypal', 'bank transfer']
    
    // Record keyword hits for telemetry
    telemetry.hits = {
      explicitPaid: explicitPaidKeywords.some(k => text.includes(k)),
      unpaidOverdue: explicitUnpaidKeywords.some(k => text.includes(k)),
      overpaidWord: overpaidKeywords.some(k => text.includes(k)),
      partialWord: partialKeywords.some(k => text.includes(k)),
      receiptWord: receiptKeywords.some(k => text.includes(k)),
      paymentMethod: paymentMethodKeywords.some(k => text.includes(k))
    }
    
    // === STEP 3: MATH FLAGS CALCULATION ===
    telemetry.decisionPath.push('STEP3_MATH_CALCULATION')
    
    const getBalance = (): number | null => {
      // Priority: balanceDue > amountDue > outstanding
      if (balanceDue !== null) return balanceDue
      if (amountDue !== null) return amountDue
      if (outstanding !== null) return outstanding
      return null
    }
    
    const currentBalance = getBalance()
    
    telemetry.math = {
      zeroBalance: currentBalance !== null && Math.abs(currentBalance) <= TOLERANCE.ZERO_BALANCE,
      unpaidMath: currentBalance !== null && currentBalance > TOLERANCE.UNPAID_THRESHOLD,
      overpayMath: (currentBalance !== null && currentBalance < -TOLERANCE.ZERO_BALANCE) || 
                   (amountPaid && totalAmount && totalAmount > 0 && amountPaid > totalAmount),
      partialMath: amountPaid && amountPaid > 0 && currentBalance !== null && currentBalance > TOLERANCE.UNPAID_THRESHOLD,
      paidCoverage: amountPaid && totalAmount && totalAmount > 0 && amountPaid >= (totalAmount * TOLERANCE.PAYMENT_COVERAGE)
    }
    
    console.log('📊 MATH FLAGS:', telemetry.math)
    console.log('🏷️ KEYWORD HITS:', telemetry.hits)
    
    // === PRIORITY LADDER WITH NUMERIC DOMINANCE ===
    
    // PRIORITY 1: UNPAID/OVERDUE (balanceDue > $5 OR explicit overdue/unpaid)
    if (telemetry.math.unpaidMath || telemetry.hits.unpaidOverdue) {
      telemetry.decisionPath.push('DECISION=UNPAID', 
        telemetry.math.unpaidMath ? `REASON=BALANCE_${currentBalance}>5` : 'REASON=EXPLICIT_UNPAID_KEYWORDS')
      telemetry.final = 'invoice'
      console.log('🚫 NUMERIC DOMINANCE: UNPAID - Balance or explicit indicators')
      console.log('📋 TELEMETRY:', telemetry)
      return 'invoice'
    }
    
    // PRIORITY 2: OVERPAID (balanceDue < -$0.01 OR amountPaid > totalAmount OR overpaid keywords)
    if (telemetry.math.overpayMath || telemetry.hits.overpaidWord) {
      telemetry.decisionPath.push('DECISION=OVERPAID',
        telemetry.math.overpayMath ? `REASON=NEGATIVE_BALANCE_${currentBalance}` : 'REASON=OVERPAID_KEYWORDS')
      telemetry.final = 'overpaid'
      console.log('💎 NUMERIC DOMINANCE: OVERPAID - Negative balance or overpayment math')
      console.log('📋 TELEMETRY:', telemetry)
      return 'overpaid'
    }
    
    // PRIORITY 3: PARTIAL (amountPaid > 0 AND balanceDue > $5) - NO KEYWORD REQUIREMENT
    if (telemetry.math.partialMath) {
      telemetry.decisionPath.push('DECISION=PARTIAL', 
        `REASON=PAID_${amountPaid}_REMAINING_${currentBalance}`)
      telemetry.final = 'partial'
      console.log('📊 NUMERIC DOMINANCE: PARTIAL - Payment made but balance remains')
      console.log('📋 TELEMETRY:', telemetry)
      return 'partial'
    }
    
    // PRIORITY 4: PAID (TIGHTENED GATE - numeric/explicit conditions ONLY)
    // Never return paid unless one of these conditions is satisfied:
    const tightenedPaidConditions = 
      telemetry.hits.explicitPaid ||                    // Explicit: "paid in full", "payment complete"
      telemetry.math.zeroBalance ||                     // Numeric: |balanceDue| ≤ 0.01
      telemetry.math.paidCoverage                       // Numeric: amountPaid ≥ total * 99.9%
    
    if (tightenedPaidConditions) {
      const reason = telemetry.hits.explicitPaid ? 'EXPLICIT_PAID_KEYWORDS' :
                    telemetry.math.zeroBalance ? `ZERO_BALANCE_${currentBalance}` :
                    `PAYMENT_COVERAGE_${amountPaid}/${totalAmount}`
      telemetry.decisionPath.push('DECISION=PAID', `REASON=${reason}`)
      telemetry.final = 'paid'
      console.log('✅ TIGHTENED PAID GATE - Explicit phrasing or numeric proof')
      console.log('📋 TELEMETRY:', telemetry)
      return 'paid'
    }

    
    // PRIORITY 5: INVOICE (document looks like invoice and none of the above)
    const invoiceKeywords = [
      'invoice', 'bill', 'statement', 'due date', 'payment terms', 'net 30', 'net 15',
      'please remit', 'remit payment', 'payment due'
    ]
    
    const isInvoiceType = invoiceKeywords.some(keyword => text.includes(keyword))
    
    if (isInvoiceType) {
      telemetry.decisionPath.push('DECISION=INVOICE', 'REASON=INVOICE_DOCUMENT_TYPE')
      telemetry.final = 'invoice'
      console.log('📄 INVOICE DOCUMENT TYPE - No numeric proof of payment')
      console.log('📋 TELEMETRY:', telemetry)
      return 'invoice'
    }
    
    // PRIORITY 6: PERSONAL TRANSACTION HEURISTIC
    const personalLanguage = [
      'thank you', 'customer copy', 'merchant copy', 'tip:', 'gratuity',
      'cashier:', 'store #', 'register #', 'transaction id'
    ]
    const businessLanguage = [
      'tax id', 'ein:', 'business license', 'vendor', 'customer', 'account number',
      'po number', 'purchase order', 'terms and conditions', 'authorized signature'
    ]
    
    const hasPersonalLanguage = personalLanguage.some(term => text.includes(term))
    const hasBusinessLanguage = businessLanguage.some(term => text.includes(term))
    
    if (hasPersonalLanguage && !hasBusinessLanguage && telemetry.math.zeroBalance) {
      telemetry.decisionPath.push('DECISION=PAID', 'REASON=PERSONAL_RECEIPT_WITH_ZERO_BALANCE')
      telemetry.final = 'paid'
      console.log('🛒 PERSONAL RECEIPT - Zero balance personal transaction')
      console.log('📋 TELEMETRY:', telemetry)
      return 'paid'
    }
    
    if (hasBusinessLanguage && !hasPersonalLanguage) {
      telemetry.decisionPath.push('DECISION=INVOICE', 'REASON=BUSINESS_DOCUMENT')
      telemetry.final = 'invoice'
      console.log('🏢 BUSINESS DOCUMENT - Default to unpaid')
      console.log('📋 TELEMETRY:', telemetry)
      return 'invoice'
    }
    
    // PRIORITY 7: CONSERVATIVE DEFAULT → invoice
    telemetry.decisionPath.push('DECISION=INVOICE', 'REASON=CONSERVATIVE_DEFAULT')
    telemetry.final = 'invoice'
    console.log('❓ CONSERVATIVE DEFAULT - Insufficient evidence for paid status')
    console.log('📋 TELEMETRY:', telemetry)
    return 'invoice'
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="modal-overlay absolute inset-0"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            layout
            className={`relative mx-4 glass rounded-2xl overflow-hidden ${stage === 'picker' 
              ? 'sm:max-w-[800px] sm:w-full w-screen h-auto' 
              : 'sm:w-[1000px] sm:max-w-[95vw] sm:max-h-[85vh] sm:h-auto sm:my-8 w-screen h-screen'}
            `}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            {stage === 'picker' ? (
              // Stage 1: Picker-only
              <div className="p-8 max-h-[80vh] overflow-auto scrollbar-kinetic">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">AI Document Import</h2>
                  <motion.button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    ✕
                  </motion.button>
                </div>

                {errorMsg && (
                  <div className="mb-4 glass border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 rounded-lg">
                    {errorMsg}
                  </div>
                )}

                {(!selectedFile) ? (
                  <motion.div
                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
                      dragActive 
                        ? 'border-electric-500 bg-electric-500/10' 
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                    onDragEnter={handleDragIn}
                    onDragLeave={handleDragOut}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="text-6xl mb-4">📄</div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Drop your document here
                    </h3>
                    <p className="text-gray-400 mb-6">
                      Or click to browse files
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                      Supports PDF, DOCX, XLSX, JPG, PNG (Max 10MB)
                    </p>
                    <motion.button
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-electric"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Select File
                    </motion.button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileInput}
                      accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                      className="hidden"
                    />
                  </motion.div>
                ) : (
                  <div className="space-y-6">
                    {/* File Preview */}
                    <motion.div
                      className="glass rounded-lg p-4"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-3xl">📄</div>
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{selectedFile.name}</h4>
                          <p className="text-sm text-gray-400">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <motion.button
                          onClick={() => setSelectedFile(null)}
                          className="text-gray-400 hover:text-white"
                          whileHover={{ scale: 1.1 }}
                        >
                          ✕
                        </motion.button>
                      </div>
                    </motion.div>

                    {isProcessing ? (
                      <motion.div
                        className="text-center py-8"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <div className="w-16 h-16 bg-electric-gradient rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                          <span className="text-2xl">🤖</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">
                          Processing Document...
                        </h3>
                        <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                          <motion.div
                            className="bg-electric-gradient h-2 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${ocrProgress}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                        <p className="text-sm text-gray-400">
                          {ocrProgress < 30 ? 'Reading document...' : 
                           ocrProgress < 70 ? 'Extracting data...' : 'Almost done...'}
                        </p>
                      </motion.div>
                    ) : (
                      <motion.button
                        onClick={processDocument}
                        className="w-full btn-electric text-lg py-4"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        🚀 Process with AI
                      </motion.button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Stage 2: Two-column fixed modal
              <div className="flex w-full h-full">
                {/* Left: file info / picker */}
                <div className="w-1/3 border-r border-white/10 p-6 overflow-y-auto overflow-x-hidden scrollbar-kinetic">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold">Selected File</h3>
                    <motion.button
                      onClick={() => setStage('picker')}
                      className="text-gray-400 hover:text-white text-sm"
                      whileHover={{ scale: 1.05 }}
                    >
                      Change
                    </motion.button>
                  </div>
                  {selectedFile && (
                    <div className="glass rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <div className="text-3xl">📄</div>
                        <div className="flex-1">
                          <h4 className="font-medium text-white truncate" title={selectedFile.name}>{selectedFile.name}</h4>
                          <p className="text-sm text-gray-400">{(selectedFile.size/1024/1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {extractedText && (
                    <div className="mt-6">
                      <h4 className="text-sm text-gray-300 mb-2">OCR Snapshot</h4>
                      <div className="glass rounded-lg p-3 max-h-[40vh] overflow-y-auto scrollbar-kinetic text-xs text-gray-300 whitespace-pre-wrap">
                        {extractedText.slice(0, 2000)}{extractedText.length > 2000 ? '…' : ''}
                      </div>
                    </div>
                  )}
                </div>
                {/* Right: form container */}
                <div className="relative flex-1 p-6 overflow-y-auto overflow-x-hidden scrollbar-kinetic">
                  <div className="mx-auto w-full max-w-[900px]">
                    {suggestionError && (
                      <div className="mb-3 glass border border-amber-500/30 bg-amber-500/10 text-amber-200 px-4 py-2 rounded-lg">
                        {suggestionError}
                      </div>
                    )}
                    {extractedExpenseData && (
                      <ExpenseForm
                        initialData={extractedExpenseData}
                        suggestionsContext={{ text: extractedText }}
                        aiSuggestions={aiSuggestions}
                        onConsumeSuggestion={(name) => setAiSuggestions(prev => prev.filter(s => s.name.toLowerCase() !== name.toLowerCase()))}
                        onSave={onClose}
                        onCancel={() => setStage('picker')}
                      />
                    )}
                    {/* Hide duplicate preset buttons if already suggested */}
                    {aiSuggestions?.length ? (
                      <div className="hidden" aria-hidden="true">
                        {/* no-op container just to emphasize de-dup done in ExpenseForm by not rendering matching presets */}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default AiImportModal 