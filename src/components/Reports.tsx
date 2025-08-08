import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import axios from 'axios'
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
  totals: { assets: number; liabilities: number; equity: number; liabilitiesAndEquity: number }
}

interface PnlItem { name: string; amount: number }
interface PnlData {
  period: { start: string; end: string }
  revenue: PnlItem[]
  expenses: PnlItem[]
  totals: { revenue: number; expenses: number; grossProfit: number; netProfit: number }
}

interface TrialRow { account: string; debit: number; credit: number }
interface TrialData { asOf: string; rows: TrialRow[]; totals: { debit: number; credit: number } }

type NameAmountRow = { name: string; amount: number }

type TabKey = 'pnl' | 'balance' | 'trial'

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

// Enhanced Trial Balance Table Component
function SimpleTrialTable({ data }: { data: TrialData | undefined }) {
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
                      key={row.account}
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
                          {row.debit ? formatCurrency(row.debit) : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right min-h-[60px]">
                        <span className={`transition-all duration-300 font-semibold ${isHighlighted ? 'text-electric-300' : 'text-white'}`}>
                          {row.credit ? formatCurrency(row.credit) : '-'}
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
        <div className="bg-transparent backdrop-blur-md px-6 py-5 border-t border-white/10">
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-left">
              <span className="text-white font-bold text-lg uppercase tracking-wide">Totals</span>
            </div>
            <div className="text-right">
              <motion.span 
                className="text-white font-bold text-xl"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: filteredRows.length * 0.03 + 0.5, type: "spring" }}
              >
                {formatCurrency(data.totals.debit)}
              </motion.span>
            </div>
            <div className="text-right">
              <motion.span 
                className="text-white font-bold text-xl"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: filteredRows.length * 0.03 + 0.6, type: "spring" }}
              >
                {formatCurrency(data.totals.credit)}
              </motion.span>
            </div>
          </div>
          
          <motion.div
            className="mt-4 pt-3 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: filteredRows.length * 0.03 + 0.8 }}
          >
            {data.totals.debit === data.totals.credit ? (
              <span className="text-green-400 text-sm font-bold flex items-center justify-center gap-2 uppercase tracking-wide">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Trial Balance is Balanced
              </span>
            ) : (
              <span className="text-red-400 text-sm font-bold flex items-center justify-center gap-2 uppercase tracking-wide">
                <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                Trial Balance is Unbalanced
              </span>
            )}
          </motion.div>
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

