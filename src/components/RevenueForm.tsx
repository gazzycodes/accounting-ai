import React, { useState } from 'react'
import { motion } from 'framer-motion'
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

interface RevenueData {
  customer: string
  amount: string
  date: string
  revenueType: 'SERVICES' | 'PRODUCTS' | 'CONSULTING' | 'OTHER'
  description: string
  paymentMethod: 'CASH' | 'CHECK' | 'BANK_TRANSFER' | 'CREDIT_CARD'
  invoiceNumber?: string
  reference?: string
}

interface RevenueFormProps {
  initialData?: Partial<RevenueData>
  onSave?: (data: RevenueData) => void
  onCancel?: () => void
  onSuccess?: () => void
}

const RevenueForm = ({ initialData, onSave, onCancel, onSuccess }: RevenueFormProps) => {
  const [formData, setFormData] = useState<RevenueData>({
    customer: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    revenueType: 'SERVICES',
    description: '',
    paymentMethod: 'CASH',
    invoiceNumber: '',
    reference: '',
    ...initialData
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string>('')

  const queryClient = useQueryClient()

  const revenueTypes = [
    { key: 'SERVICES', label: 'Services Revenue', accountCode: '4020' },
    { key: 'PRODUCTS', label: 'Product Sales', accountCode: '4010' },
    { key: 'CONSULTING', label: 'Consulting Revenue', accountCode: '4020' },
    { key: 'OTHER', label: 'Other Income', accountCode: '4900' }
  ]

  const paymentMethods = [
    { key: 'CASH', label: 'Cash', accountCode: '1010' },
    { key: 'BANK_TRANSFER', label: 'Bank Transfer', accountCode: '1010' },
    { key: 'CHECK', label: 'Check', accountCode: '1010' },
    { key: 'CREDIT_CARD', label: 'Credit Card', accountCode: '1010' }
  ]

  const handleInputChange = (field: keyof RevenueData, value: string) => {
    if (field === 'amount') {
      const sanitizedValue = value.replace(/,/g, '')
      // Regex to allow numbers and an optional decimal part with up to 2 digits
      if (/^\d*\.?\d{0,2}$/.test(sanitizedValue) || sanitizedValue === '') {
        setFormData(prev => ({ ...prev, [field]: sanitizedValue }))
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
    setError('') // Clear error when user starts editing
  }

  const validateForm = (): boolean => {
    if (!formData.customer.trim()) {
      setError('Customer name is required')
      return false
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Valid amount is required')
      return false
    }
    if (!formData.description.trim()) {
      setError('Description is required')
      return false
    }
    return true
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setIsSaving(true)
    setError('')

    try {
      const revenueType = revenueTypes.find(t => t.key === formData.revenueType)
      const paymentMethod = paymentMethods.find(p => p.key === formData.paymentMethod)

      // Create revenue transaction via API
      const response = await axios.post('http://localhost:4000/api/transactions/revenue', {
        customer: formData.customer,
        amount: parseFloat(formData.amount),
        date: formData.date,
        revenueAccount: revenueType?.accountCode || '4020',
        cashAccount: paymentMethod?.accountCode || '1010',
        description: formData.description,
        paymentMethod: formData.paymentMethod,
        invoiceNumber: formData.invoiceNumber || undefined,
        reference: formData.reference || undefined
      })

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['trial-balance'] })
      await queryClient.invalidateQueries({ queryKey: ['balance-sheet'] })
      await queryClient.invalidateQueries({ queryKey: ['pnl'] })
      await queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })

      if (onSave) onSave(formData)
      if (onSuccess) onSuccess()

    } catch (error: any) {
      console.error('Error saving revenue:', error)
      setError(error.response?.data?.error || 'Failed to save revenue transaction')
    } finally {
      setIsSaving(false)
    }
  }

  const getAccountingPreview = () => {
    const amount = parseFloat(formData.amount)
    if (!amount || amount <= 0) return null

    const revenueType = revenueTypes.find(t => t.key === formData.revenueType)
    const paymentMethod = paymentMethods.find(p => p.key === formData.paymentMethod)

    return {
      debit: { account: `Cash (${paymentMethod?.label})`, accountCode: '1010', amount },
      credit: { account: revenueType?.label || 'Revenue', accountCode: revenueType?.accountCode || '4020', amount }
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
        <h3 className="text-xl font-bold text-white mb-2">Record Revenue Transaction</h3>
        <p className="text-gray-400 text-sm">Add cash receipts and revenue to your books</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Information */}
        <div className="space-y-4">
          <h4 className="text-electric-400 font-semibold text-sm uppercase tracking-wide">Customer Information</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Customer Name *</label>
            <input
              type="text"
              value={formData.customer}
              onChange={(e) => handleInputChange('customer', e.target.value)}
              placeholder="Customer or business name"
              className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Invoice Number</label>
            <input
              type="text"
              value={formData.invoiceNumber}
              onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
              placeholder="INV-2024-001 (optional)"
              className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Reference</label>
            <input
              type="text"
              value={formData.reference}
              onChange={(e) => handleInputChange('reference', e.target.value)}
              placeholder="Payment reference or notes"
              className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
            />
          </div>
        </div>

        {/* Transaction Details */}
        <div className="space-y-4">
          <h4 className="text-electric-400 font-semibold text-sm uppercase tracking-wide">Transaction Details</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">$</span>
              <input
                type="text"
                value={formatAmountForDisplay(formData.amount)}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
              />
            </div>
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

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Revenue Type *</label>
            <select
              value={formData.revenueType}
              onChange={(e) => handleInputChange('revenueType', e.target.value as any)}
              className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
            >
              {revenueTypes.map(type => (
                <option key={type.key} value={type.key} className="bg-gray-800">
                  {type.label} ({type.accountCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Payment Method *</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => handleInputChange('paymentMethod', e.target.value as any)}
              className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors"
            >
              {paymentMethods.map(method => (
                <option key={method.key} value={method.key} className="bg-gray-800">
                  {method.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
        <textarea
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="Describe the revenue transaction..."
          rows={3}
          className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-colors resize-none"
        />
      </div>

      {/* Accounting Preview */}
      {accountingPreview && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h4 className="text-electric-400 font-semibold text-sm uppercase tracking-wide mb-3">📊 Double-Entry Preview</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="text-blue-400 font-medium">DEBIT (Asset Increase)</div>
              <div className="text-white">{accountingPreview.debit.account}</div>
              <div className="text-blue-400 font-bold">${accountingPreview.debit.amount.toFixed(2)}</div>
            </div>
            <div className="space-y-2">
              <div className="text-green-400 font-medium">CREDIT (Revenue)</div>
              <div className="text-white">{accountingPreview.credit.account}</div>
              <div className="text-green-400 font-bold">${accountingPreview.credit.amount.toFixed(2)}</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 text-center">
            <span className="text-electric-300 text-sm font-medium">✅ Transaction Balanced</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-6 pt-6 border-t border-white/10 sticky bottom-0 bg-gray-900/95 backdrop-blur-sm">
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
          disabled={isSaving || !formData.customer || !formData.amount}
          className="flex-1 px-6 py-3 bg-electric-500 text-white rounded-lg hover:bg-electric-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isSaving ? 'Recording Revenue...' : 'Record Revenue'}
        </button>
      </div>
    </motion.div>
  )
}

export default RevenueForm
