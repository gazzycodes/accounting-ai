import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { FinancialDataService } from '../services/financialDataService'
import { useMockDataStore, type AccountType } from '../store/mockDataStore'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Cell } from 'recharts'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  ColumnResizeMode,
  getFilteredRowModel,
} from '@tanstack/react-table'
import { AnimatePresence } from 'framer-motion'

interface BalanceSheetItem { name: string; amount: number }
interface BalanceSheetData {
  asOf: string
  assets: BalanceSheetItem[]
  liabilities: BalanceSheetItem[]
  equity: BalanceSheetItem[]
  currentAssets?: BalanceSheetItem[]
  nonCurrentAssets?: BalanceSheetItem[]
  currentLiabilities?: BalanceSheetItem[]
  longTermLiabilities?: BalanceSheetItem[]
  totals: { 
    assets: number
    liabilities: number
    equity: number
    liabilitiesAndEquity: number
    currentAssets?: number
    nonCurrentAssets?: number
    totalAssets?: number
    currentLiabilities?: number
    longTermLiabilities?: number
    totalLiabilities?: number
    totalEquity?: number
    workingCapital?: number
    currentRatio?: number
    debtToEquityRatio?: number
  }
}

interface PnlItem { name: string; amount: number }
interface PnlData {
  period: { start: string; end: string }
  revenue: PnlItem[]
  expenses: PnlItem[]
  cogs?: PnlItem[]
  operatingExpenses?: PnlItem[]
  nonOperatingExpenses?: PnlItem[]
  totals: { 
    revenue: number
    expenses: number
    grossProfit: number
    netProfit: number
    cogs?: number
    operatingExpenses?: number
    operatingIncome?: number
    nonOperatingExpenses?: number
    netIncome?: number
  }
}

interface TrialRow { 
  accountCode: string
  account: string
  accountType: string
  normalBalance: string
  debit: number
  credit: number
  balance: number
  transactionCount: number
  lastActivity: string | null
  isActive: boolean
}

interface TrialData { 
  asOf: string
  rows: TrialRow[]
  totals: { 
    debit: number
    credit: number
    difference: number
    isBalanced: boolean
  }
  summary: {
    totalAccounts: number
    activeAccounts: number
    zeroBalanceAccounts: number
    totalTransactions: number
  }
}

type NameAmountRow = { name: string; amount: number }

type TabKey = 'pnl' | 'balance' | 'trial' | 'coa'

// Accounting Period Dropdown Components
function PeriodSelector({ value, onChange, label, periods }: { 
  value: string; 
  onChange: (period: string) => void; 
  label: string;
  periods: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-glass h-10 px-3 text-sm font-medium text-white bg-white/5 border border-white/10 rounded-lg focus:border-electric-500 focus:ring-1 focus:ring-electric-500 transition-all duration-200 cursor-pointer"
        style={{ colorScheme: 'dark' }}
      >
        {periods.map((period) => (
          <option key={period.value} value={period.value} className="bg-gray-900 text-white">
            {period.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function AccountingPeriods() {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const currentQuarter = Math.floor(currentMonth / 3) + 1

  return {
    monthly: [
      { label: `January ${currentYear}`, value: `${currentYear}-01` },
      { label: `February ${currentYear}`, value: `${currentYear}-02` },
      { label: `March ${currentYear}`, value: `${currentYear}-03` },
      { label: `April ${currentYear}`, value: `${currentYear}-04` },
      { label: `May ${currentYear}`, value: `${currentYear}-05` },
      { label: `June ${currentYear}`, value: `${currentYear}-06` },
      { label: `July ${currentYear}`, value: `${currentYear}-07` },
      { label: `August ${currentYear}`, value: `${currentYear}-08` },
      { label: `September ${currentYear}`, value: `${currentYear}-09` },
      { label: `October ${currentYear}`, value: `${currentYear}-10` },
      { label: `November ${currentYear}`, value: `${currentYear}-11` },
      { label: `December ${currentYear}`, value: `${currentYear}-12` },
      { label: `January ${currentYear - 1}`, value: `${currentYear - 1}-01` },
      { label: `February ${currentYear - 1}`, value: `${currentYear - 1}-02` },
      { label: `March ${currentYear - 1}`, value: `${currentYear - 1}-03` },
      { label: `April ${currentYear - 1}`, value: `${currentYear - 1}-04` },
      { label: `May ${currentYear - 1}`, value: `${currentYear - 1}-05` },
      { label: `June ${currentYear - 1}`, value: `${currentYear - 1}-06` },
      { label: `July ${currentYear - 1}`, value: `${currentYear - 1}-07` },
      { label: `August ${currentYear - 1}`, value: `${currentYear - 1}-08` },
      { label: `September ${currentYear - 1}`, value: `${currentYear - 1}-09` },
      { label: `October ${currentYear - 1}`, value: `${currentYear - 1}-10` },
      { label: `November ${currentYear - 1}`, value: `${currentYear - 1}-11` },
      { label: `December ${currentYear - 1}`, value: `${currentYear - 1}-12` },
    ],
    quarterly: [
      { label: `Q1 ${currentYear} (Jan-Mar)`, value: `${currentYear}-Q1` },
      { label: `Q2 ${currentYear} (Apr-Jun)`, value: `${currentYear}-Q2` },
      { label: `Q3 ${currentYear} (Jul-Sep)`, value: `${currentYear}-Q3` },
      { label: `Q4 ${currentYear} (Oct-Dec)`, value: `${currentYear}-Q4` },
      { label: `Q1 ${currentYear - 1} (Jan-Mar)`, value: `${currentYear - 1}-Q1` },
      { label: `Q2 ${currentYear - 1} (Apr-Jun)`, value: `${currentYear - 1}-Q2` },
      { label: `Q3 ${currentYear - 1} (Jul-Sep)`, value: `${currentYear - 1}-Q3` },
      { label: `Q4 ${currentYear - 1} (Oct-Dec)`, value: `${currentYear - 1}-Q4` },
    ],
    yearly: [
      { label: `${currentYear} (Full Year)`, value: `${currentYear}` },
      { label: `${currentYear - 1} (Full Year)`, value: `${currentYear - 1}` },
      { label: `${currentYear - 2} (Full Year)`, value: `${currentYear - 2}` },
    ],
    ytd: [
      { label: `Year to Date ${currentYear}`, value: `${currentYear}-YTD` },
      { label: `Year to Date ${currentYear - 1}`, value: `${currentYear - 1}-YTD` },
    ]
  }
}

function AccountingPeriodPicker({ onPeriodChange }: { onPeriodChange: (period: string, type: string) => void }) {
  const [selectedType, setSelectedType] = useState('monthly')
  const [selectedPeriod, setSelectedPeriod] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
  
  const periods = AccountingPeriods()

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    onPeriodChange(period, selectedType)
  }

  const handleTypeChange = (type: string) => {
    setSelectedType(type)
    // Auto-select current period for the new type
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const currentQuarter = Math.floor((currentMonth - 1) / 3) + 1
    
    let defaultPeriod = ''
    switch (type) {
      case 'monthly':
        defaultPeriod = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
        break
      case 'quarterly':
        defaultPeriod = `${currentYear}-Q${currentQuarter}`
        break
      case 'yearly':
        defaultPeriod = `${currentYear}`
        break
      case 'ytd':
        defaultPeriod = `${currentYear}-YTD`
        break
    }
    
    setSelectedPeriod(defaultPeriod)
    onPeriodChange(defaultPeriod, type)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <PeriodSelector
          value={selectedType}
          onChange={handleTypeChange}
          label="Period Type"
          periods={[
            { label: 'Monthly', value: 'monthly' },
            { label: 'Quarterly', value: 'quarterly' },
            { label: 'Year to Date', value: 'ytd' },
            { label: 'Full Year', value: 'yearly' },
          ]}
        />
        <PeriodSelector
          value={selectedPeriod}
          onChange={handlePeriodChange}
          label="Select Period"
          periods={periods[selectedType as keyof typeof periods]}
        />
      </div>
    </div>
  )
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.03 } }),
}

function useNameAmountTable(data: NameAmountRow[], defaultSortDesc = true) {
  const [sorting, setSorting] = useState<SortingState>(defaultSortDesc ? [{ id: 'amount', desc: true }] : [])
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange')

  const columns: ColumnDef<NameAmountRow>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: () => 'Name',
      cell: ({ getValue }) => <span className="text-gray-300">{String(getValue())}</span>,
      enableSorting: true,
      enableResizing: true,
      size: 300,
    },
    {
      id: 'amount',
      accessorKey: 'amount',
      header: () => 'Amount',
      cell: ({ getValue }) => <span className="text-white font-medium">{formatCurrency(Number(getValue()))}</span>,
      enableSorting: true,
      enableResizing: true,
    },
  ]

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    columnResizeMode,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return { table, sorting, setSorting }
}

function TrialType(account: string): 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense' | 'Other' {
  const a = account.toLowerCase()
  if (a.includes('receivable') || a.includes('cash') || a.includes('prepaid') || a.includes('asset')) return 'Asset'
  if (a.includes('payable') || a.includes('deferred') || a.includes('loan') || a.includes('liab')) return 'Liability'
  if (a.includes('equity') || a.includes('retained')) return 'Equity'
  if (a.includes('revenue') || a.includes('income')) return 'Revenue'
  if (a.includes('expense') || a.includes('cogs') || a.includes('cost of goods')) return 'Expense'
  return 'Other'
}

function Toolbar({ children, label }: { 
  children?: React.ReactNode
  label?: string
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      {label && (
        <div className="text-sm text-gray-400 font-medium">
          {label}
        </div>
      )}
      <div className="flex items-center gap-3">{children}</div>
    </div>
  )
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <motion.input
      className="input-glass h-11 !py-3 !px-4 text-sm font-medium transition-all duration-300 focus:ring-2 focus:ring-electric-500 focus:shadow-xl focus:shadow-electric-500/25 w-32 focus:w-56 lg:w-40 lg:focus:w-64"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      whileFocus={{ scale: 1.02 }}
      whileHover={{ scale: 1.01 }}
    />
  )
}

