import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Account Types
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'

// Account Structure
export interface Account {
  code: string
  name: string
  type: AccountType
  balance: number
  normalBalance: 'DEBIT' | 'CREDIT'
}

// Transaction Entry (Double-Entry)
export interface TransactionEntry {
  accountCode: string
  type: 'debit' | 'credit'
  amount: number
  description: string
}

// Transaction
export interface Transaction {
  id: string
  date: string
  description: string
  reference: string
  amount: number
  entries: TransactionEntry[]
  category?: string
  vendor?: string
  customer?: string
  receiptUrl?: string
  customFields?: any[]
  paymentStatus?: 'paid' | 'invoice' // Track whether this is an invoice or paid expense
}

// Computed Financial Totals
export interface FinancialTotals {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  grossProfit: number
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  transactionCount: number
}

// AI Insight
export interface AIInsight {
  id: string
  category: string
  message: string
  urgency: 'low' | 'medium' | 'high'
  icon: string
  timestamp: string
}

// Recurring Transaction
export interface RecurringTransaction {
  id: string
  vendor: string
  amount: number
  category: string
  description: string
  frequency: 'weekly' | 'monthly' | 'quarterly'
  nextDate: string
  lastProcessed?: string
  isActive: boolean
  createdDate: string
  dayOfMonth?: number
  dayOfWeek?: number
}

// Store State
interface MockDataState {
  accounts: Account[]
  transactions: Transaction[]
  totals: FinancialTotals
  aiInsights: AIInsight[]
  recurringTransactions: RecurringTransaction[]
  
  // Actions
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void
  updateAccountBalance: (accountCode: string, amount: number, type: 'debit' | 'credit') => void
  recalculateTotals: () => void
  generateAIInsights: () => void
  getAccountByCode: (code: string) => Account | undefined
  getTransactionsByAccount: (accountCode: string) => Transaction[]
  resetData: () => void
  
  // New methods for dynamic account management
  createNewAccount: (name: string, type: AccountType) => Account
  getNextAccountCode: (type: AccountType) => string
  findOrCreateAccountForCategory: (categoryName: string) => { debitAccount: string, creditAccount: string }
  
  // Recurring transaction methods
  addRecurringTransaction: (recurring: Omit<RecurringTransaction, 'id' | 'createdDate'>) => void
  getRecurringTransactions: () => RecurringTransaction[]
  updateRecurringTransaction: (id: string, updates: Partial<RecurringTransaction>) => void
  deleteRecurringTransaction: (id: string) => void
  processRecurringTransactions: () => void
}

