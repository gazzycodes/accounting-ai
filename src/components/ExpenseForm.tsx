import React, { useState, useEffect, useRef } from 'react'
import { motion, Reorder, AnimatePresence } from 'framer-motion'
import { FinancialDataService } from '../services/financialDataService'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import AiSuggestionButton from './AiSuggestionButton'

interface ExpenseData {
  vendor: string
  amount: string
  date: string
  category: string
  description: string
  paymentStatus: 'paid' | 'invoice' // New field to distinguish between paid expenses and unpaid invoices
}

type CustomFieldType = 'text' | 'number' | 'currency' | 'date' | 'dropdown'

interface CustomFieldDef {
  id: string
  name: string
  type: CustomFieldType
  value: string
  options?: string[]
  aiSuggested?: boolean
  confidence?: number
}

interface SuggestionsContext {
  text?: string
}

interface AiSuggestion {
  name: string
  type: CustomFieldType
  confidence?: number
  value?: string
  options?: string[]
}

interface ExpenseFormProps {
  initialData?: ExpenseData | null
  onSave: () => void
  onCancel: () => void
  suggestionsContext?: SuggestionsContext
  aiSuggestions?: AiSuggestion[]
  onConsumeSuggestion?: (name: string) => void
}

const ExpenseForm = ({ initialData, onSave, onCancel, suggestionsContext, aiSuggestions = [], onConsumeSuggestion }: ExpenseFormProps) => {
  const [formData, setFormData] = useState<ExpenseData>({
    vendor: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: 'OTHER',
    description: '',
    paymentStatus: 'invoice' // Default to 'invoice'
  })
  const [isAnimating, setIsAnimating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [fieldAnimations, setFieldAnimations] = useState<Record<string, boolean>>({})
  const [aiFilledFields, setAiFilledFields] = useState<Record<string, boolean>>({})
  const [userEditedFields, setUserEditedFields] = useState<Record<string, boolean>>({})

  // Add QueryClient for cache invalidation
  const queryClient = useQueryClient()

  // Custom fields and AI suggestions
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([])
  // Retain local working copy of suggestions from props
  const [localSuggestions, setLocalSuggestions] = useState<AiSuggestion[]>(aiSuggestions)
  useEffect(() => { setLocalSuggestions(aiSuggestions) }, [aiSuggestions])

  const categories = [
    'SOFTWARE',
    'OFFICE_SUPPLIES',
    'TRAVEL',
    'MEALS',
    'UTILITIES',
    'RENT',
    'PROFESSIONAL_SERVICES',
    'MARKETING',
    'EQUIPMENT',
    'OTHER'
  ]

  const dropdownPresets: Record<string, string[]> = {
    Status: ['Paid', 'Pending', 'Overdue'],
    Priority: ['High', 'Medium', 'Low'],
    'Payment Method': ['Credit Card', 'Cash', 'Bank Transfer', 'ACH', 'Other']
  }

  const formatCategoryLabel = (category: string) => {
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ')
  }

  // Animate field population when initial data is provided and fetch AI suggestions
  useEffect(() => {
    if (initialData) {
      console.log('💼 ExpenseForm received initialData:', initialData)
      setIsAnimating(true)
      
      // Immediately set paymentStatus (no animation needed for this field)
      if (initialData.paymentStatus) {
        console.log('💰 Setting payment status to:', initialData.paymentStatus)
        setFormData(prev => ({ ...prev, paymentStatus: initialData.paymentStatus }))
        setAiFilledFields(prev => ({ ...prev, paymentStatus: true }))
      }
      
      const fields = ['vendor', 'amount', 'date', 'category', 'description']
      fields.forEach((field, index) => {
        setTimeout(() => {
          setFieldAnimations(prev => ({ ...prev, [field]: true }))
          setTimeout(() => {
            const fieldValue = initialData[field as keyof ExpenseData]
            if (fieldValue) {
              setFormData(prev => ({ ...prev, [field]: fieldValue }))
              setAiFilledFields(prev => ({ ...prev, [field]: true }))
            }
          }, 100)
        }, index * 400)
      })
      setTimeout(() => {
        setIsAnimating(false)
        setFieldAnimations({})
      }, fields.length * 400 + 1000)
    }
  }, [initialData])

  const handleInputChange = (field: keyof ExpenseData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setUserEditedFields(prev => ({ ...prev, [field]: true }))
    setAiFilledFields(prev => ({ ...prev, [field]: false }))
  }

  // Generate accounting preview
  const getAccountingPreview = () => {
    const amount = parseFloat(formData.amount)
    if (!amount || amount <= 0) return null
    const categoryName = formatCategoryLabel(formData.category)
    return {
      debit: { account: `${categoryName} Expense`, amount },
      credit: { account: 'Cash Account', amount }
    }
  }

  const accountingPreview = getAccountingPreview()
  const balanceDelta = accountingPreview ? Number((accountingPreview.debit.amount - accountingPreview.credit.amount).toFixed(2)) : 0
  const isBalanced = accountingPreview ? Math.abs(balanceDelta) < 0.01 : true

  // Helpers
  const addCustomField = (field: CustomFieldDef) => {
    const exists = customFields.some(f => f.name.toLowerCase() === field.name.toLowerCase())
    if (exists) return
    setCustomFields(prev => [...prev, { ...field, id: `${field.name}-${Date.now()}` }])
  }

  const handleAddSuggestion = (id: string) => {
    // kept for backward compatibility (not used now)
  }

  const handleAddAISuggestion = (s: AiSuggestion) => {
    // 1. Add to customFields (use value/options if provided)
    addCustomField({
      id: `${s.name}-${Date.now()}`,
      name: s.name,
      type: s.type,
      value: s.value ? String(s.value) : '',
      options: s.options,
      aiSuggested: true,
      confidence: s.confidence
    })
    // 2. Trigger a quick visual pulse on the list area
    setFieldAnimations(prev => ({ ...prev, [`custom-${s.name}`]: true }))
    setTimeout(() => setFieldAnimations(prev => ({ ...prev, [`custom-${s.name}`]: false })), 600)
    // 3. Remove from local + notify parent
    setLocalSuggestions(prev => prev.filter(x => x.name.toLowerCase() !== s.name.toLowerCase()))
    if (onConsumeSuggestion) onConsumeSuggestion(s.name)
  }

  const handleCustomFieldChange = (id: string, updates: Partial<CustomFieldDef>) => {
    setCustomFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const handleRemoveCustomField = (id: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== id))
  }

  const handleReorder = (newOrder: CustomFieldDef[]) => {
    setCustomFields(newOrder)
  }

  const validateForm = () => {
    if (!formData.vendor.trim()) { alert('Vendor name is required'); return false }
    if (!formData.amount || parseFloat(formData.amount) <= 0) { alert('Please enter a valid amount'); return false }
    if (!formData.date) { alert('Date is required'); return false }
    for (const f of customFields) {
      if ((f.type === 'number' || f.type === 'currency') && f.value && isNaN(Number(f.value))) { alert(`${f.name} must be a valid number`); return false }
      if (f.type === 'dropdown' && f.options && f.value && !f.options.includes(f.value)) { alert(`${f.name} must be one of: ${f.options.join(', ')}`); return false }
    }
    return true
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setIsSaving(true)
    try {
      const customFieldsPayload = customFields.map(({ id, ...rest }) => rest)
      
      // Use our FinancialDataService instead of direct API call
      const result = FinancialDataService.addExpenseTransaction({
        vendor: formData.vendor,
        category: formData.category,
        date: formData.date,
        amount: parseFloat(formData.amount),
        description: formData.description,
        customFields: customFieldsPayload,
        paymentStatus: formData.paymentStatus // Pass the payment status
      })
      
      // Invalidate all relevant queries to trigger real-time updates
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      
      // Show success message
      alert(result.message)
      setTimeout(() => { onSave() }, 500)
    } catch (error) {
      console.error('Error saving expense:', error)
      alert('Error saving expense. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const renderCustomFieldInput = (field: CustomFieldDef) => {
    const commonProps = {
      className: 'w-full input-glass transition-all duration-300',
      value: field.value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        handleCustomFieldChange(field.id, { value: e.target.value })
    }
    switch (field.type) {
      case 'text': return <input type="text" placeholder={field.name} {...commonProps} />
      case 'number': return <input type="number" placeholder={field.name} {...commonProps} />
      case 'currency': return <input type="number" step="0.01" placeholder={field.name} {...commonProps} />
      case 'date': return <input type="date" {...commonProps} />
      case 'dropdown':
        return (
          <select {...(commonProps as any)}>
            <option value="">Select {field.name}</option>
            {(field.options || []).map(opt => (
              <option key={opt} value={opt} className="bg-gray-800 text-white">{opt}</option>
            ))}
          </select>
        )
      default: return <input type="text" placeholder={field.name} {...commonProps} />
    }
  }

  return (
    <div className="w-full">
      <div className="flex w-full max-h-[70vh]">
        {/* Form column (scrollable) */}
        <div className={`flex-1 overflow-auto scrollbar-kinetic pr-4 max-h-[70vh]`}>
          <motion.div className="space-y-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">Expense Details</h3>
                <p className="text-gray-400 mt-1">Review and edit the extracted information</p>
              </div>
              <div className="flex items-center gap-2">
                <motion.button onClick={onCancel} className="btn-glass px-4 py-2 text-sm" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={isSaving}>Cancel</motion.button>
                <motion.button onClick={handleSave} disabled={isSaving || !formData.vendor || !formData.amount} className="btn-electric px-4 py-2 text-sm relative overflow-hidden" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {isSaving ? (<div className="flex items-center justify-center space-x-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Saving...</span></div>) : (<span>💾 Save</span>)}
                </motion.button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Vendor */}
              <motion.div className="space-y-2" initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0, duration: 0.6, type: 'spring' as const, stiffness: 100 }}>
                <label className="block text-sm font-medium text-gray-300">Vendor {(!userEditedFields.vendor && aiFilledFields.vendor) && (<span className="ml-2 text-xs text-electric-400 bg-electric-500/20 px-2 py-1 rounded-full">✨ AI Filled</span>)} {(userEditedFields.vendor || !aiFilledFields.vendor) && (<span className="ml-1 text-red-400">*</span>)}</label>
                <motion.input type="text" value={formData.vendor} onChange={(e) => handleInputChange('vendor', e.target.value)} placeholder="e.g., Adobe Systems" className={`w-full input-glass transition-all duration-300 ${fieldAnimations.vendor ? 'border-electric-500 shadow-lg shadow-electric-500/20' : ''}`} whileFocus={{ scale: 1.02 }} />
              </motion.div>
              {/* Amount */}
              <motion.div className="space-y-2" initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.1, duration: 0.6, type: 'spring' as const, stiffness: 100 }}>
                <label className="block text-sm font-medium text-gray-300">Amount {(!userEditedFields.amount && aiFilledFields.amount) && (<span className="ml-2 text-xs text-electric-400 bg-electric-500/20 px-2 py-1 rounded-full">✨ AI Filled</span>)} {(userEditedFields.amount || !aiFilledFields.amount) && (<span className="ml-1 text-red-400">*</span>)}</label>
                <motion.input type="number" step="0.01" value={formData.amount} onChange={(e) => handleInputChange('amount', e.target.value)} placeholder="0.00" className={`w-full input-glass transition-all duration-300 ${fieldAnimations.amount ? 'border-electric-500 shadow-lg shadow-electric-500/20' : ''}`} whileFocus={{ scale: 1.02 }} />
              </motion.div>
              {/* Date */}
              <motion.div className="space-y-2" initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.2, duration: 0.6, type: 'spring' as const, stiffness: 100 }}>
                <label className="block text-sm font-medium text-gray-300">Date {(!userEditedFields.date && aiFilledFields.date) && (<span className="ml-2 text-xs text-electric-400 bg-electric-500/20 px-2 py-1 rounded-full">✨ AI Filled</span>)} {(userEditedFields.date || !aiFilledFields.date) && (<span className="ml-1 text-red-400">*</span>)}</label>
                <motion.input type="date" value={formData.date} onChange={(e) => handleInputChange('date', e.target.value)} className={`w-full input-glass transition-all duration-300 ${fieldAnimations.date ? 'border-electric-500 shadow-lg shadow-electric-500/20' : ''}`} whileFocus={{ scale: 1.02 }} />
              </motion.div>
              {/* Category */}
              <motion.div className="space-y-2" initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.3, duration: 0.6, type: 'spring' as const, stiffness: 100 }}>
                <label className="block text-sm font-medium text-gray-300">Category {(!userEditedFields.category && aiFilledFields.category) && (<span className="ml-2 text-xs text-electric-400 bg-electric-500/20 px-2 py-1 rounded-full">✨ AI Filled</span>)}</label>
                <motion.select value={formData.category} onChange={(e) => handleInputChange('category', e.target.value)} className={`w-full input-glass transition-all duration-300 ${fieldAnimations.category ? 'border-electric-500 shadow-lg shadow-electric-500/20' : ''}`} whileFocus={{ scale: 1.02 }}>
                  {categories.map(category => (
                    <option key={category} value={category} className="bg-gray-800 text-white">{formatCategoryLabel(category)}</option>
                  ))}
                </motion.select>
              </motion.div>
              
              {/* Payment Status */}
              <motion.div className="space-y-2" initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.35, duration: 0.6, type: 'spring' as const, stiffness: 100 }}>
                <label className="block text-sm font-medium text-gray-300">
                  Payment Status
                  <span className="ml-2 text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded-full">🧾 Accounting</span>
                  {(!userEditedFields.paymentStatus && aiFilledFields.paymentStatus) && (
                    <span className="ml-2 text-xs text-electric-400 bg-electric-500/20 px-2 py-1 rounded-full">✨ AI Filled</span>
                  )}
                  {(initialData?.paymentStatus) && (
                    <span className="ml-2 text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded-full">🤖 AI Detected</span>
                  )}
                </label>
                <motion.select 
                  value={formData.paymentStatus} 
                  onChange={(e) => handleInputChange('paymentStatus', e.target.value as 'paid' | 'invoice')} 
                  className={`w-full input-glass transition-all duration-300 ${fieldAnimations.paymentStatus ? 'border-electric-500 shadow-lg shadow-electric-500/20' : ''}`} 
                  whileFocus={{ scale: 1.02 }}
                >
                  <option value="invoice" className="bg-gray-800 text-white">📄 Invoice Received (Unpaid)</option>
                  <option value="paid" className="bg-gray-800 text-white">💰 Expense Paid (Cash Out)</option>
                </motion.select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.paymentStatus === 'invoice' 
                    ? '💡 Creates liability (Accounts Payable) - you owe money'
                    : '💡 Reduces cash immediately - payment already made'
                  }
                </p>
              </motion.div>
            </div>

            {/* Description */}
            <motion.div className="space-y-2" initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.4, duration: 0.6, type: 'spring' as const, stiffness: 100 }}>
              <label className="block text-sm font-medium text-gray-300">Description {(!userEditedFields.description && aiFilledFields.description) && (<span className="ml-2 text-xs text-electric-400 bg-electric-500/20 px-2 py-1 rounded-full">✨ AI Filled</span>)}</label>
              <motion.textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="Optional description or notes..." rows={3} className={`w-full input-glass transition-all duration-300 resize-none ${fieldAnimations.description ? 'border-electric-500 shadow-lg shadow-electric-500/20' : ''}`} whileFocus={{ scale: 1.02 }} />
            </motion.div>

            {/* Custom Fields - Reorderable */}
            {customFields.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm text-gray-300">Additional Fields</h4>
                <Reorder.Group axis="y" values={customFields} onReorder={handleReorder}>
                  {customFields.map(field => (
                    <Reorder.Item key={field.id} value={field}>
                      <motion.div className="glass rounded-lg p-3 flex items-center gap-3">
                        <div className="cursor-grab select-none text-gray-400">⋮⋮</div>
                        <div className="flex-1 space-y-1">
                          <input className="bg-transparent text-sm text-white font-medium focus:outline-none border-b border-transparent focus:border-electric-500" value={field.name} onChange={(e) => handleCustomFieldChange(field.id, { name: e.target.value })} />
                          {renderCustomFieldInput(field)}
                        </div>
                        <span className="text-xs text-gray-400 w-20 text-right">{field.type}</span>
                        <motion.button onClick={() => handleRemoveCustomField(field.id)} className="text-gray-400 hover:text-white" whileHover={{ scale: 1.1 }}>✕</motion.button>
                      </motion.div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>
            )}

            {/* AI Suggestions (dynamic) and Presets */}
            <div className="space-y-2">
              <h4 className="text-sm text-gray-300">AI Suggestions</h4>
              <div className="flex flex-wrap gap-3">
                {localSuggestions.map(s => (
                  <motion.div key={s.name} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                    <AiSuggestionButton
                      name={s.name}
                      confidence={s.confidence ?? 0.75}
                      onClick={() => handleAddAISuggestion(s)}
                    />
                  </motion.div>
                ))}
                {/* Presets (hide if already suggested or already exists) */}
                {localSuggestions.every(s => s.name.toLowerCase() !== 'status') && (
                  <motion.button onClick={() => addCustomField({ id: 'tmp1', name: 'Status', type: 'dropdown', value: '', options: dropdownPresets.Status })} className="btn-glass text-sm" whileHover={{ scale: 1.02 }}>+ Add Status</motion.button>
                )}
                {localSuggestions.every(s => s.name.toLowerCase() !== 'priority') && !customFields.some(f => f.name.toLowerCase() === 'priority') && (
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                    <AiSuggestionButton
                      name="Priority"
                      confidence={1}
                      showConfidence={false}
                      onClick={() => handleAddAISuggestion({ name: 'Priority', type: 'dropdown', options: dropdownPresets.Priority, confidence: 1 })}
                    />
                  </motion.div>
                )}
                {localSuggestions.every(s => s.name.toLowerCase() !== 'payment method') && (
                  <motion.button onClick={() => addCustomField({ id: 'tmp4', name: 'Payment Method', type: 'dropdown', value: '', options: dropdownPresets['Payment Method'] })} className="btn-glass text-sm" whileHover={{ scale: 1.02 }}>+ Add Payment Method</motion.button>
                )}
                {localSuggestions.every(s => s.name.toLowerCase() !== 'project code') && !customFields.some(f => f.name.toLowerCase() === 'project code') && (
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                    <AiSuggestionButton
                      name="Project Code"
                      confidence={1}
                      showConfidence={false}
                      onClick={() => handleAddAISuggestion({ name: 'Project Code', type: 'text', confidence: 1 })}
                    />
                  </motion.div>
                )}
              </div>
            </div>

            {/* Accounting Entry Preview */}
            {accountingPreview && (
              <motion.div className="glass rounded-lg p-4 border border-electric-500/20" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center"><span className="mr-2">📊</span>Accounting Entry Preview</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center"><span className="text-green-400">Debit: {accountingPreview.debit.account}</span><span className="text-green-400 font-mono">${accountingPreview.debit.amount.toFixed(2)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-red-400">Credit: {accountingPreview.credit.account}</span><span className="text-red-400 font-mono">${accountingPreview.credit.amount.toFixed(2)}</span></div>
                  <div className="border-t border-gray-600 pt-2 mt-2">
                    <div className="flex justify-between items-center text-xs"><span className="text-gray-400">Total Balance:</span>{isBalanced ? (<span className="text-green-400 bg-green-500/15 px-2 py-0.5 rounded-full">✅ Balanced</span>) : (<span className="text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full">❗ Out of balance: ${Math.abs(balanceDelta).toFixed(2)}</span>)}</div>
                  </div>
                </div>
              </motion.div>
            )}

            {isAnimating && (
              <motion.div className="absolute top-2 right-2 glass rounded-md px-3 py-2 flex items-center space-x-2 z-20 bg-black/40" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <div className="w-3 h-3 bg-electric-gradient rounded-full animate-pulse" />
                <span className="text-xs text-white">AI populating…</span>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default ExpenseForm 