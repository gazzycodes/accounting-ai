import React from 'react'
import { useMockDataStore } from '../store/mockDataStore'
import { FinancialDataService } from '../services/financialDataService'

const TestMockData = () => {
  const { totals, transactions, accounts } = useMockDataStore()

  const addTestExpense = () => {
    FinancialDataService.addExpenseTransaction({
      vendor: 'Test Vendor',
      category: 'SOFTWARE',
      date: new Date().toISOString().split('T')[0],
      amount: 299.99,
      description: 'Test Software Subscription'
    })
  }

  const addTestRevenue = () => {
    FinancialDataService.addRevenueTransaction({
      customer: 'Test Customer',
      category: 'CONSULTING',
      date: new Date().toISOString().split('T')[0],
      amount: 5000,
      description: 'Test Consulting Revenue',
      paymentMethod: 'CASH'
    })
  }

  const resetData = () => {
    FinancialDataService.resetData()
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto my-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Mock Data Store Test</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded">
          <h3 className="font-semibold text-blue-800">Financial Totals</h3>
          <p>Revenue: ${totals.totalRevenue.toLocaleString()}</p>
          <p>Expenses: ${totals.totalExpenses.toLocaleString()}</p>
          <p>Net Profit: ${totals.netProfit.toLocaleString()}</p>
          <p>Transactions: {totals.transactionCount}</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded">
          <h3 className="font-semibold text-green-800">Store Stats</h3>
          <p>Total Accounts: {accounts.length}</p>
          <p>Total Transactions: {transactions.length}</p>
          <p>Assets: ${totals.totalAssets.toLocaleString()}</p>
          <p>Liabilities: ${totals.totalLiabilities.toLocaleString()}</p>
        </div>
      </div>

      <div className="space-x-4">
        <button
          onClick={addTestExpense}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Add Test Expense ($299.99)
        </button>
        
        <button
          onClick={addTestRevenue}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Add Test Revenue ($5,000)
        </button>
        
        <button
          onClick={resetData}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Reset Data
        </button>
      </div>

      {transactions.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-gray-800 mb-2">Recent Transactions</h3>
          <div className="bg-gray-50 p-4 rounded max-h-40 overflow-y-auto">
            {transactions.slice(-5).reverse().map((txn) => (
              <div key={txn.id} className="text-sm py-1 border-b">
                <span className="font-medium">{txn.description}</span> - 
                <span className="text-green-600"> ${txn.amount}</span> - 
                <span className="text-gray-500">{txn.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TestMockData 