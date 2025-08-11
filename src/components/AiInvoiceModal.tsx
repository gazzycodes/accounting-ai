import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Bot, 
  User, 
  Building, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  DollarSign, 
  FileText, 
  Send, 
  Download, 
  Eye, 
  Sparkles,
  Plus,
  Trash2,
  Search,
  Brain,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface AiInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
}

interface LineItem {
  id: string
  description: string
  quantity: number
  rate: number
  amount: number
}

interface Client {
  id: string
  name: string
  email: string
  company: string
  address: string
  phone: string
}

const AiInvoiceModal = ({ isOpen, onClose }: AiInvoiceModalProps) => {
  const [step, setStep] = useState<'client' | 'invoice' | 'preview'>('client')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showPaymentMethods, setShowPaymentMethods] = useState(false)
  const [showAccountingSettings, setShowAccountingSettings] = useState(false)
  const [showTaxDiscount, setShowTaxDiscount] = useState(false)
  const [activeLineItemId, setActiveLineItemId] = useState<string | null>(null)
  const [serviceSuggestions] = useState([
    { service: 'Web Development Services', defaultRate: 2500, category: 'Development' },
    { service: 'UI/UX Design', defaultRate: 1800, category: 'Design' },
    { service: 'Mobile App Development', defaultRate: 3500, category: 'Development' },
    { service: 'SEO Optimization', defaultRate: 800, category: 'Marketing' },
    { service: 'Content Writing', defaultRate: 500, category: 'Content' },
    { service: 'Social Media Management', defaultRate: 1200, category: 'Marketing' },
    { service: 'Database Setup', defaultRate: 1500, category: 'Development' },
    { service: 'API Integration', defaultRate: 2000, category: 'Development' },
    { service: 'Hosting & Maintenance', defaultRate: 300, category: 'Support' },
    { service: 'Training & Documentation', defaultRate: 1000, category: 'Support' }
  ])
  const [isGenerating, setIsGenerating] = useState(false)
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: '1',
      description: 'Web Development Services',
      quantity: 1,
      rate: 2500,
      amount: 2500
    }
  ])
  
  // Mock client data
  const mockClients: Client[] = [
    {
      id: '1',
      name: 'John Smith',
      email: 'john@techcorp.com',
      company: 'TechCorp Solutions',
      address: '123 Business Ave, San Francisco, CA 94105',
      phone: '+1 (555) 123-4567'
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah@startupinc.com',
      company: 'Startup Inc.',
      address: '456 Innovation Blvd, Austin, TX 78701',
      phone: '+1 (555) 987-6543'
    },
    {
      id: '3',
      name: 'Mike Chen',
      email: 'mike@designstudio.com',
      company: 'Design Studio Pro',
      address: '789 Creative St, New York, NY 10001',
      phone: '+1 (555) 456-7890'
    }
  ]

  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`,
    poNumber: '', // Purchase Order Number
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: 'Thank you for your business! Payment is due within 30 days.',
    paymentTerms: '30', // days
    currency: 'USD',
    status: 'draft', // draft, sent, paid, overdue, cancelled
    companyInfo: {
      name: 'EZE Ledger Inc.',
      address: '123 Business Street',
      city: 'San Francisco',
      state: 'CA',
      zip: '94105',
      country: 'USA',
      phone: '+1 (555) 123-4567',
      email: 'hello@ezeledger.com',
      website: 'www.ezeledger.com',
      taxId: '12-3456789', // Federal Tax ID
      businessNumber: 'CA-987654321' // State Business Number
    },
    taxSettings: {
      enabled: true,
      type: 'percentage', // 'percentage' or 'fixed'
      rate: 8.5,
      name: 'Sales Tax',
      taxExempt: false
    },
    discount: {
      enabled: false,
      type: 'percentage', // 'percentage' or 'fixed'
      value: 0,
      description: ''
    },
    lateFee: {
      enabled: false,
      type: 'percentage',
      value: 1.5,
      description: 'Late fee applied after due date'
    },
    paymentMethods: ['Bank Transfer', 'Credit Card', 'PayPal', 'Check'],
    template: 'professional', // 'professional', 'modern', 'minimal'
    termsAndConditions: 'Payment is due within the specified terms. Late payments may incur additional charges. All disputes must be resolved within 30 days of invoice date.',
    accountingSettings: {
      revenueAccount: '4000 - Sales Revenue',
      arAccount: '1200 - Accounts Receivable',
      taxPayableAccount: '2100 - Sales Tax Payable',
      discountAccount: '4900 - Sales Discounts'
    }
  })

  const filteredClients = mockClients.filter(client =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.company.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.email.toLowerCase().includes(clientSearch.toLowerCase())
  )

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
  
  // Calculate discount
  const discountAmount = invoiceData.discount.enabled 
    ? invoiceData.discount.type === 'percentage' 
      ? subtotal * (invoiceData.discount.value / 100)
      : invoiceData.discount.value
    : 0
  
  const afterDiscount = subtotal - discountAmount
  
  // Calculate tax (after discount if applicable)
  const taxAmount = invoiceData.taxSettings.enabled && !invoiceData.taxSettings.taxExempt
    ? invoiceData.taxSettings.type === 'percentage'
      ? afterDiscount * (invoiceData.taxSettings.rate / 100)
      : invoiceData.taxSettings.rate
    : 0
  
  const total = afterDiscount + taxAmount

  const addLineItem = () => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    }
    setLineItems([...lineItems, newItem])
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(items => items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        if (field === 'quantity' || field === 'rate') {
          updated.amount = updated.quantity * updated.rate
        }
        return updated
      }
      return item
    }))
  }

  const removeLineItem = (id: string) => {
    setLineItems(items => items.filter(item => item.id !== id))
  }

  const handleGenerateInvoice = async () => {
    setIsGenerating(true)
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsGenerating(false)
    setStep('preview')
  }

  const handleSendInvoice = () => {
    // Simulate sending
    alert(`Invoice ${invoiceData.invoiceNumber} sent to ${selectedClient?.email}!`)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        
        {/* Modal */}
        <motion.div
          className="relative w-full max-w-6xl max-h-[95vh] glass rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white flex items-center">
                    AI Invoice Generator
                    <Sparkles className="h-5 w-5 text-emerald-400 ml-2" />
                  </h3>
                  <p className="text-emerald-300 text-sm">Professional invoices powered by AI</p>
                </div>
              </div>
              <motion.button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-2"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="h-6 w-6" />
              </motion.button>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center mt-6">
              <div className="flex items-center space-x-4">
                {[
                  { id: 'client', label: 'Select Client', icon: User },
                  { id: 'invoice', label: 'Invoice Details', icon: FileText },
                  { id: 'preview', label: 'Preview & Send', icon: Eye }
                ].map((stepItem, index) => (
                  <div key={stepItem.id} className="flex items-center">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                      step === stepItem.id 
                        ? 'bg-emerald-500 border-emerald-400 text-white' 
                        : index < ['client', 'invoice', 'preview'].indexOf(step)
                          ? 'bg-emerald-500/50 border-emerald-400/50 text-emerald-200'
                          : 'bg-slate-700 border-slate-600 text-slate-400'
                    }`}>
                      <stepItem.icon className="h-5 w-5" />
                    </div>
                    <span className={`ml-2 text-sm font-medium ${
                      step === stepItem.id ? 'text-white' : 'text-slate-400'
                    }`}>
                      {stepItem.label}
                    </span>
                    {index < 2 && (
                      <div className={`w-8 h-0.5 mx-4 ${
                        index < ['client', 'invoice', 'preview'].indexOf(step)
                          ? 'bg-emerald-400'
                          : 'bg-slate-600'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(95vh-200px)]">
            <AnimatePresence mode="wait">
              {step === 'client' && (
                <motion.div
                  key="client"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-xl font-semibold text-white mb-6">Select or Add Client</h4>
                  
                  {/* Search */}
                  <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search clients by name, company, or email..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
                    />
                  </div>

                  {/* Client List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredClients.map((client) => (
                      <motion.button
                        key={client.id}
                        onClick={() => setSelectedClient(client)}
                        className={`p-6 rounded-xl border-2 text-left transition-all duration-300 ${
                          selectedClient?.id === client.id
                            ? 'bg-emerald-500/20 border-emerald-400 shadow-lg shadow-emerald-500/25'
                            : 'bg-slate-800/30 border-slate-600/30 hover:border-slate-500/50 hover:bg-slate-700/40'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                              <Building className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h5 className="font-semibold text-white">{client.name}</h5>
                              <p className="text-emerald-300 text-sm">{client.company}</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm text-slate-300">
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-slate-400" />
                            <span>{client.email}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4 text-slate-400" />
                            <span>{client.phone}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            <span>{client.address}</span>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  {/* Next Button */}
                  <div className="flex justify-end mt-8">
                    <motion.button
                      onClick={() => selectedClient && setStep('invoice')}
                      disabled={!selectedClient}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center space-x-2"
                      whileHover={selectedClient ? { scale: 1.05 } : {}}
                      whileTap={selectedClient ? { scale: 0.95 } : {}}
                    >
                      <span>Continue to Invoice Details</span>
                      <FileText className="h-5 w-5" />
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 'invoice' && (
                <motion.div
                  key="invoice"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  {/* Header with AI Assistant */}
                  <div className="flex items-center justify-between">
                    <h4 className="text-xl font-semibold text-white">Invoice Details</h4>
                    <div className="flex items-center space-x-2 px-3 py-2 bg-violet-500/20 border border-violet-400/30 rounded-lg">
                      <Sparkles className="h-4 w-4 text-violet-300" />
                      <span className="text-sm text-violet-200">AI Assistant Active</span>
                    </div>
                  </div>

                  {/* AI Suggestions Banner */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-violet-500/10 via-blue-500/10 to-emerald-500/10 border border-violet-400/20 rounded-xl p-4"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Brain className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <h6 className="font-medium text-white mb-1">Smart Suggestions</h6>
                        <p className="text-sm text-slate-300 mb-3">
                          Based on your history with {selectedClient?.company}, I recommend:
                        </p>
                        <div className="text-xs text-slate-400 mb-3 flex items-center space-x-4">
                          <span>💰 Last invoice: $2,500</span>
                          <span>📅 Typical terms: Net 30</span>
                          <span>🎯 Preferred services: Web Development</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setLineItems([{
                                id: '1',
                                description: 'Web Development Services',
                                quantity: 1,
                                rate: 2500,
                                amount: 2500
                              }])
                            }}
                            className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded-lg text-sm text-emerald-200 transition-colors"
                          >
                            + Web Dev Services
                          </button>
                          <button
                            onClick={() => {
                              setInvoiceData({
                                ...invoiceData,
                                paymentTerms: '30',
                                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                              })
                            }}
                            className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-sm text-blue-200 transition-colors"
                          >
                            + Net 30 Terms
                          </button>
                          <button
                            onClick={() => {
                              setInvoiceData({
                                ...invoiceData,
                                taxSettings: {
                                  ...invoiceData.taxSettings,
                                  enabled: true,
                                  name: 'Sales Tax',
                                  type: 'percentage',
                                  rate: 8.5
                                }
                              })
                            }}
                            className="px-3 py-1 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 rounded-lg text-sm text-orange-200 transition-colors"
                          >
                            + Add Tax
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Essential Info */}
                    <div className="space-y-6">
                      <div className="bg-slate-800/30 border border-slate-600/30 rounded-xl p-6">
                        <h5 className="text-lg font-semibold text-white mb-4 flex items-center">
                          <FileText className="h-5 w-5 mr-2 text-emerald-400" />
                          Essential Details
                        </h5>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Invoice Number</label>
                              <input
                                type="text"
                                value={invoiceData.invoiceNumber}
                                onChange={(e) => setInvoiceData({...invoiceData, invoiceNumber: e.target.value})}
                                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
                              <input
                                type="date"
                                value={invoiceData.date}
                                onChange={(e) => setInvoiceData({...invoiceData, date: e.target.value})}
                                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Payment Terms</label>
                              <select
                                value={invoiceData.paymentTerms}
                                onChange={(e) => setInvoiceData({...invoiceData, paymentTerms: e.target.value, dueDate: new Date(Date.now() + parseInt(e.target.value) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]})}
                                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              >
                                <option value="0">Due on Receipt</option>
                                <option value="15">Net 15</option>
                                <option value="30">Net 30</option>
                                <option value="60">Net 60</option>
                                <option value="90">Net 90</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">Due Date</label>
                              <input
                                type="date"
                                value={invoiceData.dueDate}
                                onChange={(e) => setInvoiceData({...invoiceData, dueDate: e.target.value})}
                                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                            <textarea
                              value={invoiceData.notes}
                              onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
                              rows={2}
                              placeholder="Thank you for your business! Payment is due within 30 days."
                              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 resize-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quick Tax & Discount Toggles */}
                      <div className="bg-slate-800/30 border border-slate-600/30 rounded-xl p-6">
                        <h5 className="text-lg font-semibold text-white mb-4 flex items-center">
                          <DollarSign className="h-5 w-5 mr-2 text-blue-400" />
                          Tax & Discounts
                        </h5>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                            <div>
                              <div className="text-sm font-medium text-white">Apply Tax</div>
                              <div className="text-xs text-slate-400">
                                {invoiceData.taxSettings.enabled ? `${invoiceData.taxSettings.name} (${invoiceData.taxSettings.rate}%)` : 'No tax applied'}
                              </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={invoiceData.taxSettings.enabled}
                                onChange={(e) => setInvoiceData({
                                  ...invoiceData,
                                  taxSettings: {...invoiceData.taxSettings, enabled: e.target.checked}
                                })}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                            <div>
                              <div className="text-sm font-medium text-white">Add Discount</div>
                              <div className="text-xs text-slate-400">
                                {invoiceData.discount.enabled ? `${invoiceData.discount.description || 'Discount'} (${invoiceData.discount.value}${invoiceData.discount.type === 'percentage' ? '%' : ''})` : 'No discount applied'}
                              </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={invoiceData.discount.enabled}
                                onChange={(e) => setInvoiceData({
                                  ...invoiceData,
                                  discount: {...invoiceData.discount, enabled: e.target.checked}
                                })}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Line Items & Advanced */}
                    <div className="space-y-6">
                      {/* Line Items */}
                      <div className="bg-slate-800/30 border border-slate-600/30 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="text-lg font-semibold text-white flex items-center">
                            <Plus className="h-5 w-5 mr-2 text-emerald-400" />
                            Line Items
                          </h5>
                          <motion.button
                            onClick={addLineItem}
                            className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-400/30 text-emerald-300 rounded-lg transition-colors flex items-center space-x-2 text-sm"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Plus className="h-4 w-4" />
                            <span>Add Item</span>
                          </motion.button>
                        </div>

                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {lineItems.map((item) => (
                            <div key={item.id} className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 mr-3 relative">
                                  <input
                                    type="text"
                                    placeholder="Service description..."
                                    value={item.description}
                                    onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                                    onFocus={() => setActiveLineItemId(item.id)}
                                    onBlur={() => setTimeout(() => setActiveLineItemId(null), 200)}
                                    className="w-full px-2 py-1 bg-slate-600/50 border border-slate-500/50 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                                  />
                                  
                                  {/* AI Autocomplete Suggestions */}
                                  {activeLineItemId === item.id && item.description.length > 2 && (
                                    <motion.div
                                      initial={{ opacity: 0, y: -10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -10 }}
                                      className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 max-h-32 overflow-y-auto"
                                    >
                                      {serviceSuggestions
                                        .filter(suggestion => 
                                          suggestion.service.toLowerCase().includes(item.description.toLowerCase())
                                        )
                                        .slice(0, 4)
                                        .map((suggestion, index) => (
                                          <button
                                            key={index}
                                            onClick={() => {
                                              updateLineItem(item.id, 'description', suggestion.service)
                                              updateLineItem(item.id, 'rate', suggestion.defaultRate)
                                              setActiveLineItemId(null)
                                            }}
                                            className="w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors border-b border-slate-600/50 last:border-b-0"
                                          >
                                            <div className="flex items-center justify-between">
                                              <div>
                                                <div className="text-white text-sm font-medium">{suggestion.service}</div>
                                                <div className="text-slate-400 text-xs">{suggestion.category}</div>
                                              </div>
                                              <div className="text-emerald-300 text-sm font-semibold">
                                                ${suggestion.defaultRate}
                                              </div>
                                            </div>
                                          </button>
                                        ))
                                      }
                                      {serviceSuggestions.filter(suggestion => 
                                        suggestion.service.toLowerCase().includes(item.description.toLowerCase())
                                      ).length === 0 && (
                                        <div className="px-3 py-2 text-slate-400 text-sm">
                                          <div className="flex items-center space-x-2">
                                            <Brain className="h-4 w-4 text-violet-400" />
                                            <span>AI will learn from this service for future suggestions</span>
                                          </div>
                                        </div>
                                      )}
                                    </motion.div>
                                  )}
                                </div>
                                <motion.button
                                  onClick={() => removeLineItem(item.id)}
                                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </motion.button>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Qty</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-1 bg-slate-600/50 border border-slate-500/50 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Rate</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.rate}
                                    onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-1 bg-slate-600/50 border border-slate-500/50 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Amount</label>
                                  <div className="px-2 py-1 bg-slate-600/30 border border-slate-500/30 rounded text-emerald-300 text-xs font-medium">
                                    ${item.amount.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Totals */}
                        <div className="mt-4 p-3 bg-slate-700/50 rounded-lg border border-slate-600/50">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-slate-300">
                              <span>Subtotal</span>
                              <span>{invoiceData.currency === 'USD' ? '$' : invoiceData.currency === 'EUR' ? '€' : invoiceData.currency === 'GBP' ? '£' : '$'}{subtotal.toFixed(2)}</span>
                            </div>
                            {invoiceData.discount.enabled && discountAmount > 0 && (
                              <div className="flex justify-between text-emerald-300">
                                <span>Discount</span>
                                <span>-{invoiceData.currency === 'USD' ? '$' : invoiceData.currency === 'EUR' ? '€' : invoiceData.currency === 'GBP' ? '£' : '$'}{discountAmount.toFixed(2)}</span>
                              </div>
                            )}
                            {invoiceData.taxSettings.enabled && taxAmount > 0 && (
                              <div className="flex justify-between text-blue-300">
                                <span>Tax ({invoiceData.taxSettings.name})</span>
                                <span>{invoiceData.currency === 'USD' ? '$' : invoiceData.currency === 'EUR' ? '€' : invoiceData.currency === 'GBP' ? '£' : '$'}{taxAmount.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-lg font-semibold text-white border-t border-slate-600/50 pt-2">
                              <span>Total</span>
                              <span>{invoiceData.currency === 'USD' ? '$' : invoiceData.currency === 'EUR' ? '€' : invoiceData.currency === 'GBP' ? '£' : '$'}{total.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Advanced Settings - Collapsible */}
                      <div className="bg-slate-800/30 border border-slate-600/30 rounded-xl p-6">
                        <motion.button
                          onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                          className="flex items-center justify-between w-full text-left hover:bg-slate-700/30 p-3 rounded-lg transition-colors"
                          whileHover={{ scale: 1.01 }}
                        >
                          <h5 className="text-lg font-semibold text-white flex items-center">
                            <Settings className="h-5 w-5 mr-2 text-violet-400" />
                            Advanced Settings
                          </h5>
                          <motion.div
                            animate={{ rotate: showAdvancedSettings ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="h-5 w-5 text-slate-400" />
                          </motion.div>
                        </motion.button>

                        <AnimatePresence>
                          {showAdvancedSettings && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="mt-4 space-y-4"
                            >
                              {/* Optional Fields */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-slate-300 mb-2">PO Number</label>
                                  <input
                                    type="text"
                                    placeholder="Purchase Order (optional)"
                                    value={invoiceData.poNumber}
                                    onChange={(e) => setInvoiceData({...invoiceData, poNumber: e.target.value})}
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-slate-300 mb-2">Currency</label>
                                  <select
                                    value={invoiceData.currency}
                                    onChange={(e) => setInvoiceData({...invoiceData, currency: e.target.value})}
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                                  >
                                    <option value="USD">USD ($)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="GBP">GBP (£)</option>
                                    <option value="CAD">CAD ($)</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Terms & Conditions</label>
                                <textarea
                                  value={invoiceData.termsAndConditions}
                                  onChange={(e) => setInvoiceData({...invoiceData, termsAndConditions: e.target.value})}
                                  rows={3}
                                  placeholder="Legal terms, payment conditions, dispute resolution..."
                                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50 resize-none"
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Tax & Discount Details - Collapsible */}
                  <div className={`bg-slate-800/30 border border-slate-600/30 rounded-xl overflow-hidden`}>
                    <motion.button
                      onClick={() => setShowTaxDiscount(!showTaxDiscount)}
                      className="flex items-center justify-between w-full p-4 hover:bg-slate-700/30 transition-colors"
                      whileHover={{ scale: 1.01 }}
                    >
                      <h5 className="text-lg font-semibold text-white flex items-center">
                        <DollarSign className="h-5 w-5 mr-2 text-blue-400" />
                        Tax & Discount Details
                      </h5>
                      <motion.div
                        animate={{ rotate: showTaxDiscount ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      </motion.div>
                    </motion.button>
                    <AnimatePresence>
                      {showTaxDiscount && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-slate-600/30 p-6"
                        >
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Tax Settings */}
                      <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-600/30">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-sm font-medium text-slate-300">Tax Settings</label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={invoiceData.taxSettings.enabled}
                              onChange={(e) => setInvoiceData({
                                ...invoiceData,
                                taxSettings: {...invoiceData.taxSettings, enabled: e.target.checked}
                              })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                        </div>
                        
                        {invoiceData.taxSettings.enabled && (
                          <div className="space-y-3">
                            <div>
                              <input
                                type="text"
                                placeholder="Tax Name (e.g., Sales Tax, VAT)"
                                value={invoiceData.taxSettings.name}
                                onChange={(e) => setInvoiceData({
                                  ...invoiceData,
                                  taxSettings: {...invoiceData.taxSettings, name: e.target.value}
                                })}
                                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <select
                                value={invoiceData.taxSettings.type}
                                onChange={(e) => setInvoiceData({
                                  ...invoiceData,
                                  taxSettings: {...invoiceData.taxSettings, type: e.target.value as 'percentage' | 'fixed'}
                                })}
                                className="px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              >
                                <option value="percentage">Percentage</option>
                                <option value="fixed">Fixed Amount</option>
                              </select>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={invoiceData.taxSettings.rate}
                                  onChange={(e) => setInvoiceData({
                                    ...invoiceData,
                                    taxSettings: {...invoiceData.taxSettings, rate: parseFloat(e.target.value) || 0}
                                  })}
                                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                                />
                                {invoiceData.taxSettings.type === 'percentage' && (
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                                )}
                              </div>
                            </div>
                            <label className="flex items-center space-x-2 text-sm text-slate-300">
                              <input
                                type="checkbox"
                                checked={invoiceData.taxSettings.taxExempt}
                                onChange={(e) => setInvoiceData({
                                  ...invoiceData,
                                  taxSettings: {...invoiceData.taxSettings, taxExempt: e.target.checked}
                                })}
                                className="rounded border-slate-600 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span>Tax Exempt</span>
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Discount Settings */}
                      <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-600/30">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-sm font-medium text-slate-300">Discount</label>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={invoiceData.discount.enabled}
                              onChange={(e) => setInvoiceData({
                                ...invoiceData,
                                discount: {...invoiceData.discount, enabled: e.target.checked}
                              })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                        </div>
                        
                        {invoiceData.discount.enabled && (
                          <div className="space-y-3">
                            <div>
                              <input
                                type="text"
                                placeholder="Discount Description"
                                value={invoiceData.discount.description}
                                onChange={(e) => setInvoiceData({
                                  ...invoiceData,
                                  discount: {...invoiceData.discount, description: e.target.value}
                                })}
                                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <select
                                value={invoiceData.discount.type}
                                onChange={(e) => setInvoiceData({
                                  ...invoiceData,
                                  discount: {...invoiceData.discount, type: e.target.value as 'percentage' | 'fixed'}
                                })}
                                className="px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              >
                                <option value="percentage">Percentage</option>
                                <option value="fixed">Fixed Amount</option>
                              </select>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={invoiceData.discount.value}
                                  onChange={(e) => setInvoiceData({
                                    ...invoiceData,
                                    discount: {...invoiceData.discount, value: parseFloat(e.target.value) || 0}
                                  })}
                                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                                />
                                {invoiceData.discount.type === 'percentage' && (
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        </div>
                        </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Payment Methods - Collapsible */}
                  <div className={`bg-slate-800/30 border border-slate-600/30 rounded-xl overflow-hidden`}>
                    <motion.button
                      onClick={() => setShowPaymentMethods(!showPaymentMethods)}
                      className="flex items-center justify-between w-full p-4 hover:bg-slate-700/30 transition-colors"
                      whileHover={{ scale: 1.01 }}
                    >
                      <h5 className="text-lg font-semibold text-white flex items-center">
                        <DollarSign className="h-5 w-5 mr-2 text-green-400" />
                        Payment Methods
                      </h5>
                      <motion.div
                        animate={{ rotate: showPaymentMethods ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      </motion.div>
                    </motion.button>
                    <AnimatePresence>
                      {showPaymentMethods && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-slate-600/30 p-6"
                        >
                        <label className="block text-sm font-medium text-slate-300 mb-3">Accepted Payment Methods</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['Bank Transfer', 'Credit Card', 'PayPal', 'Check', 'Cash', 'Crypto'].map((method) => (
                            <label key={method} className="flex items-center space-x-2 text-sm text-slate-300">
                              <input
                                type="checkbox"
                                checked={invoiceData.paymentMethods.includes(method)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setInvoiceData({
                                      ...invoiceData,
                                      paymentMethods: [...invoiceData.paymentMethods, method]
                                    })
                                  } else {
                                    setInvoiceData({
                                      ...invoiceData,
                                      paymentMethods: invoiceData.paymentMethods.filter(m => m !== method)
                                    })
                                  }
                                }}
                                className="rounded border-slate-600 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span>{method}</span>
                            </label>
                          ))}
                        </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Accounting Integration - Collapsible */}
                  <div className={`bg-slate-800/30 border border-slate-600/30 rounded-xl overflow-hidden`}>
                    <motion.button
                      onClick={() => setShowAccountingSettings(!showAccountingSettings)}
                      className="flex items-center justify-between w-full p-4 hover:bg-slate-700/30 transition-colors"
                      whileHover={{ scale: 1.01 }}
                    >
                      <h5 className="text-lg font-semibold text-white flex items-center">
                        <Settings className="h-5 w-5 mr-2 text-blue-400" />
                        Accounting Integration
                      </h5>
                      <motion.div
                        animate={{ rotate: showAccountingSettings ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      </motion.div>
                    </motion.button>
                    <AnimatePresence>
                      {showAccountingSettings && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-slate-600/30 p-6"
                      >
                        <label className="block text-sm font-medium text-slate-300 mb-3">Chart of Accounts Integration</label>
                        <div className="space-y-3 text-sm">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Revenue Account</label>
                            <select
                              value={invoiceData.accountingSettings.revenueAccount}
                              onChange={(e) => setInvoiceData({
                                ...invoiceData,
                                accountingSettings: {...invoiceData.accountingSettings, revenueAccount: e.target.value}
                              })}
                              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                            >
                              <option value="4000 - Sales Revenue">4000 - Sales Revenue</option>
                              <option value="4100 - Service Revenue">4100 - Service Revenue</option>
                              <option value="4200 - Consulting Revenue">4200 - Consulting Revenue</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">A/R Account</label>
                            <select
                              value={invoiceData.accountingSettings.arAccount}
                              onChange={(e) => setInvoiceData({
                                ...invoiceData,
                                accountingSettings: {...invoiceData.accountingSettings, arAccount: e.target.value}
                              })}
                              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                            >
                              <option value="1200 - Accounts Receivable">1200 - Accounts Receivable</option>
                              <option value="1210 - Trade Receivables">1210 - Trade Receivables</option>
                            </select>
                          </div>
                          {invoiceData.taxSettings.enabled && (
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Tax Payable Account</label>
                              <select
                                value={invoiceData.accountingSettings.taxPayableAccount}
                                onChange={(e) => setInvoiceData({
                                  ...invoiceData,
                                  accountingSettings: {...invoiceData.accountingSettings, taxPayableAccount: e.target.value}
                                })}
                                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                              >
                                <option value="2100 - Sales Tax Payable">2100 - Sales Tax Payable</option>
                                <option value="2110 - GST/HST Payable">2110 - GST/HST Payable</option>
                                <option value="2120 - State Tax Payable">2120 - State Tax Payable</option>
                              </select>
                            </div>
                          )}
                        </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between mt-8">
                    <motion.button
                      onClick={() => setStep('client')}
                      className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Back to Client
                    </motion.button>
                    <motion.button
                      onClick={handleGenerateInvoice}
                      disabled={isGenerating || lineItems.length === 0}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center space-x-2"
                      whileHover={!isGenerating ? { scale: 1.05 } : {}}
                      whileTap={!isGenerating ? { scale: 0.95 } : {}}
                    >
                      {isGenerating ? (
                        <>
                          <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                          <span>Generating Invoice...</span>
                        </>
                      ) : (
                        <>
                          <span>Generate Preview</span>
                          <Eye className="h-5 w-5" />
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {step === 'preview' && (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <h4 className="text-xl font-semibold text-white mb-6">Invoice Preview</h4>
                  
                  <div className="bg-white rounded-xl p-8 text-black max-h-[600px] overflow-y-auto">
                    {/* Invoice Header */}
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">INVOICE</h1>
                        <div className="text-gray-600">
                          <p>Invoice #: {invoiceData.invoiceNumber}</p>
                          {invoiceData.poNumber && <p>PO #: {invoiceData.poNumber}</p>}
                          <p>Date: {new Date(invoiceData.date).toLocaleDateString()}</p>
                          <p>Due Date: {new Date(invoiceData.dueDate).toLocaleDateString()}</p>
                          <p className="text-sm font-medium">Status: <span className={`${
                            invoiceData.status === 'paid' ? 'text-green-600' :
                            invoiceData.status === 'overdue' ? 'text-red-600' :
                            invoiceData.status === 'sent' ? 'text-blue-600' :
                            'text-gray-600'
                          }`}>{invoiceData.status.toUpperCase()}</span></p>
                        </div>
                      </div>
                      <div className="text-right">
                        <h2 className="text-xl font-bold text-gray-800 mb-2">{invoiceData.companyInfo.name}</h2>
                        <div className="text-gray-600 text-sm">
                          <p>{invoiceData.companyInfo.address}</p>
                          <p>{invoiceData.companyInfo.city}, {invoiceData.companyInfo.state} {invoiceData.companyInfo.zip}</p>
                          <p>{invoiceData.companyInfo.country}</p>
                          <p>{invoiceData.companyInfo.phone}</p>
                          <p>{invoiceData.companyInfo.email}</p>
                          <p>{invoiceData.companyInfo.website}</p>
                          <div className="mt-2 pt-2 border-t border-gray-300">
                            <p className="text-xs">Tax ID: {invoiceData.companyInfo.taxId}</p>
                            <p className="text-xs">Business #: {invoiceData.companyInfo.businessNumber}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Client Info */}
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">Bill To:</h3>
                      <div className="text-gray-700">
                        <p className="font-medium">{selectedClient?.name}</p>
                        <p>{selectedClient?.company}</p>
                        <p>{selectedClient?.address}</p>
                        <p>{selectedClient?.email}</p>
                        <p>{selectedClient?.phone}</p>
                      </div>
                    </div>

                    {/* Line Items */}
                    <div className="mb-8">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 border-gray-300">
                            <th className="text-left py-3 font-semibold text-gray-800">Description</th>
                            <th className="text-center py-3 font-semibold text-gray-800">Qty</th>
                            <th className="text-right py-3 font-semibold text-gray-800">Rate</th>
                            <th className="text-right py-3 font-semibold text-gray-800">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item) => (
                            <tr key={item.id} className="border-b border-gray-200">
                              <td className="py-3 text-gray-700">{item.description}</td>
                              <td className="py-3 text-center text-gray-700">{item.quantity}</td>
                              <td className="py-3 text-right text-gray-700">${item.rate.toFixed(2)}</td>
                              <td className="py-3 text-right text-gray-700">${item.amount.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end mb-8">
                      <div className="w-80">
                        <div className="flex justify-between py-2 text-gray-700">
                          <span>Subtotal:</span>
                          <span>{invoiceData.currency === 'USD' ? '$' : invoiceData.currency === 'EUR' ? '€' : invoiceData.currency === 'GBP' ? '£' : '$'}{subtotal.toFixed(2)}</span>
                        </div>
                        {invoiceData.discount.enabled && discountAmount > 0 && (
                          <div className="flex justify-between py-2 text-red-600">
                            <span>
                              {invoiceData.discount.description || 'Discount'}
                              {invoiceData.discount.type === 'percentage' && ` (${invoiceData.discount.value}%)`}:
                            </span>
                            <span>-{invoiceData.currency === 'USD' ? '$' : invoiceData.currency === 'EUR' ? '€' : invoiceData.currency === 'GBP' ? '£' : '$'}{discountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {invoiceData.taxSettings.enabled && !invoiceData.taxSettings.taxExempt && taxAmount > 0 && (
                          <div className="flex justify-between py-2 text-gray-700">
                            <span>
                              {invoiceData.taxSettings.name || 'Tax'}
                              {invoiceData.taxSettings.type === 'percentage' && ` (${invoiceData.taxSettings.rate}%)`}:
                            </span>
                            <span>{invoiceData.currency === 'USD' ? '$' : invoiceData.currency === 'EUR' ? '€' : invoiceData.currency === 'GBP' ? '£' : '$'}{taxAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {invoiceData.taxSettings.taxExempt && (
                          <div className="flex justify-between py-2 text-yellow-600 font-medium">
                            <span>Tax Status:</span>
                            <span>Tax Exempt</span>
                          </div>
                        )}
                        <div className="flex justify-between py-3 border-t-2 border-gray-300 font-bold text-gray-800 text-lg">
                          <span>Total:</span>
                          <span>{invoiceData.currency === 'USD' ? '$' : invoiceData.currency === 'EUR' ? '€' : invoiceData.currency === 'GBP' ? '£' : '$'}{total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                      {/* Payment Terms */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Payment Terms:</h3>
                        <div className="text-gray-700">
                          <p>Payment due: {invoiceData.paymentTerms === '0' ? 'Upon receipt' : `${invoiceData.paymentTerms} days`}</p>
                          <p>Due date: {new Date(invoiceData.dueDate).toLocaleDateString()}</p>
                          {invoiceData.lateFee.enabled && (
                            <p className="text-red-600 text-sm mt-2">
                              Late fee: {invoiceData.lateFee.type === 'percentage' ? `${invoiceData.lateFee.value}%` : `$${invoiceData.lateFee.value}`} {invoiceData.lateFee.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Payment Methods */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Accepted Payment Methods:</h3>
                        <div className="text-gray-700">
                          <ul className="list-disc list-inside space-y-1">
                            {invoiceData.paymentMethods.map((method) => (
                              <li key={method}>{method}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {invoiceData.notes && (
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Notes:</h3>
                        <p className="text-gray-700">{invoiceData.notes}</p>
                      </div>
                    )}

                    {/* Terms & Conditions */}
                    {invoiceData.termsAndConditions && (
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Terms & Conditions:</h3>
                        <p className="text-gray-700 text-sm">{invoiceData.termsAndConditions}</p>
                      </div>
                    )}

                    {/* Accounting Information */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">Accounting Integration:</h3>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>Revenue Account: {invoiceData.accountingSettings.revenueAccount}</p>
                        <p>A/R Account: {invoiceData.accountingSettings.arAccount}</p>
                        {invoiceData.taxSettings.enabled && (
                          <p>Tax Payable: {invoiceData.accountingSettings.taxPayableAccount}</p>
                        )}
                        <p>Invoice Status: {invoiceData.status.toUpperCase()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between mt-8">
                    <motion.button
                      onClick={() => setStep('invoice')}
                      className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Back to Edit
                    </motion.button>
                    <div className="flex space-x-4">
                      <motion.button
                        onClick={() => alert('Invoice downloaded!')}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors flex items-center space-x-2"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Download className="h-5 w-5" />
                        <span>Download PDF</span>
                      </motion.button>
                      <motion.button
                        onClick={handleSendInvoice}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors flex items-center space-x-2"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Send className="h-5 w-5" />
                        <span>Send Invoice</span>
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default AiInvoiceModal
