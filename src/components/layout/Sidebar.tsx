import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, 
  Bot, 
  RotateCcw, 
  BarChart3, 
  FileSpreadsheet, 
  Building2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Menu,
  X,
  Receipt
} from 'lucide-react'

import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet'
import { Switch } from '../ui/switch'
import { ScrollArea } from '../ui/scroll-area'
// Phase 1: Removed mock store dependency - recurring transactions will be in Phase 2
import { cn } from '../../lib/utils'

type ActiveItem = 'dashboard' | 'reports' | 'monthlyReport' | 'recurringManage' | 'aiImport' | 'setRecurring' | 'addExpense' | 'connectBank' | 'createInvoice'

interface SidebarProps {
  onViewReports?: () => void
  onSetupRecurring?: () => void
  onAddExpense?: () => void
  onAiImport?: () => void
  onCreateInvoice?: () => void
  activeItem?: ActiveItem
  isAiImportOpen?: boolean
  isRecurringModalOpen?: boolean
  isAddExpenseOpen?: boolean
  isCreateInvoiceOpen?: boolean
  className?: string
}

interface QuickAction {
  id: ActiveItem
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick?: () => void
  variant: 'ghost' | 'gradient'
  shortcut: string
  subtext?: string
  disabled?: boolean
  isPersistent?: boolean // true for navigation items, false for action CTAs
}

