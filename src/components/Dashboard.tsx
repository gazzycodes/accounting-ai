import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import axios from 'axios'

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
}

const Dashboard = () => {
  const [aiSummary, setAiSummary] = useState('')
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)

  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await axios.get('/api/dashboard')
      return response.data
    },
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
      const prompt = `Based on this financial data, provide a brief, insightful summary in one sentence:
      - Total Revenue: $${dashboardData.metrics.totalRevenue}
      - Total Expenses: $${dashboardData.metrics.totalExpenses}  
      - Net Profit: $${dashboardData.metrics.netProfit}
      - Transaction Count: ${dashboardData.metrics.transactionCount}
      
      Focus on the financial health and any notable trends.`

      const response = await axios.post('/api/ai/generate', { prompt })
      setAiSummary(response.data.content)
    } catch (error) {
      console.error('Failed to generate AI summary:', error)
      setAiSummary('Your business is showing healthy financial activity this month.')
    } finally {
      setIsLoadingSummary(false)
    }
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
      change: '+12.5%'
    },
    {
      title: 'Total Expenses',
      value: dashboardData.metrics.totalExpenses,
      color: 'from-red-400 to-red-600',
      icon: '💸',
      change: '+8.2%'
    },
    {
      title: 'Net Profit',
      value: dashboardData.metrics.netProfit,
      color: 'from-electric-400 to-electric-600',
      icon: '📈',
      change: '+15.3%'
    },
    {
      title: 'Transactions',
      value: dashboardData.metrics.transactionCount,
      color: 'from-blue-400 to-blue-600',
      icon: '🔄',
      change: '+5.1%',
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
          <motion.p
            className="text-gray-300 text-lg leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            {aiSummary}
          </motion.p>
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

      {/* Recent Activity */}
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
              <span className="text-green-400 font-medium">Positive</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
              <span className="text-gray-300">Expense Ratio</span>
              <span className="text-yellow-400 font-medium">
                {dashboardData ? Math.round((dashboardData.metrics.totalExpenses / dashboardData.metrics.totalRevenue) * 100) : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
              <span className="text-gray-300">Profit Margin</span>
              <span className="text-electric-400 font-medium">
                {dashboardData ? Math.round((dashboardData.metrics.netProfit / dashboardData.metrics.totalRevenue) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="card-glass">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <span className="mr-2">🎯</span>
            Quick Actions
          </h3>
          <div className="space-y-3">
            <motion.button
              className="w-full btn-glass text-left"
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="mr-2">📄</span>
              Generate Monthly Report
            </motion.button>
            <motion.button
              className="w-full btn-glass text-left"
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="mr-2">💳</span>
              Connect Bank Account
            </motion.button>
            <motion.button
              className="w-full btn-glass text-left"
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="mr-2">📧</span>
              Send Invoice
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Dashboard 