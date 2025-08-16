import { PrismaClient, AccountType, NormalBalance } from '@prisma/client'

const prisma = new PrismaClient()

// Chart of Accounts - 37 Essential Business Accounts
// Based on INITIAL_ACCOUNTS from mockDataStore.ts
const CHART_OF_ACCOUNTS = [
  // ASSETS
  { code: '1010', name: 'Cash and Cash Equivalents', type: 'ASSET' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '1200', name: 'Accounts Receivable', type: 'ASSET' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '1250', name: 'Customer Deposits', type: 'ASSET' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '1300', name: 'Inventory', type: 'ASSET' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '1350', name: 'Deposits & Advances', type: 'ASSET' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '1400', name: 'Prepaid Expenses', type: 'ASSET' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '1500', name: 'Supplies Inventory', type: 'ASSET' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '1600', name: 'Property & Equipment (net)', type: 'ASSET' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '1700', name: 'Intangible Assets', type: 'ASSET' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  
  // LIABILITIES
  { code: '2010', name: 'Accounts Payable', type: 'LIABILITY' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  { code: '2050', name: 'Customer Credits Payable', type: 'LIABILITY' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  { code: '2100', name: 'Accrued Expenses', type: 'LIABILITY' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  { code: '2150', name: 'Sales Tax Payable', type: 'LIABILITY' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  { code: '2200', name: 'Credit Card Payable', type: 'LIABILITY' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  { code: '2250', name: 'Payroll Liabilities', type: 'LIABILITY' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  { code: '2300', name: 'Short-term Loan', type: 'LIABILITY' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  { code: '2350', name: 'Unearned Revenue', type: 'LIABILITY' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  { code: '2400', name: 'Deferred Revenue', type: 'LIABILITY' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  
  // EQUITY
  { code: '3000', name: "Owner's Equity", type: 'EQUITY' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  { code: '3200', name: 'Retained Earnings', type: 'EQUITY' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  
  // REVENUE
  { code: '4010', name: 'Product Sales', type: 'REVENUE' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  { code: '4020', name: 'Services Revenue', type: 'REVENUE' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  { code: '4030', name: 'Marketing Services Revenue', type: 'REVENUE' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  { code: '4040', name: 'Support & Training Revenue', type: 'REVENUE' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  { code: '4900', name: 'Other Income', type: 'REVENUE' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  { code: '4910', name: 'Sales Discounts', type: 'REVENUE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '4950', name: 'Payment Processing Income', type: 'REVENUE' as AccountType, normalBalance: 'CREDIT' as NormalBalance },
  
  // EXPENSES
  { code: '5010', name: 'Cost of Goods Sold', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6010', name: 'Salaries & Wages', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6020', name: 'Office Supplies Expense', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6030', name: 'Software Subscriptions', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6040', name: 'Marketing Expense', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6050', name: 'Subscriptions Expense', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6060', name: 'Travel Expense', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6070', name: 'Rent', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6080', name: 'Utilities', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6090', name: 'Professional Services', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6100', name: 'Bank Fees & Processing', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6110', name: 'Insurance', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6120', name: 'Legal & Compliance', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6130', name: 'Training & Development', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6140', name: 'Entertainment & Meals', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6150', name: 'Telecommunications', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6160', name: 'Depreciation', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6170', name: 'Bad Debt', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
  { code: '6999', name: 'General Expense', type: 'EXPENSE' as AccountType, normalBalance: 'DEBIT' as NormalBalance },
]

async function main() {
  console.log('🌱 Seeding Chart of Accounts...')
  
  let created = 0
  let updated = 0
  
  for (const account of CHART_OF_ACCOUNTS) {
    const result = await prisma.account.upsert({
      where: { code: account.code },
      update: {
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
        isActive: true
      },
      create: {
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
        isActive: true
      }
    })
    
    // Check if this was a creation or update
    const existing = await prisma.account.findFirst({
      where: { 
        code: account.code,
        createdAt: { lt: new Date(Date.now() - 1000) } // Created more than 1 second ago
      }
    })
    
    if (existing) {
      updated++
      console.log(`✅ Updated: ${account.code} - ${account.name}`)
    } else {
      created++
      console.log(`🆕 Created: ${account.code} - ${account.name}`)
    }
  }
  
  console.log(`\n📊 Seeding Complete:`)
  console.log(`   🆕 Created: ${created} accounts`)
  console.log(`   ✅ Updated: ${updated} accounts`)
  console.log(`   📋 Total: ${CHART_OF_ACCOUNTS.length} accounts in Chart of Accounts`)
  
  // Verify the seed worked
  const totalAccounts = await prisma.account.count()
  // Seed Customers (if none exist)
  const customerCount = await prisma.customer.count()
  if (customerCount === 0) {
    console.log('\n📇 Seeding sample customers...')
    
    const sampleCustomers = [
      {
        name: 'John Smith',
        company: 'TechCorp Solutions',
        email: 'john@techcorp.com',
        phone: '+1 (555) 123-4567',
        address: '123 Business Ave',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94105',
        country: 'US'
      },
      {
        name: 'Sarah Johnson',
        company: 'Startup Inc.',
        email: 'sarah@startupinc.com',
        phone: '+1 (555) 987-6543',
        address: '456 Innovation Blvd',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        country: 'US'
      },
      {
        name: 'Mike Chen',
        company: 'Design Studio Pro',
        email: 'mike@designstudio.com',
        phone: '+1 (555) 456-7890',
        address: '789 Creative St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US'
      }
    ]

    for (const customerData of sampleCustomers) {
      await prisma.customer.create({
        data: customerData
      })
    }

    const finalCustomerCount = await prisma.customer.count()
    console.log(`✅ Seeded ${finalCustomerCount} sample customers`)
  } else {
    console.log(`\n📇 Found ${customerCount} existing customers, skipping customer seeding`)
  }

  console.log(`\n🔍 Verification: ${totalAccounts} accounts in database`)
  
  if (totalAccounts === CHART_OF_ACCOUNTS.length) {
    console.log('✅ Seed verification successful!')
  } else {
    console.log('⚠️ Seed verification failed - account count mismatch')
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