// Category to Account Mapping - Enhanced with comprehensive business categories
export const ACCOUNT_MAPPING = {
  // Expense Categories - Specific Accounts
  SOFTWARE: { debitAccount: '6030', creditAccount: '1010' }, // Software → Cash
  OFFICE_SUPPLIES: { debitAccount: '6020', creditAccount: '1010' }, // Office Supplies → Cash  
  MARKETING: { debitAccount: '6040', creditAccount: '1010' }, // Marketing → Cash
  SUBSCRIPTIONS: { debitAccount: '6050', creditAccount: '1010' }, // Subscriptions → Cash
  TRAVEL: { debitAccount: '6060', creditAccount: '1010' }, // Travel → Cash
  RENT: { debitAccount: '6070', creditAccount: '1010' }, // Rent → Cash
  UTILITIES: { debitAccount: '6080', creditAccount: '1010' }, // Utilities → Cash
  SALARIES: { debitAccount: '6010', creditAccount: '1010' }, // Salaries → Cash
  COGS: { debitAccount: '5010', creditAccount: '1010' }, // COGS → Cash
  PROFESSIONAL_SERVICES: { debitAccount: '6090', creditAccount: '1010' }, // Professional Services → Cash
  BANK_FEES: { debitAccount: '6100', creditAccount: '1010' }, // Bank Fees → Cash
  INSURANCE: { debitAccount: '6110', creditAccount: '1010' }, // Insurance → Cash
  LEGAL: { debitAccount: '6120', creditAccount: '1010' }, // Legal & Compliance → Cash
  TRAINING: { debitAccount: '6130', creditAccount: '1010' }, // Training & Development → Cash
  MEALS: { debitAccount: '6140', creditAccount: '1010' }, // Entertainment & Meals → Cash
  ENTERTAINMENT: { debitAccount: '6140', creditAccount: '1010' }, // Entertainment & Meals → Cash
  TELECOMMUNICATIONS: { debitAccount: '6150', creditAccount: '1010' }, // Telecommunications → Cash
  PHONE: { debitAccount: '6150', creditAccount: '1010' }, // Phone (maps to Telecommunications)
  INTERNET: { debitAccount: '6150', creditAccount: '1010' }, // Internet (maps to Telecommunications)
  DEPRECIATION: { debitAccount: '6160', creditAccount: '1600' }, // Depreciation → Equipment (contra account)
  BAD_DEBT: { debitAccount: '6170', creditAccount: '1200' }, // Bad Debt → Accounts Receivable
  OTHER: { debitAccount: '6999', creditAccount: '1010' }, // Other → Other Expenses → Cash
  
  // Revenue Categories  
  PRODUCT_SALES: { debitAccount: '1010', creditAccount: '4010' }, // Cash → Product Sales
  CONSULTING: { debitAccount: '1010', creditAccount: '4020' }, // Cash → Services
  RECURRING: { debitAccount: '1200', creditAccount: '4020' }, // A/R → Services
  OTHER_INCOME: { debitAccount: '1010', creditAccount: '4900' }, // Cash → Other Income
  PROCESSING_INCOME: { debitAccount: '1010', creditAccount: '4950' }, // Cash → Processing Income
  
  // Asset/Inventory Categories
  INVENTORY: { debitAccount: '1300', creditAccount: '1010' }, // Inventory → Cash
  SUPPLIES: { debitAccount: '1500', creditAccount: '1010' }, // Supplies Inventory → Cash
  DEPOSITS: { debitAccount: '1350', creditAccount: '1010' }, // Deposits & Advances → Cash
  EQUIPMENT: { debitAccount: '1600', creditAccount: '1010' }, // Equipment → Cash
  
  // Liability Categories
  SALES_TAX: { debitAccount: '2150', creditAccount: '1010' }, // Sales Tax Payable → Cash (when paying)
  PAYROLL_TAXES: { debitAccount: '2250', creditAccount: '1010' }, // Payroll Liabilities → Cash
  
  // Customer Credit/Overpayment Handling
  CUSTOMER_CREDIT: { debitAccount: '1010', creditAccount: '2050' }, // Cash → Customer Credits Payable
  CUSTOMER_DEPOSIT: { debitAccount: '1250', creditAccount: '1010' }, // Customer Deposits → Cash (when refunding)
} as const

