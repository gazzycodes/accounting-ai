import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { FinancialDataService } from './services/financialDataService'
import Dashboard from './components/Dashboard'
import ChatDrawer from './components/ChatDrawer'
import AiImportModal from './components/AiImportModal'
import AiInvoiceModal from './components/AiInvoiceModal'
import ReceiptUpload from './components/ReceiptUpload'
import RecurringTransactionModal from './components/RecurringTransactionModal'
import Sidebar from './components/layout/Sidebar'
import ThreeBackground from './components/ThreeBackground'
import Reports from './components/Reports'
import TransactionModal from './components/TransactionModal'

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'reports'>('dashboard')
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isReceiptUploadOpen, setIsReceiptUploadOpen] = useState(false)
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false)
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const [transactionType, setTransactionType] = useState<'expense' | 'revenue' | 'capital'>('expense')

  // Preload animation
  const [isLoading, setIsLoading] = useState(true)
  
  // Query client for cache invalidation
  const queryClient = useQueryClient()

  // Reset data function
  const handleResetData = async () => {
    const confirmed = window.confirm('🗑️ Are you sure you want to reset all data? This will clear all transactions and restore initial demo data.')
    if (confirmed) {
      const result = await FinancialDataService.resetData()
      
      // Invalidate all queries to trigger UI updates
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
      
      alert(result.message)
    }
  }

  // Transaction handlers
  const handleAddExpense = () => {
    setTransactionType('expense')
    setIsTransactionModalOpen(true)
  }

  const handleAddRevenue = () => {
    setTransactionType('revenue')
    setIsTransactionModalOpen(true)
  }

  const handleAddCapital = () => {
    setTransactionType('capital')
    setIsTransactionModalOpen(true)
  }



  useEffect(() => {
    // Simulate app loading
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Sync initial route
    if (location.pathname === '/reports') {
      setCurrentView('reports')
    }
    const onPop = () => {
      setCurrentView(location.pathname === '/reports' ? 'reports' : 'dashboard')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = (view: 'dashboard' | 'reports') => {
    setCurrentView(view)
    const path = view === 'reports' ? '/reports' : '/'
    if (location.pathname !== path) {
      window.history.pushState(null, '', path)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-animated flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="w-16 h-16 border-4 border-electric-500 border-t-transparent rounded-full mx-auto mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <motion.h1
            className="text-4xl font-bold bg-electric-gradient bg-clip-text text-transparent mb-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            EZE Ledger
          </motion.h1>
          <motion.p
            className="text-gray-300 text-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            Initializing AI-First Accounting...
          </motion.p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-animated relative overflow-hidden">
        {/* Three.js Background - disable on Reports to reduce GPU load */}
        {currentView !== 'reports' && <ThreeBackground />}
        
        {/* Sidebar */}
        <Sidebar
          onViewReports={() => navigate('reports')}
          onSetupRecurring={() => setIsRecurringModalOpen(true)}
          onAddExpense={() => setIsReceiptUploadOpen(true)}
          onAiImport={() => setIsImportModalOpen(true)}
          onCreateInvoice={() => setIsCreateInvoiceModalOpen(true)}
          activeItem={currentView === 'reports' ? 'reports' : 'dashboard'}
          isAiImportOpen={isImportModalOpen}
          isRecurringModalOpen={isRecurringModalOpen}
          isAddExpenseOpen={isReceiptUploadOpen}
          isCreateInvoiceOpen={isCreateInvoiceModalOpen}
        />
        
        {/* AI Command Center Header */}
        <motion.header
          className="bg-slate-800/30 backdrop-blur-xl border-b border-white/10 relative z-10 transition-all duration-300"
          style={{ marginLeft: 'var(--sidebar-w)' }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              {/* AI-First Branding */}
              <motion.div
                className="flex items-center space-x-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
                  <span className="text-white font-bold text-lg">E</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                    EZE Ledger
                  </h1>
                  <p className="text-xs text-slate-400">AI Financial Command Center</p>
                </div>
              </motion.div>
              
              {/* Navigation Pills */}
              <nav className="flex items-center space-x-2">
                <motion.button
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                    currentView === 'dashboard' 
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-400/30 shadow-lg shadow-violet-500/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/30 border border-transparent hover:border-white/10'
                  }`}
                  onClick={() => navigate('dashboard')}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Dashboard
                </motion.button>
                
                <motion.button
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                    currentView === 'reports' 
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-400/30 shadow-lg shadow-violet-500/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/30 border border-transparent hover:border-white/10'
                  }`}
                  onClick={() => navigate('reports')}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Reports
                </motion.button>
              </nav>

              {/* Quick Action Controls */}
              <div className="flex items-center space-x-2">
                <motion.button
                  onClick={() => setIsReceiptUploadOpen(true)}
                  className="px-3 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-700/30 border border-transparent hover:border-white/10 transition-all duration-300"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  title="Add Expense (A)"
                >
                  Add Expense
                </motion.button>
                
                <motion.button
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-3 py-2 text-sm font-medium bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 hover:from-violet-500/30 hover:to-fuchsia-500/30 border border-violet-400/30 text-violet-300 rounded-xl transition-all duration-300 shadow-lg shadow-violet-500/20"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  title="AI Import (I)"
                >
                  AI Import
                </motion.button>

                <motion.button
                  onClick={() => setIsCreateInvoiceModalOpen(true)}
                  className="px-3 py-2 text-sm font-medium bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 border border-emerald-400/30 text-emerald-300 rounded-xl transition-all duration-300 shadow-lg shadow-emerald-500/20"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  title="Create Invoice (C)"
                >
                  Create Invoice
                </motion.button>


              </div>
            </div>
          </div>
        </motion.header>

      {/* Main Content */}
      <main 
        className="relative z-10 transition-all duration-300"
        style={{ marginLeft: 'var(--sidebar-w)' }}
      >
        <AnimatePresence mode="wait">
          {currentView === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4 }}
            >
              <Dashboard 
                onViewReports={() => navigate('reports')}
                onAddExpense={handleAddExpense}
                onAddRevenue={handleAddRevenue}
                onAddCapital={handleAddCapital}
                onAiImport={() => setIsImportModalOpen(true)}
                onCreateInvoice={() => setIsCreateInvoiceModalOpen(true)}
                onSetupRecurring={() => setIsRecurringModalOpen(true)}
              />
            </motion.div>
          )}
          {currentView === 'reports' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
            >
              <Reports />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Chat Drawer */}
      <ChatDrawer isOpen={isChatOpen} onToggle={setIsChatOpen} />
      
      {/* Modals */}
      <AnimatePresence>
        {isImportModalOpen && (
          <AiImportModal
            key="ai-import-modal"
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
          />
        )}

        {isCreateInvoiceModalOpen && (
          <AiInvoiceModal 
            key="ai-invoice-modal"
            isOpen={isCreateInvoiceModalOpen}
            onClose={() => setIsCreateInvoiceModalOpen(false)}
          />
        )}

        {isTransactionModalOpen && (
          <TransactionModal
            key="transaction-modal"
            isOpen={isTransactionModalOpen}
            onClose={() => setIsTransactionModalOpen(false)}
            initialType={transactionType}
          />
        )}
        
        {isReceiptUploadOpen && (
          <ReceiptUpload
            key="receipt-upload-modal"
            isOpen={isReceiptUploadOpen}
            onClose={() => setIsReceiptUploadOpen(false)}
          />
        )}
        
        {isRecurringModalOpen && (
          <RecurringTransactionModal
            key="recurring-modal"
            isOpen={isRecurringModalOpen}
            onClose={() => setIsRecurringModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default App 