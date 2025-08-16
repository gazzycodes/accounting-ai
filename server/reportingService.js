import { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

/**
 * Pure Database-Driven Reporting Service
 * 
 * Phase 1: Single Source of Truth
 * All financial calculations computed from TransactionEntry records.
 * No hardcoded values, no mock data - only what's in the database.
 */
export class ReportingService {
  
  /**
   * Calculate Trial Balance from Database
   * For each account, sum all debit and credit entries
   * 
   * @param {Date?} asOfDate - Optional date filter (Phase 2)
   * @returns {Object} Trial balance with account rows and totals
   */
  static async getTrialBalance(asOfDate = null) {
    try {
      // Get all accounts with their transaction entries
      const accounts = await prisma.account.findMany({
        include: {
          debitEntries: {
            include: {
              transaction: {
                select: { date: true }
              }
            },
            where: asOfDate ? {
              transaction: {
                date: { lte: asOfDate }
              }
            } : undefined
          },
          creditEntries: {
            include: {
              transaction: {
                select: { date: true }
              }
            },
            where: asOfDate ? {
              transaction: {
                date: { lte: asOfDate }
              }
            } : undefined
          }
        },
        orderBy: { code: 'asc' }
      })

      const rows = []
      let totalDebits = new Decimal(0)
      let totalCredits = new Decimal(0)

      for (const account of accounts) {
        // Sum all debit entries for this account
        const debitSum = account.debitEntries.reduce((sum, entry) => {
          return sum.add(new Decimal(entry.amount))
        }, new Decimal(0))

        // Sum all credit entries for this account
        const creditSum = account.creditEntries.reduce((sum, entry) => {
          return sum.add(new Decimal(entry.amount))
        }, new Decimal(0))

        // Determine debit/credit column based on normal balance and net amount
        let debitColumn = new Decimal(0)
        let creditColumn = new Decimal(0)
        
        if (account.normalBalance === 'DEBIT') {
          // Assets, Expenses: show net positive as debit, net negative as credit
          const netAmount = debitSum.sub(creditSum)
          if (netAmount.gte(0)) {
            debitColumn = netAmount
          } else {
            creditColumn = netAmount.abs()
          }
        } else {
          // Liabilities, Equity, Revenue: show net positive as credit, net negative as debit
          const netAmount = creditSum.sub(debitSum)
          if (netAmount.gte(0)) {
            creditColumn = netAmount
          } else {
            debitColumn = netAmount.abs()
          }
        }

        // Only include accounts with activity or non-zero balances
        if (debitColumn.gt(0) || creditColumn.gt(0) || account.debitEntries.length > 0 || account.creditEntries.length > 0) {
          rows.push({
            accountCode: account.code,
            account: account.name,
            accountType: account.type,
            normalBalance: account.normalBalance,
            debit: parseFloat(debitColumn.toFixed(2)),
            credit: parseFloat(creditColumn.toFixed(2)),
            transactionCount: account.debitEntries.length + account.creditEntries.length,
            lastActivity: this.getLastActivityDate(account)
          })

          totalDebits = totalDebits.add(debitColumn)
          totalCredits = totalCredits.add(creditColumn)
        }
      }

      // Calculate difference and balance check
      const difference = totalDebits.sub(totalCredits)
      const isBalanced = difference.abs().lt(0.01) // Allow for minor rounding differences

      return {
        asOf: asOfDate ? asOfDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        rows,
        totals: {
          debit: parseFloat(totalDebits.toFixed(2)),
          credit: parseFloat(totalCredits.toFixed(2)),
          difference: parseFloat(difference.toFixed(2)),
          isBalanced
        },
        summary: {
          totalAccounts: accounts.length,
          activeAccounts: rows.length,
          zeroBalanceAccounts: accounts.length - rows.length,
          totalTransactions: rows.reduce((sum, row) => sum + row.transactionCount, 0)
        }
      }
    } catch (error) {
      console.error('Trial Balance calculation error:', error)
      throw new Error('Failed to calculate trial balance')
    }
  }

  /**
   * Calculate Profit & Loss from Trial Balance
   * Revenue - Expenses = Net Profit
   */
  static async getProfitAndLoss(asOfDate = null) {
    try {
      const trialBalance = await this.getTrialBalance(asOfDate)
      
      // Extract revenue and expense rows from trial balance
      const revenueRows = trialBalance.rows.filter(row => row.accountType === 'REVENUE')
      const expenseRows = trialBalance.rows.filter(row => row.accountType === 'EXPENSE')
      const cogsRows = expenseRows.filter(row => row.accountCode.startsWith('5')) // 5xxx = COGS
      const operatingExpenseRows = expenseRows.filter(row => row.accountCode.startsWith('6')) // 6xxx = Operating

      // Calculate totals (Revenue is credits, Expenses are debits)
      const totalRevenue = revenueRows.reduce((sum, row) => sum + row.credit - row.debit, 0)
      const totalCOGS = cogsRows.reduce((sum, row) => sum + row.debit - row.credit, 0)
      const totalOperatingExpenses = operatingExpenseRows.reduce((sum, row) => sum + row.debit - row.credit, 0)
      const totalExpenses = totalCOGS + totalOperatingExpenses

      const grossProfit = totalRevenue - totalCOGS
      const operatingIncome = grossProfit - totalOperatingExpenses  // 🔧 FIX: Add missing Operating Income
      const netProfit = totalRevenue - totalExpenses
      
      // DEBUG LOGGING FOR P&L CALCULATION  
      console.log('🔍 P&L CALCULATION DEBUG:')
      console.log('  Revenue Rows:', revenueRows.length)
      console.log('  Expense Rows:', expenseRows.length)
      console.log('  Total Revenue:', totalRevenue)
      console.log('  Total COGS:', totalCOGS)
      console.log('  Total Operating Expenses:', totalOperatingExpenses)
      console.log('  Gross Profit:', grossProfit)
      console.log('  Operating Income:', operatingIncome)  // 🔧 FIX: Add to debug log
      console.log('  Total Expenses:', totalExpenses)
      console.log('  Net Profit:', netProfit)

      const period = {
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
        end: asOfDate ? asOfDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
      }

      return {
        period,
        revenue: revenueRows.map(row => ({ 
          name: row.account, 
          amount: row.credit - row.debit 
        })),
        expenses: expenseRows.map(row => ({ 
          name: row.account, 
          amount: row.debit - row.credit 
        })),
        cogs: cogsRows.map(row => ({ 
          name: row.account, 
          amount: row.debit - row.credit 
        })),
        operatingExpenses: operatingExpenseRows.map(row => ({ 
          name: row.account, 
          amount: row.debit - row.credit 
        })),
        totals: {
          revenue: totalRevenue,
          cogs: totalCOGS,
          grossProfit: grossProfit,
          operatingExpenses: totalOperatingExpenses,
          operatingIncome: operatingIncome,  // 🔧 FIX: Add Operating Income to return object
          netIncome: netProfit,
          expenses: totalExpenses,
          netProfit: netProfit
        }
      }
    } catch (error) {
      console.error('P&L calculation error:', error)
      throw new Error('Failed to calculate Profit & Loss')
    }
  }

  /**
   * Calculate Balance Sheet from Trial Balance
   * Assets = Liabilities + Equity (accounting equation must hold)
   */
  static async getBalanceSheet(asOfDate = null) {
    try {
      const trialBalance = await this.getTrialBalance(asOfDate)
      const pnl = await this.getProfitAndLoss(asOfDate)
      
      // Extract account categories from trial balance
      const assetRows = trialBalance.rows.filter(row => row.accountType === 'ASSET')
      const liabilityRows = trialBalance.rows.filter(row => row.accountType === 'LIABILITY')
      const equityRows = trialBalance.rows.filter(row => row.accountType === 'EQUITY')

      // Classify current vs non-current assets
      const currentAssets = assetRows.filter(row => 
        row.accountCode.startsWith('10') || row.accountCode.startsWith('11') ||
        row.accountCode.startsWith('12') || row.accountCode.startsWith('13') ||
        row.accountCode.startsWith('14') || row.accountCode.startsWith('15')
      )
      const nonCurrentAssets = assetRows.filter(row => 
        row.accountCode.startsWith('16') || row.accountCode.startsWith('17') ||
        row.accountCode.startsWith('18') || row.accountCode.startsWith('19')
      )

      // Classify current vs long-term liabilities
      const currentLiabilities = liabilityRows.filter(row =>
        row.accountCode.startsWith('20') || row.accountCode.startsWith('21') ||
        row.accountCode.startsWith('22') || row.accountCode.startsWith('23')
      )
      const longTermLiabilities = liabilityRows.filter(row =>
        row.accountCode.startsWith('24') || row.accountCode.startsWith('25') ||
        row.accountCode.startsWith('26')
      )

      // Calculate totals (Assets are debits, Liabilities/Equity are credits)
      const totalCurrentAssets = currentAssets.reduce((sum, row) => sum + (row.debit - row.credit), 0)
      const totalNonCurrentAssets = nonCurrentAssets.reduce((sum, row) => sum + (row.debit - row.credit), 0)
      const totalAssets = totalCurrentAssets + totalNonCurrentAssets

      const totalCurrentLiabilities = currentLiabilities.reduce((sum, row) => sum + (row.credit - row.debit), 0)
      const totalLongTermLiabilities = longTermLiabilities.reduce((sum, row) => sum + (row.credit - row.debit), 0)
      const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities

      // Calculate equity including retained earnings (net profit)
      const ownerEquity = equityRows
        .filter(row => row.accountCode !== '3200') // Exclude retained earnings
        .reduce((sum, row) => sum + (row.credit - row.debit), 0)
      
      const retainedEarnings = pnl.totals.netProfit // Current period earnings
      const totalEquity = ownerEquity + retainedEarnings
      
      // DEBUG LOGGING FOR EQUITY CALCULATION
      console.log('🔍 EQUITY CALCULATION DEBUG:')
      console.log('  Owner Equity (3000):', ownerEquity)
      console.log('  P&L Net Profit:', pnl.totals.netProfit)
      console.log('  P&L Total Revenue:', pnl.totals.revenue)
      console.log('  P&L Total Expenses:', pnl.totals.expenses)
      console.log('  Calculated Retained Earnings:', retainedEarnings)
      console.log('  Total Equity:', totalEquity)
      console.log('  Equity Rows Found:', equityRows.length)

      // Check accounting equation
      const equationDifference = Math.abs(totalAssets - (totalLiabilities + totalEquity))
      const equationOK = equationDifference < 0.01

      // Calculate financial ratios
      const workingCapital = totalCurrentAssets - totalCurrentLiabilities
      const currentRatio = totalCurrentLiabilities > 0 ? totalCurrentAssets / totalCurrentLiabilities : 0
      const debtToEquityRatio = totalEquity > 0 ? totalLiabilities / totalEquity : 0

      return {
        asOf: asOfDate ? asOfDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        currentAssets: currentAssets.map(row => ({ 
          name: row.account, 
          amount: row.debit - row.credit 
        })),
        nonCurrentAssets: nonCurrentAssets.map(row => ({ 
          name: row.account, 
          amount: row.debit - row.credit 
        })),
        currentLiabilities: currentLiabilities.map(row => ({ 
          name: row.account, 
          amount: row.credit - row.debit 
        })),
        longTermLiabilities: longTermLiabilities.map(row => ({ 
          name: row.account, 
          amount: row.credit - row.debit 
        })),
        equity: [
          ...equityRows.filter(row => row.accountCode !== '3200').map(row => ({ 
            name: row.account, 
            amount: row.credit - row.debit 
          })),
          { name: 'Retained Earnings', amount: retainedEarnings }
        ],
        assets: assetRows.map(row => ({ 
          name: row.account, 
          amount: row.debit - row.credit 
        })),
        liabilities: liabilityRows.map(row => ({ 
          name: row.account, 
          amount: row.credit - row.debit 
        })),
        totals: {
          currentAssets: totalCurrentAssets,
          nonCurrentAssets: totalNonCurrentAssets,
          totalAssets: totalAssets,
          currentLiabilities: totalCurrentLiabilities,
          longTermLiabilities: totalLongTermLiabilities,
          totalLiabilities: totalLiabilities,
          totalEquity: totalEquity,
          liabilitiesAndEquity: totalLiabilities + totalEquity,
          workingCapital: workingCapital,
          currentRatio: Number(currentRatio.toFixed(2)),
          debtToEquityRatio: Number(debtToEquityRatio.toFixed(2)),
          equationOK: equationOK,
          equationDifference: Number(equationDifference.toFixed(2)),
          assets: totalAssets,
          liabilities: totalLiabilities,
          equity: totalEquity
        }
      }
    } catch (error) {
      console.error('Balance Sheet calculation error:', error)
      throw new Error('Failed to calculate Balance Sheet')
    }
  }

  /**
   * Get Chart of Accounts with current balances
   */
  static async getChartOfAccounts() {
    try {
      const trialBalance = await this.getTrialBalance()
      const pnl = await this.getProfitAndLoss()  // 🔧 FIX: Get P&L for retained earnings
      
      // Get all accounts (even those with zero balances)
      const allAccounts = await prisma.account.findMany({
        orderBy: { code: 'asc' }
      })

      const accounts = allAccounts.map(account => {
        // Find this account in trial balance for current balance
        const tbRow = trialBalance.rows.find(row => row.accountCode === account.code)
        
        // Calculate balance based on normal balance (CRITICAL FIX)
        let balance = 0
        if (tbRow) {
          if (account.normalBalance === 'DEBIT') {
            // Assets, Expenses: positive when debit > credit
            balance = tbRow.debit - tbRow.credit
          } else {
            // Liabilities, Equity, Revenue: positive when credit > debit  
            balance = tbRow.credit - tbRow.debit
          }
        }
        
        // 🔧 FIX: Special handling for Retained Earnings (3200)
        if (account.code === '3200') {
          balance = pnl.totals.netProfit  // Use computed net profit/loss
          console.log(`🔧 RETAINED EARNINGS FIX: Account 3200 balance set to ${balance} (from P&L net profit)`)
        }
        
        const transactionCount = tbRow ? tbRow.transactionCount : 0
        const lastActivity = tbRow ? tbRow.lastActivity : null

        // Determine subcategory for hierarchy
        const subcategory = this.getAccountSubcategory(account.code)
        
        return {
          code: account.code,
          name: account.name,
          type: account.type,
          category: account.type,
          subcategory: subcategory,
          balance: balance,
          normalBalance: account.normalBalance,
          description: this.getAccountDescription(account.type),
          isActive: balance !== 0 || transactionCount > 0,
          transactionCount: transactionCount,
          lastActivity: lastActivity,
          createdDate: account.createdAt.toISOString().slice(0, 10),
          status: (balance !== 0 || transactionCount > 0) ? 'Active' : 'Inactive'
        }
      })

      // Group by category and subcategory
      const hierarchy = accounts.reduce((acc, account) => {
        if (!acc[account.category]) acc[account.category] = {}
        if (!acc[account.category][account.subcategory]) acc[account.category][account.subcategory] = []
        acc[account.category][account.subcategory].push(account)
        return acc
      }, {})

      // Calculate summary
      const summary = {
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter(a => a.isActive).length,
        inactiveAccounts: accounts.filter(a => !a.isActive).length,
        accountsByType: {
          ASSET: accounts.filter(a => a.type === 'ASSET').length,
          LIABILITY: accounts.filter(a => a.type === 'LIABILITY').length,
          EQUITY: accounts.filter(a => a.type === 'EQUITY').length,
          REVENUE: accounts.filter(a => a.type === 'REVENUE').length,
          EXPENSE: accounts.filter(a => a.type === 'EXPENSE').length
        },
        totalTransactions: trialBalance.summary.totalTransactions,
        accountsWithActivity: accounts.filter(a => a.transactionCount > 0).length
      }

      return {
        accounts,
        hierarchy,
        summary
      }
    } catch (error) {
      console.error('Chart of Accounts error:', error)
      throw new Error('Failed to get Chart of Accounts')
    }
  }

  /**
   * Get Dashboard KPIs
   */
  static async getDashboard() {
    try {
      const pnl = await this.getProfitAndLoss()
      const balanceSheet = await this.getBalanceSheet()
      const trialBalance = await this.getTrialBalance()

      // Generate simple sparkline data (can be enhanced later)
      const sparklineData = []
      for (let i = 29; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        // For now, just return zeros - real sparkline needs historical data
        sparklineData.push({
          date: date.toISOString().slice(0, 10),
          amount: 0
        })
      }

      return {
        metrics: {
          totalRevenue: pnl.totals.revenue,
          totalExpenses: pnl.totals.expenses,
          netProfit: pnl.totals.netProfit,
          grossProfit: pnl.totals.grossProfit,
          totalAssets: balanceSheet.totals.totalAssets,
          totalLiabilities: balanceSheet.totals.totalLiabilities,
          totalEquity: balanceSheet.totals.totalEquity,
          transactionCount: trialBalance.summary.totalTransactions
        },
        sparklineData,
        healthChecks: {
          trialBalanceOK: trialBalance.totals.isBalanced,
          balanceSheetOK: balanceSheet.totals.equationOK,
          trialBalanceDifference: trialBalance.totals.difference,
          balanceSheetDifference: balanceSheet.totals.equationDifference
        }
      }
    } catch (error) {
      console.error('Dashboard calculation error:', error)
      throw new Error('Failed to calculate Dashboard')
    }
  }

  /**
   * Health Check - Verify accounting integrity
   */
  static async healthCheck() {
    try {
      const trialBalance = await this.getTrialBalance()
      const balanceSheet = await this.getBalanceSheet()

      const issues = []
      
      if (!trialBalance.totals.isBalanced) {
        issues.push({
          type: 'TRIAL_BALANCE_IMBALANCE',
          message: `Trial balance doesn't balance: ${trialBalance.totals.difference}`,
          severity: 'HIGH'
        })
      }

      if (!balanceSheet.totals.equationOK) {
        issues.push({
          type: 'BALANCE_SHEET_EQUATION',
          message: `Balance sheet equation fails: Assets(${balanceSheet.totals.totalAssets}) ≠ Liabilities(${balanceSheet.totals.totalLiabilities}) + Equity(${balanceSheet.totals.totalEquity})`,
          severity: 'HIGH'
        })
      }

      return {
        status: issues.length === 0 ? 'HEALTHY' : 'ISSUES_FOUND',
        issues,
        summary: {
          trialBalanceOK: trialBalance.totals.isBalanced,
          balanceSheetOK: balanceSheet.totals.equationOK,
          totalAccounts: trialBalance.summary.totalAccounts,
          totalTransactions: trialBalance.summary.totalTransactions
        }
      }
    } catch (error) {
      return {
        status: 'ERROR',
        issues: [{
          type: 'SYSTEM_ERROR',
          message: error.message,
          severity: 'CRITICAL'
        }]
      }
    }
  }

  // Helper methods
  static getLastActivityDate(account) {
    const allEntries = [...account.debitEntries, ...account.creditEntries]
    if (allEntries.length === 0) return null
    
    const latestEntry = allEntries.reduce((latest, entry) => {
      return new Date(entry.transaction.date) > new Date(latest.transaction.date) ? entry : latest
    })
    
    return latestEntry.transaction.date.toISOString().slice(0, 10)
  }

  static getAccountSubcategory(code) {
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
  }

  static getAccountDescription(type) {
    switch (type) {
      case 'ASSET': return 'Resources owned by the business'
      case 'LIABILITY': return 'Debts and obligations owed'
      case 'EQUITY': return 'Owner\'s stake in the business'
      case 'REVENUE': return 'Income earned from operations'
      case 'EXPENSE': return 'Costs incurred in operations'
      default: return 'General ledger account'
    }
  }
}

export default ReportingService
