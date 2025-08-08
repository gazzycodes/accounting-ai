import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createWorker } from 'tesseract.js'
import Lottie from 'react-lottie-player'
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
    vendor: string; amount: string; date: string; category: string; description: string
  } | null>(null)
  const [extractedText, setExtractedText] = useState<string>('')
  const [stage, setStage] = useState<'picker' | 'form'>('picker')
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([])
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [suggestionError, setSuggestionError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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

      // Step 2: AI Processing with Gemini (primary fields)
      setOcrProgress(75)
      const aiPrompt = `Extract the following information from this document text. Return the data in JSON format with the exact field names specified. Respond with ONLY valid JSON and nothing else. Keys must be: vendor, amount, date, description, category, invoiceNumber. Amount should be numeric, date in YYYY-MM-DD, category uppercase from [SOFTWARE, OFFICE_SUPPLIES, TRAVEL, MEALS, UTILITIES, RENT, PROFESSIONAL_SERVICES, MARKETING, EQUIPMENT, OTHER].

Document text: "${ocrText}"`

      let extractedData:
        | {
            vendor: string
            amount: string
            date: string
            description: string
            category: string
            invoiceNumber?: string
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
      setExtractedExpenseData({
        vendor: extractedData!.vendor || '',
        amount: extractedData!.amount || '',
        date: extractedData!.date || new Date().toISOString().split('T')[0],
        category: extractedData!.category || 'OTHER',
        description: extractedData!.description || ''
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

  const saveTransaction = async () => {
    const allFields = [...extractedFields, ...customFields]
    const transactionData = allFields.reduce((acc, field) => {
      acc[field.name] = field.value
      return acc
    }, {} as Record<string, string>)

    try {
      await axios.post('/api/expenses', {
        vendor: transactionData.vendor,
        category: transactionData.category || 'OTHER',
        date: transactionData.date || new Date().toISOString(),
        amount: parseFloat(transactionData.amount) || 0,
        description: transactionData.description,
        receiptUrl: selectedFile?.name
      })

      alert('Transaction saved successfully!')
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
              <div className="p-8 max-h-[80vh] overflow-auto">
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
                <div className="w-1/3 border-r border-white/10 p-6 overflow-y-auto overflow-x-hidden">
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
                      <div className="glass rounded-lg p-3 max-h-[40vh] overflow-y-auto text-xs text-gray-300 whitespace-pre-wrap">
                        {extractedText.slice(0, 2000)}{extractedText.length > 2000 ? '…' : ''}
                      </div>
                    </div>
                  )}
                </div>
                {/* Right: form container */}
                <div className="relative flex-1 p-6 overflow-y-auto overflow-x-hidden">
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