const Sidebar: React.FC<SidebarProps> = ({
  onViewReports,
  onSetupRecurring,
  onAddExpense,
  onAiImport,
  onCreateInvoice,
  activeItem,
  isAiImportOpen = false,
  isRecurringModalOpen = false,
  isAddExpenseOpen = false,
  isCreateInvoiceOpen = false,
  className
}) => {
  // Sidebar state management
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebar:collapsed')
      const isMobile = window.innerWidth < 1024
      return stored ? JSON.parse(stored) : isMobile
    }
    return false
  })
  
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileOverlay, setShowMobileOverlay] = useState(false)
  const [showManageDrawer, setShowManageDrawer] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Phase 1: Recurring transactions disabled - will be implemented in Phase 2 with backend API
  const recurringTransactions: any[] = [] // Empty for now
  
  // Placeholder functions for Phase 1 - will be implemented in Phase 2
  const updateRecurringTransaction = (id: string, updates: any) => {
    console.warn('Recurring transaction updates will be available in Phase 2')
  }
  
  const deleteRecurringTransaction = (id: string) => {
    console.warn('Recurring transaction deletion will be available in Phase 2')
  }

  // Sparkle animation state for CTAs
  const [showSparkle, setShowSparkle] = useState({ aiImport: false, createInvoice: false, setupRecurring: false })

  // Responsive handling
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      if (mobile && !isCollapsed) {
        setIsCollapsed(true)
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [isCollapsed])

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem('sidebar:collapsed', JSON.stringify(isCollapsed))
    
    // Update CSS variable
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty(
        '--sidebar-w', 
        isCollapsed ? '72px' : '304px'
      )
      document.documentElement.classList.toggle('sidebar-collapsed', isCollapsed)
    }

    // Announce state change for accessibility
    const message = isCollapsed ? 'Sidebar collapsed' : 'Sidebar expanded'
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', 'polite')
    announcement.setAttribute('aria-atomic', 'true')
    announcement.className = 'sr-only'
    announcement.textContent = message
    document.body.appendChild(announcement)
    setTimeout(() => document.body.removeChild(announcement), 1000)
  }, [isCollapsed])

  // Sparkle effect for CTAs
  useEffect(() => {
    const sparkleInterval = setInterval(() => {
      setShowSparkle(prev => ({
        aiImport: Math.random() > 0.5,
        createInvoice: Math.random() > 0.5,
        setupRecurring: Math.random() > 0.5
      }))
    }, 7000)

    return () => clearInterval(sparkleInterval)
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault()
          onAddExpense?.()
          break
        case 'i':
          e.preventDefault()
          onAiImport?.()
          break
        case 'c':
          e.preventDefault()
          onCreateInvoice?.()
          break
        case 'r':
          e.preventDefault()
          onSetupRecurring?.()
          break
        case 'v':
          e.preventDefault()
          onViewReports?.()
          break
        case '[':
          e.preventDefault()
          setIsCollapsed(true)
          break
        case ']':
          e.preventDefault()
          setIsCollapsed(false)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onAddExpense, onAiImport, onCreateInvoice, onSetupRecurring, onViewReports])

  // Toggle sidebar
  const toggleCollapsed = useCallback(() => {
    if (isMobile) {
      setShowMobileOverlay(!showMobileOverlay)
    } else {
      setIsCollapsed(!isCollapsed)
    }
  }, [isMobile, showMobileOverlay, isCollapsed])

  // Active state logic
  const getActiveState = useCallback((actionId: ActiveItem): 'active' | 'transient' | 'inactive' => {
    // Transient active states (while modals are open)
    if (actionId === 'aiImport' && isAiImportOpen) return 'transient'
    if (actionId === 'createInvoice' && isCreateInvoiceOpen) return 'transient'
    if (actionId === 'setRecurring' && isRecurringModalOpen) return 'transient'
    if (actionId === 'addExpense' && isAddExpenseOpen) return 'transient'
    if (actionId === 'recurringManage' && showManageDrawer) return 'transient'
    
    // Persistent active states (navigation)
    if (activeItem === actionId) return 'active'
    
    return 'inactive'
  }, [activeItem, isAiImportOpen, isCreateInvoiceOpen, isRecurringModalOpen, isAddExpenseOpen, showManageDrawer])

  // Quick actions configuration
  const quickActions: QuickAction[] = useMemo(() => [
    {
      id: 'addExpense',
      label: 'Add Expense',
      icon: FileText,
      onClick: onAddExpense,
      variant: 'ghost',
      shortcut: 'A',
      subtext: undefined,
      isPersistent: false
    },
    {
      id: 'aiImport',
      label: 'AI Import',
      icon: Bot,
      onClick: onAiImport,
      variant: 'gradient',
      shortcut: 'I',
      subtext: 'Read any bill in seconds',
      isPersistent: false
    },
    {
      id: 'createInvoice',
      label: 'Create Invoice',
      icon: Receipt,
      onClick: onCreateInvoice,
      variant: 'gradient',
      shortcut: 'C',
      subtext: 'AI-powered invoice generation',
      isPersistent: false
    },
    {
      id: 'setRecurring',
      label: 'Set Up Recurring',
      icon: RotateCcw,
      onClick: onSetupRecurring,
      variant: 'gradient',
      shortcut: 'R',
      subtext: 'Auto-create subscriptions & rent',
      isPersistent: false
    },
    {
      id: 'reports',
      label: 'View Reports',
      icon: BarChart3,
      onClick: onViewReports,
      variant: 'ghost',
      shortcut: 'V',
      subtext: undefined,
      isPersistent: true
    },
    {
      id: 'monthlyReport',
      label: 'Monthly Report',
      icon: FileSpreadsheet,
      onClick: () => console.log('Generate monthly report'),
      variant: 'ghost',
      shortcut: '',
      subtext: undefined,
      isPersistent: true
    },
    {
      id: 'connectBank',
      label: 'Connect Bank',
      icon: Building2,
      onClick: () => console.log('Connect bank'),
      variant: 'ghost',
      shortcut: '',
      subtext: undefined,
      disabled: true,
      isPersistent: false
    }
  ], [onAddExpense, onAiImport, onCreateInvoice, onSetupRecurring, onViewReports])

  // Recurring transactions summary
  const recurringStats = useMemo(() => {
    const active = recurringTransactions.filter(r => r.isActive)
    const monthlyTotal = active.reduce((sum, r) => sum + r.amount, 0)
    return { activeCount: active.length, monthlyTotal }
  }, [recurringTransactions])

  // Amount drift calculation
  const getAmountDrift = useCallback((recurringId: string, ruleAmount: number) => {
    // This is a stub - in real implementation, you'd compare against latest expense
    // For now, return null (no drift)
    return null
  }, [])

  // Render action button
  const renderActionButton = (action: QuickAction, index: number) => {
    const isGradient = action.variant === 'gradient'
    const activeState = getActiveState(action.id)
    const isActive = activeState !== 'inactive'
    const hasSparkle = isGradient && (
      (action.id === 'aiImport' && showSparkle.aiImport) ||
      (action.id === 'createInvoice' && showSparkle.createInvoice) ||
      (action.id === 'setRecurring' && showSparkle.setupRecurring)
    )

    if (isCollapsed) {
      // BEAUTIFUL COLLAPSED MODE
      return (
        <div key={action.id} className="relative group px-2 mb-3">
          {/* Active indicator - modern left bar */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-gradient-to-b from-violet-500 via-fuchsia-500 to-cyan-400 rounded-r-full shadow-lg"
                initial={{ opacity: 0, scaleY: 0.3 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0.3 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>

          {/* Beautiful button with glassmorphism */}
          <motion.button
            className={cn(
              'relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-105',
              isActive 
                ? isGradient 
                  ? 'bg-gradient-to-br from-violet-500/35 via-fuchsia-500/30 to-cyan-400/35 border border-violet-400/50 text-white shadow-xl shadow-violet-500/25 backdrop-blur-md ring-1 ring-white/10'
                  : 'bg-gradient-to-br from-slate-700/70 to-slate-600/70 border border-slate-500/60 text-white shadow-xl backdrop-blur-md ring-1 ring-white/10'
                : isGradient
                  ? 'bg-gradient-to-br from-violet-500/20 via-fuchsia-500/15 to-cyan-400/20 hover:from-violet-500/30 hover:via-fuchsia-500/25 hover:to-cyan-400/30 border border-violet-400/30 hover:border-violet-400/50 text-violet-200 hover:text-white backdrop-blur-md ring-1 ring-white/5 hover:ring-white/15'
                  : 'text-slate-400 hover:text-white hover:bg-gradient-to-br hover:from-slate-700/50 hover:to-slate-600/50 border border-slate-600/25 hover:border-slate-500/50 backdrop-blur-md ring-1 ring-white/5 hover:ring-white/10',
              action.disabled && 'opacity-40 cursor-not-allowed',
              'focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2 focus:ring-offset-slate-900'
            )}
            onClick={action.onClick}
            disabled={action.disabled}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            title={action.label}
          >
            <action.icon className="h-5 w-5" />
            
            {/* Premium notification dot */}
            {hasSparkle && (
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full shadow-lg border border-white/20"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ duration: 0.4, type: 'spring' }}
              />
            )}
          </motion.button>

          {/* Premium tooltip with better styling */}
          <div className="absolute left-full ml-6 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-300 delay-200">
            <div className="bg-gradient-to-br from-slate-900/98 to-slate-800/98 text-white text-sm px-4 py-3 rounded-xl shadow-2xl border border-white/10 backdrop-blur-xl min-w-max ring-1 ring-white/5">
              <div className="font-semibold text-white">{action.label}</div>
              {action.subtext && (
                <div className="text-xs text-slate-300 mt-1 opacity-90">{action.subtext}</div>
              )}
              {action.shortcut && (
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className="text-slate-400">Press</span>
                  <kbd className="px-2 py-1 bg-gradient-to-br from-slate-700/90 to-slate-600/90 text-slate-200 rounded-md text-xs font-mono border border-white/10 backdrop-blur-sm">{action.shortcut}</kbd>
                </div>
              )}
            </div>
            {/* Better tooltip arrow */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-3 h-3 bg-gradient-to-br from-slate-900/98 to-slate-800/98 border-l border-b border-white/10 rotate-45 backdrop-blur-xl" />
          </div>
        </div>
      )
    }

    // EXPANDED MODE - Enhanced glassmorphism design
    const buttonContent = (
      <motion.button
        className={cn(
          'w-full justify-start h-auto p-3 transition-all duration-300 text-left rounded-xl flex items-center',
          'px-4 backdrop-blur-md border',
          isActive 
            ? isGradient 
              ? 'bg-gradient-to-br from-violet-500/30 via-fuchsia-500/25 to-cyan-400/30 border-violet-400/50 text-white shadow-xl shadow-violet-500/20 ring-1 ring-white/10'
              : 'bg-gradient-to-br from-slate-700/60 to-slate-600/60 border-slate-500/50 text-white shadow-lg ring-1 ring-white/10'
            : isGradient
              ? 'bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-cyan-400/15 hover:from-violet-500/25 hover:via-fuchsia-500/20 hover:to-cyan-400/25 border-violet-400/25 hover:border-violet-400/40 text-violet-200 hover:text-white ring-1 ring-white/5 hover:ring-white/15'
              : 'bg-white/[0.02] hover:bg-gradient-to-br hover:from-slate-700/40 hover:to-slate-600/40 border-white/10 hover:border-white/20 text-slate-400 hover:text-white ring-1 ring-white/5 hover:ring-white/10',
          action.disabled && 'opacity-50 cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-violet-400/50'
        )}
        onClick={action.onClick}
        disabled={action.disabled}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center space-x-3 w-full">
          <div className="relative">
            <action.icon className={cn(
              'h-5 w-5 flex-shrink-0',
              hasSparkle && 'animate-pulse'
            )} />
            {hasSparkle && (
              <motion.div
                className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </div>
          
          <motion.div
            className="flex-1 text-left"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="font-medium text-sm leading-tight">{action.label}</div>
            {action.subtext && (
              <div className="text-xs opacity-70 mt-0.5 line-clamp-1">
                {action.subtext}
              </div>
            )}
          </motion.div>
        </div>
      </motion.button>
    )

    return <div key={action.id}>{buttonContent}</div>
  }

  // Main sidebar content
  const sidebarContent = (
    <div className="h-full flex flex-col">
              {/* Header */}
      <div className={cn(
        'flex items-center border-b border-white/10 bg-gradient-to-r from-white/[0.02] to-transparent',
        isCollapsed ? 'justify-center py-6' : 'justify-between p-6'
      )}>
        <AnimatePresence mode="wait">
          {isCollapsed ? (
            <motion.div
              key="collapsed-logo"
              className="relative group"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/25 cursor-pointer ring-2 ring-white/10 backdrop-blur-sm"
                whileHover={{ scale: 1.1, rotate: 5, boxShadow: '0 20px 25px -5px rgba(139, 92, 246, 0.4)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsCollapsed(false)}
              >
                <span className="text-white font-bold text-lg">E</span>
              </motion.div>
              
              {/* Logo tooltip */}
              <div className="absolute left-full ml-6 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-300 delay-200">
                <div className="bg-slate-800/95 text-white text-sm px-4 py-3 rounded-xl shadow-2xl border border-slate-600/50 backdrop-blur-md whitespace-nowrap">
                  <div className="font-semibold text-white">EZE Ledger</div>
                  <div className="text-xs text-slate-300 mt-1">Click to expand</div>
                </div>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-3 h-3 bg-slate-800/95 border-l border-b border-slate-600/50 rotate-45 backdrop-blur-md" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="expanded-logo"
              className="flex items-center space-x-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/20 ring-1 ring-white/10">
                <span className="text-white font-bold text-sm">E</span>
              </div>
              <h2 className="text-lg font-semibold bg-gradient-to-r from-white via-white to-violet-200 bg-clip-text text-transparent">
                EZE Ledger
              </h2>
            </motion.div>
          )}
        </AnimatePresence>

        {!isMobile && (
          <motion.button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              'h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-300 flex items-center justify-center backdrop-blur-sm border border-white/5 hover:border-white/20',
              isCollapsed && 'absolute top-4 right-2 w-6 h-6'
            )}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </motion.button>
        )}
      </div>

      {/* Main content */}
      <div className={cn(
        'flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20',
        isCollapsed ? 'px-1 py-6' : 'px-6 py-6'
      )}>
        <div className={cn(
          isCollapsed ? 'space-y-1' : 'space-y-6'
        )}>
          {/* Quick Actions */}
          <div>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.h3
                  className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2 bg-gradient-to-r from-slate-400 to-slate-300 bg-clip-text text-transparent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  ⚡ Quick Actions
                </motion.h3>
              )}
            </AnimatePresence>
            
            <div className={cn(
              isCollapsed ? 'space-y-1' : 'space-y-2'
            )}>
              {quickActions.slice(0, 6).map((action, index) => 
                renderActionButton(action, index)
              )}
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Recurring Transactions */}
          <div>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 bg-gradient-to-r from-slate-400 to-slate-300 bg-clip-text text-transparent">
                      🔄 Recurring Transactions
                    </h3>
                  </div>

                  {recurringStats.activeCount > 0 && (
                    <div className="flex items-center space-x-2 mb-3 px-1">
                      <Badge className="text-xs bg-violet-500/20 text-violet-300 border-violet-400/30">
                        Active: {recurringStats.activeCount}
                      </Badge>
                      <Badge className="text-xs bg-slate-700/50 text-slate-300 border-slate-500/30">
                        Monthly: ${recurringStats.monthlyTotal.toFixed(0)}
                      </Badge>
                    </div>
                  )}

                  {recurringTransactions.length > 0 ? (
                    <div className="space-y-2">
                      {recurringTransactions.slice(0, 5).map((recurring) => {
                        const drift = getAmountDrift(recurring.id, recurring.amount)
                        
                        return (
                          <motion.div
                            key={recurring.id}
                            className="p-3 rounded-xl bg-gradient-to-br from-white/[0.02] to-white/[0.01] hover:from-slate-700/30 hover:to-slate-600/30 transition-all duration-300 cursor-pointer border border-white/10 hover:border-white/20 backdrop-blur-md ring-1 ring-white/5 hover:ring-white/10 shadow-lg hover:shadow-xl"
                            whileHover={{ scale: 1.02, y: -2 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white truncate">
                                  {recurring.vendor}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {recurring.frequency} • ${recurring.amount.toFixed(0)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Next: {new Date(recurring.nextDate).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </div>
                                {drift && (
                                  <Badge className="text-xs mt-1 bg-yellow-500/20 text-yellow-300 border-yellow-400/30">
                                    amount changed {drift > 0 ? '+' : ''}{drift}%
                                  </Badge>
                                )}
                              </div>
                              <div className={cn(
                                'w-2 h-2 rounded-full flex-shrink-0 ml-2',
                                recurring.isActive ? 'bg-green-400' : 'bg-gray-500'
                              )} />
                            </div>
                          </motion.div>
                        )
                      })}

                      {recurringTransactions.length > 5 && (
                        <motion.button
                          className="w-full mt-2 text-xs py-2 px-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg border border-white/10 hover:border-white/20 transition-all duration-200 backdrop-blur-sm"
                          onClick={() => setShowManageDrawer(true)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          View all {recurringTransactions.length} recurring
                        </motion.button>
                      )}

                      <motion.button
                        className="w-full mt-2 text-xs py-2 px-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg border border-white/10 hover:border-white/20 transition-all duration-200 backdrop-blur-sm"
                        onClick={() => setShowManageDrawer(true)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Manage
                      </motion.button>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="text-2xl mb-2">🔄</div>
                      <p className="text-xs text-muted-foreground mb-3">
                        No recurring yet — try Set Up Recurring.
                      </p>
                      <motion.button
                        onClick={onSetupRecurring}
                        className="text-xs py-2 px-4 text-slate-400 hover:text-white hover:bg-gradient-to-br hover:from-violet-500/20 hover:to-fuchsia-500/20 rounded-lg border border-white/10 hover:border-violet-400/30 transition-all duration-200 backdrop-blur-sm"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Set Up First
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Collapsed recurring indicator */}
            {isCollapsed && (
              <div className="relative group px-2 mb-3">
                {/* Beautiful recurring button */}
                <motion.button
                  className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-white/[0.02] to-white/[0.01] hover:from-slate-700/50 hover:to-slate-600/50 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white flex items-center justify-center transition-all duration-300 backdrop-blur-md ring-1 ring-white/5 hover:ring-white/15 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg hover:shadow-xl"
                  onClick={() => setShowManageDrawer(true)}
                  whileHover={{ y: -2, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Recurring Transactions"
                >
                  <RotateCcw className="h-5 w-5" />
                  
                  {/* Premium count badge */}
                  {recurringStats.activeCount > 0 && (
                    <motion.div
                      className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg border border-white/20"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: 0.1 }}
                    >
                      {recurringStats.activeCount}
                    </motion.div>
                  )}

                  {/* Status dot with glow */}
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-slate-800 shadow-lg shadow-green-400/50" />
                </motion.button>

                {/* Premium tooltip */}
                <div className="absolute left-full ml-6 top-1/2 -translate-y-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-300 delay-200">
                  <div className="bg-slate-800/95 text-white text-sm px-4 py-3 rounded-xl shadow-2xl border border-slate-600/50 backdrop-blur-md min-w-max">
                    <div className="font-semibold text-white">Recurring Transactions</div>
                    {recurringStats.activeCount > 0 ? (
                      <div className="text-xs text-slate-300 mt-1 opacity-90">
                        {recurringStats.activeCount} active • ${recurringStats.monthlyTotal.toFixed(0)}/month
                      </div>
                    ) : (
                      <div className="text-xs text-slate-300 mt-1 opacity-90">
                        No recurring set up yet
                      </div>
                    )}
                  </div>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-3 h-3 bg-slate-800/95 border-l border-b border-slate-600/50 rotate-45 backdrop-blur-md" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={cn(
        'border-t border-white/10 bg-gradient-to-r from-white/[0.01] to-transparent',
        isCollapsed ? 'p-3' : 'p-4'
      )}>
        {!isCollapsed ? (
          <div className="flex items-center justify-between">
            <div className="text-xs bg-gradient-to-r from-slate-400 to-slate-500 bg-clip-text text-transparent font-medium">
              AI-First Accounting v1.0.0
            </div>
            <div className="relative group">
              <motion.button
                className="h-6 w-6 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200 flex items-center justify-center backdrop-blur-sm border border-white/5 hover:border-white/15"
                onClick={() => setShowShortcuts(!showShortcuts)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <HelpCircle className="h-3 w-3" />
              </motion.button>
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 hidden group-hover:block">
                <div className="bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg border border-white/10 max-w-xs">
                  <div className="space-y-1">
                    <div><kbd className="px-1 py-0.5 bg-slate-700 rounded">A</kbd> Add Expense</div>
                    <div><kbd className="px-1 py-0.5 bg-slate-700 rounded">I</kbd> AI Import</div>
                    <div><kbd className="px-1 py-0.5 bg-slate-700 rounded">R</kbd> Set Up Recurring</div>
                    <div><kbd className="px-1 py-0.5 bg-slate-700 rounded">V</kbd> View Reports</div>
                    <div><kbd className="px-1 py-0.5 bg-slate-700 rounded">[</kbd> Collapse / <kbd className="px-1 py-0.5 bg-slate-700 rounded">]</kbd> Expand</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            {/* Beautiful help button */}
            <div className="relative group">
              <Sheet>
                <SheetTrigger asChild>
                  <motion.button
                    className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/[0.02] to-white/[0.01] hover:from-slate-700/40 hover:to-slate-600/40 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white flex items-center justify-center transition-all duration-300 backdrop-blur-md ring-1 ring-white/5 hover:ring-white/15 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg hover:shadow-xl"
                    whileHover={{ y: -2, scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Help & Shortcuts"
                  >
                    <HelpCircle className="h-5 w-5" />
                  </motion.button>
                </SheetTrigger>
                <SheetContent {...({ side: "right" } as any)} className="w-80 bg-slate-900/95 backdrop-blur-xl border-white/10">
                  <SheetHeader>
                    <SheetTitle className="text-white">Help & Shortcuts</SheetTitle>
                  </SheetHeader>
                  
                  <div className="mt-6 space-y-6">
                    {/* Version info */}
                    <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                      <div className="text-sm font-medium text-white mb-1">EZE Ledger</div>
                      <div className="text-xs text-slate-400">Version 1.0.0 • AI-First Accounting</div>
                    </div>

                    {/* Keyboard shortcuts */}
                    <div>
                      <h4 className="text-sm font-medium text-white mb-3">Keyboard Shortcuts</h4>
                      <div className="space-y-2">
                        {[
                          { key: 'A', action: 'Add Expense' },
                          { key: 'I', action: 'AI Import' },
                          { key: 'C', action: 'Create Invoice' },
                          { key: 'R', action: 'Set Up Recurring' },
                          { key: 'V', action: 'View Reports' },
                          { key: '[', action: 'Collapse Sidebar' },
                          { key: ']', action: 'Expand Sidebar' },
                        ].map(({ key, action }) => (
                          <div key={key} className="flex items-center justify-between p-2 rounded-md bg-slate-800/30">
                            <span className="text-sm text-slate-300">{action}</span>
                            <kbd className="px-2 py-1 bg-slate-700 text-slate-200 rounded text-sm font-mono border border-slate-600">{key}</kbd>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <>
        {/* Mobile hamburger button */}
        <motion.button
          className="fixed top-4 left-4 z-50 lg:hidden h-10 w-10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-white/10 shadow-lg rounded-lg text-white hover:bg-gradient-to-br hover:from-slate-800/90 hover:to-slate-700/90 transition-all duration-200 flex items-center justify-center"
          onClick={() => setShowMobileOverlay(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Menu className="h-5 w-5" />
        </motion.button>

        {/* Mobile overlay */}
        <Sheet open={showMobileOverlay} onOpenChange={setShowMobileOverlay}>
          <SheetContent 
                      {...({ side: "left" } as any)}
          className="w-80 p-0 bg-slate-900/95 backdrop-blur-xl border-white/10"
          >
            {sidebarContent}
          </SheetContent>
        </Sheet>

        {/* Manage drawer */}
        <ManageDrawer 
          open={showManageDrawer}
          onOpenChange={setShowManageDrawer}
          recurringTransactions={recurringTransactions}
          onUpdateRecurring={updateRecurringTransaction}
          onDeleteRecurring={deleteRecurringTransaction}
        />
      </>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <motion.div
        className={cn(
          'fixed left-0 top-0 h-full z-40 transition-all duration-500 ease-out backdrop-blur-xl shadow-2xl',
          'bg-gradient-to-b from-slate-900/98 via-slate-900/95 to-slate-800/98',
          'border-r border-gradient-to-b border-white/10',
          isCollapsed 
            ? 'w-16' 
            : 'w-80',
          className
        )}
        initial={{ x: isCollapsed ? -16 : -80, opacity: 0 }}
        animate={{ 
          x: 0, 
          opacity: 1,
          width: isCollapsed ? 64 : 320
        }}
        transition={{ 
          type: 'spring', 
          damping: 30, 
          stiffness: 300,
          width: { duration: 0.5, ease: [0.23, 1, 0.320, 1] }
        }}
        role="navigation"
        aria-label="Primary"
        style={{
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(15, 23, 42, 0.95) 50%, rgba(30, 41, 59, 0.98) 100%)',
          backdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        {sidebarContent}
      </motion.div>

      {/* Manage drawer */}
      <ManageDrawer 
        open={showManageDrawer}
        onOpenChange={setShowManageDrawer}
        recurringTransactions={recurringTransactions}
        onUpdateRecurring={updateRecurringTransaction}
        onDeleteRecurring={deleteRecurringTransaction}
      />
    </>
  )
}

// Manage drawer component
interface ManageDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recurringTransactions: any[]
  onUpdateRecurring: (id: string, updates: any) => void
  onDeleteRecurring: (id: string) => void
}

const ManageDrawer: React.FC<ManageDrawerProps> = ({
  open,
  onOpenChange,
  recurringTransactions,
  onUpdateRecurring,
  onDeleteRecurring
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        {...({ side: "right" } as any)}
        className="w-full sm:max-w-2xl bg-slate-900/95 backdrop-blur-xl border-white/10"
      >
        <SheetHeader>
          <SheetTitle className="text-white">Manage Recurring Transactions</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-full mt-6">
          <div className="space-y-4">
            {recurringTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No recurring transactions to manage.
              </div>
            ) : (
              recurringTransactions.map((recurring) => (
                <div
                  key={recurring.id}
                  className="p-4 rounded-lg bg-gradient-to-r from-slate-800/40 to-slate-700/30 border border-white/10 backdrop-blur-sm hover:from-slate-700/50 hover:to-slate-600/40 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{recurring.vendor}</h4>
                      <div className="text-sm text-muted-foreground mt-1">
                        ${recurring.amount.toFixed(2)} • {recurring.frequency}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Next: {new Date(recurring.nextDate).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Switch
                        checked={recurring.isActive}
                        onCheckedChange={(checked: boolean) => 
                          onUpdateRecurring(recurring.id, { isActive: checked })
                        }
                      />
                      
                      <motion.button
                        onClick={() => {
                          if (window.confirm('Delete this recurring transaction?')) {
                            onDeleteRecurring(recurring.id)
                          }
                        }}
                        className="px-3 py-1 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg border border-red-400/20 hover:border-red-400/40 transition-all duration-200 backdrop-blur-sm"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Delete
                      </motion.button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

export default Sidebar
