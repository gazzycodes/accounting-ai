import { useMockDataStore, type Account, type Transaction, type FinancialTotals, type AIInsight, ACCOUNT_MAPPING } from '../store/mockDataStore'

// Smart AI Category Mapping - Convert AI-detected categories to system categories
const mapAICategoryToSystem = (aiCategory: string): keyof typeof ACCOUNT_MAPPING => {
  const category = aiCategory.toLowerCase().trim()
  
  // Office supplies variations
  if (category.includes('office') || category.includes('supplies') || category.includes('stationery')) {
    return 'OFFICE_SUPPLIES'
  }
  
  // Software/Subscription variations
  if (category.includes('software') || category.includes('subscription') || category.includes('saas') ||
      category.includes('subscriptions')) {
    return 'SOFTWARE'
  }
  
  // Marketing variations
  if (category.includes('marketing') || category.includes('advertising') || category.includes('ads') ||
      category.includes('promotion') || category.includes('seo') || category.includes('campaign') ||
      category.includes('social media') || category.includes('google ads') || category.includes('facebook ads')) {
    return 'MARKETING'
  }
  
  // Travel variations
  if (category.includes('travel') || category.includes('transportation') || category.includes('flight') ||
      category.includes('hotel') || category.includes('accommodation') || category.includes('taxi') ||
      category.includes('uber') || category.includes('gas') || category.includes('fuel')) {
    return 'TRAVEL'
  }
  
  // Utilities variations
  if (category.includes('utilities') || category.includes('electric') || category.includes('water') || 
      category.includes('internet') || category.includes('phone') || category.includes('telecom')) {
    return 'UTILITIES'
  }
  
  // Rent variations
  if (category.includes('rent') || category.includes('lease') || category.includes('office space')) {
    return 'RENT'
  }
  
  // Professional services variations
  if (category.includes('professional') || category.includes('legal') || category.includes('consulting') ||
      category.includes('accounting') || category.includes('advisory')) {
    return 'PROFESSIONAL_SERVICES'
  }
  
  // Salaries variations
  if (category.includes('salary') || category.includes('wage') || category.includes('payroll') ||
      category.includes('staff') || category.includes('employee')) {
    return 'SALARIES'
  }
  
  // COGS variations
  if (category.includes('cogs') || category.includes('cost of goods') || category.includes('inventory') ||
      category.includes('materials') || category.includes('manufacturing')) {
    return 'COGS'
  }
  
  // If no match found, return the category as-is for auto-creation
  return 'OTHER'
}

