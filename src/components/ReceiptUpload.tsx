import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createWorker } from 'tesseract.js'
import axios from 'axios'
import ExpenseForm from './ExpenseForm'

interface ReceiptUploadProps {
  isOpen: boolean
  onClose: () => void
}

interface ExpenseData {
  vendor: string
  amount: string
  date: string
  category: string
  description: string
  paymentStatus: 'paid' | 'invoice' | 'overpaid' | 'partial' // Enhanced AI detection: paid, unpaid, overpaid, partial
  amountPaid?: string
  balanceDue?: string
  invoiceNumber?: string
  dueDate?: string
  recurring?: boolean
  overdue?: boolean
  docType?: 'invoice' | 'receipt' | 'statement'
}

const ReceiptUpload = ({ isOpen, onClose }: ReceiptUploadProps) => {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [extractedData, setExtractedData] = useState<ExpenseData | null>(null)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg']

    if (!allowedTypes.includes(file.type)) {
      alert('Please select a valid image file (JPG, PNG)')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }

    setSelectedFile(file)
    
    // Create preview URL
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  const processReceipt = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setOcrProgress(0)

    try {
      // Step 1: OCR Processing
      const worker = await createWorker('eng')
      
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/$@#%-:() ',
      })

      setOcrProgress(25)
      
      const { data } = await worker.recognize(selectedFile)
      await worker.terminate()

      setOcrProgress(50)

      // Step 2: AI Processing with Gemini - Enhanced Payment Status Detection
      const aiPrompt = `You are an expert accountant analyzing receipt/invoice text. Extract expense information and determine payment status with high precision.

DOCUMENT TEXT:
"${data.text}"

REQUIRED OUTPUT: JSON format only with these exact fields:
{
  "vendor": "Company name (clean, no extra text)",
  "amount": "Total amount as number only (no currency symbols)", 
  "amountPaid": "Amount paid as number only or null if not present",
  "balanceDue": "Balance due as number only or null if not present",
  "date": "Date in YYYY-MM-DD format",
  "dueDate": "Due date in YYYY-MM-DD format if present",
  "invoiceNumber": "Invoice/receipt number if present",
  "category": "One of: SOFTWARE, OFFICE_SUPPLIES, TRAVEL, MEALS, UTILITIES, RENT, PROFESSIONAL_SERVICES, MARKETING, EQUIPMENT, INSURANCE, LEGAL, TRAINING, ENTERTAINMENT, TELECOMMUNICATIONS, PHONE, INTERNET, BANK_FEES, SALARIES, SUBSCRIPTIONS, SUPPLIES, INVENTORY, DEPOSITS, OTHER",
  "description": "Brief description of purchase",
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

      setOcrProgress(75)

      const aiResponse = await axios.post('/api/ai/generate', { 
        prompt: aiPrompt 
      })

      setOcrProgress(90)

      // Parse AI response
      try {
        const jsonMatch = aiResponse.data.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const extractedExpense = JSON.parse(jsonMatch[0])
          
          // 🤖 AI-FIRST DETECTION with Custom Logic Fallback
          console.log('🤖 AI-FIRST PAYMENT DETECTION - STARTING ANALYSIS')
          console.log('=================================================')
          console.log('📄 FULL OCR TEXT (First 1000 chars):')
          console.log(data.text.substring(0, 1000))
          console.log('=================================================')
          console.log('🧠 AI GEMINI DETECTED:', extractedExpense.paymentStatus)
          
          // Use AI result as primary, with validation
          let finalPaymentStatus = extractedExpense.paymentStatus
          
          // Validate AI result - fallback to custom logic if AI gives invalid result
          const validStatuses = ['paid', 'invoice', 'overpaid', 'partial']
          if (!validStatuses.includes(finalPaymentStatus)) {
            console.log('⚠️ AI returned invalid status, using custom fallback detection')
            finalPaymentStatus = detectPaymentStatus(data.text)
          } else {
            console.log('✅ AI STATUS ACCEPTED:', finalPaymentStatus)
          }
          
          // Optional: Cross-check with custom logic for debugging
          const customDetectedStatus = detectPaymentStatus(data.text)
          if (finalPaymentStatus !== customDetectedStatus) {
            console.log('🔍 COMPARISON - AI vs Custom:')
            console.log('   AI Result:', finalPaymentStatus)
            console.log('   Custom Result:', customDetectedStatus)
            console.log('   Using AI Result ✅')
          }
          
          console.log('🎯 FINAL STATUS (AI-First):', finalPaymentStatus)
          console.log('=====================================')
          
          // Also test with our quick test pattern to compare
          if (data.text.toLowerCase().includes('overpaid') || data.text.toLowerCase().includes('balance due') || data.text.toLowerCase().includes('amount paid')) {
            console.log('🔍 RECEIPT CONTAINS RELEVANT KEYWORDS - Should detect overpaid/partial/paid')
            console.log('Looking for: overpaid, balance due, amount paid, credit balance')
            const keywords = ['overpaid', 'balance due', 'amount paid', 'credit balance', 'customer credit']
            keywords.forEach(keyword => {
              if (data.text.toLowerCase().includes(keyword)) {
                console.log(`✅ Found keyword: "${keyword}"`)
              }
            })
          } else {
            console.log('❌ RECEIPT MISSING KEY FINANCIAL KEYWORDS - OCR might be poor quality')
          }
          
          setExtractedData({
            vendor: extractedExpense.vendor || '',
            amount: String(extractedExpense.amount || ''),
            date: extractedExpense.date || new Date().toISOString().split('T')[0],
            category: extractedExpense.category || 'OTHER',
            description: extractedExpense.description || '',
            paymentStatus: finalPaymentStatus, // 🤖 AI-First Detection Result!
            amountPaid: extractedExpense.amountPaid != null ? String(extractedExpense.amountPaid) : undefined,
            balanceDue: extractedExpense.balanceDue != null ? String(extractedExpense.balanceDue) : undefined,
            invoiceNumber: extractedExpense.invoiceNumber || undefined,
            dueDate: extractedExpense.dueDate || undefined,
            recurring: !!extractedExpense.recurring,
            overdue: !!extractedExpense.overdue,
            docType: extractedExpense.docType || undefined
          })
          setShowExpenseForm(true)
        } else {
          throw new Error('No valid JSON found in AI response')
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError)
        // Fallback with basic data
        setExtractedData({
          vendor: 'Unknown Vendor',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          category: 'OTHER',
          description: 'Receipt processed',
          paymentStatus: 'paid' // Receipts are typically for paid transactions
        })
        setShowExpenseForm(true)
      }

      setOcrProgress(100)
    } catch (error) {
      console.error('Receipt processing error:', error)
      alert('Error processing receipt. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExpenseSaved = () => {
    // Reset state and close modal
    setSelectedFile(null)
    setPreviewUrl(null)
    setExtractedData(null)
    setShowExpenseForm(false)
    onClose()
  }

  const resetUpload = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setExtractedData(null)
    setShowExpenseForm(false)
    setIsProcessing(false)
    setOcrProgress(0)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
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
    
    // 🔥 ENHANCED DEBUG - Show exact parsed values
    console.log('🧮 PARSED AMOUNTS:', {
      totalAmount,
      balanceDue, 
      amountDue,
      amountPaid,
      paymentReceived,
      outstanding: parseAmount(outstandingMatch)
    })
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
            className="relative w-full max-w-4xl mx-4 max-h-[90vh] glass rounded-2xl overflow-hidden"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Receipt to Expense</h2>
                <motion.button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              </div>
              <p className="text-gray-400 mt-2">Upload a receipt and let AI extract the expense details</p>
            </div>

            <div className="p-6">
              {!showExpenseForm ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Panel - Upload */}
                  <div className="space-y-6">
                    {!selectedFile ? (
                      <motion.div
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
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
                        <div className="text-5xl mb-4">📄</div>
                        <h3 className="text-lg font-semibold text-white mb-2">
                          Drop receipt image here
                        </h3>
                        <p className="text-gray-400 mb-4">
                          Or click to browse files
                        </p>
                        <p className="text-xs text-gray-500 mb-4">
                          JPG, PNG up to 10MB
                        </p>
                        <motion.button
                          onClick={() => fileInputRef.current?.click()}
                          className="btn-electric"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Select Image
                        </motion.button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileInput}
                          accept="image/*"
                          className="hidden"
                        />
                      </motion.div>
                    ) : (
                      <div className="space-y-4">
                        {/* File Preview */}
                        <motion.div
                          className="glass rounded-lg p-4"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-white">Receipt Preview</h4>
                            <motion.button
                              onClick={resetUpload}
                              className="text-gray-400 hover:text-white text-sm"
                              whileHover={{ scale: 1.05 }}
                            >
                              Change Image
                            </motion.button>
                          </div>
                          
                          {previewUrl && (
                            <motion.img
                              src={previewUrl}
                              alt="Receipt preview"
                              className="w-full h-48 object-contain rounded-lg bg-gray-800"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.2 }}
                            />
                          )}
                          
                          <div className="mt-3 text-sm text-gray-400">
                            {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                          </div>
                        </motion.div>

                        {/* Processing or Process Button */}
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
                              Processing Receipt...
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
                              {ocrProgress < 30 ? 'Reading receipt...' : 
                               ocrProgress < 70 ? 'Extracting data...' : 'Almost done...'}
                            </p>
                          </motion.div>
                        ) : extractedData ? (
                          <motion.div
                            className="text-center py-8"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                          >
                            <div className="text-4xl mb-4">✨</div>
                            <h3 className="text-lg font-semibold text-white mb-2">
                              Receipt Processed!
                            </h3>
                            <p className="text-gray-400">
                              Review and edit the extracted information
                            </p>
                          </motion.div>
                        ) : (
                          <motion.button
                            onClick={processReceipt}
                            className="w-full btn-electric text-lg py-4"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            🚀 Process Receipt
                          </motion.button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Panel - AI Extraction Preview */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Extracted Data Preview</h3>
                    
                    {!extractedData ? (
                      <div className="text-center py-12 text-gray-400">
                        <div className="text-4xl mb-4">⚡</div>
                        <p>AI will extract expense details here</p>
                      </div>
                    ) : (
                      <motion.div
                        className="space-y-3"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        {Object.entries(extractedData).map(([key, value], index) => (
                          <motion.div
                            key={key}
                            className="glass rounded-lg p-3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </div>
                            <div className="text-white font-medium">
                              {value || 'Not detected'}
                            </div>
                          </motion.div>
                        ))}
                        
                        <motion.button
                          onClick={() => setShowExpenseForm(true)}
                          className="w-full btn-electric mt-6"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Continue to Expense Form
                        </motion.button>
                      </motion.div>
                    )}
                  </div>
                </div>
              ) : (
                /* Expense Form */
                <ExpenseForm
                  initialData={extractedData}
                  onSave={handleExpenseSaved}
                  onCancel={() => setShowExpenseForm(false)}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ReceiptUpload 