// Initial Accounts - Enhanced with Essential Business Accounts
const INITIAL_ACCOUNTS: Account[] = [
  // ASSETS
  { code: '1010', name: 'Cash and Cash Equivalents', type: 'ASSET', balance: 150000.00, normalBalance: 'DEBIT' }, // Demo starting cash
  { code: '1200', name: 'Accounts Receivable', type: 'ASSET', balance: 0.00, normalBalance: 'DEBIT' },
  { code: '1250', name: 'Customer Deposits', type: 'ASSET', balance: 0.00, normalBalance: 'DEBIT' }, // For overpayments held
  { code: '1300', name: 'Inventory', type: 'ASSET', balance: 0.00, normalBalance: 'DEBIT' }, // Product inventory
  { code: '1350', name: 'Deposits & Advances', type: 'ASSET', balance: 0.00, normalBalance: 'DEBIT' }, // Security deposits, vendor advances
  { code: '1400', name: 'Prepaid Expenses', type: 'ASSET', balance: 0.00, normalBalance: 'DEBIT' },
  { code: '1500', name: 'Supplies Inventory', type: 'ASSET', balance: 0.00, normalBalance: 'DEBIT' }, // Office supplies on hand
  { code: '1600', name: 'Property & Equipment (net)', type: 'ASSET', balance: 0.00, normalBalance: 'DEBIT' },
  { code: '1700', name: 'Intangible Assets', type: 'ASSET', balance: 0.00, normalBalance: 'DEBIT' },
  
  // LIABILITIES
  { code: '2010', name: 'Accounts Payable', type: 'LIABILITY', balance: 0.00, normalBalance: 'CREDIT' },
  { code: '2050', name: 'Customer Credits Payable', type: 'LIABILITY', balance: 0.00, normalBalance: 'CREDIT' }, // Credits owed to customers
  { code: '2100', name: 'Accrued Expenses', type: 'LIABILITY', balance: 0.00, normalBalance: 'CREDIT' },
  { code: '2150', name: 'Sales Tax Payable', type: 'LIABILITY', balance: 0.00, normalBalance: 'CREDIT' }, // Sales tax collected
  { code: '2200', name: 'Credit Card Payable', type: 'LIABILITY', balance: 0.00, normalBalance: 'CREDIT' },
  { code: '2250', name: 'Payroll Liabilities', type: 'LIABILITY', balance: 0.00, normalBalance: 'CREDIT' }, // Payroll taxes, benefits
  { code: '2300', name: 'Short-term Loan', type: 'LIABILITY', balance: 0.00, normalBalance: 'CREDIT' },
  { code: '2350', name: 'Unearned Revenue', type: 'LIABILITY', balance: 0.00, normalBalance: 'CREDIT' }, // Customer prepayments
  { code: '2400', name: 'Deferred Revenue', type: 'LIABILITY', balance: 0.00, normalBalance: 'CREDIT' },
  
  // EQUITY
  { code: '3000', name: "Owner's Equity", type: 'EQUITY', balance: 150000.00, normalBalance: 'CREDIT' }, // Balances the $150K cash
  { code: '3200', name: 'Retained Earnings', type: 'EQUITY', balance: 0.00, normalBalance: 'CREDIT' },
  
  // REVENUE
  { code: '4010', name: 'Product Sales', type: 'REVENUE', balance: 0.00, normalBalance: 'CREDIT' },
  { code: '4020', name: 'Services', type: 'REVENUE', balance: 0.00, normalBalance: 'CREDIT' },
  { code: '4900', name: 'Other Income', type: 'REVENUE', balance: 0.00, normalBalance: 'CREDIT' },
  { code: '4950', name: 'Payment Processing Income', type: 'REVENUE', balance: 0.00, normalBalance: 'CREDIT' }, // Overpayment handling income
  
  // EXPENSES - Organized by account codes
  { code: '5010', name: 'Cost of Goods Sold', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' },
  { code: '6010', name: 'Salaries & Wages', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' },
  { code: '6020', name: 'Office Supplies Expense', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' },
  { code: '6030', name: 'Software Subscriptions', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' },
  { code: '6040', name: 'Marketing Expense', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' },
  { code: '6050', name: 'Subscriptions Expense', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' },
  { code: '6060', name: 'Travel Expense', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' },
  { code: '6070', name: 'Rent', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' },
  { code: '6080', name: 'Utilities', type:'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' },
  { code: '6090', name: 'Professional Services', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' },
  { code: '6100', name: 'Bank Fees & Processing', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' }, // Payment processing costs
  { code: '6110', name: 'Insurance', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' }, // Business insurance
  { code: '6120', name: 'Legal & Compliance', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' }, // Legal fees, permits
  { code: '6130', name: 'Training & Development', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' }, // Employee training
  { code: '6140', name: 'Entertainment & Meals', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' }, // Business meals
  { code: '6150', name: 'Telecommunications', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' }, // Phone, internet
  { code: '6160', name: 'Depreciation', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' }, // Asset depreciation
  { code: '6170', name: 'Bad Debt', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' }, // Uncollectible receivables
  { code: '6999', name: 'Other Expenses', type: 'EXPENSE', balance: 0.00, normalBalance: 'DEBIT' },
]

// Calculate initial totals
const calculateInitialTotals = (): FinancialTotals => {
  const revenue = INITIAL_ACCOUNTS.filter(a => a.type === 'REVENUE').reduce((sum, a) => sum + a.balance, 0)
  const expenses = INITIAL_ACCOUNTS.filter(a => a.type === 'EXPENSE').reduce((sum, a) => sum + a.balance, 0)
  const assets = INITIAL_ACCOUNTS.filter(a => a.type === 'ASSET').reduce((sum, a) => sum + a.balance, 0)
  const liabilities = INITIAL_ACCOUNTS.filter(a => a.type === 'LIABILITY').reduce((sum, a) => sum + a.balance, 0)
  const equity = INITIAL_ACCOUNTS.filter(a => a.type === 'EQUITY').reduce((sum, a) => sum + a.balance, 0)
  const cogs = INITIAL_ACCOUNTS.find(a => a.code === '5010')?.balance || 0
  
  return {
    totalRevenue: revenue,
    totalExpenses: expenses,
    netProfit: revenue - expenses,
    grossProfit: revenue - cogs,
    totalAssets: assets,
    totalLiabilities: liabilities,
    totalEquity: equity,
    transactionCount: 0
  }
}

// Initial AI Insights for Demo with Starting Capital
const INITIAL_AI_INSIGHTS: AIInsight[] = [
  {
    id: '1',
    category: 'Demo Ready',
    message: 'Demo business is funded with $150,000 starting capital. Upload invoices and expenses to see real-time financial tracking!',
    urgency: 'low',
    icon: '🚀',
    timestamp: new Date().toISOString()
  },
  {
    id: '2',
    category: 'Cash Position',
    message: 'Strong cash position: $150,000 available. Ready to process any invoice or expense for a realistic demo experience!',
    urgency: 'low',
    icon: '💰',
    timestamp: new Date().toISOString()
  }
]

// Create Zustand Store with Persistence
export const useMockDataStore = create<MockDataState>()(
  persist(
    (set, get) => ({
      accounts: INITIAL_ACCOUNTS,
      transactions: [],
      totals: calculateInitialTotals(),
      aiInsights: INITIAL_AI_INSIGHTS,
      recurringTransactions: [],

      // Add Transaction
      addTransaction: (transaction: Omit<Transaction, 'id'>) => {
        const newTransaction: Transaction = {
          ...transaction,
          id: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }

        set((state: MockDataState) => {
          const updatedTransactions = [...state.transactions, newTransaction]
          
          // Update account balances based on transaction entries
          const updatedAccounts = state.accounts.map((account: Account) => {
            const entry = newTransaction.entries.find(e => e.accountCode === account.code)
            if (!entry) return account

            let newBalance = account.balance
            
            // Apply double-entry logic based on account normal balance
            if (account.normalBalance === 'DEBIT') {
              // For debit normal balance accounts (Assets, Expenses)
              newBalance += entry.type === 'debit' ? entry.amount : -entry.amount
            } else {
              // For credit normal balance accounts (Liabilities, Equity, Revenue)
              newBalance += entry.type === 'credit' ? entry.amount : -entry.amount
            }

            return { ...account, balance: newBalance }
          })

          return {
            ...state,
            transactions: updatedTransactions,
            accounts: updatedAccounts
          }
        })

        // Recalculate totals and AI insights
        get().recalculateTotals()
        get().generateAIInsights()
      },

      // Update Account Balance
      updateAccountBalance: (accountCode: string, amount: number, type: 'debit' | 'credit') => {
        set((state: MockDataState) => ({
          accounts: state.accounts.map((account: Account) => {
            if (account.code !== accountCode) return account
            
            let newBalance = account.balance
            if (account.normalBalance === 'DEBIT') {
              newBalance += type === 'debit' ? amount : -amount
            } else {
              newBalance += type === 'credit' ? amount : -amount
            }
            
            return { ...account, balance: newBalance }
          })
        }))
        
        get().recalculateTotals()
      },

      // Recalculate Financial Totals
      recalculateTotals: () => {
        set((state: MockDataState) => {
          const revenue = state.accounts.filter(a => a.type === 'REVENUE').reduce((sum, a) => sum + a.balance, 0)
          const expenses = state.accounts.filter(a => a.type === 'EXPENSE').reduce((sum, a) => sum + a.balance, 0)
          const assets = state.accounts.filter(a => a.type === 'ASSET').reduce((sum, a) => sum + a.balance, 0)
          const liabilities = state.accounts.filter(a => a.type === 'LIABILITY').reduce((sum, a) => sum + a.balance, 0)
          
          // Calculate net income for display purposes only (don't modify accounts)
          const netIncome = revenue - expenses
          const retainedEarningsAccount = state.accounts.find(a => a.code === '3200')
          const ownerEquityAccount = state.accounts.find(a => a.code === '3000')
          
          // DON'T modify account balances - let transactions handle that
          // Calculate total equity from actual account balances
          const totalOwnerEquity = ownerEquityAccount?.balance || 0
          const totalRetainedEarnings = retainedEarningsAccount?.balance || 0
          const totalEquity = totalOwnerEquity + totalRetainedEarnings
          
          const cogs = state.accounts.find(a => a.code === '5010')?.balance || 0

          return {
            ...state,
            totals: {
              totalRevenue: revenue,
              totalExpenses: expenses,
              netProfit: netIncome,
              grossProfit: revenue - cogs,
              totalAssets: assets,
              totalLiabilities: liabilities,
              totalEquity: totalEquity,
              transactionCount: state.transactions.length
            }
          }
        })
      },

      // Generate Dynamic AI Insights
      generateAIInsights: () => {
        const { accounts, transactions, totals } = get()
        const insights: AIInsight[] = []

        // 1. CASH FLOW ANALYSIS
        const cashAccount = accounts.find(a => a.code === '1010')
        if (cashAccount) {
          if (cashAccount.balance < 0) {
            insights.push({
              id: `cash-negative-${Date.now()}`,
              category: 'Cash Flow Alert',
              message: `⚠️ Cash balance is negative: ${cashAccount.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}. Consider reviewing recent expenses.`,
              urgency: 'high',
              icon: '🚨',
              timestamp: new Date().toISOString()
            })
          } else if (cashAccount.balance < 1000) {
            insights.push({
              id: `cash-low-${Date.now()}`,
              category: 'Cash Flow Warning',
              message: `💰 Cash balance is low: ${cashAccount.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}. Monitor upcoming expenses.`,
              urgency: 'medium',
              icon: '⚠️',
              timestamp: new Date().toISOString()
            })
          } else if (cashAccount.balance > 10000) {
            insights.push({
              id: `cash-strong-${Date.now()}`,
              category: 'Cash Position',
              message: `💚 Strong cash position: ${cashAccount.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} available. Consider investment opportunities.`,
              urgency: 'low',
              icon: '💰',
              timestamp: new Date().toISOString()
            })
          }
        }

        // 2. PROFITABILITY ANALYSIS
        if (totals.totalRevenue > 0) {
          const profitMargin = (totals.netProfit / totals.totalRevenue) * 100
          if (profitMargin > 25) {
            insights.push({
              id: `profit-excellent-${Date.now()}`,
              category: 'Profitability',
              message: `🎯 Excellent profit margin: ${profitMargin.toFixed(1)}%! Revenue streams are performing exceptionally well.`,
              urgency: 'low',
              icon: '📈',
              timestamp: new Date().toISOString()
            })
          } else if (profitMargin > 15) {
            insights.push({
              id: `profit-good-${Date.now()}`,
              category: 'Profitability',
              message: `✅ Healthy profit margin: ${profitMargin.toFixed(1)}%. Business is performing well.`,
              urgency: 'low',
              icon: '📊',
              timestamp: new Date().toISOString()
            })
          } else if (profitMargin > 0) {
            insights.push({
              id: `profit-low-${Date.now()}`,
              category: 'Profitability',
              message: `📉 Profit margin is ${profitMargin.toFixed(1)}%. Consider reviewing expense categories to improve profitability.`,
              urgency: 'medium',
              icon: '⚠️',
              timestamp: new Date().toISOString()
            })
          } else {
            insights.push({
              id: `profit-loss-${Date.now()}`,
              category: 'Loss Alert',
              message: `🔴 Operating at a loss: ${profitMargin.toFixed(1)}% margin. Immediate expense review recommended.`,
              urgency: 'high',
              icon: '🚨',
              timestamp: new Date().toISOString()
            })
          }
        } else if (totals.totalExpenses > 0) {
          insights.push({
            id: `no-revenue-${Date.now()}`,
            category: 'Revenue Alert',
            message: `📊 ${totals.totalExpenses.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} in expenses recorded, but no revenue yet. Add your first sale!`,
            urgency: 'medium',
            icon: '💼',
            timestamp: new Date().toISOString()
          })
        }

        // 3. EXPENSE PATTERN ANALYSIS
        const expenseAccounts = accounts.filter(a => a.type === 'EXPENSE' && a.balance > 0)
        if (expenseAccounts.length > 0) {
          // Find top expense categories
          const topExpense = expenseAccounts.reduce((max, account) => 
            account.balance > max.balance ? account : max
          )
          
          const expenseTransactions = transactions.filter(t => 
            t.entries.some(e => e.accountCode === topExpense.code)
          ).length

          insights.push({
            id: `top-expense-${Date.now()}`,
            category: 'Expense Analysis',
            message: `📈 Top expense category: ${topExpense.name} (${topExpense.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}) across ${expenseTransactions} transactions.`,
            urgency: 'low',
            icon: '📊',
            timestamp: new Date().toISOString()
          })

          // Software subscription analysis
          const softwareAccount = accounts.find(a => a.code === '6030')
          if (softwareAccount && softwareAccount.balance > 500) {
            const softwareTxns = transactions.filter(t => 
              t.entries.some(e => e.accountCode === '6030')
            ).length
            insights.push({
              id: `software-analysis-${Date.now()}`,
              category: 'Software Subscriptions',
              message: `💻 Software subscriptions: ${softwareAccount.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} across ${softwareTxns} transactions. Consider subscription audit.`,
              urgency: 'low',
              icon: '💻',
              timestamp: new Date().toISOString()
            })
          }
        }

        // 4. TRANSACTION ACTIVITY INSIGHTS
        if (transactions.length === 0) {
          insights.push({
            id: `getting-started-${Date.now()}`,
            category: 'Getting Started',
            message: '🚀 Ready to start! Add your first expense or import a receipt to begin tracking your finances.',
            urgency: 'low',
            icon: '✨',
            timestamp: new Date().toISOString()
          })
        } else if (transactions.length < 5) {
          insights.push({
            id: `early-stage-${Date.now()}`,
            category: 'Activity',
            message: `📝 ${transactions.length} transactions recorded. Keep adding expenses to unlock more detailed insights!`,
            urgency: 'low',
            icon: '📈',
            timestamp: new Date().toISOString()
          })
        } else {
          // Recent activity analysis
          const recentTransactions = transactions.slice(-7) // Last 7 transactions
          const recentTotal = recentTransactions.reduce((sum, t) => sum + t.amount, 0)
          
          insights.push({
            id: `activity-summary-${Date.now()}`,
            category: 'Recent Activity',
            message: `📊 ${recentTransactions.length} recent transactions totaling ${recentTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}. Financial tracking is active!`,
            urgency: 'low',
            icon: '📈',
            timestamp: new Date().toISOString()
          })
        }

        // 5. BALANCE SHEET HEALTH
        if (totals.totalAssets > 0 && totals.totalLiabilities > 0) {
          const debtToAssetRatio = (totals.totalLiabilities / totals.totalAssets) * 100
          if (debtToAssetRatio > 70) {
            insights.push({
              id: `debt-high-${Date.now()}`,
              category: 'Financial Health',
              message: `⚠️ High debt-to-asset ratio: ${debtToAssetRatio.toFixed(1)}%. Consider debt reduction strategies.`,
              urgency: 'medium',
              icon: '⚠️',
              timestamp: new Date().toISOString()
            })
          } else if (debtToAssetRatio < 30) {
            insights.push({
              id: `debt-healthy-${Date.now()}`,
              category: 'Financial Health',
              message: `✅ Healthy debt-to-asset ratio: ${debtToAssetRatio.toFixed(1)}%. Strong financial position.`,
              urgency: 'low',
              icon: '💚',
              timestamp: new Date().toISOString()
            })
          }
        }

        // 6. ACCOUNTS RECEIVABLE ANALYSIS
        const arAccount = accounts.find(a => a.code === '1200')
        if (arAccount && arAccount.balance > 0) {
          const arTransactions = transactions.filter(t => 
            t.entries.some(e => e.accountCode === '1200')
          ).length
          insights.push({
            id: `ar-analysis-${Date.now()}`,
            category: 'Accounts Receivable',
            message: `💼 Outstanding receivables: ${arAccount.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} across ${arTransactions} invoices. Monitor collection status.`,
            urgency: 'medium',
            icon: '📋',
            timestamp: new Date().toISOString()
          })
        }

        // Limit to 5 most relevant insights and sort by urgency
        const prioritizedInsights = insights
          .sort((a, b) => {
            const urgencyOrder = { high: 3, medium: 2, low: 1 }
            return urgencyOrder[b.urgency] - urgencyOrder[a.urgency]
          })
          .slice(0, 5)

        set((state: MockDataState) => ({ ...state, aiInsights: prioritizedInsights }))
      },

      // Utility Functions
      getAccountByCode: (code: string) => {
        return get().accounts.find(account => account.code === code)
      },

      getTransactionsByAccount: (accountCode: string) => {
        return get().transactions.filter(transaction => 
          transaction.entries.some(entry => entry.accountCode === accountCode)
        )
      },

      // Reset to Initial State
      resetData: () => {
        set({
          accounts: INITIAL_ACCOUNTS,
          transactions: [],
          totals: calculateInitialTotals(),
          aiInsights: INITIAL_AI_INSIGHTS,
          recurringTransactions: []
        })
      },
      
      // New methods for dynamic account management
      createNewAccount: (name: string, type: AccountType) => {
        const newCode = get().getNextAccountCode(type)
        const newAccount: Account = {
          code: newCode,
          name: name,
          type: type,
          balance: 0.00,
          normalBalance: type === 'ASSET' || type === 'EXPENSE' ? 'DEBIT' : 'CREDIT'
        }
        set((state: MockDataState) => ({ accounts: [...state.accounts, newAccount] }))
        return newAccount
      },

      getNextAccountCode: (type: AccountType) => {
        const accounts = get().accounts.filter(a => a.type === type)
        if (type === 'EXPENSE') {
          // For expenses, find the highest 6XXX code and increment
          const expenseCodes = accounts
            .filter(a => a.code.startsWith('6'))
            .map(a => parseInt(a.code))
            .sort((a, b) => b - a)
          
          if (expenseCodes.length === 0) return '6010'
          
          const highestCode = expenseCodes[0]
          // Skip 6999 (reserved for Other Expenses)
          if (highestCode >= 6990) return '6010'
          
          const nextCode = highestCode + 10 // Increment by 10 for clean numbering
          return nextCode.toString()
        }
        
        // Default logic for other account types
        if (accounts.length === 0) {
          return type === 'ASSET' ? '1010' : type === 'LIABILITY' ? '2010' : type === 'EQUITY' ? '3000' : '4010'
        }
        
        const lastCode = parseInt(accounts[accounts.length - 1].code)
        return (lastCode + 10).toString().padStart(4, '0')
      },

      findOrCreateAccountForCategory: (categoryName: string) => {
        // Normalize category name
        const normalizedCategory = categoryName.toLowerCase().trim()
        
        // Try to find existing mapping first
        const existingMapping = Object.entries(ACCOUNT_MAPPING).find(([key]) => 
          key.toLowerCase().replace('_', ' ') === normalizedCategory ||
          key.toLowerCase() === normalizedCategory.replace(' ', '_')
        )
        
        if (existingMapping) {
          return existingMapping[1]
        }
        
        // Auto-create new expense account
        const newAccountCode = get().getNextAccountCode('EXPENSE')
        const accountName = categoryName.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ') + ' Expense'
        
        const newAccount: Account = {
          code: newAccountCode,
          name: accountName,
          type: 'EXPENSE',
          balance: 0.00,
          normalBalance: 'DEBIT'
        }
        
        set((state: MockDataState) => ({ 
          ...state,
          accounts: [...state.accounts, newAccount] 
        }))
        
        return { debitAccount: newAccountCode, creditAccount: '1010' } // Always credit Cash
      },

      // Recurring Transaction Methods
      addRecurringTransaction: (recurring: Omit<RecurringTransaction, 'id' | 'createdDate'>) => {
        const newRecurring: RecurringTransaction = {
          ...recurring,
          id: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdDate: new Date().toISOString()
        }

        set((state: MockDataState) => ({
          ...state,
          recurringTransactions: [...state.recurringTransactions, newRecurring]
        }))
      },

      getRecurringTransactions: () => {
        return get().recurringTransactions
      },

      updateRecurringTransaction: (id: string, updates: Partial<RecurringTransaction>) => {
        set((state: MockDataState) => ({
          ...state,
          recurringTransactions: state.recurringTransactions.map(recurring =>
            recurring.id === id ? { ...recurring, ...updates } : recurring
          )
        }))
      },

      deleteRecurringTransaction: (id: string) => {
        set((state: MockDataState) => ({
          ...state,
          recurringTransactions: state.recurringTransactions.filter(recurring => recurring.id !== id)
        }))
      },

      processRecurringTransactions: () => {
        const state = get()
        const today = new Date()
        const todayString = today.toISOString().split('T')[0]

        state.recurringTransactions.forEach(recurring => {
          if (!recurring.isActive) return

          const nextDate = new Date(recurring.nextDate)
          if (nextDate <= today) {
            // Create the recurring transaction
            const { addTransaction, findOrCreateAccountForCategory } = get()
            
            // Get account mapping for the category
            const mapping = findOrCreateAccountForCategory(recurring.category)
            
            const transaction = {
              date: todayString,
              description: `${recurring.description} (Auto-recurring)`,
              reference: `REC-${recurring.id}`,
              amount: recurring.amount,
              vendor: recurring.vendor,
              category: recurring.category,
              entries: [
                {
                  accountCode: mapping.debitAccount,
                  type: 'debit' as const,
                  amount: recurring.amount,
                  description: `${recurring.category} expense - ${recurring.description}`
                },
                {
                  accountCode: mapping.creditAccount,
                  type: 'credit' as const,
                  amount: recurring.amount,
                  description: `Auto payment to ${recurring.vendor}`
                }
              ]
            }
            
            addTransaction(transaction)

            // Calculate next date
            const nextDateCalc = new Date(recurring.nextDate)
            switch (recurring.frequency) {
              case 'weekly':
                nextDateCalc.setDate(nextDateCalc.getDate() + 7)
                break
              case 'monthly':
                nextDateCalc.setMonth(nextDateCalc.getMonth() + 1)
                break
              case 'quarterly':
                nextDateCalc.setMonth(nextDateCalc.getMonth() + 3)
                break
            }

            // Update the recurring transaction
            get().updateRecurringTransaction(recurring.id, {
              nextDate: nextDateCalc.toISOString().split('T')[0],
              lastProcessed: todayString
            })
          }
        })
      }
    }),
    {
      name: 'eze-ledger-mock-data', // localStorage key
      version: 1,
    }
  )
) 