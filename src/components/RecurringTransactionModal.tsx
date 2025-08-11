import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FinancialDataService } from '../services/financialDataService'
import { useQueryClient } from '@tanstack/react-query'
import { useMockDataStore } from '../store/mockDataStore'

interface RecurringTransactionModalProps {
  isOpen: boolean
  onClose: () => void
}

interface RecurringPattern {
  id: string
  vendor: string
  amount: number
  category: string
  description: string
  confidence: number
  frequency: 'weekly' | 'monthly' | 'quarterly'
  nextDate: string
  lastTransactionDate: string
  transactionCount: number
}

interface ManualRecurring {
  vendor: string
  amount: string
  category: string
  description: string
  frequency: 'weekly' | 'monthly' | 'quarterly'
  startDate: string
  dayOfMonth?: number
  dayOfWeek?: number
}

const RecurringTransactionModal = ({ isOpen, onClose }: RecurringTransactionModalProps) => {
  const [step, setStep] = useState<'detection' | 'manual' | 'manage'>('detection')
  const [detectedPatterns, setDetectedPatterns] = useState<RecurringPattern[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([])
  const [manualForm, setManualForm] = useState<ManualRecurring>({
    vendor: '',
    amount: '',
    category: 'OTHER',
    description: '',
    frequency: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    dayOfMonth: 1
  })

  const queryClient = useQueryClient()
  const { getRecurringTransactions, addRecurringTransaction } = useMockDataStore()

  const categories = [
    'SOFTWARE', 'OFFICE_SUPPLIES', 'TRAVEL', 'MEALS', 'UTILITIES', 
    'RENT', 'PROFESSIONAL_SERVICES', 'MARKETING', 'EQUIPMENT', 'OTHER'
  ]

  const formatCategoryLabel = (category: string) => {
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ')
  }

  // AI Pattern Detection
  useEffect(() => {
    if (isOpen && step === 'detection') {
      detectRecurringPatterns()
    }
  }, [isOpen, step])

  const detectRecurringPatterns = async () => {
    setIsLoading(true)
    try {
      // Simulate AI pattern detection
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Mock detected patterns based on existing transactions
      const mockPatterns: RecurringPattern[] = [
        {
          id: 'pattern-1',
          vendor: 'Adobe Systems',
          amount: 299.00,
          category: 'SOFTWARE',
          description: 'Creative Cloud Subscription',
          confidence: 0.95,
          frequency: 'monthly',
          nextDate: '2024-02-15',
          lastTransactionDate: '2024-01-15',
          transactionCount: 6
        },
        {
          id: 'pattern-2',
          vendor: 'Office Building LLC',
          amount: 2000.00,
          category: 'RENT',
          description: 'Monthly Office Rent',
          confidence: 0.92,
          frequency: 'monthly',
          nextDate: '2024-02-01',
          lastTransactionDate: '2024-01-01',
          transactionCount: 12
        },
        {
          id: 'pattern-3',
          vendor: 'Slack Technologies',
          amount: 144.00,
          category: 'SOFTWARE',
          description: 'Team Communication',
          confidence: 0.88,
          frequency: 'monthly',
          nextDate: '2024-02-10',
          lastTransactionDate: '2024-01-10',
          transactionCount: 4
        }
      ]
      
      setDetectedPatterns(mockPatterns)
    } catch (error) {
      console.error('Error detecting patterns:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePatternToggle = (patternId: string) => {
    setSelectedPatterns(prev => 
      prev.includes(patternId) 
        ? prev.filter(id => id !== patternId)
        : [...prev, patternId]
    )
  }

  const setupSelectedPatterns = async () => {
    setIsLoading(true)
    try {
      for (const patternId of selectedPatterns) {
        const pattern = detectedPatterns.find(p => p.id === patternId)
        if (pattern) {
          await addRecurringTransaction({
            vendor: pattern.vendor,
            amount: pattern.amount,
            category: pattern.category,
            description: pattern.description,
            frequency: pattern.frequency,
            nextDate: pattern.nextDate,
            isActive: true
          })
        }
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['recurring'] })
      
      onClose()
    } catch (error) {
      console.error('Error setting up patterns:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const setupManualRecurring = async () => {
    if (!manualForm.vendor || !manualForm.amount) {
      alert('Please fill in vendor and amount')
      return
    }

    setIsLoading(true)
    try {
      await addRecurringTransaction({
        vendor: manualForm.vendor,
        amount: parseFloat(manualForm.amount),
        category: manualForm.category,
        description: manualForm.description || `${manualForm.frequency} ${manualForm.category.toLowerCase()} expense`,
        frequency: manualForm.frequency,
        nextDate: manualForm.startDate,
        isActive: true
      })
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['recurring'] })
      
      onClose()
    } catch (error) {
      console.error('Error setting up manual recurring:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const renderDetectionStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <motion.div
          className="w-16 h-16 bg-electric-gradient rounded-full flex items-center justify-center mx-auto mb-4"
          animate={{ rotate: isLoading ? 360 : 0 }}
          transition={{ duration: 2, repeat: isLoading ? Infinity : 0, ease: "linear" }}
        >
          <span className="text-2xl">🤖</span>
        </motion.div>
        <h3 className="text-xl font-semibold text-white mb-2">
          {isLoading ? 'AI Analyzing Your Transactions...' : 'Smart Recurring Detection'}
        </h3>
        <p className="text-gray-400">
          {isLoading 
            ? 'Looking for patterns in your expense history...'
            : `Found ${detectedPatterns.length} potential recurring transactions`
          }
        </p>
      </div>

      {!isLoading && detectedPatterns.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-medium text-white">Select transactions to automate:</h4>
          {detectedPatterns.map((pattern) => (
            <motion.div
              key={pattern.id}
              className={`card-glass border cursor-pointer transition-all duration-300 ${
                selectedPatterns.includes(pattern.id) 
                  ? 'border-electric-500 bg-electric-500/10' 
                  : 'border-white/10 hover:border-white/20'
              }`}
              onClick={() => handlePatternToggle(pattern.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      selectedPatterns.includes(pattern.id)
                        ? 'border-electric-500 bg-electric-500'
                        : 'border-gray-400'
                    }`}>
                      {selectedPatterns.includes(pattern.id) && (
                        <span className="text-white text-xs">✓</span>
                      )}
                    </div>
                    <div>
                      <h5 className="text-white font-medium">{pattern.vendor}</h5>
                      <p className="text-gray-400 text-sm">
                        ${pattern.amount.toFixed(2)} • {formatCategoryLabel(pattern.category)} • {pattern.frequency}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span>✨ {Math.round(pattern.confidence * 100)}% confidence</span>
                    <span>📊 {pattern.transactionCount} past transactions</span>
                    <span>📅 Next: {new Date(pattern.nextDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="flex space-x-3">
          <motion.button
            onClick={() => setStep('manual')}
            className="flex-1 btn-glass"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            ➕ Add Manual Recurring
          </motion.button>
          {selectedPatterns.length > 0 && (
            <motion.button
              onClick={setupSelectedPatterns}
              disabled={isLoading}
              className="flex-1 btn-electric"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              🚀 Setup {selectedPatterns.length} Recurring
            </motion.button>
          )}
        </div>
      )}
    </div>
  )

  const renderManualStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">Create Manual Recurring</h3>
        <motion.button
          onClick={() => setStep('detection')}
          className="text-gray-400 hover:text-white"
          whileHover={{ scale: 1.1 }}
        >
          ← Back
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Vendor *</label>
          <input
            type="text"
            value={manualForm.vendor}
            onChange={(e) => setManualForm(prev => ({ ...prev, vendor: e.target.value }))}
            placeholder="e.g., Netflix, Spotify, etc."
            className="w-full input-glass"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Amount *</label>
          <input
            type="number"
            step="0.01"
            value={manualForm.amount}
            onChange={(e) => setManualForm(prev => ({ ...prev, amount: e.target.value }))}
            placeholder="0.00"
            className="w-full input-glass"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Category</label>
          <select
            value={manualForm.category}
            onChange={(e) => setManualForm(prev => ({ ...prev, category: e.target.value }))}
            className="w-full input-glass"
          >
            {categories.map(category => (
              <option key={category} value={category} className="bg-gray-800 text-white">
                {formatCategoryLabel(category)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Frequency</label>
          <select
            value={manualForm.frequency}
            onChange={(e) => setManualForm(prev => ({ ...prev, frequency: e.target.value as any }))}
            className="w-full input-glass"
          >
            <option value="weekly" className="bg-gray-800 text-white">Weekly</option>
            <option value="monthly" className="bg-gray-800 text-white">Monthly</option>
            <option value="quarterly" className="bg-gray-800 text-white">Quarterly</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="block text-sm font-medium text-gray-300">Description</label>
          <input
            type="text"
            value={manualForm.description}
            onChange={(e) => setManualForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Optional description"
            className="w-full input-glass"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Start Date</label>
          <input
            type="date"
            value={manualForm.startDate}
            onChange={(e) => setManualForm(prev => ({ ...prev, startDate: e.target.value }))}
            className="w-full input-glass"
          />
        </div>
      </div>

      <motion.button
        onClick={setupManualRecurring}
        disabled={isLoading || !manualForm.vendor || !manualForm.amount}
        className="w-full btn-electric"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isLoading ? 'Creating...' : '✅ Create Recurring Transaction'}
      </motion.button>
    </div>
  )

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
                <h2 className="text-2xl font-bold text-white">🔄 Smart Recurring Transactions</h2>
                <motion.button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              </div>
              <p className="text-gray-400 mt-2">
                Automate your regular expenses and save time on data entry
              </p>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[80vh] overflow-y-auto scrollbar-kinetic">
              {step === 'detection' && renderDetectionStep()}
              {step === 'manual' && renderManualStep()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default RecurringTransactionModal
