import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { FinancialDataService } from '../services/financialDataService'

interface DashboardData {
  metrics: {
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    transactionCount: number
  }
  sparklineData: Array<{
    date: string
    amount: number
  }>
  aiInsights?: Array<{
    id: string
    category: string
    message: string
    urgency: 'low' | 'medium' | 'high'
    icon: string
  }>
}

interface ChartOfAccountsItem { 
  code: string; 
  name: string; 
  type: string; 
  balance: number;
  normalBalance: string;
}

interface ChartOfAccountsData {
  accounts: ChartOfAccountsItem[]
}

interface DashboardProps {
  onViewReports?: () => void
  onAddExpense?: () => void
  onAddRevenue?: () => void
  onAddCapital?: () => void
  onAiImport?: () => void
  onCreateInvoice?: () => void
  onSetupRecurring?: () => void
}

// Utility function to get proper balance display for accounting
const getBalanceDisplay = (account: ChartOfAccountsItem) => {
  const absBalance = Math.abs(account.balance)
  
  // For LIABILITY accounts, show as positive/green when we owe money (even if backend sends negative)
  // For ASSET/EXPENSE accounts, show as positive/green when balance is positive
  let isPositive = false
  
  if (account.type === 'LIABILITY' || account.type === 'EQUITY' || account.type === 'REVENUE') {
    // Credit normal balance accounts - show positive when we have a credit balance
    isPositive = true // Always show liabilities as positive for user clarity
  } else {
    // Debit normal balance accounts (ASSET, EXPENSE)
    isPositive = account.balance >= 0
  }
  
  return {
    amount: absBalance,
    isPositive: isPositive,
    displayText: `$${absBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }
}

const Dashboard = ({ onViewReports, onAddExpense, onAddRevenue, onAddCapital, onAiImport, onCreateInvoice, onSetupRecurring }: DashboardProps) => {
  const [aiSummary, setAiSummary] = useState('')
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)

  // Fetch dashboard data from database via API
  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'], // No more dependency on mock store
    queryFn: () => FinancialDataService.getDashboardData(),
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    staleTime: 1000, // Consider data stale after 1 second
  })

  const { data: coaData } = useQuery<ChartOfAccountsData>({
    queryKey: ['chart-of-accounts'], // No more dependency on mock store
    queryFn: () => FinancialDataService.getChartOfAccountsData(),
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  })



  // Generate AI summary when data loads
  useEffect(() => {
    if (dashboardData && !aiSummary) {
      generateAISummary()
    }
  }, [dashboardData, aiSummary])

  const generateAISummary = async () => {
    if (!dashboardData) return
    
    setIsLoadingSummary(true)
    
    try {
      // Use dashboard-specific AI insights (async)
      const insights = await FinancialDataService.getDashboardInsights()
      
      if (insights && insights.length > 0) {
        // Create a comprehensive summary from multiple insights
        const summaryParts = insights.map((insight: any) => insight.message)
        setAiSummary(summaryParts.join(' '))
      } else {
        // Fallback for when no insights are available
        if (dashboardData.metrics.totalRevenue > 0) {
          const profitMargin = ((dashboardData.metrics.netProfit / dashboardData.metrics.totalRevenue) * 100).toFixed(1)
          setAiSummary(`Business performance shows ${profitMargin}% profit margin with ${dashboardData.metrics.transactionCount} transactions recorded.`)
        } else {
          setAiSummary('🚀 Ready to start! Add your first expense or import a receipt to begin tracking your finances.')
        }
      }
    } catch (error) {
      console.error('Error generating AI summary:', error)
      setAiSummary('Financial summary unavailable. Data is being loaded from database.')
    }
    
    setIsLoadingSummary(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const metrics = dashboardData ? [
    {
      title: 'Total Revenue',
      value: dashboardData.metrics.totalRevenue,
      color: 'from-green-400 to-green-600',
      icon: '💰',
      change: dashboardData.metrics.totalRevenue > 0 ? '+0.0%' : '—'
    },
    {
      title: 'Total Expenses',
      value: dashboardData.metrics.totalExpenses,
      color: 'from-red-400 to-red-600',
      icon: '💸',
      change: dashboardData.metrics.totalExpenses > 0 ? '+0.0%' : '—'
    },
    {
      title: 'Net Profit',
      value: dashboardData.metrics.netProfit,
      color: 'from-electric-400 to-electric-600',
      icon: '📈',
      change: dashboardData.metrics.netProfit !== 0 ? (dashboardData.metrics.netProfit > 0 ? '+0.0%' : '-0.0%') : '—'
    },
    {
      title: 'Transactions',
      value: dashboardData.metrics.transactionCount,
      color: 'from-blue-400 to-blue-600',
      icon: '🔄',
      change: dashboardData.metrics.transactionCount > 0 ? `${dashboardData.metrics.transactionCount} entries` : '—',
      isCount: true
    }
  ] : []

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className="card-glass h-32"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="animate-pulse">
                <div className="h-4 bg-gray-600 rounded w-3/4 mb-3"></div>
                <div className="h-8 bg-gray-600 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-600 rounded w-1/4"></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* AI Summary Banner */}
      <motion.div
        className="card-glass mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-electric-gradient rounded-full flex items-center justify-center">
            <span className="text-white text-sm">🤖</span>
          </div>
          <h2 className="text-xl font-semibold text-white">AI Financial Insights</h2>
        </div>
        
        {isLoadingSummary ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin w-4 h-4 border-2 border-electric-500 border-t-transparent rounded-full"></div>
            <span className="text-gray-300">Analyzing your financial data...</span>
          </div>
        ) : (
          <div>
        <motion.p
              className="text-gray-300 text-lg leading-relaxed mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
            {aiSummary}
        </motion.p>
            
            {/* Dynamic Insights Panel */}
            {(() => {
              // Phase 1: AI insights disabled for now
              const allInsights: any[] = []
              if (false) { // Disabled for Phase 1
                return (
                  <div className="space-y-3 mt-4">
                    {allInsights.slice(0, 3).map((insight, index) => (
        <motion.div
                        key={insight.id}
                        className={`p-3 rounded-lg border-l-4 ${
                          insight.urgency === 'high' 
                            ? 'bg-red-900/20 border-red-500' 
                            : insight.urgency === 'medium'
                            ? 'bg-yellow-900/20 border-yellow-500'
                            : 'bg-green-900/20 border-green-500'
                        }`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
                      >
                        <div className="flex items-start space-x-3">
                          <span className="text-xl">{insight.icon}</span>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-sm font-medium text-gray-300">
                                {insight.category}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                insight.urgency === 'high'
                                  ? 'bg-red-500/20 text-red-300'
                                  : insight.urgency === 'medium'
                                  ? 'bg-yellow-500/20 text-yellow-300'
                                  : 'bg-green-500/20 text-green-300'
                              }`}>
                                {insight.urgency}
                              </span>
                            </div>
                            <p className="text-gray-400 text-sm">{insight.message}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )
              }
              return null
            })()}
                  </div>
                )}
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.title}
            className="card-glass group cursor-pointer"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
              delay: index * 0.1,
              duration: 0.6,
              type: "spring" as const,
              stiffness: 100
            }}
            whileHover={{ 
              scale: 1.02,
              rotateY: 5,
              transition: { duration: 0.2 }
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 bg-gradient-to-br ${metric.color} rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300`}>
                {metric.icon}
              </div>
              <span className="text-green-400 text-sm font-medium">
                {metric.change}
              </span>
              </div>
              
            <h3 className="text-gray-400 text-sm font-medium mb-2">
              {metric.title}
            </h3>
            
            <motion.div
              className="text-2xl font-bold text-white mb-3"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.1 + 0.5, type: "spring" as const }}
            >
              {metric.isCount ? metric.value : formatCurrency(metric.value)}
            </motion.div>
            
            {/* Mini Sparkline */}
            {dashboardData?.sparklineData && (
              <div className="h-12 w-full opacity-70 group-hover:opacity-100 transition-opacity duration-300">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.sparklineData.slice(-7)}>
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke={`url(#gradient-${index})`}
                      strokeWidth={2}
                      dot={false}
                    />
                    <defs>
                      <linearGradient id={`gradient-${index}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#7c3aed" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div
        className="card-glass mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      >
        <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
          <span className="mr-2">⚡</span>
          Quick Actions
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Add Expense */}
          <motion.button
            onClick={onAddExpense}
            className="p-6 bg-gradient-to-br from-slate-800/50 to-slate-700/50 hover:from-slate-700/60 hover:to-slate-600/60 border border-slate-600/30 hover:border-slate-500/50 rounded-xl transition-all duration-300 text-left group"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">📝</span>
              </div>
              <div className="text-slate-400 group-hover:text-slate-300 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            <h4 className="text-white font-semibold mb-2 group-hover:text-blue-300 transition-colors">
              Add Expense
            </h4>
            <p className="text-slate-400 text-sm group-hover:text-slate-300 transition-colors">
              Manually record a new expense transaction
            </p>
          </motion.button>

          {/* Add Revenue */}
          <motion.button
            onClick={onAddRevenue}
            className="p-6 bg-gradient-to-br from-green-800/50 to-emerald-700/50 hover:from-green-700/60 hover:to-emerald-600/60 border border-green-600/30 hover:border-green-500/50 rounded-xl transition-all duration-300 text-left group"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">💰</span>
              </div>
              <div className="text-slate-400 group-hover:text-slate-300 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            <h4 className="text-white font-semibold mb-2 group-hover:text-green-300 transition-colors">
              Add Revenue
            </h4>
            <p className="text-slate-400 text-sm group-hover:text-slate-300 transition-colors">
              Record customer payments and income
            </p>
          </motion.button>

          {/* Add Capital */}
          <motion.button
            onClick={onAddCapital}
            className="p-6 bg-gradient-to-br from-blue-800/50 to-indigo-700/50 hover:from-blue-700/60 hover:to-indigo-600/60 border border-blue-600/30 hover:border-blue-500/50 rounded-xl transition-all duration-300 text-left group"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <span className="text-2xl">🏛️</span>
              </div>
              <div className="text-slate-400 group-hover:text-slate-300 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            <h4 className="text-white font-semibold mb-2 group-hover:text-blue-300 transition-colors">
              Capital Contribution
            </h4>
            <p className="text-slate-400 text-sm group-hover:text-slate-300 transition-colors">
              Record owner investments and equity
            </p>
          </motion.button>

          {/* AI Import */}
          <motion.button
            onClick={onAiImport}
            className="p-6 bg-gradient-to-br from-violet-600/20 to-cyan-500/20 hover:from-violet-600/30 hover:to-cyan-500/30 border border-violet-400/30 hover:border-violet-400/50 rounded-xl transition-all duration-300 text-left group relative overflow-hidden"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-cyan-400/5 group-hover:from-violet-500/10 group-hover:to-cyan-400/10 transition-all duration-300" />
            
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <span className="text-2xl">🤖</span>
                    </div>
                <div className="text-violet-400 group-hover:text-violet-300 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              <h4 className="text-white font-semibold mb-2 group-hover:text-violet-300 transition-colors">
                AI Import
              </h4>
              <p className="text-slate-400 text-sm group-hover:text-slate-300 transition-colors">
                Read any bill in seconds with AI
              </p>
            </div>
          </motion.button>

          {/* Create Invoice */}
          <motion.button
            onClick={onCreateInvoice}
            className="p-6 bg-gradient-to-br from-emerald-600/20 to-teal-500/20 hover:from-emerald-600/30 hover:to-teal-500/30 border border-emerald-400/30 hover:border-emerald-400/50 rounded-xl transition-all duration-300 text-left group relative overflow-hidden"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-400/5 group-hover:from-emerald-500/10 group-hover:to-teal-400/10 transition-all duration-300" />
            
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <span className="text-2xl">📄</span>
                </div>
                <div className="text-emerald-400 group-hover:text-emerald-300 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              <h4 className="text-white font-semibold mb-2 group-hover:text-emerald-300 transition-colors">
                Create Invoice
              </h4>
              <p className="text-slate-400 text-sm group-hover:text-slate-300 transition-colors">
                AI-powered invoice generation
              </p>
            </div>
          </motion.button>

          {/* Set Up Recurring */}
          <motion.button
            onClick={onSetupRecurring}
            className="p-6 bg-gradient-to-br from-purple-600/20 to-pink-500/20 hover:from-purple-600/30 hover:to-pink-500/30 border border-purple-400/30 hover:border-purple-400/50 rounded-xl transition-all duration-300 text-left group relative overflow-hidden"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-400/5 group-hover:from-purple-500/10 group-hover:to-pink-400/10 transition-all duration-300" />
            
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <span className="text-2xl">🔄</span>
                </div>
                <div className="text-purple-400 group-hover:text-purple-300 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              <h4 className="text-white font-semibold mb-2 group-hover:text-purple-300 transition-colors">
                Set Up Recurring
              </h4>
              <p className="text-slate-400 text-sm group-hover:text-slate-300 transition-colors">
                Auto-create subscriptions & rent
              </p>
            </div>
          </motion.button>
        </div>
      </motion.div>

      {/* Financial Overview */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
      >
        <div className="card-glass">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <span className="mr-2">📊</span>
            Financial Overview
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
              <span className="text-gray-300">Cash Flow</span>
              <span className={`font-medium ${
                dashboardData && dashboardData.metrics.netProfit > 0 
                  ? 'text-green-400' 
                  : dashboardData && dashboardData.metrics.netProfit < 0 
                    ? 'text-red-400' 
                    : 'text-gray-400'
              }`}>
                {dashboardData 
                  ? dashboardData.metrics.netProfit > 0 
                    ? 'Positive' 
                    : dashboardData.metrics.netProfit < 0 
                      ? 'Negative' 
                      : 'Neutral'
                  : '—'
                }
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
              <span className="text-gray-300">Expense Ratio</span>
              <span className="text-yellow-400 font-medium">
                {dashboardData && dashboardData.metrics.totalRevenue > 0 
                  ? Math.round((dashboardData.metrics.totalExpenses / dashboardData.metrics.totalRevenue) * 100) 
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
              <span className="text-gray-300">Profit Margin</span>
              <span className={`font-medium ${
                dashboardData && dashboardData.metrics.totalRevenue > 0 
                  ? Math.round((dashboardData.metrics.netProfit / dashboardData.metrics.totalRevenue) * 100) > 0
                    ? 'text-electric-400'
                    : 'text-red-400'
                  : 'text-gray-400'
              }`}>
                {dashboardData && dashboardData.metrics.totalRevenue > 0 
                  ? Math.round((dashboardData.metrics.netProfit / dashboardData.metrics.totalRevenue) * 100) 
                  : 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="card-glass">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white flex items-center">
              <span className="mr-2">📋</span>
              Chart of Accounts
            </h3>
            <motion.button
              onClick={onViewReports}
              className="text-electric-400 hover:text-electric-300 text-sm font-medium transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              View All →
            </motion.button>
          </div>
          
          {coaData ? (
            <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
              {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((type, typeIndex) => {
                const accounts = coaData.accounts.filter(acc => acc.type === type).slice(0, 3)
                if (accounts.length === 0) return null
                
                const typeLabels = {
                  'ASSET': '🏢 Assets',
                  'LIABILITY': '💳 Liabilities', 
                  'EQUITY': '👑 Equity',
                  'REVENUE': '💰 Revenue',
                  'EXPENSE': '💸 Expenses'
                }

                return (
                  <motion.div
                    key={type}
                    className="mb-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: typeIndex * 0.1, duration: 0.3 }}
                  >
                    <h4 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">
                      {typeLabels[type as keyof typeof typeLabels]}
                    </h4>
                    <div className="space-y-2">
                      {accounts.map((account, index) => (
                        <motion.div
                          key={account.code}
                          className="flex items-center justify-between p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group cursor-pointer"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: (typeIndex * 0.1) + (index * 0.05), duration: 0.3 }}
                          whileHover={{ scale: 1.02, x: 5 }}
                        >
                          <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <span className="text-electric-400 font-mono text-xs flex-shrink-0">
                              {account.code}
                            </span>
                            <span className="text-gray-300 text-sm truncate group-hover:text-white transition-colors">
                              {account.name}
                            </span>
                          </div>
                          <span className={`text-xs font-semibold flex-shrink-0 ml-2 ${
                            getBalanceDisplay(account).isPositive ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {getBalanceDisplay(account).displayText}
                          </span>
                        </motion.div>
                      ))}
                      {coaData.accounts.filter(acc => acc.type === type).length > 3 && (
                        <div className="text-center">
                          <span className="text-gray-500 text-xs">
                            +{coaData.accounts.filter(acc => acc.type === type).length - 3} more accounts
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-electric-500 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>


        </motion.div>
      </div>
    )
}

export default Dashboard 