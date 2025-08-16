import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

const formatAmountForDisplay = (amount: string): string => {
  if (!amount) return ''
  // Ensure we are working with a string
  const amountStr = String(amount);
  const [integer, decimal] = amountStr.split('.')
  // Add commas to integer part
  const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  // Return with decimal part if it exists
  return decimal !== undefined ? `${formattedInteger}.${decimal}` : formattedInteger
}

interface CapitalLineItem {
  id: string
  contributionType: string
  description: string
  amount: string
  accountCode: string
  accountName: string
}

interface CapitalData {
  contributor: string
  date: string
  reference?: string
  notes?: string
  isMultiLine: boolean
  lineItems: CapitalLineItem[]
}

interface CapitalFormProps {
  initialData?: Partial<CapitalData>
  onSave?: (data: CapitalData) => void
  onCancel?: () => void
  onSuccess?: () => void
}

const CapitalForm = ({ initialData, onSave, onCancel, onSuccess }: CapitalFormProps) => {
  const [formData, setFormData] = useState<CapitalData>({
    contributor: '',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
    isMultiLine: false,
    lineItems: [
      {
        id: '1',
        contributionType: 'CASH',
        description: '',
        amount: '',
        accountCode: '1010',
        accountName: 'Cash and Cash Equivalents'
      }
    ],
    ...initialData
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string>('')

  const queryClient = useQueryClient()

  const contributionTypes = [
    { key: 'CASH', label: 'Cash Investment', debitAccount: '1010', debitName: 'Cash and Cash Equivalents' },
    { key: 'EQUIPMENT', label: 'Computer Equipment', debitAccount: '1600', debitName: 'Property & Equipment' },
    { key: 'VEHICLES', label: 'Vehicles', debitAccount: '1600', debitName: 'Property & Equipment' },
    { key: 'FURNITURE', label: 'Furniture & Fixtures', debitAccount: '1600', debitName: 'Property & Equipment' },
    { key: 'REAL_ESTATE', label: 'Real Estate', debitAccount: '1600', debitName: 'Property & Equipment' },
    { key: 'INVENTORY', label: 'Inventory/Stock', debitAccount: '1300', debitName: 'Inventory' },
    { key: 'SERVICES', label: 'Services Contributed', debitAccount: '1700', debitName: 'Contributed Services Asset' },
    { key: 'INTELLECTUAL_PROPERTY', label: 'Patents/Trademarks', debitAccount: '1700', debitName: 'Intangible Assets' },
    { key: 'OTHER', label: 'Other Assets', debitAccount: '1700', debitName: 'Other Assets' }
  ]

  const handleInputChange = (field: keyof CapitalData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('') // Clear error when user starts editing
  }

  const toggleMultiLine = () => {
    setFormData(prev => ({
      ...prev,
      isMultiLine: !prev.isMultiLine
    }))
  }

  const addLineItem = () => {
    const newLineItem: CapitalLineItem = {
      id: Date.now().toString(),
      contributionType: 'CASH',
      description: '',
      amount: '',
      accountCode: '1010',
      accountName: 'Cash and Cash Equivalents'
    }
    setFormData(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, newLineItem]
    }))
  }

  const removeLineItem = (id: string) => {
    if (formData.lineItems.length > 1) {
      setFormData(prev => ({
        ...prev,
        lineItems: prev.lineItems.filter(item => item.id !== id)
      }))
    }
  }

  const updateLineItem = (id: string, field: keyof CapitalLineItem, value: string) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(item => {
        if (item.id === id) {
          if (field === 'contributionType') {
            const type = contributionTypes.find(t => t.key === value)
            return {
              ...item,
              [field]: value,
              accountCode: type?.debitAccount || '1010',
              accountName: type?.debitName || 'Cash and Cash Equivalents'
            }
          }
          if (field === 'amount') {
            const sanitizedValue = value.replace(/,/g, '')
            if (/^\d*\.?\d{0,2}$/.test(sanitizedValue) || sanitizedValue === '') {
              return { ...item, [field]: sanitizedValue }
            }
            return item
          }
          return { ...item, [field]: value }
        }
        return item
      })
    }))
  }

  const calculateTotalAmount = () => {
    return formData.lineItems.reduce((total, item) => {
      return total + (parseFloat(item.amount) || 0)
    }, 0)
  }

  const validateForm = (): boolean => {
    if (!formData.contributor.trim()) {
      setError('Contributor name is required')
      return false
    }
    
    if (formData.lineItems.length === 0) {
      setError('At least one contribution item is required')
      return false
    }

    for (const item of formData.lineItems) {
      if (!item.description.trim()) {
        setError('All contribution items must have a description')
        return false
      }
      if (!item.amount || parseFloat(item.amount) <= 0) {
        setError('All contribution items must have a valid amount')
        return false
      }
    }

    return true
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setIsSaving(true)
    setError('')

    try {
      // Create individual transactions for each line item
      for (const item of formData.lineItems) {
        await axios.post('http://localhost:4000/api/transactions/capital', {
          contributor: formData.contributor,
          amount: parseFloat(item.amount),
          date: formData.date,
          contributionType: item.contributionType,
          debitAccount: item.accountCode,
          equityAccount: '3000',
          description: item.description,
          reference: formData.reference || undefined,
          notes: formData.notes || undefined
        })
      }

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['trial-balance'] })
      await queryClient.invalidateQueries({ queryKey: ['balance-sheet'] })
      await queryClient.invalidateQueries({ queryKey: ['pnl'] })
      await queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })

      if (onSave) onSave(formData)
      if (onSuccess) onSuccess()

    } catch (error: any) {
      console.error('Error saving capital contribution:', error)
      setError(error.response?.data?.error || 'Failed to save capital contribution')
    } finally {
      setIsSaving(false)
    }
  }

  const getAccountingPreview = () => {
    const totalAmount = calculateTotalAmount()
    if (totalAmount <= 0) return null

    // Group amounts by account code
    const accountGroups = formData.lineItems.reduce((acc, item) => {
      const amount = parseFloat(item.amount) || 0
      if (amount > 0) {
        if (!acc[item.accountCode]) {
          acc[item.accountCode] = { name: item.accountName, amount: 0 }
        }
        acc[item.accountCode].amount += amount
      }
      return acc
    }, {} as Record<string, { name: string, amount: number }>)

    return {
      debits: Object.entries(accountGroups).map(([code, data]) => ({
        account: data.name,
        accountCode: code,
        amount: data.amount
      })),
      credit: {
        account: "Owner's Equity",
        accountCode: '3000',
        amount: totalAmount
      }
    }
  }

  const accountingPreview = getAccountingPreview()

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2">Record Capital Contribution</h3>
      </div>

      {/* Multi-Line Toggle */}
      <div className="flex items-center justify-center">
        <div className="bg-white/5 border border-white/10 rounded-lg p-2 flex items-center gap-2">
          <button
            onClick={toggleMultiLine}
            className={`px-4 py-2 rounded-md transition-all duration-200 text-sm font-medium ${
              !formData.isMultiLine
                ? 'bg-electric-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🏛️ Single Asset
          </button>
          <button
            onClick={toggleMultiLine}
            className={`px-4 py-2 rounded-md transition-all duration-200 text-sm font-medium ${
              formData.isMultiLine
                ? 'bg-electric-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📋 Multiple Assets
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          className="bg-red-500/10 border border-red-500/20 rounded-lg p-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-red-400 text-sm">{error}</p>
        </motion.div>
      )}

      <div className="space-y-6">
        {/* Contributor Information */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h4 className="text-electric-400 font-semibold text-sm uppercase tracking-wide mb-4">Contributor Information</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Contributor Name *</label>
              <input
                type="text"
                value={formData.contributor}
                onChange={(e) => handleInputChange('contributor', e.target.value)}
                placeholder="Owner or investor name"
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Reference</label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => handleInputChange('reference', e.target.value)}
                placeholder="Check number, wire reference, etc."
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Additional Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Additional context or notes..."
                rows={2}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {/* Investment Details */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h4 className="text-electric-400 font-semibold text-sm uppercase tracking-wide mb-4">Investment Details</h4>
          
          {!formData.isMultiLine ? (
            // Single Line Mode
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-400">$</span>
                    <input
                      type="text"
                      value={formatAmountForDisplay(formData.lineItems[0]?.amount || '')}
                      onChange={(e) => updateLineItem(formData.lineItems[0]?.id || '1', 'amount', e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Contribution Type *</label>
                  <select
                    value={formData.lineItems[0]?.contributionType || 'CASH'}
                    onChange={(e) => updateLineItem(formData.lineItems[0]?.id || '1', 'contributionType', e.target.value)}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
                  >
                    {contributionTypes.map(type => (
                      <option key={type.key} value={type.key} className="bg-gray-800">
                        {type.label} → {type.debitName} ({type.debitAccount})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
                <input
                  type="text"
                  value={formData.lineItems[0]?.description || ''}
                  onChange={(e) => updateLineItem(formData.lineItems[0]?.id || '1', 'description', e.target.value)}
                  placeholder="Describe this contribution..."
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
                />
              </div>
            </div>
          ) : (
            // Multi Line Mode
            <div className="text-center mb-4">
              <div className="text-2xl font-bold text-electric-400">
                ${formatAmountForDisplay(calculateTotalAmount().toFixed(2))}
              </div>
              <div className="text-sm text-gray-400">Total Contribution</div>
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-400">💡</span>
              <span className="text-blue-400 text-sm font-medium">Accounting Impact</span>
            </div>
            <ul className="text-blue-200 text-xs space-y-1">
              <li>• Increases business assets (cash, equipment, etc.)</li>
              <li>• Increases owner's equity in the business</li>
              <li>• Does not affect business income or expenses</li>
              <li>• Creates permanent capital for business operations</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Multi-Line Items (only show in multi-line mode) */}
      {formData.isMultiLine && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-electric-400 font-semibold text-sm uppercase tracking-wide">Contribution Items</h4>
            <button
              onClick={addLineItem}
              className="px-4 py-2 bg-electric-500 text-white rounded-lg hover:bg-electric-600 transition-colors text-sm font-medium"
            >
              + Add Item
            </button>
          </div>

          <div className="space-y-3">
            <AnimatePresence>
              {formData.lineItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white/5 border border-white/10 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-300">Item {index + 1}</span>
                    {formData.lineItems.length > 1 && (
                      <button
                        onClick={() => removeLineItem(item.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Type</label>
                      <select
                        value={item.contributionType}
                        onChange={(e) => updateLineItem(item.id, 'contributionType', e.target.value)}
                        className="w-full p-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
                      >
                        {contributionTypes.map(type => (
                          <option key={type.key} value={type.key} className="bg-gray-800">
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Amount</label>
                      <div className="relative">
                        <span className="absolute left-2 top-2 text-gray-400 text-sm">$</span>
                        <input
                          type="text"
                          value={formatAmountForDisplay(item.amount)}
                          onChange={(e) => updateLineItem(item.id, 'amount', e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-6 pr-2 py-2 bg-white/5 border border-white/10 rounded text-white text-sm placeholder-gray-500 focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        placeholder="Describe this contribution..."
                        className="w-full p-2 bg-white/5 border border-white/10 rounded text-white text-sm placeholder-gray-500 focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    Account: {item.accountCode} - {item.accountName}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Accounting Preview */}
      {accountingPreview && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h4 className="text-electric-400 font-semibold text-sm uppercase tracking-wide mb-3">📊 Double-Entry Preview</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="text-blue-400 font-medium">DEBITS (Asset Increase)</div>
              {accountingPreview.debits.map((debit, index) => (
                <div key={index} className="border-l-2 border-blue-500/30 pl-3 mb-2">
                  <div className="text-white">{debit.account}</div>
                  <div className="text-gray-400">Account: {debit.accountCode}</div>
                  <div className="text-blue-400 font-bold">${debit.amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="text-green-400 font-medium">CREDIT (Equity Increase)</div>
              <div className="border-l-2 border-green-500/30 pl-3">
                <div className="text-white">{accountingPreview.credit.account}</div>
                <div className="text-gray-400">Account: {accountingPreview.credit.accountCode}</div>
                <div className="text-green-400 font-bold">${accountingPreview.credit.amount.toFixed(2)}</div>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 text-center">
            <span className="text-electric-300 text-sm font-medium">✅ Transaction Balanced</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-6 pt-6 border-t border-white/10 sticky bottom-0 bg-gray-900 backdrop-blur-sm">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors font-medium"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving || !formData.contributor || calculateTotalAmount() === 0}
          className="flex-1 px-6 py-3 bg-electric-500 text-white rounded-lg hover:bg-electric-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isSaving ? 'Recording Capital...' : 'Record Capital Contribution'}
        </button>
      </div>
    </motion.div>
  )
}

export default CapitalForm
