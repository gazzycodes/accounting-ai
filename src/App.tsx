import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { FinancialDataService } from './services/financialDataService'
import Dashboard from './components/Dashboard'
import ChatDrawer from './components/ChatDrawer'
import AiImportModal from './components/AiImportModal'
import ReceiptUpload from './components/ReceiptUpload'
import ThreeBackground from './components/ThreeBackground'
import Reports from './components/Reports'

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'reports'>('dashboard')
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isReceiptUploadOpen, setIsReceiptUploadOpen] = useState(false)

  // Preload animation
  const [isLoading, setIsLoading] = useState(true)
  
  // Query client for cache invalidation
  const queryClient = useQueryClient()

  // Reset data function
  const handleResetData = () => {
    const confirmed = window.confirm('🗑️ Are you sure you want to reset all data? This will clear all transactions and restore initial demo data.')
    if (confirmed) {
      const result = FinancialDataService.resetData()
      
      // Invalidate all queries to trigger UI updates
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
      
      alert(result.message)
    }
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
      
      {/* Header */}
      <motion.header
        className="glass border-b border-white/10 p-4 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <motion.div
            className="flex items-center space-x-2"
            whileHover={{ scale: 1.05 }}
          >
            <div className="w-8 h-8 bg-electric-gradient rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <h1 className="text-2xl font-bold bg-electric-gradient bg-clip-text text-transparent">
              EZE Ledger
            </h1>
          </motion.div>
          
          <nav className="flex items-center space-x-4">
            <motion.button
              onClick={() => navigate('dashboard')}
              className={`px-4 py-2 rounded-lg transition-all duration-300 ${
                currentView === 'dashboard' 
                  ? 'bg-electric-600 text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Dashboard
            </motion.button>
            
            <motion.button
              onClick={() => setIsReceiptUploadOpen(true)}
              className="btn-glass"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Add Expense
            </motion.button>
            
            <motion.button
              onClick={() => setIsImportModalOpen(true)}
              className="btn-electric"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              AI Import
            </motion.button>

            <motion.button
              onClick={handleResetData}
              className="btn-red"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Reset Data
            </motion.button>
          </nav>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10">
        <AnimatePresence mode="wait">
          {currentView === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4 }}
            >
              <Dashboard onViewReports={() => navigate('reports')} />
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
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
          />
        )}
        
        {isReceiptUploadOpen && (
          <ReceiptUpload
            isOpen={isReceiptUploadOpen}
            onClose={() => setIsReceiptUploadOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default App 