export default function Reports() {
  const [tab, setTab] = useState<TabKey>('pnl')

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
    queryKey: ['reports', 'balance-sheet'],
    queryFn: async () => (await axios.get('/api/reports/balance-sheet')).data,
    enabled: tab === 'balance',
  })

  const pnlQuery = useQuery<PnlData>({
    queryKey: ['reports', 'pnl'],
    queryFn: async () => (await axios.get('/api/reports/pnl')).data,
    enabled: tab === 'pnl',
  })

  const trialQuery = useQuery<TrialData>({
    queryKey: ['reports', 'trial-balance'],
    queryFn: async () => (await axios.get('/api/reports/trial-balance')).data,
    enabled: tab === 'trial',
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

  const renderContent = () => {
    if (tab === 'pnl') {
      const d = pnlQuery.data
      return (
        <motion.div 
          className="card-glass rounded-2xl border border-white/10 shadow-2xl shadow-electric-500/10" 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: "spring" }}
        >
          {/* Header Section */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
            <h3 className="text-white text-2xl font-bold flex items-center">
              <span className="mr-3 text-2xl">📈</span> Profit & Loss Statement
            </h3>
            <div className="flex flex-col items-end gap-3">
              <div className="text-electric-400 font-semibold text-sm">
                {getPeriodDisplayText()}
              </div>
              <div className="flex items-center gap-4">
                <AccountingPeriodPicker onPeriodChange={handlePeriodChange} />
              </div>
            </div>
          </div>

          {/* AI Insights Panel */}
          <AIInsightsPanel 
            insight="Revenue growth slowed 12% vs last quarter. Consider reviewing marketing spend."
            delay={500}
          />

          {/* Data Tables Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div>
              <div className="mb-6">
                <h4 className="text-white font-bold text-xl mb-4 flex items-center">
                  <span className="mr-2">💰</span> Revenue Streams
                </h4>
                <Toolbar label="Income sources and revenue streams">
                  <SearchInput value={revFilter} onChange={setRevFilter} placeholder="Search revenue streams..." />
                </Toolbar>
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

            <div>
              <div className="mb-6">
                <h4 className="text-white font-bold text-xl mb-4 flex items-center">
                  <span className="mr-2">💸</span> Operating Expenses
                </h4>
                <Toolbar label="Business costs and operational expenses">
                  <SearchInput value={expFilter} onChange={setExpFilter} placeholder="Search expenses..." />
                </Toolbar>
              </div>
              <TableGlass
                table={expenseTable.table as any}
                rowKey={(row) => 'exp-' + (row as NameAmountRow).name}
                footer={d && (
                  <>
                    <span className="text-electric-400 font-semibold">Total Expenses</span>
                    <span className="text-red-400 font-bold text-lg">{formatCurrency(d.totals.expenses)}</span>
                  </>
                )}
              />
            </div>
          </div>

          {/* Key Metrics Section */}
          {pnlQuery.data && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl">
                <div className="text-white font-semibold text-lg">Gross Profit</div>
                <div className="text-cyan-400 font-bold text-2xl">{formatCurrency(pnlQuery.data.totals.grossProfit)}</div>
              </div>
              <div className="flex items-center justify-between p-6 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl">
                <div className="text-white font-semibold text-lg">Net Profit</div>
                <div className="text-emerald-400 font-bold text-2xl">{formatCurrency(pnlQuery.data.totals.netProfit)}</div>
              </div>
            </div>
          )}
        </motion.div>
      )
    }

    if (tab === 'balance') {
      const d = balanceQuery.data
      return (
        <motion.div 
          className="card-glass rounded-2xl border border-white/10 shadow-2xl shadow-electric-500/10" 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: "spring" }}
        >
          {/* Header Section */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
            <h3 className="text-white text-2xl font-bold flex items-center">
              <span className="mr-3 text-2xl">📊</span> Balance Sheet
            </h3>
            <div className="flex flex-col items-end gap-3">
              <div className="text-electric-400 font-semibold text-sm">
                As of {getPeriodDisplayText()}
              </div>
              <AccountingPeriodPicker onPeriodChange={handlePeriodChange} />
            </div>
          </div>

          {/* AI Insights Panel */}
          <AIInsightsPanel 
            insight="Cash position is strong. Consider investing excess cash."
            delay={500}
          />

          {/* Data Tables Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="mb-6">
                <h4 className="text-white font-bold text-xl mb-4 flex items-center">
                  <span className="mr-2">🏦</span> Assets
                </h4>
                <Toolbar label="Resources owned by the company">
                  <SearchInput value={assetFilter} onChange={setAssetFilter} placeholder="Search assets..." />
                </Toolbar>
              </div>
              <TableGlass
                table={assetsTable.table as any}
                rowKey={(row) => 'asset-' + (row as NameAmountRow).name}
                footer={d && (
                  <>
                    <span className="text-electric-400 font-semibold">Total Assets</span>
                    <span className="text-green-400 font-bold text-lg">{formatCurrency(d.totals.assets)}</span>
                  </>
                )}
              />
            </div>

            <div>
              <div className="mb-6">
                <h4 className="text-white font-bold text-xl mb-4 flex items-center">
                  <span className="mr-2">📋</span> Liabilities
                </h4>
                <Toolbar label="Debts and obligations owed">
                  <SearchInput value={liabFilter} onChange={setLiabFilter} placeholder="Search liabilities..." />
                </Toolbar>
              </div>
              <TableGlass
                table={liabilitiesTable.table as any}
                rowKey={(row) => 'liab-' + (row as NameAmountRow).name}
                footer={d && (
                  <>
                    <span className="text-electric-400 font-semibold">Total Liabilities</span>
                    <span className="text-red-400 font-bold text-lg">{formatCurrency(d.totals.liabilities)}</span>
                  </>
                )}
              />
            </div>

            <div>
              <div className="mb-6">
                <h4 className="text-white font-bold text-xl mb-4 flex items-center">
                  <span className="mr-2">💎</span> Equity
                </h4>
                <Toolbar label="Owner's stake and retained earnings">
                  <SearchInput value={eqFilter} onChange={setEqFilter} placeholder="Search equity..." />
                </Toolbar>
              </div>
              <TableGlass
                table={equityTable.table as any}
                rowKey={(row) => 'equity-' + (row as NameAmountRow).name}
                footer={d && (
                  <>
                    <span className="text-electric-400 font-semibold">Total Equity</span>
                    <span className="text-blue-400 font-bold text-lg">{formatCurrency(d.totals.equity)}</span>
                  </>
                )}
              />
            </div>
          </div>
        </motion.div>
      )
    }

    if (tab === 'trial') {
      return (
        <motion.div 
          className="card-glass rounded-2xl border border-white/10 shadow-2xl shadow-electric-500/10" 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: "spring" }}
        >
          {/* Header Section */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
            <h3 className="text-white text-2xl font-bold flex items-center">
              <span className="mr-3 text-2xl">🧾</span> Trial Balance
            </h3>
            <div className="flex flex-col items-end gap-3">
              <div className="text-electric-400 font-semibold text-sm">
                As of {getPeriodDisplayText()}
              </div>
              <AccountingPeriodPicker onPeriodChange={handlePeriodChange} />
            </div>
          </div>
          
          <div className="mb-3">
            <p className="text-gray-300 text-sm leading-relaxed">
              Comprehensive view of all account balances with debits and credits. 
              <span className="text-electric-400 font-medium"> Totals must balance for accurate financial reporting.</span>
            </p>
          </div>

          {/* AI Insights Panel */}
          <AIInsightsPanel 
            insight="3 accounts have unusual balances. Review recommended."
            delay={500}
          />

          {/* Trial Balance Table with integrated toolbar */}
          <div className="space-y-4">
            <Toolbar label="All general ledger accounts and balances">
              <SearchInput 
                value={trialFilter} 
                onChange={setTrialFilter} 
                placeholder="Search trial balance accounts..." 
              />
            </Toolbar>

            <motion.div 
              className="glass rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-electric-500/10 relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, type: "spring" }}
            >
              <div className="max-h-[500px] overflow-y-auto scrollbar-electric">
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
                      {trialRows.map((row, i) => {
                        return (
                          <motion.tr
                            key={row.account}
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
                            className="hover:bg-gradient-to-r hover:from-electric-500/10 hover:to-transparent transition-all duration-300 hover:shadow-lg hover:shadow-electric-500/20"
                            whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
                          >
                            <td className="px-6 py-4 min-h-[60px]">
                              <span className="text-gray-300 font-medium">
                                {row.account}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right min-h-[60px]">
                              <span className="text-white font-semibold">
                                {row.debit ? formatCurrency(row.debit) : '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right min-h-[60px]">
                              <span className="text-white font-semibold">
                                {row.credit ? formatCurrency(row.credit) : '-'}
                              </span>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
              
              {/* Professional Totals Footer */}
              <div className="bg-gradient-to-r from-electric-600/20 to-electric-700/20 backdrop-blur-md border-t border-white/10 px-6 py-4">
                <div className="grid grid-cols-3 gap-4 items-center mb-3">
                  <div className="text-left">
                    <span className="text-white font-semibold text-sm uppercase tracking-wide">Totals</span>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold text-lg">
                      {formatCurrency(trialQuery.data?.totals.debit || 0)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold text-lg">
                      {formatCurrency(trialQuery.data?.totals.credit || 0)}
                    </div>
                  </div>
                </div>
                
                <div className="text-center pt-2 border-t border-white/10">
                  {trialQuery.data?.totals.debit === trialQuery.data?.totals.credit ? (
                    <span className="text-green-400 text-sm font-medium flex items-center justify-center gap-2">
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      Trial Balance is Balanced
                    </span>
                  ) : (
                    <span className="text-red-400 text-sm font-medium flex items-center justify-center gap-2">
                      <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                      Trial Balance is Unbalanced
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Search Results Info */}
            <AnimatePresence>
              {trialFilter && (
                <motion.div
                  className="text-center text-electric-400 text-sm font-medium"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  Showing {trialRows.length} of {trialQuery.data?.rows.length || 0} accounts
                  {trialRows.length === 0 && ' - try a different search term'}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
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
        {(['pnl','balance','trial'] as TabKey[]).map((t, index) => (
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
            <span className="mr-2">{t === 'pnl' ? '📈' : t === 'balance' ? '📊' : '🧾'}</span>
            {t === 'pnl' ? 'P&L Statement' : t === 'balance' ? 'Balance Sheet' : 'Trial Balance'}
          </motion.button>
        ))}
      </motion.div>

      {renderContent()}
    </div>
  )
} 