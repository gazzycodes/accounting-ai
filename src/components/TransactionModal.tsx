import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CapitalForm from './CapitalForm'

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
}

const TransactionModal = ({ isOpen, onClose }: TransactionModalProps) => {

  if (!isOpen) return null

  const handleSuccess = () => {
    onClose()
    // Reset to default type for next time
    setSelectedType('expense')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Capital Contribution</h2>
                  <p className="text-gray-400 text-sm mt-1">Record owner investments and equity</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 pb-20 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 180px)' }}>
              <CapitalForm 
                onCancel={onClose}
                onSuccess={handleSuccess}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default TransactionModal
