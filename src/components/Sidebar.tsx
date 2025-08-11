import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMockDataStore } from '../store/mockDataStore'

interface SidebarProps {
  onViewReports?: () => void
  onSetupRecurring?: () => void
  onAddExpense?: () => void
  onAiImport?: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

const Sidebar = ({ 
  onViewReports, 
  onSetupRecurring, 
  onAddExpense, 
  onAiImport,
  isCollapsed = false,
  onToggleCollapse
}: SidebarProps) => {
  const { getRecurringTransactions } = useMockDataStore()
  const recurringTransactions = getRecurringTransactions()

  const quickActions = [
    {
      id: 'add-expense',
      label: 'Add Expense',
      icon: '📄',
      onClick: onAddExpense,
      className: 'btn-glass'
    },
    {
      id: 'ai-import',
      label: 'AI Import',
      icon: '🤖',
      onClick: onAiImport,
      className: 'btn-electric'
    },
    {
      id: 'setup-recurring',
      label: 'Set Up Recurring',
      icon: '🔄',
      onClick: onSetupRecurring,
      className: 'btn-electric'
    },
    {
      id: 'view-reports',
      label: 'View Reports',
      icon: '📊',
      onClick: onViewReports,
      className: 'btn-glass'
    },
    {
      id: 'generate-report',
      label: 'Monthly Report',
      icon: '📑',
      onClick: () => console.log('Generate monthly report'),
      className: 'btn-glass'
    },
    {
      id: 'connect-bank',
      label: 'Connect Bank',
      icon: '🏦',
      onClick: () => console.log('Connect bank account'),
      className: 'btn-glass'
    }
  ]

  return (
    <motion.div
      className={`fixed left-0 top-0 h-full z-40 transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-80'
      }`}
      initial={{ x: -320 }}
      animate={{ x: 0 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
    >
      {/* Sidebar Content */}
      <div className="h-full glass border-r border-white/10 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <motion.div
                className="flex items-center space-x-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="w-8 h-8 bg-electric-gradient rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">E</span>
                </div>
                <h2 className="text-lg font-bold bg-electric-gradient bg-clip-text text-transparent">
                  EZE Ledger
                </h2>
              </motion.div>
            )}
            <motion.button
              onClick={onToggleCollapse}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <span className="text-gray-400 text-xl">
                {isCollapsed ? '→' : '←'}
              </span>
            </motion.button>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Quick Actions */}
          <div>
            {!isCollapsed && (
              <motion.h3 
                className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                🎯 Quick Actions
              </motion.h3>
            )}
            <div className="space-y-2">
              {quickActions.map((action, index) => (
                <motion.button
                  key={action.id}
                  onClick={action.onClick}
                  className={`w-full ${action.className} text-left flex items-center space-x-3 p-3`}
                  whileHover={{ x: 5, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <span className="text-xl flex-shrink-0">{action.icon}</span>
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span
                        className="font-medium"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {action.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Recurring Transactions Section */}
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
                🔄 Recurring Transactions
              </h3>
              
              {recurringTransactions.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-xs text-gray-400 mb-3 p-2 bg-white/5 rounded-lg">
                    <div className="flex justify-between">
                      <span>Active:</span>
                      <span className="text-electric-400 font-medium">
                        {recurringTransactions.filter(r => r.isActive).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monthly Total:</span>
                      <span className="text-electric-400 font-medium">
                        ${recurringTransactions.filter(r => r.isActive).reduce((sum, r) => sum + r.amount, 0).toFixed(0)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
                    {recurringTransactions.slice(0, 5).map((recurring) => (
                      <motion.div
                        key={recurring.id}
                        className="p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                        whileHover={{ scale: 1.02, x: 5 }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">
                              {recurring.vendor}
                            </div>
                            <div className="text-xs text-gray-400">
                              {recurring.frequency} • ${recurring.amount.toFixed(0)}
                            </div>
                          </div>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ml-2 ${
                            recurring.isActive ? 'bg-green-400' : 'bg-gray-500'
                          }`} />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Next: {new Date(recurring.nextDate).toLocaleDateString()}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  
                  {recurringTransactions.length > 5 && (
                    <div className="text-center">
                      <span className="text-gray-500 text-xs">
                        +{recurringTransactions.length - 5} more
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">🔄</div>
                  <p className="text-gray-400 text-xs mb-3">
                    No recurring transactions
                  </p>
                  <motion.button
                    onClick={onSetupRecurring}
                    className="btn-electric text-xs px-3 py-2"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Set Up First
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}

          {/* Collapsed State - Show Recurring Count */}
          {isCollapsed && recurringTransactions.length > 0 && (
            <motion.div
              className="flex flex-col items-center space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="w-8 h-8 bg-electric-gradient rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {recurringTransactions.filter(r => r.isActive).length}
                </span>
              </div>
              <div className="text-xs text-gray-400 text-center">
                Recurring
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          {!isCollapsed ? (
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">AI-First Accounting</div>
              <div className="text-xs text-electric-400 font-medium">v1.0.0</div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-electric-400 rounded-full animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default Sidebar
