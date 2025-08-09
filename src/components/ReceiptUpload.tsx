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
  paymentStatus: 'paid' | 'invoice' // New field to distinguish between paid expenses and unpaid invoices
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

      // Step 2: AI Processing with Gemini
      const aiPrompt = `Extract expense information from this receipt text. Return JSON format only:

Receipt text: "${data.text}"

Required fields: vendor, amount, date, category, description, paymentStatus

Field requirements:
- vendor: Company name (clean, no extra text)
- amount: Total amount as number only (no currency symbols)
- date: Date in YYYY-MM-DD format
- category: Best category (SOFTWARE, OFFICE_SUPPLIES, TRAVEL, MEALS, UTILITIES, RENT, PROFESSIONAL_SERVICES, MARKETING, EQUIPMENT, INSURANCE, LEGAL, TRAINING, ENTERTAINMENT, TELECOMMUNICATIONS, PHONE, INTERNET, BANK_FEES, SALARIES, SUBSCRIPTIONS, SUPPLIES, INVENTORY, DEPOSITS, OTHER)
- description: Brief description of purchase
- paymentStatus: Analyze the document to determine if this is "invoice" or "paid"

PAYMENT STATUS DETECTION RULES:
- CRITICAL: If document contains ANY payment completion indicators, classify as "paid" regardless of other content
- Use "paid" if document contains: "Date Paid", "Amount Paid", "Paid", "Receipt", "Overpaid", "Credit Balance", "Balance Due: $-", "Payment received", "Transaction completed", "Thank you for payment", "Card ending in", "Payment processed", "Confirmation", "Paid in full", "Payment successful"
- Use "invoice" ONLY if document contains invoice indicators AND NO payment indicators: "Invoice", "Bill To", "Due Date", "Net 30", "Payment Due", "Please remit", "Amount Due", "Balance Due" (positive amount), "Unpaid", "Outstanding", "Remit to", "Terms"
- OVERRIDE RULE: Payment completion indicators (Date Paid, Amount Paid, Overpaid, etc.) always override invoice indicators
- Example: A document with both "Invoice Date" and "Date Paid" should be classified as "paid"
- If uncertain, default to "paid" (receipts are usually for completed transactions)

Return only valid JSON with these exact field names. If unclear, make reasonable assumptions.`

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
          
          // Use smart AI detection on OCR text for more accurate payment status
          const smartDetectedStatus = detectPaymentStatus(data.text)
          
          setExtractedData({
            vendor: extractedExpense.vendor || '',
            amount: String(extractedExpense.amount || ''),
            date: extractedExpense.date || new Date().toISOString().split('T')[0],
            category: extractedExpense.category || 'OTHER',
            description: extractedExpense.description || '',
            paymentStatus: smartDetectedStatus // Use smart detection instead of AI response
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

  // Smart AI Payment Status Detection
  const detectPaymentStatus = (ocrText: string): 'paid' | 'invoice' => {
    const text = ocrText.toLowerCase()
    
    // Strong payment completion indicators (prioritized)
    const paidIndicators = [
      'date paid', 'amount paid', 'overpaid', 'credit balance', 'balance due: $-',
      'paid in full', 'payment successful', 'payment received', 'payment processed',
      'transaction completed', 'thank you for payment', 'receipt', 'confirmation',
      'card ending in', 'payment confirmation'
    ]
    
    // Invoice/unpaid indicators (lower priority)
    const invoiceIndicators = [
      'amount due', 'balance due', 'payment due', 'please remit', 'net 30',
      'unpaid', 'outstanding', 'due date', 'remit to', 'payment terms'
    ]
    
    // Check for payment completion indicators first
    const hasPaidIndicators = paidIndicators.some(indicator => text.includes(indicator))
    const hasInvoiceIndicators = invoiceIndicators.some(indicator => text.includes(indicator))
    
    // Override logic: payment indicators always win
    if (hasPaidIndicators) {
      console.log('🎯 AI Detection: PAID - Found payment indicators:', paidIndicators.filter(i => text.includes(i)))
      return 'paid'
    }
    
    if (hasInvoiceIndicators && !hasPaidIndicators) {
      console.log('📄 AI Detection: INVOICE - Found invoice indicators:', invoiceIndicators.filter(i => text.includes(i)))
      return 'invoice'
    }
    
    // For receipts, default to paid since they're typically for completed transactions
    console.log('📄 AI Detection: RECEIPT DEFAULT - Defaulting to paid for receipt')
    return 'paid'
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