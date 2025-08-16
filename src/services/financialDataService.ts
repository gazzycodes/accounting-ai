import axios from 'axios'

// Environment Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const USE_DB = import.meta.env.VITE_USE_DB !== 'false' // Default to true (database mode)

// API Client Configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add request/response interceptors for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('🚨 API Request Error:', error)
    return Promise.reject(error)
  }
)

apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`)
    return response
  },
  (error) => {
    console.error('🚨 API Response Error:', error.response?.status, error.response?.data || error.message)
    return Promise.reject(error)
  }
)

/**
 * Phase 1: Database-First Financial Data Service
 * 
 * Single source of truth: All financial data comes from database via API.
 * No more mock data usage - everything is real and persistent.
 */
export class FinancialDataService {
  
  /**
   * Dashboard Data - Real KPIs from database
   */
  static async getDashboardData() {
    try {
      if (!USE_DB) {
        console.warn('⚠️ Database mode disabled, falling back to empty data')
        return this.getEmptyDashboardData()
      }

      const response = await apiClient.get('/api/dashboard')
      return response.data
    } catch (error) {
      console.error('Dashboard API error:', error)
      // Return empty structure for UI compatibility
      return this.getEmptyDashboardData()
    }
  }

  /**
   * P&L Statement Data - Real profit/loss from transactions
   */
  static async getPnlData() {
    try {
      if (!USE_DB) {
        return this.getEmptyPnlData()
      }

      const response = await apiClient.get('/api/reports/pnl')
      return response.data
    } catch (error) {
      console.error('P&L API error:', error)
      return this.getEmptyPnlData()
    }
  }

  /**
   * Balance Sheet Data - Real assets/liabilities/equity from database
   */
  static async getBalanceSheetData() {
    try {
      if (!USE_DB) {
        return this.getEmptyBalanceSheetData()
      }

      const response = await apiClient.get('/api/reports/balance-sheet')
      return response.data
    } catch (error) {
      console.error('Balance Sheet API error:', error)
      return this.getEmptyBalanceSheetData()
    }
  }

  /**
   * Trial Balance Data - Real trial balance from transaction entries
   */
  static async getTrialBalanceData() {
    try {
      if (!USE_DB) {
        return this.getEmptyTrialBalanceData()
      }

      const response = await apiClient.get('/api/reports/trial-balance')
      return response.data
    } catch (error) {
      console.error('Trial Balance API error:', error)
      return this.getEmptyTrialBalanceData()
    }
  }

  /**
   * Chart of Accounts Data - All accounts with current balances
   */
  static async getChartOfAccountsData() {
    try {
      if (!USE_DB) {
        return this.getEmptyChartOfAccountsData()
      }

      const response = await apiClient.get('/api/reports/chart-of-accounts')
      return response.data
    } catch (error) {
      console.error('Chart of Accounts API error:', error)
      return this.getEmptyChartOfAccountsData()
    }
  }

  /**
   * Add Invoice Transaction - Create invoice/revenue via API
   */
  static async addInvoiceTransaction(invoiceData: {
    customerName: string
    category: string
    date: string
    amount: number
    subtotal?: number
    description: string
    receiptUrl?: string
    customFields?: any[]
    paymentStatus?: 'paid' | 'invoice' | 'overpaid' | 'partial'
    amountPaid?: number
    balanceDue?: number
    overdue?: boolean
    recurring?: boolean
    invoiceNumber?: string
    dueDate?: string
    lineItems?: Array<{
      description: string
      amount: number
      quantity: number
      rate: number
      category: string
    }>
    taxSettings?: {
      enabled: boolean
      name?: string
      type?: string
      rate?: number
      amount?: number
      taxExempt?: boolean
    }
    discount?: {
      enabled: boolean
      description?: string
      type?: string
      value?: number
      amount?: number
    }
  }) {
    try {
      if (!USE_DB) {
        return { 
          success: false, 
          message: 'Database mode disabled - invoice not saved',
          transaction: null 
        }
      }

      // Transform to PostingEngine invoice format
      const postingEngineData = {
        date: invoiceData.date,
        amount: invoiceData.amount.toFixed(2),
        subtotal: (invoiceData.subtotal || invoiceData.amount).toFixed(2),
        amountPaid: (invoiceData.amountPaid || invoiceData.amount).toFixed(2),
        balanceDue: (invoiceData.balanceDue || 0).toFixed(2),
        paymentStatus: invoiceData.paymentStatus || 'paid',
        categoryKey: (invoiceData.category || 'PROFESSIONAL_SERVICES').toUpperCase(),
        customerName: invoiceData.customerName,
        reference: `AI-INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${performance.now()}`,
        description: invoiceData.description,
        invoiceNumber: invoiceData.invoiceNumber,
        dueDate: invoiceData.dueDate,
        lineItems: invoiceData.lineItems || [],
        // FIXED: Include tax and discount settings that were missing
        taxSettings: invoiceData.taxSettings || { enabled: false },
        discount: invoiceData.discount || { enabled: false }
      }

      console.log('💰 Posting Invoice to API:', postingEngineData)

      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postingEngineData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to post invoice')
      }

      const result = await response.json()
      console.log('✅ Invoice posted successfully:', result)

      return { success: true, message: result.message, transaction: result }
    } catch (error) {
      console.error('❌ Failed to add invoice transaction:', error)
      return { success: false, message: error.message || 'Failed to add invoice', transaction: null }
    }
  }

  /**
   * Add Expense Transaction - Create expense via API
   */
  static async addExpenseTransaction(expenseData: {
    vendor: string
    category: string
    date: string
    amount: number
    description: string
    receiptUrl?: string
    customFields?: any[]
    paymentStatus?: 'paid' | 'invoice' | 'overpaid' | 'partial'
    amountPaid?: number
    balanceDue?: number
    overdue?: boolean
    recurring?: boolean
    invoiceNumber?: string
    dueDate?: string
  }) {
    try {
      if (!USE_DB) {
        return { 
          success: false, 
          message: 'Database mode disabled - expense not saved',
          transaction: null 
        }
      }

      // Transform to PostingEngine format
      const postingEngineData = {
        date: expenseData.date,
        amount: expenseData.amount.toFixed(2),  // Convert to string with 2 decimals
        // Preserve richer statuses for backend multi-line logic
        paymentStatus: expenseData.paymentStatus === 'invoice' 
          ? 'unpaid' 
          : expenseData.paymentStatus === 'partial'
          ? 'partial'
          : expenseData.paymentStatus === 'overpaid'
          ? 'overpaid'
          : 'paid',
        categoryKey: expenseData.category.toUpperCase(),
        vendorName: expenseData.vendor,
        reference: `AI-EXP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${performance.now()}`, // Generate unique reference with performance counter
        notes: expenseData.description,
        receiptUrl: expenseData.receiptUrl,
        // Optional numeric fields for precise posting
        amountPaid: typeof expenseData.amountPaid === 'number' ? expenseData.amountPaid.toFixed(2) : undefined,
        balanceDue: typeof expenseData.balanceDue === 'number' ? expenseData.balanceDue.toFixed(2) : undefined,
        // Optional flags
        overdue: expenseData.overdue ?? undefined,
        recurring: expenseData.recurring ?? undefined,
        invoiceNumber: expenseData.invoiceNumber ?? undefined,
        dueDate: expenseData.dueDate ?? undefined
      }

      const response = await apiClient.post('/api/expenses', postingEngineData)
      return { 
        success: true, 
        message: `✅ Expense recorded: $${expenseData.amount} to ${expenseData.vendor}`,
        transaction: response.data 
      }
    } catch (error) {
      console.error('Add Expense API error:', error)
      return { 
        success: false, 
        message: `❌ Failed to record expense: ${error instanceof Error ? error.message : 'Unknown error'}`,
        transaction: null 
      }
    }
  }

  /**
   * Health Check - Verify accounting integrity
   */
  static async getHealthCheck() {
    try {
      if (!USE_DB) {
        return {
          status: 'DISABLED',
          issues: [],
          summary: { message: 'Database mode disabled' }
        }
      }

      const response = await apiClient.get('/api/health')
      return response.data
    } catch (error) {
      console.error('Health Check API error:', error)
      return {
        status: 'ERROR',
        issues: [{
          type: 'API_ERROR',
          message: error instanceof Error ? error.message : 'Health check failed',
          severity: 'HIGH'
        }],
        summary: { message: 'Unable to perform health check' }
      }
    }
  }

  // Legacy methods for compatibility (Phase 2 will enhance these)
  static async getAccountTransactions(accountCode: string) {
    console.log(`Getting transactions for account ${accountCode} - Phase 2 feature`)
    return []
  }

  static async addRevenueTransaction(revenueData: any) {
    console.warn('Revenue transactions will be available in Phase 2')
    return { success: false, message: 'Revenue transactions will be available in Phase 2' }
  }

  static async getAIInsights() { return [] }
  static async getDashboardInsights() { return [] }
  static async getPnlInsights() { return [] }
  static async getBalanceSheetInsights() { return [] }
  static async getTrialBalanceInsights() { return [] }
  static async getChartOfAccountsInsights() { return [] }

  static async resetData() {
    console.warn('Data reset not supported in database mode')
    return { success: false, message: 'Data reset not supported in database mode' }
  }

  // Empty data fallbacks for UI compatibility
  private static getEmptyDashboardData() {
    return {
      metrics: {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        grossProfit: 0,
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        transactionCount: 0
      },
      sparklineData: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        amount: 0
      })),
      aiInsights: []
    }
  }

  private static getEmptyPnlData() {
    const now = new Date()
    return {
      period: {
        start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
        end: now.toISOString().slice(0, 10)
      },
      revenue: [],
      expenses: [],
      cogs: [],
      operatingExpenses: [],
      totals: {
        revenue: 0,
        expenses: 0,
        cogs: 0,
        grossProfit: 0,
        operatingExpenses: 0,
        netIncome: 0,
        netProfit: 0
      }
    }
  }

  private static getEmptyBalanceSheetData() {
    return {
      asOf: new Date().toISOString().slice(0, 10),
      currentAssets: [],
      nonCurrentAssets: [],
      currentLiabilities: [],
      longTermLiabilities: [],
      equity: [],
      assets: [],
      liabilities: [],
      totals: {
        currentAssets: 0,
        nonCurrentAssets: 0,
        totalAssets: 0,
        currentLiabilities: 0,
        longTermLiabilities: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        liabilitiesAndEquity: 0,
        workingCapital: 0,
        currentRatio: 0,
        debtToEquityRatio: 0,
        assets: 0,
        liabilities: 0,
        equity: 0
      }
    }
  }

  private static getEmptyTrialBalanceData() {
    return {
      asOf: new Date().toISOString().slice(0, 10),
      rows: [],
      totals: {
        debit: 0,
        credit: 0,
        difference: 0,
        isBalanced: true
      },
      summary: {
        totalAccounts: 0,
        activeAccounts: 0,
        zeroBalanceAccounts: 0,
        totalTransactions: 0
      }
    }
  }

  private static getEmptyChartOfAccountsData() {
    return {
      accounts: [],
      hierarchy: {},
      summary: {
        totalAccounts: 0,
        activeAccounts: 0,
        inactiveAccounts: 0,
        accountsByType: {
          ASSET: 0,
          LIABILITY: 0,
          EQUITY: 0,
          REVENUE: 0,
          EXPENSE: 0
        },
        totalTransactions: 0,
        accountsWithActivity: 0
      }
    }
  }

  // Customer/Client Management Methods - Phase 3: Client Integration
  static async getCustomers() {
    console.log('🔍 FinancialDataService: Fetching customers from API');
    
    const response = await fetch('/api/customers', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ FinancialDataService: Loaded ${data.customers?.length || 0} customers`);
    
    return data.customers || [];
  }

  static async addCustomer(customerData: {
    name: string
    company?: string
    email: string
    phone?: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    notes?: string
  }) {
    console.log('💾 FinancialDataService: Adding new customer', customerData.name);
    
    const response = await fetch('/api/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to create customer: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ FinancialDataService: Customer created successfully', result.customer?.name);
    
    return result;
  }

  static async updateCustomer(customerId: string, customerData: {
    name: string
    company?: string
    email: string
    phone?: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    notes?: string
  }) {
    console.log('✏️ FinancialDataService: Updating customer', customerId, customerData.name);
    
    const response = await fetch(`/api/customers/${customerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to update customer: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ FinancialDataService: Customer updated successfully', result.customer?.name);
    
    return result;
  }
}

export default FinancialDataService 