function TableGlass<T>({
  table,
  footer,
  rowKey,
}: {
  table: ReturnType<typeof useReactTable<T>>
  footer?: React.ReactNode
  rowKey: (row: T, idx: number) => string
}) {
  return (
    <motion.div 
      className="glass rounded-2xl overflow-hidden shadow-2xl shadow-electric-500/10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, type: "spring" }}
    >
      <div>
        <table className="w-full">
          <thead className="bg-gradient-to-r from-gray-900/95 to-gray-800/95 backdrop-blur-xl sticky top-0 z-50 border-b border-white/20">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const isRight = ['amount', 'debit', 'credit'].includes(header.column.id)
                  const SortIcons = () => {
                    const base = 'text-xs ml-2'
                    if (sorted === 'asc') return (<span className="inline-flex ml-2"><span className="text-electric-400">▲</span><span className="text-gray-500/60">▼</span></span>)
                    if (sorted === 'desc') return (<span className="inline-flex ml-2"><span className="text-gray-500/60">▲</span><span className="text-electric-400">▼</span></span>)
                    return (<span className={`${base} text-gray-500/60`}>▲▼</span>)
                  }
                  return (
                    <th
                      key={header.id}
                      className={`px-6 py-4 ${isRight ? 'text-right' : 'text-left'} text-white font-semibold select-none relative text-sm uppercase tracking-wide`}
                      style={{ width: header.getSize() }}
                    >
                      <motion.div
                        className={`inline-flex items-center gap-1 ${canSort ? 'cursor-pointer hover:text-electric-300' : ''}`}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        title={canSort ? 'Sort' : undefined}
                        whileHover={canSort ? { scale: 1.05 } : {}}
                        whileTap={canSort ? { scale: 0.95 } : {}}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcons />
                      </motion.div>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <motion.tr
                key={rowKey(row.original as T, i)}
                className="hover:bg-gradient-to-r hover:from-electric-500/10 hover:to-transparent transition-all duration-300 hover:shadow-lg hover:shadow-electric-500/20"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4, type: "spring" }}
                whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
              >
                {row.getVisibleCells().map(cell => {
                  const isRight = ['amount', 'debit', 'credit'].includes(cell.column.id)
                  return (
                    <td key={cell.id} className={`px-6 py-4 ${isRight ? 'text-right' : ''} min-h-[60px]`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && (
        <div className="bg-gradient-to-r from-electric-600/20 to-electric-700/20 backdrop-blur-md border-t border-white/10 px-6 py-4">
          <div className="flex items-center justify-between text-sm font-semibold">
            {footer}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// Enhanced Trial Balance Table Component (UNUSED - keeping for reference)
// function SimpleTrialTable({ data, trialQuery }: { data: TrialData | undefined; trialQuery: any }) {
function unusedSimpleTrialTable({ data, trialQuery }: { data: TrialData | undefined; trialQuery: any }) {
  const [highlightedRow, setHighlightedRow] = useState<string | null>(null)
  const [searchFilter, setSearchFilter] = useState('')

  if (!data) return <div className="text-gray-400">Loading...</div>

  const filteredRows = data.rows.filter(row => 
    searchFilter ? row.account.toLowerCase().includes(searchFilter.toLowerCase()) : true
  )

  const handleRowClick = (account: string) => {
    setHighlightedRow(highlightedRow === account ? null : account)
  }

  return (
    <div className="space-y-3">
      {/* Enhanced Search Bar */}
      <motion.div 
        className="flex justify-end"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <SearchInput 
          value={searchFilter} 
          onChange={setSearchFilter} 
          placeholder="Search trial balance accounts..." 
        />
      </motion.div>

      {/* Enhanced Table Container */}
      <motion.div 
        className="glass rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-electric-500/10 relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring" }}
      >
        <div>
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-900/95 to-gray-800/95 backdrop-blur-xl sticky top-0 z-50 border-b border-white/20">
              <motion.tr
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <th className="px-6 py-4 text-left text-white font-semibold text-sm uppercase tracking-wide">Account</th>
                <th className="px-6 py-4 text-right text-white font-semibold text-sm uppercase tracking-wide">Debit</th>
                <th className="px-6 py-4 text-right text-white font-semibold text-sm uppercase tracking-wide">Credit</th>
              </motion.tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {filteredRows.map((row, i) => {
                  const isHighlighted = highlightedRow === row.account
                  return (
                    <motion.tr
                      key={row.accountCode}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ 
                        delay: i * 0.03,
                        duration: 0.4,
                        type: "spring",
                        stiffness: 100,
                        damping: 15
                      }}
                      onClick={() => handleRowClick(row.account)}
                      className={`
                        cursor-pointer select-none
                        transition-all duration-300 ease-out
                        hover:bg-gradient-to-r hover:from-electric-500/10 hover:to-transparent hover:shadow-lg hover:shadow-electric-500/20
                        ${isHighlighted 
                          ? 'bg-gradient-to-r from-electric-500/20 to-electric-600/10 shadow-lg shadow-electric-500/30 ring-1 ring-electric-500/50' 
                          : ''
                        }
                      `}
                      whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <td className="px-6 py-4 min-h-[60px]">
                        <span className={`transition-all duration-300 font-medium ${isHighlighted ? 'text-white' : 'text-gray-300'}`}>
                          {row.account}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right min-h-[60px]">
                        <span className={`transition-all duration-300 font-semibold ${isHighlighted ? 'text-electric-300' : 'text-white'}`}>
                          {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right min-h-[60px]">
                        <span className={`transition-all duration-300 font-semibold ${isHighlighted ? 'text-electric-300' : 'text-white'}`}>
                          {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                        </span>
                      </td>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {/* Enhanced Totals Footer */}
        <div className="bg-gradient-to-r from-electric-600/20 to-electric-700/20 backdrop-blur-md border-t border-white/10 px-6 py-4">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-electric-400 font-semibold">Total</span>
            <span className="text-green-400 font-bold text-lg">{formatCurrency(trialQuery.data?.totals.debit || 0)}</span>
          </div>
        </div>
      </motion.div>

      {/* Search Results Info */}
      <AnimatePresence>
        {searchFilter && (
          <motion.div
            className="text-center text-electric-400 text-sm font-medium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            Showing {filteredRows.length} of {data.rows.length} accounts
            {filteredRows.length === 0 && ' - try a different search term'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Custom Tooltip Component for Charts
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900/95 backdrop-blur-md rounded-xl p-4 border-2 border-electric-400/50 shadow-2xl shadow-electric-500/30 min-w-[200px]">
        <p className="text-white font-bold mb-3 text-base">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-3 mb-2">
            <span 
              className="inline-block w-4 h-4 rounded-full border-2 border-white/20" 
              style={{ backgroundColor: entry.color || entry.payload?.color }}
            />
            <span className="text-white font-semibold text-base">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

// Typewriter Text Component
function TypewriterText({ text, speed = 30 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(true)

  useEffect(() => {
    setDisplayedText('')
    setIsTyping(true)
    
    let index = 0
    const typeInterval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1))
        index++
      } else {
        setIsTyping(false)
        clearInterval(typeInterval)
      }
    }, speed)

    return () => clearInterval(typeInterval)
  }, [text, speed])

  return (
    <span>
      {displayedText}
      {isTyping && (
        <motion.span
          className="inline-block w-2 h-4 bg-electric-400 ml-1"
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
    </span>
  )
}

// AI Insights Panel Component
function AIInsightsPanel({ insight, delay = 0 }: { insight: string; delay?: number }) {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    setDisplayedText('')
    setIsTyping(false)
    
    const timer = setTimeout(() => {
      setIsTyping(true)
      let index = 0
      const typeInterval = setInterval(() => {
        if (index < insight.length) {
          setDisplayedText(insight.slice(0, index + 1))
          index++
        } else {
          setIsTyping(false)
          clearInterval(typeInterval)
        }
      }, 30) // 30ms per character for smooth typing

      return () => clearInterval(typeInterval)
    }, delay)

    return () => clearTimeout(timer)
  }, [insight, delay])

  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, type: "spring", delay: delay / 1000 }}
    >
      <div className="glass rounded-xl p-4 border border-electric-400/30 bg-gradient-to-r from-electric-500/10 to-purple-500/10 shadow-lg shadow-electric-500/20">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <motion.div
              className="w-8 h-8 bg-gradient-to-r from-electric-400 to-purple-400 rounded-lg flex items-center justify-center text-white text-lg"
              animate={isTyping ? { 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0] 
              } : {}}
              transition={{ 
                duration: 0.6, 
                repeat: isTyping ? Infinity : 0,
                repeatDelay: 0.5
              }}
            >
              🧠
            </motion.div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-electric-300 font-semibold text-sm uppercase tracking-wide">
                AI Financial Insights
              </h4>
              {isTyping && (
                <motion.div
                  className="w-1 h-4 bg-electric-400"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </div>
            <p className="text-gray-200 text-sm leading-relaxed font-medium">
              {displayedText}
              {isTyping && (
                <motion.span
                  className="inline-block w-2 h-4 bg-electric-400 ml-1"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

interface ChartOfAccountsItem { 
  code: string
  name: string
  type: string
  category: string
  subcategory: string
  balance: number
  normalBalance: string
  description: string
  isActive: boolean
  transactionCount: number
  lastActivity: string | null
  createdDate: string
  status: string
}

interface ChartOfAccountsData {
  accounts: ChartOfAccountsItem[]
  hierarchy: Record<string, Record<string, ChartOfAccountsItem[]>>
  summary: {
    totalAccounts: number
    activeAccounts: number
    inactiveAccounts: number
    accountsByType: {
      ASSET: number
      LIABILITY: number
      EQUITY: number
      REVENUE: number
      EXPENSE: number
    }
    totalTransactions: number
    accountsWithActivity: number
  }
}

// Add new interfaces for AI-assisted CoA
interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'debit' | 'credit'
}

interface AccountAnalysis {
  trend: 'increasing' | 'decreasing' | 'stable'
  percentChange: number
  period: string
  aiInsight: string
  suggestions: string[]
}

interface AIInsight {
  id: string
  category: string
  message: string
  urgency: 'low' | 'medium' | 'high'
  icon: string
}

export default function Reports() {
  const [tab, setTab] = useState<TabKey>('pnl')
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccountsItem | null>(null)
  const [showAddAccountModal, setShowAddAccountModal] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountType, setNewAccountType] = useState<AccountType>('EXPENSE')
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false)
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0)
  const [showAiInsights, setShowAiInsights] = useState(false)
  
  // Collapsible account groups state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    'ASSET': false,
    'LIABILITY': false,
    'EQUITY': false,
    'REVENUE': false,
    'EXPENSE': false
  })
  
  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<ChartOfAccountsItem | null>(null)

  // Toggle group collapse state
  const toggleGroup = (groupType: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupType]: !prev[groupType]
    }))
  }

  // Get account connections and dependencies
  const getAccountConnections = (account: ChartOfAccountsItem) => {
    const transactions = getMockTransactions(account.code, account.name)
    const hasTransactions = transactions.length > 0
    const totalTransactions = transactions.length
    const recentTransactions = transactions.slice(0, 3)
    
    // Mock some additional connections for demo
    const connections = {
      hasTransactions,
      totalTransactions,
      recentTransactions,
      hasRecurringTransactions: account.name.toLowerCase().includes('subscription') || account.name.toLowerCase().includes('rent'),
      isSystemAccount: ['1010', '2010', '3010'].includes(account.code), // Cash, Accounts Payable, Owner's Equity
      relatedAccounts: account.type === 'ASSET' && account.name.includes('Cash') ? ['Accounts Receivable', 'Customer Deposits'] : [],
      hasOpenInvoices: account.type === 'LIABILITY' && Math.random() > 0.5,
      lastActivity: hasTransactions ? new Date(Math.max(...transactions.map(t => new Date(t.date).getTime()))) : null
    }
    
    return connections
  }

  // Handle delete account
  const handleDeleteAccount = (account: ChartOfAccountsItem) => {
    setAccountToDelete(account)
    setShowDeleteModal(true)
  }

  // Confirm delete account
  const confirmDeleteAccount = () => {
    if (!accountToDelete) return
    
    // Here you would call your delete API
    // For now, just show success message
    alert(`Account "${accountToDelete.name}" (${accountToDelete.code}) has been deleted successfully!`)
    
    // Close modals
    setShowDeleteModal(false)
    setSelectedAccount(null)
    setAccountToDelete(null)
    
    // Invalidate queries to refresh data
    // queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
  }

  // Subscribe to store changes for real-time updates
  const storeData = useMockDataStore()
  
  // Debug store data
  console.log('Store Debug:', {
    accounts: storeData.accounts?.length,
    transactions: storeData.transactions?.length,
    totals: storeData.totals
  })

  // Accounting period state
  const [selectedPeriod, setSelectedPeriod] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
  const [periodType, setPeriodType] = useState('monthly')

  const handlePeriodChange = (period: string, type: string) => {
    setSelectedPeriod(period)
    setPeriodType(type)
  }

  const getPeriodDisplayText = () => {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    
    if (selectedPeriod.includes('YTD')) {
      return `Year to Date ${selectedPeriod.split('-')[0]}`
    } else if (selectedPeriod.includes('Q')) {
      const [year, quarter] = selectedPeriod.split('-')
      const quarters = {
        'Q1': 'Jan-Mar',
        'Q2': 'Apr-Jun', 
        'Q3': 'Jul-Sep',
        'Q4': 'Oct-Dec'
      }
      return `${quarter} ${year} (${quarters[quarter as keyof typeof quarters]})`
    } else if (selectedPeriod.includes('-')) {
      const [year, month] = selectedPeriod.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${monthNames[parseInt(month) - 1]} ${year}`
    } else {
      return `Full Year ${selectedPeriod}`
    }
  }

  const balanceQuery = useQuery<BalanceSheetData>({
    queryKey: ['reports', 'balance-sheet', storeData.accounts, storeData.totals],
    queryFn: () => FinancialDataService.getBalanceSheetData(),
    enabled: tab === 'balance',
  })

  const pnlQuery = useQuery<PnlData>({
    queryKey: ['reports', 'pnl', storeData.accounts, storeData.totals],
    queryFn: () => FinancialDataService.getPnlData(),
    enabled: tab === 'pnl',
  })

  const trialQuery = useQuery<TrialData>({
    queryKey: ['reports', 'trial-balance', storeData.accounts],
    queryFn: () => FinancialDataService.getTrialBalanceData(),
    enabled: tab === 'trial',
  })

  const coaQuery = useQuery<ChartOfAccountsData>({
    queryKey: ['reports', 'chart-of-accounts', storeData.accounts],
    queryFn: () => FinancialDataService.getChartOfAccountsData(),
    enabled: tab === 'coa',
  })

  // Prepare rows and tables
  const [revFilter, setRevFilter] = useState('')
  const [expFilter, setExpFilter] = useState('')
  const [trialFilter, setTrialFilter] = useState('')
  const [highlightedRow, setHighlightedRow] = useState<string | null>(null)
  
  const revenueRows: NameAmountRow[] = useMemo(() => (pnlQuery.data?.revenue ?? []).filter(r => r.name.toLowerCase().includes(revFilter.toLowerCase())), [pnlQuery.data, revFilter])
  const expenseRows: NameAmountRow[] = useMemo(() => (pnlQuery.data?.expenses ?? []).filter(r => r.name.toLowerCase().includes(expFilter.toLowerCase())), [pnlQuery.data, expFilter])
  const trialRows = useMemo(() => (trialQuery.data?.rows ?? []).filter(row => 
    trialFilter ? row.account.toLowerCase().includes(trialFilter.toLowerCase()) : true
  ), [trialQuery.data, trialFilter])
  
  const revenueTable = useNameAmountTable(revenueRows, true)
  const expenseTable = useNameAmountTable(expenseRows, true)
  
  // Additional tables for Balance Sheet and P&L sections (to avoid conditional hook calls)
  const cogsTable = useNameAmountTable(pnlQuery.data?.cogs || [], true)
  const operatingExpensesTable = useNameAmountTable(pnlQuery.data?.operatingExpenses || [], true)
  const nonOperatingExpensesTable = useNameAmountTable(pnlQuery.data?.nonOperatingExpenses || [], true)

  const handleRowClick = (account: string) => {
    setHighlightedRow(highlightedRow === account ? null : account)
  }

  const [assetFilter, setAssetFilter] = useState('')
  const [liabFilter, setLiabFilter] = useState('')
  const [eqFilter, setEqFilter] = useState('')
  const assets: NameAmountRow[] = useMemo(() => (balanceQuery.data?.assets ?? []).filter(r => r.name.toLowerCase().includes(assetFilter.toLowerCase())), [balanceQuery.data, assetFilter])
  const liabilities: NameAmountRow[] = useMemo(() => (balanceQuery.data?.liabilities ?? []).filter(r => r.name.toLowerCase().includes(liabFilter.toLowerCase())), [balanceQuery.data, liabFilter])
  const equity: NameAmountRow[] = useMemo(() => (balanceQuery.data?.equity ?? []).filter(r => r.name.toLowerCase().includes(eqFilter.toLowerCase())), [balanceQuery.data, eqFilter])
  const assetsTable = useNameAmountTable(assets, true)
  const liabilitiesTable = useNameAmountTable(liabilities, true)
  const equityTable = useNameAmountTable(equity, true)

  // Get AI insights from store - now report-specific based on active tab
  const getReportSpecificInsights = () => {
    switch (tab) {
      case 'pnl':
        return FinancialDataService.getPnlInsights()
      case 'balance':
        return FinancialDataService.getBalanceSheetInsights()
      case 'trial':
        return FinancialDataService.getTrialBalanceInsights()
      case 'coa':
        return FinancialDataService.getChartOfAccountsInsights()
      default:
        return FinancialDataService.getAIInsights()
    }
  }
  
  const aiInsights = getReportSpecificInsights()

  // Mock transaction data for account drill-down
  const getMockTransactions = (accountCode: string, accountName: string): Transaction[] => {
    // Get real transactions from our store
    const realTransactions = FinancialDataService.getAccountTransactions(accountCode)
    
    // Return real transactions if they exist, otherwise empty array (clean after reset)
    return realTransactions as Transaction[]
  }

  // Clean AI account analysis - no mock data
  const getAccountAnalysis = (account: ChartOfAccountsItem): AccountAnalysis => {
    // Get real transactions for this account
    const transactions = FinancialDataService.getAccountTransactions(account.code)
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    let percentChange = 0
    let aiInsight = ''
    let suggestions: string[] = []
    
    if (transactions.length === 0) {
      // No activity yet
      aiInsight = `${account.name} has no transaction history yet. Start by adding expenses or revenue to see insights.`
      suggestions = [
        'Add your first transaction to this account',
        'Set up automatic categorization rules',
        'Configure account reconciliation'
      ]
    } else {
      // Has transactions - analyze based on balance and activity
      if (account.balance > 0) {
        trend = 'increasing'
        percentChange = Math.round((account.balance / 1000) * 100) / 100 // Simple calculation
    
    if (account.type === 'EXPENSE') {
          aiInsight = `${account.name} shows ${transactions.length} transaction(s) with current balance of $${account.balance.toLocaleString()}.`
      suggestions = [
            'Monitor spending patterns in this category',
            'Set up budget alerts',
            'Review recent transactions for accuracy'
      ]
    } else if (account.type === 'REVENUE') {
          aiInsight = `${account.name} generated $${account.balance.toLocaleString()} from ${transactions.length} transaction(s).`
      suggestions = [
            'Track revenue trends over time',
            'Analyze customer payment patterns',
            'Set up recurring revenue tracking'
      ]
    } else {
          aiInsight = `${account.name} has ${transactions.length} transaction(s) with current balance of $${account.balance.toLocaleString()}.`
      suggestions = [
            'Review account activity regularly',
            'Set up reconciliation schedule',
            'Monitor balance changes'
          ]
        }
      } else {
        aiInsight = `${account.name} currently has a zero balance with ${transactions.length} historical transaction(s).`
        suggestions = [
          'Review transaction history',
          'Check for pending entries',
          'Verify account classification'
        ]
      }
    }
    
    return {
      trend,
      percentChange,
      period: 'Current Period',
      aiInsight,
      suggestions
    }
  }

  // AI auto-suggestions for new accounts
  const getAiAccountSuggestions = (name: string) => {
    const suggestions = {
      type: '',
      code: '',
      parent: '',
      confidence: 0
    }
    
    const lowerName = name.toLowerCase()
    
    if (lowerName.includes('cash') || lowerName.includes('bank')) {
      suggestions.type = 'ASSET'
      suggestions.code = '1010'
      suggestions.parent = 'Current Assets'
      suggestions.confidence = 95
    } else if (lowerName.includes('revenue') || lowerName.includes('sales') || lowerName.includes('income')) {
      suggestions.type = 'REVENUE'
      suggestions.code = '4000'
      suggestions.parent = 'Operating Revenue'
      suggestions.confidence = 92
    } else if (lowerName.includes('expense') || lowerName.includes('cost') || lowerName.includes('fee')) {
      suggestions.type = 'EXPENSE'
      suggestions.code = '6000'
      suggestions.parent = 'Operating Expenses'
      suggestions.confidence = 88
    } else if (lowerName.includes('loan') || lowerName.includes('payable') || lowerName.includes('debt')) {
      suggestions.type = 'LIABILITY'
      suggestions.code = '2000'
      suggestions.parent = 'Current Liabilities'
      suggestions.confidence = 90
    } else {
      suggestions.type = 'EXPENSE'
      suggestions.code = '6999'
      suggestions.parent = 'General Expenses'
      suggestions.confidence = 65
    }
    
    return suggestions
  }

  // Start AI insights with delay for all report tabs
  useEffect(() => {
    if (tab === 'pnl' || tab === 'balance' || tab === 'trial' || tab === 'coa') {
      const timer = setTimeout(() => {
        setShowAiInsights(true)
      }, 1500)
      return () => clearTimeout(timer)
    } else {
      setShowAiInsights(false)
    }
  }, [tab])

  // Cycle through AI insights
  useEffect(() => {
    if (showAiInsights && aiInsights.length > 0) {
      const interval = setInterval(() => {
        setCurrentInsightIndex((prev) => (prev + 1) % aiInsights.length)
      }, 8000) // Change insight every 8 seconds
      return () => clearInterval(interval)
    }
  }, [showAiInsights, aiInsights.length])

  // Handle new account creation
  const handleCreateAccount = () => {
    if (!newAccountName.trim()) return

    const { createNewAccount } = useMockDataStore.getState()
    
    // Use AI suggestions if available
    const suggestions = getAiAccountSuggestions(newAccountName)
    const accountType = (suggestions.confidence > 80 ? suggestions.type : newAccountType) as AccountType
    
    // Create the new account
    const newAccount = createNewAccount(newAccountName.trim(), accountType)
    
    // Reset form and close modal
    setNewAccountName('')
    setNewAccountType('EXPENSE')
    setShowAddAccountModal(false)
    
    // Trigger data refresh
    coaQuery.refetch()
  }

  // Handle new account name changes with AI suggestions
  useEffect(() => {
    if (newAccountName.length > 2) {
      setAiSuggestionLoading(true)
      const timer = setTimeout(() => {
        setAiSuggestionLoading(false)
        // Update account type based on AI suggestion
        const suggestions = getAiAccountSuggestions(newAccountName)
        if (suggestions.confidence > 80) {
          setNewAccountType(suggestions.type as AccountType)
        }
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [newAccountName])

  const renderContent = () => {
    if (tab === 'pnl') {
      const d = pnlQuery.data
      if (!d) return <div className="flex items-center justify-center h-64 text-gray-400">Loading P&L data...</div>

      const currentInsight = aiInsights[currentInsightIndex]

      return (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <motion.h3 
                className="text-2xl font-bold text-white mb-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                📊 Profit & Loss Statement
              </motion.h3>
              <motion.p 
                className="text-gray-400"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                For the period ending {d.period.end}
              </motion.p>
            </div>
          </div>

          {/* AI Intelligence Panel - Same as Chart of Accounts */}
          <AnimatePresence>
            {showAiInsights && aiInsights.length > 0 && (
        <motion.div 
                className="mb-6"
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.6, type: "spring" }}
        >
                <div className="glass rounded-xl p-4 border border-electric-400/30 bg-gradient-to-r from-electric-500/10 to-purple-500/10 shadow-lg shadow-electric-500/20">
                  <div className="flex items-start gap-3">
                    <motion.div
                      className="flex-shrink-0 mt-0.5"
                      animate={{ 
                        rotate: [0, 5, -5, 0],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ 
                        duration: 2, 
                        repeat: Infinity,
                        repeatDelay: 3
                      }}
                    >
                      <div className="w-8 h-8 bg-gradient-to-r from-electric-400 to-purple-400 rounded-lg flex items-center justify-center text-white text-lg">
                        🧠
              </div>
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-electric-300 font-semibold text-sm uppercase tracking-wide">
                          AI Financial Intelligence
                        </h4>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          currentInsight.urgency === 'high' ? 'bg-red-500/20 text-red-300' :
                          currentInsight.urgency === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-green-500/20 text-green-300'
                        }`}>
                          {currentInsight.urgency.toUpperCase()}
                        </span>
              </div>
                      <motion.p 
                        key={currentInsight.id || currentInsightIndex}
                        className="text-gray-200 text-sm leading-relaxed font-medium"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8 }}
                      >
                        <TypewriterText text={currentInsight.message} />
                      </motion.p>
                      <div className="mt-2 text-xs text-gray-400">
                        {currentInsight.category} • AI Analysis
            </div>
          </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Revenue Section */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xl font-semibold text-electric-400">Revenue</h4>
              <input
                type="text"
                placeholder="Filter revenue accounts..."
                value={revFilter}
                onChange={(e) => setRevFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm text-white placeholder-gray-400"
              />
              </div>
            
              <TableGlass
                table={revenueTable.table as any}
                rowKey={(row) => 'rev-' + (row as NameAmountRow).name}
                footer={d && (
                  <>
                    <span className="text-electric-400 font-semibold">Total Revenue</span>
                    <span className="text-green-400 font-bold text-lg">{formatCurrency(d.totals.revenue)}</span>
                  </>
                )}
              />
            </div>

          {/* Cost of Goods Sold Section */}
          {d.cogs && d.cogs.length > 0 && (
            <div className="glass rounded-2xl p-6 border border-white/10">
              <h4 className="text-xl font-semibold text-orange-400 mb-4">Cost of Goods Sold</h4>
              <TableGlass
                table={cogsTable.table as any}
                rowKey={(row) => 'cogs-' + (row as NameAmountRow).name}
                footer={d && (
                  <>
                    <span className="text-orange-400 font-semibold">Total COGS</span>
                    <span className="text-red-400 font-bold text-lg">{formatCurrency(d.totals.cogs || 0)}</span>
                  </>
                )}
              />
            </div>
          )}

          {/* Gross Profit */}
          <div className="glass rounded-2xl p-6 border border-white/10 bg-gradient-to-r from-green-500/10 to-transparent">
            <div className="flex justify-between items-center">
              <h4 className="text-xl font-semibold text-green-400">Gross Profit</h4>
              <span className="text-green-400 font-bold text-2xl">{formatCurrency(d.totals.grossProfit || 0)}</span>
            </div>
            <p className="text-gray-400 text-sm mt-2">Revenue minus Cost of Goods Sold</p>
          </div>

          {/* Operating Expenses Section */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xl font-semibold text-red-400">Operating Expenses</h4>
              <input
                type="text"
                placeholder="Filter expense accounts..."
                value={expFilter}
                onChange={(e) => setExpFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm text-white placeholder-gray-400"
              />
              </div>
            
            <div className="max-h-[400px] overflow-y-auto scrollbar-electric">
              <TableGlass
                table={operatingExpensesTable.table as any}
                rowKey={(row) => 'opexp-' + (row as NameAmountRow).name}
              />
              </div>
            
            {/* Sticky Footer outside scrollable area */}
            <div className="flex justify-between items-center py-3 px-4 mt-3 border-t border-white/10 bg-gradient-to-r from-red-500/10 to-transparent rounded-lg">
              <span className="text-red-400 font-semibold">Total Operating Expenses</span>
              <span className="text-red-400 font-bold text-lg">{formatCurrency(d.totals.operatingExpenses || 0)}</span>
            </div>
          </div>

          {/* Operating Income */}
          <div className="glass rounded-2xl p-6 border border-white/10 bg-gradient-to-r from-blue-500/10 to-transparent">
            <div className="flex justify-between items-center">
              <h4 className="text-xl font-semibold text-blue-400">Operating Income</h4>
              <span className="text-blue-400 font-bold text-2xl">{formatCurrency(d.totals.operatingIncome || 0)}</span>
            </div>
            <p className="text-gray-400 text-sm mt-2">Gross Profit minus Operating Expenses</p>
          </div>

          {/* Non-Operating Expenses Section */}
          {d.nonOperatingExpenses && d.nonOperatingExpenses.length > 0 && (
            <div className="glass rounded-2xl p-6 border border-white/10">
              <h4 className="text-xl font-semibold text-purple-400 mb-4">Non-Operating Expenses</h4>
              <TableGlass
                table={nonOperatingExpensesTable.table as any}
                rowKey={(row) => 'nonop-' + (row as NameAmountRow).name}
                footer={d && (
                  <>
                    <span className="text-purple-400 font-semibold">Total Non-Operating Expenses</span>
                    <span className="text-red-400 font-bold text-lg">{formatCurrency(d.totals.nonOperatingExpenses || 0)}</span>
                  </>
                )}
              />
            </div>
          )}

          {/* Net Income */}
          <div className="glass rounded-2xl p-6 border border-white/10 bg-gradient-to-r from-electric-500/20 to-transparent">
            <div className="flex justify-between items-center">
              <h4 className="text-2xl font-bold text-electric-400">Net Income</h4>
              <span className={`font-bold text-3xl ${(d.totals.netIncome || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(d.totals.netIncome || 0)}
              </span>
            </div>
            <p className="text-gray-400 text-sm mt-2">Operating Income minus Non-Operating Expenses</p>
          </div>
        </div>
      )
    }

    if (tab === 'balance') {
      const d = balanceQuery.data
      
      // Debug logging
      console.log('Balance Sheet Debug:', {
        tab,
        queryData: d,
        queryError: balanceQuery.error,
        queryStatus: balanceQuery.status,
        isLoading: balanceQuery.isLoading,
        isError: balanceQuery.isError
      })
      
      if (balanceQuery.isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading Balance Sheet data...</div>
      if (balanceQuery.isError) return <div className="flex items-center justify-center h-64 text-red-400">Error loading Balance Sheet: {balanceQuery.error?.message}</div>
      if (!d) return <div className="flex items-center justify-center h-64 text-gray-400">No Balance Sheet data available</div>

      const currentInsight = aiInsights[currentInsightIndex]

      return (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <motion.h3 
                className="text-2xl font-bold text-white mb-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                ⚖️ Balance Sheet
              </motion.h3>
              <motion.p 
                className="text-gray-400"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                As of {d.asOf}
              </motion.p>
            </div>
          </div>

          {/* AI Intelligence Panel - Same as Chart of Accounts */}
          <AnimatePresence>
            {showAiInsights && aiInsights.length > 0 && (
        <motion.div 
                className="mb-6"
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.6, type: "spring" }}
        >
                <div className="glass rounded-xl p-4 border border-electric-400/30 bg-gradient-to-r from-electric-500/10 to-purple-500/10 shadow-lg shadow-electric-500/20">
                  <div className="flex items-start gap-3">
                    <motion.div
                      className="flex-shrink-0 mt-0.5"
                      animate={{ 
                        rotate: [0, 5, -5, 0],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ 
                        duration: 2, 
                        repeat: Infinity,
                        repeatDelay: 3
                      }}
                    >
                      <div className="w-8 h-8 bg-gradient-to-r from-electric-400 to-purple-400 rounded-lg flex items-center justify-center text-white text-lg">
                        🧠
              </div>
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-electric-300 font-semibold text-sm uppercase tracking-wide">
                          AI Financial Intelligence
                        </h4>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          currentInsight.urgency === 'high' ? 'bg-red-500/20 text-red-300' :
                          currentInsight.urgency === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-green-500/20 text-green-300'
                        }`}>
                          {currentInsight.urgency.toUpperCase()}
                        </span>
            </div>
                      <motion.p 
                        key={currentInsight.id || currentInsightIndex}
                        className="text-gray-200 text-sm leading-relaxed font-medium"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8 }}
                      >
                        <TypewriterText text={currentInsight.message} />
                      </motion.p>
                      <div className="mt-2 text-xs text-gray-400">
                        {currentInsight.category} • AI Analysis
          </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Assets Section */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <h4 className="text-2xl font-bold text-electric-400 mb-6">ASSETS</h4>
            
            {/* Current Assets */}
              <div className="mb-6">
              <h5 className="text-lg font-semibold text-green-400 mb-3">Current Assets</h5>
              <div className="space-y-2">
                {(d.currentAssets || []).map((asset, i) => (
                  <div key={i} className="flex justify-between items-center py-2 px-4 hover:bg-white/5 rounded-lg transition-colors">
                    <span className="text-gray-300">{asset.name}</span>
                    <span className="text-green-400 font-medium">{formatCurrency(asset.amount)}</span>
              </div>
                ))}
                <div className="flex justify-between items-center py-2 px-4 border-t border-white/10 font-semibold">
                  <span className="text-green-400">Total Current Assets</span>
                  <span className="text-green-400 text-lg">{formatCurrency(d.totals.currentAssets || 0)}</span>
                </div>
              </div>
            </div>

            {/* Non-Current Assets */}
            {d.nonCurrentAssets && d.nonCurrentAssets.length > 0 && (
              <div className="mb-6">
                <h5 className="text-lg font-semibold text-blue-400 mb-3">Non-Current Assets</h5>
                <div className="space-y-2">
                  {d.nonCurrentAssets.map((asset, i) => (
                    <div key={i} className="flex justify-between items-center py-2 px-4 hover:bg-white/5 rounded-lg transition-colors">
                      <span className="text-gray-300">{asset.name}</span>
                      <span className="text-blue-400 font-medium">{formatCurrency(asset.amount)}</span>
              </div>
                  ))}
                  <div className="flex justify-between items-center py-2 px-4 border-t border-white/10 font-semibold">
                    <span className="text-blue-400">Total Non-Current Assets</span>
                    <span className="text-blue-400 text-lg">{formatCurrency(d.totals.nonCurrentAssets || 0)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Total Assets */}
            <div className="border-t-2 border-electric-500/50 pt-4">
              <div className="flex justify-between items-center font-bold text-xl">
                <span className="text-electric-400">TOTAL ASSETS</span>
                <span className="text-electric-400">{formatCurrency(d.totals.assets)}</span>
              </div>
            </div>
            </div>

          {/* Liabilities Section */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <h4 className="text-2xl font-bold text-red-400 mb-6">LIABILITIES</h4>
            
            {/* Current Liabilities */}
              <div className="mb-6">
              <h5 className="text-lg font-semibold text-orange-400 mb-3">Current Liabilities</h5>
              <div className="space-y-2">
                {(d.currentLiabilities || []).map((liability, i) => (
                  <div key={i} className="flex justify-between items-center py-2 px-4 hover:bg-white/5 rounded-lg transition-colors">
                    <span className="text-gray-300">{liability.name}</span>
                    <span className="text-orange-400 font-medium">{formatCurrency(liability.amount)}</span>
              </div>
                ))}
                <div className="flex justify-between items-center py-2 px-4 border-t border-white/10 font-semibold">
                  <span className="text-orange-400">Total Current Liabilities</span>
                  <span className="text-orange-400 text-lg">{formatCurrency(d.totals.currentLiabilities || 0)}</span>
                </div>
              </div>
            </div>

            {/* Long-term Liabilities */}
            {d.longTermLiabilities && d.longTermLiabilities.length > 0 && (
              <div className="mb-6">
                <h5 className="text-lg font-semibold text-red-400 mb-3">Long-term Liabilities</h5>
                <div className="space-y-2">
                  {d.longTermLiabilities.map((liability, i) => (
                    <div key={i} className="flex justify-between items-center py-2 px-4 hover:bg-white/5 rounded-lg transition-colors">
                      <span className="text-gray-300">{liability.name}</span>
                      <span className="text-red-400 font-medium">{formatCurrency(liability.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-2 px-4 border-t border-white/10 font-semibold">
                    <span className="text-red-400">Total Long-term Liabilities</span>
                    <span className="text-red-400 text-lg">{formatCurrency(d.totals.longTermLiabilities || 0)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Total Liabilities */}
            <div className="border-t-2 border-red-500/50 pt-4">
              <div className="flex justify-between items-center font-bold text-xl">
                <span className="text-red-400">TOTAL LIABILITIES</span>
                <span className="text-red-400">{formatCurrency(d.totals.liabilities)}</span>
            </div>
          </div>
          </div>

          {/* Equity Section */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <h4 className="text-2xl font-bold text-purple-400 mb-6">EQUITY</h4>
            <div className="space-y-2">
              {(d.equity || []).map((equity, i) => (
                <div key={i} className="flex justify-between items-center py-2 px-4 hover:bg-white/5 rounded-lg transition-colors">
                  <span className="text-gray-300">{equity.name}</span>
                  <span className="text-purple-400 font-medium">{formatCurrency(equity.amount)}</span>
                </div>
              ))}
              <div className="border-t-2 border-purple-500/50 pt-4">
                <div className="flex justify-between items-center font-bold text-xl">
                  <span className="text-purple-400">TOTAL EQUITY</span>
                  <span className="text-purple-400">{formatCurrency(d.totals.equity)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Ratios & Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass rounded-2xl p-6 border border-white/10 bg-gradient-to-br from-green-500/10 to-transparent">
              <h5 className="text-lg font-semibold text-green-400 mb-2">Working Capital</h5>
              <div className="text-2xl font-bold text-white">{formatCurrency((d.totals.currentAssets || 0) - (d.totals.currentLiabilities || 0))}</div>
              <p className="text-gray-400 text-sm mt-2">Current Assets - Current Liabilities</p>
            </div>

            <div className="glass rounded-2xl p-6 border border-white/10 bg-gradient-to-br from-blue-500/10 to-transparent">
              <h5 className="text-lg font-semibold text-blue-400 mb-2">Current Ratio</h5>
              <div className="text-2xl font-bold text-white">{(d.totals.currentRatio || 0).toFixed(2)}</div>
              <p className="text-gray-400 text-sm mt-2">Current Assets ÷ Current Liabilities</p>
            </div>

            <div className="glass rounded-2xl p-6 border border-white/10 bg-gradient-to-br from-purple-500/10 to-transparent">
              <h5 className="text-lg font-semibold text-purple-400 mb-2">Debt-to-Equity</h5>
              <div className="text-2xl font-bold text-white">{(d.totals.debtToEquityRatio || 0).toFixed(2)}</div>
              <p className="text-gray-400 text-sm mt-2">Total Liabilities ÷ Total Equity</p>
            </div>
          </div>

          {/* Balance Check */}
          <div className="glass rounded-2xl p-6 border border-white/10 bg-gradient-to-r from-electric-500/20 to-transparent">
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-electric-400">TOTAL LIABILITIES + EQUITY</span>
              <span className="text-2xl font-bold text-electric-400">{formatCurrency(d.totals.liabilitiesAndEquity)}</span>
            </div>
            <div className="mt-4 flex items-center justify-center">
              {Math.abs(d.totals.assets - d.totals.liabilitiesAndEquity) < 0.01 ? (
                <div className="flex items-center text-green-400">
                  <span className="text-2xl mr-2">✅</span>
                  <span className="font-semibold">Balance Sheet Balances</span>
                </div>
              ) : (
                <div className="flex items-center text-red-400">
                  <span className="text-2xl mr-2">⚠️</span>
                  <span className="font-semibold">Balance Sheet Out of Balance</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    if (tab === 'trial') {
      const trialData = trialQuery.data
      if (!trialData) return <div className="flex items-center justify-center h-64 text-gray-400">Loading Trial Balance data...</div>

      const currentInsight = aiInsights[currentInsightIndex]

      return (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <motion.h3 
                className="text-2xl font-bold text-white mb-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                📋 Trial Balance
              </motion.h3>
              <motion.p 
                className="text-gray-400"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                As of {trialData.asOf}
              </motion.p>
            </div>
          </div>

          {/* AI Intelligence Panel - Same as Chart of Accounts */}
          <AnimatePresence>
            {showAiInsights && aiInsights.length > 0 && (
        <motion.div 
                className="mb-6"
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.6, type: "spring" }}
        >
                <div className="glass rounded-xl p-4 border border-electric-400/30 bg-gradient-to-r from-electric-500/10 to-purple-500/10 shadow-lg shadow-electric-500/20">
                  <div className="flex items-start gap-3">
                    <motion.div
                      className="flex-shrink-0 mt-0.5"
                      animate={{ 
                        rotate: [0, 5, -5, 0],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ 
                        duration: 2, 
                        repeat: Infinity,
                        repeatDelay: 3
                      }}
                    >
                      <div className="w-8 h-8 bg-gradient-to-r from-electric-400 to-purple-400 rounded-lg flex items-center justify-center text-white text-lg">
                        🧠
              </div>
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-electric-300 font-semibold text-sm uppercase tracking-wide">
                          AI Financial Intelligence
                        </h4>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          currentInsight.urgency === 'high' ? 'bg-red-500/20 text-red-300' :
                          currentInsight.urgency === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-green-500/20 text-green-300'
                        }`}>
                          {currentInsight.urgency.toUpperCase()}
                        </span>
            </div>
                      <motion.p 
                        key={currentInsight.id || currentInsightIndex}
                        className="text-gray-200 text-sm leading-relaxed font-medium"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8 }}
                      >
                        <TypewriterText text={currentInsight.message} />
                      </motion.p>
                      <div className="mt-2 text-xs text-gray-400">
                        {currentInsight.category} • AI Analysis
          </div>
          </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Simple Trial Balance Table */}
          <div className="glass rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xl font-semibold text-electric-400">Account Balances</h4>
              <input
                type="text"
                placeholder="Search accounts..."
                value={trialFilter} 
                onChange={(e) => setTrialFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm text-white placeholder-gray-400"
              />
            </div>

              <div className="max-h-[500px] overflow-y-auto scrollbar-electric">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-900/95 to-gray-800/95 backdrop-blur-xl sticky top-0 z-50 border-b border-white/20">
                  <tr>
                    <th className="px-6 py-4 text-left text-white font-semibold text-sm uppercase tracking-wide">Account Code</th>
                    <th className="px-6 py-4 text-left text-white font-semibold text-sm uppercase tracking-wide">Account Name</th>
                      <th className="px-6 py-4 text-right text-white font-semibold text-sm uppercase tracking-wide">Debit</th>
                      <th className="px-6 py-4 text-right text-white font-semibold text-sm uppercase tracking-wide">Credit</th>
                  </tr>
                  </thead>
                <tbody className="divide-y divide-white/5">
                  {trialRows.map((row) => (
                    <tr key={row.accountCode} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-electric-400 font-mono text-sm">{row.accountCode}</td>
                      <td className="px-6 py-4 text-gray-300">{row.account}</td>
                      <td className="px-6 py-4 text-right text-green-400 font-mono">
                        {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                            </td>
                      <td className="px-6 py-4 text-right text-red-400 font-mono">
                        {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                            </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
              
            {/* Simple Totals Footer */}
            <div className="flex justify-between items-center py-4 px-6 mt-4 border-t border-white/10 bg-gradient-to-r from-electric-500/10 to-transparent rounded-lg">
              <div className="flex space-x-8">
                <div>
                  <span className="text-green-400 font-semibold">Total Debits: </span>
                  <span className="text-green-400 font-bold text-lg">{formatCurrency(trialData.totals.debit)}</span>
                  </div>
                <div>
                  <span className="text-red-400 font-semibold">Total Credits: </span>
                  <span className="text-red-400 font-bold text-lg">{formatCurrency(trialData.totals.credit)}</span>
                    </div>
                  </div>
              <div className="flex items-center">
                {trialData.totals.isBalanced ? (
                  <div className="flex items-center text-green-400">
                    <span className="text-xl mr-2">✅</span>
                    <span className="font-semibold">Balanced</span>
                    </div>
                ) : (
                  <div className="flex items-center text-red-400">
                    <span className="text-xl mr-2">⚠️</span>
                    <span className="font-semibold">Out of Balance</span>
                  </div>
                  )}
                </div>
              </div>
          </div>
        </div>
      )
    } else if (tab === 'coa') {
      const data = coaQuery.data
      if (coaQuery.isLoading) {
        return (
          <div className="flex items-center justify-center h-64">
            <div className="loading-spinner text-electric-400"></div>
          </div>
        )
      }

      if (!data) {
        return (
          <div className="text-center text-gray-400 py-12">
            <p>No chart of accounts data available</p>
          </div>
        )
      }

      // Group accounts by type for better organization
      const accountsByType = data.accounts.reduce((acc, account) => {
        if (!acc[account.type]) acc[account.type] = []
        acc[account.type].push(account)
        return acc
      }, {} as Record<string, ChartOfAccountsItem[]>)

      const typeOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']
      const typeLabels = {
        'ASSET': '🏢 Assets',
        'LIABILITY': '💳 Liabilities', 
        'EQUITY': '👑 Equity',
        'REVENUE': '💰 Revenue',
        'EXPENSE': '💸 Expenses'
      }

      const currentInsight = aiInsights[currentInsightIndex]

      return (
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-8">
              <motion.h3 
                className="text-3xl font-bold text-white mb-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                📋 Chart of Accounts
              </motion.h3>
              <motion.p 
                className="text-gray-400 text-lg"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                AI-powered account management and insights
              </motion.p>
            </div>

            {/* AI Insights Panel */}
            <AnimatePresence>
              {showAiInsights && (
                <motion.div
                  className="mb-6"
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.6, type: "spring" }}
                >
                  <div className="flex items-center gap-4">
                    {/* AI Intelligence Panel - Takes most of the width */}
                    <div className="flex-1 glass rounded-xl p-4 border border-electric-400/30 bg-gradient-to-r from-electric-500/10 to-purple-500/10 shadow-lg shadow-electric-500/20">
                      <div className="flex items-start gap-3">
                        <motion.div
                          className="flex-shrink-0 mt-0.5"
                          animate={{ 
                            rotate: [0, 5, -5, 0],
                            scale: [1, 1.1, 1]
                          }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity,
                            repeatDelay: 3
                          }}
                        >
                          <div className="w-8 h-8 bg-gradient-to-r from-electric-400 to-purple-400 rounded-lg flex items-center justify-center text-white text-lg">
                            🧠
                          </div>
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-electric-300 font-semibold text-sm uppercase tracking-wide">
                              AI Financial Intelligence
                            </h4>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              currentInsight.urgency === 'high' ? 'bg-red-500/20 text-red-300' :
                              currentInsight.urgency === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                              'bg-green-500/20 text-green-300'
                            }`}>
                              {currentInsight.urgency.toUpperCase()}
                            </span>
                          </div>
                          <motion.p 
                            key={currentInsight.id}
                            className="text-gray-200 text-sm leading-relaxed font-medium"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8 }}
                          >
                            <TypewriterText text={currentInsight.message} />
                          </motion.p>
                          <div className="mt-2 text-xs text-gray-400">
                            {currentInsight.category} • AI Analysis
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Add Account Button - Compact on the right */}
                    <motion.button
                      onClick={() => setShowAddAccountModal(true)}
                      className="btn-electric flex items-center gap-2 px-4 py-3 rounded-lg flex-shrink-0"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span>➕</span>
                      Add Account
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Fallback Add Account Button (when AI insights not shown) */}
            {!showAiInsights && (
              <div className="flex justify-end mb-6">
                <motion.button
                  onClick={() => setShowAddAccountModal(true)}
                  className="btn-electric flex items-center gap-2 px-4 py-2 rounded-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>➕</span>
                  Add Account
                </motion.button>
              </div>
            )}

            {/* Account Summary Info */}
            <motion.div
              className="mb-6 p-4 glass rounded-xl border border-white/10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <p className="text-gray-400 text-sm">
                📊 Total Accounts: <span className="text-white font-semibold">{data.accounts.length}</span>
                {' • '}
                Last Updated: <span className="text-white">{new Date().toLocaleDateString()}</span>
                {' • '}
                <span className="text-electric-400">AI Analysis Active</span>
              </p>
            </motion.div>

            <div className="space-y-6" style={{ contain: 'layout', position: 'relative' }}>
              {typeOrder.map((type, typeIndex) => {
                const accounts = accountsByType[type] || []
                if (accounts.length === 0) return null

                return (
                  <motion.div
                    key={type}
                    className="glass p-6 rounded-2xl border border-white/10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: typeIndex * 0.1, duration: 0.5 }}
                    layout
                    style={{
                      contain: 'layout style',
                      position: 'relative'
                    }}
                  >
                    {/* Collapsible Header */}
                    <motion.button
                      onClick={() => toggleGroup(type)}
                      className={`flex items-center justify-between w-full group hover:bg-white/5 p-2 rounded-lg transition-all duration-200 ${
                        collapsedGroups[type] ? 'mb-0' : 'mb-4'
                      }`}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <h4 className="text-xl font-bold text-white group-hover:text-electric-400 transition-colors">
                        {typeLabels[type as keyof typeof typeLabels]}
                      </h4>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                          {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                        </span>
                        <motion.div
                          animate={{ rotate: collapsedGroups[type] ? -90 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-gray-400 group-hover:text-electric-400 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </motion.div>
                      </div>
                    </motion.button>
                    
                    {/* Collapsible Table Content */}
                    <AnimatePresence mode="wait" initial={false}>
                      {!collapsedGroups[type] && (
                        <motion.div
                          initial={{ opacity: 0, scaleY: 0 }}
                          animate={{ 
                            opacity: 1, 
                            scaleY: 1,
                            transition: {
                              scaleY: { duration: 0.3, ease: [0.23, 1, 0.320, 1] },
                              opacity: { duration: 0.2, delay: 0.05 }
                            }
                          }}
                          exit={{ 
                            opacity: 0, 
                            scaleY: 0,
                            transition: {
                              scaleY: { duration: 0.25, ease: [0.23, 1, 0.320, 1] },
                              opacity: { duration: 0.15 }
                            }
                          }}
                          layout
                          className="overflow-hidden"
                          style={{ 
                            transformOrigin: 'top',
                            willChange: 'transform, opacity'
                          }}
                        >
                          <div className="overflow-hidden rounded-xl border border-white/10" style={{ position: 'relative' }}>
                            <table className="w-full" style={{ tableLayout: 'fixed', width: '100%' }}>
                              <thead className="bg-white/5">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Account Code
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Account Name
                                  </th>
                                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Current Balance
                                  </th>
                                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {accounts.map((account, index) => (
                                  <motion.tr
                                    key={account.code}
                                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                                    initial={{ opacity: 0, x: -20, scale: 0.98 }}
                                    animate={{ 
                                      opacity: 1, 
                                      x: 0, 
                                      scale: 1,
                                      transition: {
                                        delay: (typeIndex * 0.1) + (index * 0.03), 
                                        duration: 0.25,
                                        ease: [0.23, 1, 0.320, 1]
                                      }
                                    }}
                                    onClick={() => setSelectedAccount(account)}
                                    whileHover={{ x: 5, scale: 1.02 }}
                                    style={{ position: 'relative' }}
                                  >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className="text-electric-400 font-mono text-sm">
                                        {account.code}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className="text-white font-medium group-hover:text-electric-300 transition-colors">
                                        {account.name}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                      <span className={`font-bold ${
                                        account.balance >= 0 ? 'text-green-400' : 'text-red-400'
                                      }`}>
                                        {account.balance >= 0 ? '' : '-'}${Math.abs(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                      <motion.button
                                        className="text-electric-400 hover:text-electric-300 text-sm font-medium opacity-0 group-hover:opacity-100 transition-all"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setSelectedAccount(account)
                                        }}
                                      >
                                        View Details →
                                      </motion.button>
                                    </td>
                                  </motion.tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>


          </motion.div>

          {/* Account Detail Modal */}
          <AnimatePresence>
            {selectedAccount && (
                <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
              >
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setSelectedAccount(null)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
                
                {/* Modal */}
                <motion.div
                  className="relative w-full max-w-5xl max-h-[90vh] glass rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="p-6 border-b border-white/10">
                    <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-bold text-white">Account Details</h3>
                      <motion.button
                        onClick={() => setSelectedAccount(null)}
                        className="text-gray-400 hover:text-white transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        ✕
                      </motion.button>
                    </div>
                    </div>

                  {/* Content */}
                  <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {/* Account Info */}
                    <div className="glass p-6 rounded-lg mb-6">
                      <div className="flex items-center gap-4 mb-6">
                        <span className="text-electric-400 font-mono text-xl">{selectedAccount.code}</span>
                        <span className="text-white font-semibold text-xl">{selectedAccount.name}</span>
                        <div className="flex items-center gap-2 ml-auto">
                          <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                            selectedAccount.type === 'ASSET' ? 'bg-blue-500/20 text-blue-300' :
                            selectedAccount.type === 'LIABILITY' ? 'bg-red-500/20 text-red-300' :
                            selectedAccount.type === 'EQUITY' ? 'bg-purple-500/20 text-purple-300' :
                            selectedAccount.type === 'REVENUE' ? 'bg-green-500/20 text-green-300' :
                            'bg-orange-500/20 text-orange-300'
                          }`}>
                            {selectedAccount.type}
                          </span>
                      </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-8">
                        <div className="space-y-3">
                          <h5 className="text-electric-300 font-semibold text-sm uppercase tracking-wide">Account Classification</h5>
                          <div className="space-y-2">
                      <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Account Type</span>
                              <span className="text-white text-sm font-medium">
                                {selectedAccount.type === 'ASSET' ? 'Asset Account' :
                                 selectedAccount.type === 'LIABILITY' ? 'Liability Account' :
                                 selectedAccount.type === 'EQUITY' ? 'Equity Account' :
                                 selectedAccount.type === 'REVENUE' ? 'Revenue Account' :
                                 'Expense Account'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Normal Balance</span>
                              <span className={`text-sm font-medium ${
                                ['ASSET', 'EXPENSE'].includes(selectedAccount.type) ? 'text-blue-400' : 'text-green-400'
                              }`}>
                                {['ASSET', 'EXPENSE'].includes(selectedAccount.type) ? 'Debit' : 'Credit'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Financial Statement</span>
                              <span className="text-white text-sm">
                                {['ASSET', 'LIABILITY', 'EQUITY'].includes(selectedAccount.type) ? 'Balance Sheet' : 'Income Statement'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h5 className="text-electric-300 font-semibold text-sm uppercase tracking-wide">Current Status</h5>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Current Balance</span>
                        <span className={`font-bold text-lg ${
                          selectedAccount.balance >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          ${Math.abs(selectedAccount.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Balance Type</span>
                              <span className={`text-sm font-medium ${
                                selectedAccount.balance >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {selectedAccount.balance >= 0 ? 
                                  (['ASSET', 'EXPENSE'].includes(selectedAccount.type) ? 'Debit Balance' : 'Credit Balance') :
                                  (['ASSET', 'EXPENSE'].includes(selectedAccount.type) ? 'Credit Balance' : 'Debit Balance')
                                }
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Last Updated</span>
                              <span className="text-white text-sm">{new Date().toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h5 className="text-electric-300 font-semibold text-sm uppercase tracking-wide">Account Activity</h5>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Transactions</span>
                              <span className="text-white text-sm font-medium">
                                {getMockTransactions(selectedAccount.code, selectedAccount.name).length} entries
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Period</span>
                              <span className="text-white text-sm">Last 30 days</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Status</span>
                              <span className="text-green-400 text-sm font-medium">Active</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Analysis */}
                    <div className="glass p-4 rounded-lg mb-6 border border-electric-400/30">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">🧠</span>
                        <h4 className="text-electric-300 font-semibold">AI Analysis</h4>
                      </div>
                      <div className="space-y-3">
                        <p className="text-gray-300 text-sm">
                          <TypewriterText text={getAccountAnalysis(selectedAccount).aiInsight} />
                        </p>
                        <div>
                          <h5 className="text-white font-medium text-sm mb-2">AI Suggestions:</h5>
                          <ul className="space-y-1">
                            {getAccountAnalysis(selectedAccount).suggestions.map((suggestion, index) => (
                              <li key={index} className="text-gray-400 text-xs flex items-start gap-2">
                                <span className="text-electric-400 mt-1">•</span>
                                {suggestion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Recent Transactions */}
                    <div className="glass p-4 rounded-lg">
                      <h4 className="text-white font-semibold mb-4">Account Ledger</h4>
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        <div className="grid grid-cols-12 gap-4 px-4 py-3 text-sm font-medium text-gray-400 uppercase border-b border-white/10 bg-white/5 rounded-lg">
                          <div className="col-span-2">Date</div>
                          <div className="col-span-5">Description</div>
                          <div className="col-span-2 text-right">Debit</div>
                          <div className="col-span-2 text-right">Credit</div>
                          <div className="col-span-1 text-right">Balance</div>
                        </div>
                        {(() => {
                          const transactions = getMockTransactions(selectedAccount.code, selectedAccount.name)
                          
                          // Show empty state if no transactions
                          if (transactions.length === 0) {
                            return (
                              <motion.div
                                className="flex flex-col items-center justify-center py-8 text-center"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                              >
                                <div className="text-4xl mb-3">📋</div>
                                <h3 className="text-gray-300 font-medium mb-2">No Transactions Yet</h3>
                                <p className="text-gray-500 text-sm">
                                  Add an expense or import a receipt to see transactions here
                                </p>
                              </motion.div>
                            )
                          }
                          
                          let runningBalance = selectedAccount.balance
                          
                          return transactions.map((transaction, index) => {
                            // Calculate running balance (working backwards since transactions are newest first)
                            const balanceChange = transaction.type === 'credit' ? -transaction.amount : transaction.amount
                            const transactionBalance = runningBalance
                            runningBalance -= balanceChange
                            
                            return (
                          <motion.div
                            key={transaction.id}
                                className="grid grid-cols-12 gap-4 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors border border-white/5"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                          >
                                <div className="col-span-2 text-gray-300 text-sm font-medium">
                                  {new Date(transaction.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                            </div>
                                <div className="col-span-5 text-white text-sm font-medium">
                                  {transaction.description}
                                </div>
                                <div className="col-span-2 text-right text-sm font-bold">
                                  {transaction.type === 'debit' ? (
                                    <span className="text-blue-400">
                                      ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">—</span>
                                  )}
                                </div>
                                <div className="col-span-2 text-right text-sm font-bold">
                                  {transaction.type === 'credit' ? (
                                    <span className="text-green-400">
                                      ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">—</span>
                                  )}
                                </div>
                                <div className="col-span-1 text-right text-sm font-bold text-electric-300">
                                  ${Math.abs(transactionBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                          </motion.div>
                            )
                          })
                        })()}
                      </div>
                      
                      {/* Account Summary Footer */}
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="text-center">
                            <div className="text-gray-400">Total Debits</div>
                            <div className="text-blue-400 font-bold">
                              ${getMockTransactions(selectedAccount.code, selectedAccount.name)
                                .filter(t => t.type === 'debit')
                                .reduce((sum, t) => sum + t.amount, 0)
                                .toFixed(2)}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-400">Total Credits</div>
                            <div className="text-green-400 font-bold">
                              ${getMockTransactions(selectedAccount.code, selectedAccount.name)
                                .filter(t => t.type === 'credit')
                                .reduce((sum, t) => sum + t.amount, 0)
                                .toFixed(2)}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-400">Net Change</div>
                            <div className={`font-bold ${
                              selectedAccount.balance >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              ${Math.abs(
                                getMockTransactions(selectedAccount.code, selectedAccount.name)
                                  .reduce((sum, t) => sum + (t.type === 'debit' ? t.amount : -t.amount), 0)
                              ).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Modal Actions */}
                    <div className="border-t border-white/10 p-6 bg-white/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <motion.button
                            onClick={() => setSelectedAccount(null)}
                            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/60 text-white rounded-lg transition-colors"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            Close
                          </motion.button>
                          <motion.button
                            className="px-4 py-2 bg-electric-600/80 hover:bg-electric-500 text-white rounded-lg transition-colors"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            Edit Account
                          </motion.button>
                        </div>
                        
                        <motion.button
                          onClick={() => handleDeleteAccount(selectedAccount)}
                          className="px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center space-x-2"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <span>🗑️</span>
                          <span>Delete Account</span>
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add Account Modal */}
          <AnimatePresence>
            {showAddAccountModal && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowAddAccountModal(false)}
                >
                  {/* Modal */}
                  <motion.div
                    className="glass p-6 rounded-2xl border border-white/10 w-full max-w-md"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-white">Add New Account</h3>
                      <motion.button
                        onClick={() => setShowAddAccountModal(false)}
                        className="text-gray-400 hover:text-white transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        ✕
                      </motion.button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-gray-300 text-sm font-medium mb-2">Account Name</label>
                        <input
                          type="text"
                          value={newAccountName}
                          onChange={(e) => setNewAccountName(e.target.value)}
                          className="w-full input-glass px-3 py-2 rounded-lg"
                          placeholder="Enter account name..."
                        />
                      </div>

                      <div>
                        <label className="block text-gray-300 text-sm font-medium mb-2">Account Type</label>
                        <div className="relative">
                          <select
                            value={newAccountType}
                            onChange={(e) => setNewAccountType(e.target.value as AccountType)}
                            className="w-full input-glass px-3 py-2 rounded-lg appearance-none cursor-pointer pr-10"
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              backdropFilter: 'blur(10px)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: 'white'
                            }}
                          >
                            <option value="ASSET" style={{ backgroundColor: '#1f2937', color: 'white' }}>Asset</option>
                            <option value="LIABILITY" style={{ backgroundColor: '#1f2937', color: 'white' }}>Liability</option>
                            <option value="EQUITY" style={{ backgroundColor: '#1f2937', color: 'white' }}>Equity</option>
                            <option value="REVENUE" style={{ backgroundColor: '#1f2937', color: 'white' }}>Revenue</option>
                            <option value="EXPENSE" style={{ backgroundColor: '#1f2937', color: 'white' }}>Expense</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* AI Suggestions */}
                      {newAccountName.length > 2 && (
                        <motion.div
                          className="glass p-4 rounded-lg border border-electric-400/30"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            {aiSuggestionLoading ? (
                              <div className="animate-spin w-4 h-4 border-2 border-electric-500 border-t-transparent rounded-full"></div>
                            ) : (
                              <span className="text-lg">🧠</span>
                            )}
                            <h4 className="text-electric-300 font-semibold text-sm">AI Suggestions</h4>
                          </div>
                          
                          {!aiSuggestionLoading && (
                            <div className="space-y-2">
                              {(() => {
                                const suggestions = getAiAccountSuggestions(newAccountName)
                                return (
                                  <div className="text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Account Type:</span>
                                      <span className="text-electric-400 font-medium">{suggestions.type}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Suggested Code:</span>
                                      <span className="text-electric-400 font-mono">{suggestions.code}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-400">Parent Account:</span>
                                      <span className="text-electric-400">{suggestions.parent}</span>
                                    </div>
                                    <div className="flex justify-between mt-2 pt-2 border-t border-white/10">
                                      <span className="text-gray-400">AI Confidence:</span>
                                      <span className="text-green-400 font-medium">{suggestions.confidence}%</span>
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </motion.div>
                      )}

                      <div className="flex gap-3 pt-4">
                        <motion.button
                          onClick={() => setShowAddAccountModal(false)}
                          className="flex-1 btn-glass py-2"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Cancel
                        </motion.button>
                        <motion.button
                          onClick={handleCreateAccount}
                          disabled={!newAccountName.trim()}
                          className={`flex-1 py-2 ${!newAccountName.trim() ? 'btn-glass opacity-50 cursor-not-allowed' : 'btn-electric'}`}
                          whileHover={!newAccountName.trim() ? {} : { scale: 1.02 }}
                          whileTap={!newAccountName.trim() ? {} : { scale: 0.98 }}
                        >
                          Create Account
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Delete Account Confirmation Modal */}
          <AnimatePresence>
            {showDeleteModal && accountToDelete && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowDeleteModal(false)}
                >
                  {/* Modal */}
                  <motion.div
                    className="glass p-6 rounded-2xl border border-red-500/30 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                          <span className="text-2xl">⚠️</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">Delete Account</h3>
                          <p className="text-red-300 text-sm">This action cannot be undone</p>
                        </div>
                      </div>
                      <motion.button
                        onClick={() => setShowDeleteModal(false)}
                        className="text-gray-400 hover:text-white transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        ✕
                      </motion.button>
                    </div>

                    {/* Account Info */}
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="text-electric-400 font-mono text-lg">{accountToDelete.code}</span>
                        <span className="text-white font-semibold text-lg">{accountToDelete.name}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          accountToDelete.type === 'ASSET' ? 'bg-blue-500/20 text-blue-300' :
                          accountToDelete.type === 'LIABILITY' ? 'bg-red-500/20 text-red-300' :
                          accountToDelete.type === 'EQUITY' ? 'bg-purple-500/20 text-purple-300' :
                          accountToDelete.type === 'REVENUE' ? 'bg-green-500/20 text-green-300' :
                          'bg-orange-500/20 text-orange-300'
                        }`}>
                          {accountToDelete.type}
                        </span>
                      </div>
                      <div className="text-gray-300 text-sm">
                        Current Balance: <span className={`font-bold ${
                          accountToDelete.balance >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          ${Math.abs(accountToDelete.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Connection Analysis */}
                    {(() => {
                      const connections = getAccountConnections(accountToDelete)
                      const hasConnections = connections.hasTransactions || connections.hasRecurringTransactions || 
                                           connections.isSystemAccount || connections.relatedAccounts.length > 0

                      return (
                        <div className="space-y-4 mb-6">
                          <h4 className="text-white font-semibold flex items-center">
                            <span className="mr-2">🔍</span>
                            Account Impact Analysis
                          </h4>
                          
                          {/* Warnings */}
                          {hasConnections && (
                            <div className="space-y-3">
                              {connections.hasTransactions && (
                                <motion.div
                                  className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4"
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.1 }}
                                >
                                  <div className="flex items-start space-x-3">
                                    <span className="text-yellow-400 text-lg">⚠️</span>
                                    <div>
                                      <div className="text-yellow-300 font-medium">Transaction History</div>
                                      <div className="text-gray-300 text-sm mt-1">
                                        This account has <strong>{connections.totalTransactions} transaction(s)</strong>
                                        {connections.lastActivity && (
                                          <span> (last activity: {connections.lastActivity.toLocaleDateString()})</span>
                                        )}
                                      </div>
                                      {connections.recentTransactions.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          <div className="text-xs text-gray-400">Recent transactions:</div>
                                          {connections.recentTransactions.map((tx, index) => (
                                            <div key={index} className="text-xs text-gray-300 ml-2">
                                              • {new Date(tx.date).toLocaleDateString()} - {tx.description} (${tx.amount.toFixed(2)})
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}

                              {connections.hasRecurringTransactions && (
                                <motion.div
                                  className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4"
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.2 }}
                                >
                                  <div className="flex items-start space-x-3">
                                    <span className="text-purple-400 text-lg">🔄</span>
                                    <div>
                                      <div className="text-purple-300 font-medium">Recurring Transactions</div>
                                      <div className="text-gray-300 text-sm mt-1">
                                        This account appears to have recurring transactions (subscriptions/rent)
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}

                              {connections.isSystemAccount && (
                                <motion.div
                                  className="bg-red-500/10 border border-red-500/30 rounded-lg p-4"
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.3 }}
                                >
                                  <div className="flex items-start space-x-3">
                                    <span className="text-red-400 text-lg">🚨</span>
                                    <div>
                                      <div className="text-red-300 font-medium">System Account</div>
                                      <div className="text-gray-300 text-sm mt-1">
                                        This is a critical system account. Deleting it may affect core functionality.
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}

                              {connections.relatedAccounts.length > 0 && (
                                <motion.div
                                  className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4"
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.4 }}
                                >
                                  <div className="flex items-start space-x-3">
                                    <span className="text-blue-400 text-lg">🔗</span>
                                    <div>
                                      <div className="text-blue-300 font-medium">Related Accounts</div>
                                      <div className="text-gray-300 text-sm mt-1">
                                        Connected to: {connections.relatedAccounts.join(', ')}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          )}

                          {!hasConnections && (
                            <motion.div
                              className="bg-green-500/10 border border-green-500/30 rounded-lg p-4"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.1 }}
                            >
                              <div className="flex items-start space-x-3">
                                <span className="text-green-400 text-lg">✅</span>
                                <div>
                                  <div className="text-green-300 font-medium">Safe to Delete</div>
                                  <div className="text-gray-300 text-sm mt-1">
                                    This account has no transactions or connections. It can be safely deleted.
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Consequences */}
                    <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
                      <h5 className="text-white font-medium mb-3">What happens when you delete this account:</h5>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li className="flex items-start space-x-2">
                          <span className="text-red-400 mt-0.5">•</span>
                          <span>The account will be permanently removed from your Chart of Accounts</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="text-red-400 mt-0.5">•</span>
                          <span>All transaction history will be preserved but marked as "Deleted Account"</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="text-red-400 mt-0.5">•</span>
                          <span>Financial reports will show historical data but account won't appear in new transactions</span>
                        </li>
                        <li className="flex items-start space-x-2">
                          <span className="text-red-400 mt-0.5">•</span>
                          <span>Any recurring transactions using this account will be paused</span>
                        </li>
                      </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <motion.button
                        onClick={() => setShowDeleteModal(false)}
                        className="px-6 py-2 bg-slate-700/50 hover:bg-slate-600/60 text-white rounded-lg transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Cancel
                      </motion.button>
                      
                      <motion.button
                        onClick={confirmDeleteAccount}
                        className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center space-x-2"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span>🗑️</span>
                        <span>Yes, Delete Account</span>
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )
    }

    return null
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="mb-8"
        transition={{ duration: 0.6, type: "spring" }}
      >
        <h2 className="text-3xl font-bold bg-gradient-to-r from-electric-400 to-purple-400 bg-clip-text text-transparent flex items-center">
          <span className="mr-3 text-3xl">📑</span> Financial Reports
        </h2>
        <p className="text-gray-300 mt-2 text-lg">Interactive financial dashboards with real-time data visualization.</p>
      </motion.div>

      <motion.div 
        className="glass p-2 rounded-2xl mb-8 border border-white/10 inline-flex shadow-xl shadow-electric-500/10"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
      >
        {(['pnl','balance','trial','coa'] as TabKey[]).map((t, index) => (
          <motion.button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 ${
              tab === t 
                ? 'bg-gradient-to-r from-electric-600 to-purple-600 text-white shadow-lg shadow-electric-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
          >
            <span className="mr-2">{t === 'pnl' ? '📈' : t === 'balance' ? '📊' : t === 'trial' ? '🧾' : '📋'}</span>
            {t === 'pnl' ? 'P&L Statement' : t === 'balance' ? 'Balance Sheet' : t === 'trial' ? 'Trial Balance' : 'Chart of Accounts'}
          </motion.button>
        ))}
      </motion.div>

      {renderContent()}
    </div>
  )
} 