// Normalize category name for dynamic account creation
const normalizeCategory = (category: string): string => {
  return category
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Financial Data Service - Abstract layer for data access
export class FinancialDataService {
  // Dashboard Data
  static getDashboardData() {
    const { totals, aiInsights } = useMockDataStore.getState()
    
    // Generate sparkline data (demo purposes)
    const sparklineData = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const baseAmount = (totals.totalRevenue + totals.totalExpenses) / 60
      const variance = baseAmount * 0.3
      const amount = baseAmount + (Math.sin(i * 0.5) * variance) // Deterministic pattern
      sparklineData.push({
        date: date.toISOString().slice(0, 10),
        amount: Math.round(amount * 100) / 100
      })
    }

    return {
      metrics: totals,
      sparklineData,
      aiInsights: aiInsights.slice(0, 1) // Show only latest insight on dashboard
    }
  }

  // P&L Statement Data
  static getPnlData() {
    const { accounts, totals } = useMockDataStore.getState()
    
    const revenueAccounts = accounts.filter(a => a.type === 'REVENUE')
    const expenseAccounts = accounts.filter(a => a.type === 'EXPENSE')
    
    // Separate COGS from Operating Expenses
    const cogsAccounts = expenseAccounts.filter(a => a.code.startsWith('5')) // 5xxx = COGS
    const operatingExpenseAccounts = expenseAccounts.filter(a => a.code.startsWith('6')) // 6xxx = Operating Expenses
    const nonOperatingExpenseAccounts = expenseAccounts.filter(a => a.code.startsWith('7')) // 7xxx = Non-Operating
    
    const period = {
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
      end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
    }

    // Calculate detailed totals
    const totalRevenue = revenueAccounts.reduce((sum, a) => sum + a.balance, 0)
    const totalCOGS = cogsAccounts.reduce((sum, a) => sum + a.balance, 0)
    const totalOperatingExpenses = operatingExpenseAccounts.reduce((sum, a) => sum + a.balance, 0)
    const totalNonOperatingExpenses = nonOperatingExpenseAccounts.reduce((sum, a) => sum + a.balance, 0)
    
    const grossProfit = totalRevenue - totalCOGS
    const operatingIncome = grossProfit - totalOperatingExpenses
    const netIncome = operatingIncome - totalNonOperatingExpenses

    return {
      period,
      revenue: revenueAccounts.map(a => ({ name: a.name, amount: a.balance })),
      expenses: expenseAccounts.map(a => ({ name: a.name, amount: a.balance })), // Legacy compatibility
      cogs: cogsAccounts.map(a => ({ name: a.name, amount: a.balance })),
      operatingExpenses: operatingExpenseAccounts.map(a => ({ name: a.name, amount: a.balance })),
      nonOperatingExpenses: nonOperatingExpenseAccounts.map(a => ({ name: a.name, amount: a.balance })),
      totals: {
        revenue: totalRevenue,
        cogs: totalCOGS,
        grossProfit: grossProfit,
        operatingExpenses: totalOperatingExpenses,
        operatingIncome: operatingIncome,
        nonOperatingExpenses: totalNonOperatingExpenses,
        netIncome: netIncome,
        
        // Legacy fields for compatibility
        expenses: totals.totalExpenses,
        netProfit: totals.netProfit
      }
    }
  }

  // Balance Sheet Data
  static getBalanceSheetData() {
    const { accounts, totals } = useMockDataStore.getState()
    
    const assetAccounts = accounts.filter(a => a.type === 'ASSET')
    const liabilityAccounts = accounts.filter(a => a.type === 'LIABILITY')
    const equityAccounts = accounts.filter(a => a.type === 'EQUITY')
    
    // Classify Current vs Non-Current Assets
    const currentAssets = assetAccounts.filter(a => 
      a.code.startsWith('10') || // Cash, A/R, Inventory
      a.code.startsWith('11') || // Short-term investments
      a.code.startsWith('12') || // A/R and related
      a.code.startsWith('13') || // Inventory
      a.code.startsWith('14') || // Prepaid expenses
      a.code.startsWith('15')    // Supplies
    )
    
    const nonCurrentAssets = assetAccounts.filter(a => 
      a.code.startsWith('16') || // Property & Equipment
      a.code.startsWith('17') || // Intangible assets
      a.code.startsWith('18') || // Long-term investments
      a.code.startsWith('19')    // Other non-current
    )
    
    // Classify Current vs Long-term Liabilities
    const currentLiabilities = liabilityAccounts.filter(a =>
      a.code.startsWith('20') || // A/P, Accrued expenses
      a.code.startsWith('21') || // Short-term payables
      a.code.startsWith('22') || // Credit cards
      a.code.startsWith('23')    // Current portion of long-term debt
    )
    
    const longTermLiabilities = liabilityAccounts.filter(a =>
      a.code.startsWith('24') || // Long-term debt
      a.code.startsWith('25') || // Deferred revenue
      a.code.startsWith('26')    // Other long-term
    )
    
    // Calculate totals
    const totalCurrentAssets = currentAssets.reduce((sum, a) => sum + a.balance, 0)
    const totalNonCurrentAssets = nonCurrentAssets.reduce((sum, a) => sum + a.balance, 0)
    const totalCurrentLiabilities = currentLiabilities.reduce((sum, a) => sum + a.balance, 0)
    const totalLongTermLiabilities = longTermLiabilities.reduce((sum, a) => sum + a.balance, 0)
    const totalEquity = equityAccounts.reduce((sum, a) => sum + a.balance, 0)
    
    // Calculate financial ratios
    const workingCapital = totalCurrentAssets - totalCurrentLiabilities
    const currentRatio = totalCurrentLiabilities > 0 ? totalCurrentAssets / totalCurrentLiabilities : 0
    const debtToEquityRatio = totalEquity > 0 ? (totalCurrentLiabilities + totalLongTermLiabilities) / totalEquity : 0
    
    const asOf = new Date().toISOString().slice(0, 10)

    return {
      asOf,
      currentAssets: currentAssets.map(a => ({ name: a.name, amount: a.balance })),
      nonCurrentAssets: nonCurrentAssets.map(a => ({ name: a.name, amount: a.balance })),
      currentLiabilities: currentLiabilities.map(a => ({ name: a.name, amount: a.balance })),
      longTermLiabilities: longTermLiabilities.map(a => ({ name: a.name, amount: a.balance })),
      equity: equityAccounts.map(a => ({ name: a.name, amount: a.balance })),
      
      // Legacy format for compatibility
      assets: assetAccounts.map(a => ({ name: a.name, amount: a.balance })),
      liabilities: liabilityAccounts.map(a => ({ name: a.name, amount: a.balance })),
      
      totals: {
        currentAssets: totalCurrentAssets,
        nonCurrentAssets: totalNonCurrentAssets,
        totalAssets: totals.totalAssets,
        currentLiabilities: totalCurrentLiabilities,
        longTermLiabilities: totalLongTermLiabilities,
        totalLiabilities: totals.totalLiabilities,
        totalEquity: totalEquity,
        liabilitiesAndEquity: Number((totals.totalLiabilities + totals.totalEquity).toFixed(2)),
        
        // Financial Ratios
        workingCapital: workingCapital,
        currentRatio: Number(currentRatio.toFixed(2)),
        debtToEquityRatio: Number(debtToEquityRatio.toFixed(2)),
        
        // Legacy fields
        assets: totals.totalAssets,
        liabilities: totals.totalLiabilities,
        equity: totals.totalEquity
      }
    }
  }

  // Trial Balance Data
  static getTrialBalanceData() {
    const { accounts, transactions } = useMockDataStore.getState()
    
    const asOf = new Date().toISOString().slice(0, 10)
    
    // Convert accounts to trial balance rows with enhanced information
    const rows = accounts.map(account => {
      let debit = 0
      let credit = 0
      
      if (account.balance === 0) {
        // Zero balance - show as zeros
        debit = 0
        credit = 0
      } else if (account.normalBalance === 'DEBIT') {
        // Normal debit accounts (Assets, Expenses)
        if (account.balance >= 0) {
          debit = account.balance  // Positive balance shows in debit column
          credit = 0
        } else {
          debit = 0
          credit = Math.abs(account.balance)  // Negative balance shows in credit column
        }
      } else {
        // Normal credit accounts (Liabilities, Equity, Revenue)  
        if (account.balance >= 0) {
          debit = 0
          credit = account.balance  // Positive balance shows in credit column
        } else {
          debit = Math.abs(account.balance)  // Negative balance shows in debit column
          credit = 0
        }
      }
      
      // Calculate transaction count for this account
      const transactionCount = transactions.filter(t => 
        t.entries.some(e => e.accountCode === account.code)
      ).length
      
      // Get last activity date
      const accountTransactions = transactions.filter(t => 
        t.entries.some(e => e.accountCode === account.code)
      ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      const lastActivity = accountTransactions.length > 0 ? accountTransactions[0].date : null
      
      return {
        accountCode: account.code,
        account: account.name,
        accountType: account.type,
        normalBalance: account.normalBalance,
        debit,
        credit,
        balance: account.balance,
        transactionCount,
        lastActivity,
        isActive: account.balance !== 0 || transactionCount > 0
      }
    }).sort((a, b) => a.accountCode.localeCompare(b.accountCode)) // Sort by account code
    
    // Calculate totals
    const totals = rows.reduce((acc, row) => {
      acc.debit += row.debit
      acc.credit += row.credit
      return acc
    }, { debit: 0, credit: 0 })

    // Check if trial balance is balanced
    const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01
    const difference = totals.debit - totals.credit

    return {
      asOf,
      rows,
      totals: {
        debit: Number(totals.debit.toFixed(2)),
        credit: Number(totals.credit.toFixed(2)),
        difference: Number(difference.toFixed(2)),
        isBalanced
      },
      summary: {
        totalAccounts: accounts.length,
        activeAccounts: rows.filter(r => r.isActive).length,
        zeroBalanceAccounts: rows.filter(r => r.balance === 0).length,
        totalTransactions: transactions.length
      }
    }
  }

  // Chart of Accounts Data
  static getChartOfAccountsData() {
    const { accounts, transactions } = useMockDataStore.getState()
    
    // Enhanced account data with usage statistics
    const enhancedAccounts = accounts.map(account => {
      // Calculate transaction count and last activity
      const accountTransactions = transactions.filter(t => 
        t.entries.some(e => e.accountCode === account.code)
      )
      
      const transactionCount = accountTransactions.length
      const lastActivity = accountTransactions.length > 0 ? 
        accountTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date : null
      
      // Determine account status
      const isActive = account.balance !== 0 || transactionCount > 0
      
      // Determine account category for hierarchy
      const category = account.type
      const subcategory = (() => {
        const code = account.code
        if (code.startsWith('10')) return 'Current Assets'
        if (code.startsWith('11')) return 'Short-term Investments'
        if (code.startsWith('12')) return 'Receivables'
        if (code.startsWith('13')) return 'Inventory'
        if (code.startsWith('14')) return 'Prepaid Expenses'
        if (code.startsWith('15')) return 'Supplies'
        if (code.startsWith('16')) return 'Property & Equipment'
        if (code.startsWith('17')) return 'Intangible Assets'
        if (code.startsWith('20')) return 'Current Liabilities'
        if (code.startsWith('21')) return 'Accrued Liabilities'
        if (code.startsWith('22')) return 'Credit Cards & Short-term Debt'
        if (code.startsWith('24')) return 'Long-term Liabilities'
        if (code.startsWith('25')) return 'Deferred Revenue'
        if (code.startsWith('30')) return 'Owner Equity'
        if (code.startsWith('32')) return 'Retained Earnings'
        if (code.startsWith('40')) return 'Revenue'
        if (code.startsWith('49')) return 'Other Income'
        if (code.startsWith('50')) return 'Cost of Goods Sold'
        if (code.startsWith('60')) return 'Operating Expenses'
        if (code.startsWith('61')) return 'Administrative Expenses'
        if (code.startsWith('62')) return 'Marketing & Sales'
        if (code.startsWith('70')) return 'Non-Operating Expenses'
        return 'Other'
      })()
      
      // Account description based on type and code
      const description = (() => {
        if (account.type === 'ASSET') return 'Resources owned by the business'
        if (account.type === 'LIABILITY') return 'Debts and obligations owed'
        if (account.type === 'EQUITY') return 'Owner\'s stake in the business'
        if (account.type === 'REVENUE') return 'Income earned from operations'
        if (account.type === 'EXPENSE') return 'Costs incurred in operations'
        return 'General ledger account'
      })()
      
      return {
        code: account.code,
        name: account.name,
        type: account.type,
        category: category,
        subcategory: subcategory,
        balance: account.balance,
        normalBalance: account.normalBalance,
        description: description,
        isActive: isActive,
        transactionCount: transactionCount,
        lastActivity: lastActivity,
        createdDate: '2025-01-01', // Default creation date for demo
        status: isActive ? 'Active' : 'Inactive'
      }
    }).sort((a, b) => a.code.localeCompare(b.code))

    // Group accounts by category and subcategory for hierarchy
    const accountHierarchy = enhancedAccounts.reduce((acc, account) => {
      if (!acc[account.category]) {
        acc[account.category] = {}
      }
      if (!acc[account.category][account.subcategory]) {
        acc[account.category][account.subcategory] = []
      }
      acc[account.category][account.subcategory].push(account)
      return acc
    }, {} as Record<string, Record<string, typeof enhancedAccounts>>)

    // Calculate summary statistics
    const summary = {
      totalAccounts: enhancedAccounts.length,
      activeAccounts: enhancedAccounts.filter(a => a.isActive).length,
      inactiveAccounts: enhancedAccounts.filter(a => !a.isActive).length,
      accountsByType: {
        ASSET: enhancedAccounts.filter(a => a.type === 'ASSET').length,
        LIABILITY: enhancedAccounts.filter(a => a.type === 'LIABILITY').length,
        EQUITY: enhancedAccounts.filter(a => a.type === 'EQUITY').length,
        REVENUE: enhancedAccounts.filter(a => a.type === 'REVENUE').length,
        EXPENSE: enhancedAccounts.filter(a => a.type === 'EXPENSE').length
      },
      totalTransactions: transactions.length,
      accountsWithActivity: enhancedAccounts.filter(a => a.transactionCount > 0).length
    }
    
    return {
      accounts: enhancedAccounts,
      hierarchy: accountHierarchy,
      summary: summary
    }
  }

  // Account Transactions (for modal)
  static getAccountTransactions(accountCode: string) {
    const { getTransactionsByAccount, getAccountByCode } = useMockDataStore.getState()
    const account = getAccountByCode(accountCode)
    const transactions = getTransactionsByAccount(accountCode)
    
    if (!account) return []
    
    // Convert to format expected by UI
    return transactions.map(transaction => {
      const entry = transaction.entries.find(e => e.accountCode === accountCode)
      if (!entry) return null
      
      return {
        id: transaction.id,
        date: transaction.date,
        description: entry.description || transaction.description,
        amount: entry.amount,
        type: entry.type
      }
    }).filter(Boolean).slice(0, 8) // Limit to 8 transactions for modal
  }

  // Add Expense Transaction
  static addExpenseTransaction(expenseData: {
    vendor: string
    category: string
    date: string
    amount: number
    description: string
    receiptUrl?: string
    customFields?: any[]
    paymentStatus?: 'paid' | 'invoice' // New field to distinguish between paid expenses and invoices
  }) {
    const { addTransaction, findOrCreateAccountForCategory } = useMockDataStore.getState()
    
    // Try mapped category first, then use direct category name for auto-creation
    const systemCategory = mapAICategoryToSystem(expenseData.category)
    let mapping: { debitAccount: string, creditAccount: string }
    
    if (systemCategory !== 'OTHER' && ACCOUNT_MAPPING[systemCategory]) {
      // Use existing mapping
      mapping = ACCOUNT_MAPPING[systemCategory]
    } else {
      // Use dynamic account creation for unmapped categories
      mapping = findOrCreateAccountForCategory(expenseData.category)
    }
    
    // Determine credit account based on payment status
    // CORRECTED: Use proper cash-based accounting for paid expenses
    const creditAccount = expenseData.paymentStatus === 'invoice' 
      ? '2010' // Accounts Payable (creates liability for unpaid invoices)
      : '1010' // Cash (reduces cash for paid expenses - CORRECT!)
    
    const transaction = {
      date: expenseData.date,
      description: expenseData.paymentStatus === 'invoice' 
        ? `Invoice from ${expenseData.vendor} - ${expenseData.description}` 
        : `Paid expense to ${expenseData.vendor} - ${expenseData.description}`,
      reference: expenseData.paymentStatus === 'invoice' 
        ? `INV-${Date.now()}` 
        : `EXP-${Date.now()}`,
      amount: expenseData.amount,
      entries: [
        {
          accountCode: mapping.debitAccount,
          type: 'debit' as const,
          amount: expenseData.amount,
          description: `${expenseData.category} expense - ${expenseData.description}`
        },
        {
          accountCode: creditAccount,
          type: 'credit' as const,
          amount: expenseData.amount,
          description: expenseData.paymentStatus === 'invoice' 
            ? `Liability to ${expenseData.vendor}` 
            : `Cash payment to ${expenseData.vendor}`
        }
      ],
      category: expenseData.category,
      vendor: expenseData.vendor,
      receiptUrl: expenseData.receiptUrl,
      customFields: expenseData.customFields,
      paymentStatus: expenseData.paymentStatus
    }

    addTransaction(transaction)

    const successMessage = expenseData.paymentStatus === 'invoice' 
      ? `📄 Invoice recorded: ${expenseData.category} expense of $${expenseData.amount.toFixed(2)} from ${expenseData.vendor}. Liability created in Accounts Payable.`
      : `💰 Expense paid: ${expenseData.category} expense of $${expenseData.amount.toFixed(2)} to ${expenseData.vendor}. Cash reduced.`
    
    return { success: true, message: successMessage, transaction }
  }

  // Add Revenue Transaction
  static addRevenueTransaction(revenueData: {
    customer: string
    category: 'PRODUCT_SALES' | 'CONSULTING' | 'RECURRING' | 'OTHER_INCOME'
    date: string
    amount: number
    description: string
    invoiceNumber?: string
    paymentMethod?: 'CASH' | 'INVOICE'
  }) {
    const { addTransaction } = useMockDataStore.getState()
    
    // Get account mapping for the category
    const mapping = ACCOUNT_MAPPING[revenueData.category]
    
    // Use A/R if invoice, otherwise cash
    const debitAccount = revenueData.paymentMethod === 'INVOICE' ? '1200' : mapping.debitAccount
    
    const transaction = {
      date: revenueData.date,
      description: revenueData.description || `Revenue: ${revenueData.customer}`,
      reference: revenueData.invoiceNumber || `REV-${Date.now()}`,
      amount: revenueData.amount,
      customer: revenueData.customer,
      category: revenueData.category,
      entries: [
        {
          accountCode: debitAccount,
          type: 'debit' as const,
          amount: revenueData.amount,
          description: `Payment from: ${revenueData.customer}`
        },
        {
          accountCode: mapping.creditAccount,
          type: 'credit' as const,
          amount: revenueData.amount,
          description: `${revenueData.category}: ${revenueData.customer}`
        }
      ]
    }
    
    addTransaction(transaction)
    return { success: true, message: `💰 Revenue recorded successfully! $${revenueData.amount} from ${revenueData.customer}` }
  }

  // Add Transfer Transaction
  static addTransferTransaction(transferData: {
    fromAccountCode: string
    toAccountCode: string
    amount: number
    description: string
    date: string
  }) {
    const { addTransaction, getAccountByCode } = useMockDataStore.getState()
    
    const fromAccount = getAccountByCode(transferData.fromAccountCode)
    const toAccount = getAccountByCode(transferData.toAccountCode)
    
    if (!fromAccount || !toAccount) {
      return { success: false, message: 'Invalid account codes' }
    }
    
    const transaction = {
      date: transferData.date,
      description: transferData.description,
      reference: `TRF-${Date.now()}`,
      amount: transferData.amount,
      entries: [
        {
          accountCode: transferData.toAccountCode,
          type: 'debit' as const,
          amount: transferData.amount,
          description: `Transfer from ${fromAccount.name}`
        },
        {
          accountCode: transferData.fromAccountCode,
          type: 'credit' as const,
          amount: transferData.amount,
          description: `Transfer to ${toAccount.name}`
        }
      ]
    }
    
    addTransaction(transaction)
    return { success: true, message: `↔️ Transfer completed successfully! $${transferData.amount} from ${fromAccount.name} to ${toAccount.name}` }
  }

  // Get All AI Insights
  static getAIInsights() {
    const { aiInsights } = useMockDataStore.getState()
    return aiInsights
  }

  // Get Dashboard-Specific AI Insights
  static getDashboardInsights() {
    const { accounts, transactions, totals } = useMockDataStore.getState()
    const insights: any[] = []

    // Dashboard focuses on high-level KPIs and immediate alerts
    const cashAccount = accounts.find(a => a.code === '1010')
    
    // Cash flow alerts (critical for dashboard)
    if (cashAccount && cashAccount.balance < 0) {
      insights.push({
        category: 'Cash Alert',
        message: `🚨 Negative cash balance: ${cashAccount.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
        urgency: 'high',
        icon: '🚨'
      })
    }

    // Overall business health
    if (totals.totalRevenue > 0) {
      const profitMargin = (totals.netProfit / totals.totalRevenue) * 100
      insights.push({
        category: 'Performance',
        message: `📈 Current profit margin: ${profitMargin.toFixed(1)}%`,
        urgency: profitMargin > 15 ? 'low' : 'medium',
        icon: profitMargin > 15 ? '✅' : '⚠️'
      })
    }

    return insights.slice(0, 3) // Show top 3 on dashboard
  }

  // Get P&L-Specific AI Insights
  static getPnlInsights() {
    const { accounts, transactions, totals } = useMockDataStore.getState()
    const insights: any[] = []

    // Revenue analysis
    if (totals.totalRevenue === 0 && totals.totalExpenses > 0) {
      insights.push({
        id: 'pnl-revenue-gap',
        category: 'Revenue Gap',
        message: `💼 ${totals.totalExpenses.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} in expenses but no revenue recorded. Add sales to improve P&L.`,
        urgency: 'high',
        icon: '📊',
        timestamp: new Date().toISOString()
      })
    }

    // Expense breakdown analysis
    const expenseAccounts = accounts.filter(a => a.type === 'EXPENSE' && a.balance > 0)
    if (expenseAccounts.length > 0) {
      const topExpense = expenseAccounts.reduce((max, account) => 
        account.balance > max.balance ? account : max
      )
      insights.push({
        id: 'pnl-top-expense',
        category: 'Top Expense',
        message: `📈 Largest expense: ${topExpense.name} (${topExpense.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})`,
        urgency: 'low',
        icon: '💸',
        timestamp: new Date().toISOString()
      })
    }

    // Profitability trends
    if (totals.totalRevenue > 0 && totals.netProfit > 0) {
      const profitMargin = (totals.netProfit / totals.totalRevenue) * 100
      insights.push({
        id: 'pnl-profitability',
        category: 'Profitability',
        message: `✅ Profitable operations with ${profitMargin.toFixed(1)}% margin`,
        urgency: 'low',
        icon: '💚',
        timestamp: new Date().toISOString()
      })
    }

    // Empty state for clean demo
    if (insights.length === 0) {
      insights.push({
        id: 'pnl-getting-started',
        category: 'Getting Started',
        message: '🚀 Ready for your first transaction! Add expenses or revenue to see dynamic P&L insights.',
        urgency: 'low',
        icon: '🏁',
        timestamp: new Date().toISOString()
      })
    }

    return insights
  }

  // Get Balance Sheet-Specific AI Insights
  static getBalanceSheetInsights() {
    const { accounts, totals } = useMockDataStore.getState()
    const insights: any[] = []

    // Asset composition analysis
    const cashAccount = accounts.find(a => a.code === '1010')
    if (cashAccount && totals.totalAssets > 0) {
      const cashPercentage = (cashAccount.balance / totals.totalAssets) * 100
      if (cashPercentage > 50) {
        insights.push({
          id: 'bs-asset-mix',
          category: 'Asset Mix',
          message: `💰 Cash represents ${cashPercentage.toFixed(1)}% of total assets. Consider diversification.`,
          urgency: 'low',
          icon: '📊',
          timestamp: new Date().toISOString()
        })
      } else if (cashAccount.balance > 0) {
        insights.push({
          id: 'bs-cash-position',
          category: 'Cash Position',
          message: `💰 Strong cash position of ${cashAccount.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} provides excellent liquidity for operations.`,
          urgency: 'low',
          icon: '✅',
          timestamp: new Date().toISOString()
        })
      }
    }

    // Debt analysis
    if (totals.totalAssets > 0 && totals.totalLiabilities > 0) {
      const debtRatio = (totals.totalLiabilities / totals.totalAssets) * 100
      insights.push({
        id: 'bs-debt-ratio',
        category: 'Debt Ratio',
        message: `${debtRatio > 50 ? '⚠️' : '✅'} Debt-to-asset ratio: ${debtRatio.toFixed(1)}%`,
        urgency: debtRatio > 70 ? 'medium' : 'low',
        icon: debtRatio > 50 ? '⚠️' : '💚',
        timestamp: new Date().toISOString()
      })
    }

    // Equity position
    if (totals.totalEquity > 0) {
      insights.push({
        id: 'bs-equity-position',
        category: 'Equity Position',
        message: `💼 Owner's equity: ${totals.totalEquity.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
        urgency: 'low',
        icon: '🏦',
        timestamp: new Date().toISOString()
      })
    }

    // Empty state for clean demo
    if (insights.length === 0) {
      insights.push({
        id: 'bs-getting-started',
        category: 'Getting Started',
        message: '⚖️ Balance sheet ready! Add transactions to see dynamic asset, liability, and equity insights.',
        urgency: 'low',
        icon: '🏁',
        timestamp: new Date().toISOString()
      })
    }

    return insights
  }

  // Get Trial Balance-Specific AI Insights
  static getTrialBalanceInsights() {
    const { accounts, transactions } = useMockDataStore.getState()
    const insights: any[] = []

    // Balance validation
    const totalDebits = accounts.reduce((sum, account) => {
      if (account.normalBalance === 'DEBIT' && account.balance >= 0) return sum + account.balance
      if (account.normalBalance === 'CREDIT' && account.balance < 0) return sum + Math.abs(account.balance)
      return sum
    }, 0)

    const totalCredits = accounts.reduce((sum, account) => {
      if (account.normalBalance === 'CREDIT' && account.balance >= 0) return sum + account.balance
      if (account.normalBalance === 'DEBIT' && account.balance < 0) return sum + Math.abs(account.balance)
      return sum
    }, 0)

    if (Math.abs(totalDebits - totalCredits) < 0.01) {
      insights.push({
        id: 'tb-balance-check',
        category: 'Balance Validation',
        message: `✅ All accounts balanced with ${transactions.length} transactions totaling ${totalDebits.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
        urgency: 'low',
        icon: '⚖️',
        timestamp: new Date().toISOString()
      })
    } else {
      insights.push({
        id: 'tb-balance-error',
        category: 'Balance Error',
        message: `🚨 Trial Balance imbalance detected. Debits: ${totalDebits.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}, Credits: ${totalCredits.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
        urgency: 'high',
        icon: '⚠️',
        timestamp: new Date().toISOString()
      })
    }

    // Account activity summary
    const activeAccounts = accounts.filter(a => a.balance !== 0)
    if (activeAccounts.length > 0) {
      insights.push({
        id: 'tb-account-activity',
        category: 'Account Activity',
        message: `📊 ${activeAccounts.length} of ${accounts.length} accounts have activity (${((activeAccounts.length / accounts.length) * 100).toFixed(1)}% utilization)`,
        urgency: 'low',
        icon: '📈',
        timestamp: new Date().toISOString()
      })
    }

    // Empty state for clean demo
    if (insights.length === 0) {
      insights.push({
        id: 'tb-getting-started',
        category: 'Getting Started',
        message: '📋 Trial balance initialized! Add transactions to see account-level balance validation insights.',
        urgency: 'low',
        icon: '🏁',
        timestamp: new Date().toISOString()
      })
    }

    return insights
  }

  // Get Chart of Accounts-Specific AI Insights  
  static getChartOfAccountsInsights() {
    const { accounts, transactions } = useMockDataStore.getState()
    const insights: any[] = []

    // Account utilization
    const activeAccounts = accounts.filter(a => a.balance !== 0)
    const utilizationRate = (activeAccounts.length / accounts.length) * 100

    if (activeAccounts.length > 0) {
      insights.push({
        id: 'coa-account-usage',
        category: 'Account Usage',
        message: `📊 ${utilizationRate.toFixed(0)}% account utilization (${activeAccounts.length}/${accounts.length} active)`,
        urgency: 'low',
        icon: '📋',
        timestamp: new Date().toISOString()
      })
    }

    // Most active account
    if (transactions.length > 0) {
      const accountActivity = accounts.map(account => ({
        account,
        transactions: transactions.filter(t => 
          t.entries.some(e => e.accountCode === account.code)
        ).length
      })).filter(item => item.transactions > 0)

      if (accountActivity.length > 0) {
        const mostActive = accountActivity.reduce((max, item) => 
          item.transactions > max.transactions ? item : max
        )

        insights.push({
          id: 'coa-most-active',
          category: 'Most Active',
          message: `⭐ Most active account: ${mostActive.account.name} (${mostActive.transactions} transactions)`,
          urgency: 'low',
          icon: '🎯',
          timestamp: new Date().toISOString()
        })
      }
    }

    // Empty state for clean demo
    if (insights.length === 0) {
      insights.push({
        id: 'coa-getting-started',
        category: 'Getting Started',
        message: '📋 Chart of Accounts ready! Add transactions to see account utilization and activity insights.',
        urgency: 'low',
        icon: '🏁',
        timestamp: new Date().toISOString()
      })
    }

    return insights
  }

  // Reset All Data (for demo purposes)
  static resetData() {
    const { resetData } = useMockDataStore.getState()
    resetData()
    return { success: true, message: 'Data reset to initial state' }
  }
}

// Export for easier imports
export default FinancialDataService 