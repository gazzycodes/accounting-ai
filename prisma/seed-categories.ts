import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Initial categories to seed (converted from the old enum)
const INITIAL_CATEGORIES = [
  { name: 'Office Supplies', key: 'OFFICE_SUPPLIES', accountCode: '6020', description: 'General office supplies and materials' },
  { name: 'Software & Subscriptions', key: 'SOFTWARE', accountCode: '6030', description: 'Software licenses and subscription services' },
  { name: 'Travel Expenses', key: 'TRAVEL', accountCode: '6060', description: 'Business travel costs including flights, hotels, and ground transportation' },
  { name: 'Meals & Entertainment', key: 'MEALS', accountCode: '6140', description: 'Business meals and client entertainment expenses' },
  { name: 'Utilities', key: 'UTILITIES', accountCode: '6080', description: 'Electricity, gas, water, and other utility services' },
  { name: 'Rent & Facilities', key: 'RENT', accountCode: '6070', description: 'Office rent and facility-related expenses' },
  { name: 'Professional Services', key: 'PROFESSIONAL_SERVICES', accountCode: '6090', description: 'Legal, consulting, and other professional service fees' },
  { name: 'Marketing & Advertising', key: 'MARKETING', accountCode: '6040', description: 'Marketing campaigns, advertising, and promotional expenses' },
  { name: 'Equipment & Hardware', key: 'EQUIPMENT', accountCode: '6999', description: 'Computer equipment, furniture, and other business hardware' },
  { name: 'Insurance', key: 'INSURANCE', accountCode: '6110', description: 'Business insurance premiums and coverage' },
  { name: 'Legal Fees', key: 'LEGAL', accountCode: '6090', description: 'Legal services and attorney fees' },
  { name: 'Training & Development', key: 'TRAINING', accountCode: '6120', description: 'Employee training, courses, and professional development' },
  { name: 'Entertainment', key: 'ENTERTAINMENT', accountCode: '6140', description: 'Client entertainment and business social events' },
  { name: 'Telecommunications', key: 'TELECOMMUNICATIONS', accountCode: '6100', description: 'Phone, internet, and communication services' },
  { name: 'Phone Services', key: 'PHONE', accountCode: '6100', description: 'Mobile and landline phone services' },
  { name: 'Internet Services', key: 'INTERNET', accountCode: '6100', description: 'Internet connectivity and web services' },
  { name: 'Bank Fees', key: 'BANK_FEES', accountCode: '6130', description: 'Banking fees, transaction charges, and financial service costs' },
  { name: 'Salaries & Wages', key: 'SALARIES', accountCode: '6010', description: 'Employee salaries, wages, and payroll expenses' },
  { name: 'Subscriptions', key: 'SUBSCRIPTIONS', accountCode: '6030', description: 'Recurring subscription services and memberships' },
  { name: 'Supplies', key: 'SUPPLIES', accountCode: '6020', description: 'General business supplies and consumables' },
  { name: 'Inventory', key: 'INVENTORY', accountCode: '6999', description: 'Inventory purchases and stock items' },
  { name: 'Deposits', key: 'DEPOSITS', accountCode: '6999', description: 'Security deposits and advance payments' },
  { name: 'Other Business Expense', key: 'OTHER', accountCode: '6999', description: 'Miscellaneous business expenses not covered by other categories' }
]

async function seedCategories() {
  console.log('🌱 Seeding initial categories...')
  
  try {
    // Check if categories already exist
    const existingCount = await prisma.category.count()
    if (existingCount > 0) {
      console.log(`✅ Categories already seeded (${existingCount} found)`)
      return
    }

    // Create all initial categories one by one (to handle uniqueness)
    let createdCount = 0
    for (const category of INITIAL_CATEGORIES) {
      try {
        await prisma.category.create({
          data: {
            ...category,
            aiGenerated: false,
            isApproved: true, // Pre-approved standard categories
            usageCount: 0
          }
        })
        createdCount++
      } catch (error) {
        console.log(`⚠️  Category ${category.name} already exists, skipping...`)
      }
    }

    console.log(`✅ Seeded ${createdCount} initial categories`)
    
    // Display seeded categories
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    })
    
    console.log('\n📋 Seeded Categories:')
    categories.forEach(cat => {
      console.log(`  ${cat.name} (${cat.key}) → Account ${cat.accountCode}`)
    })
    
  } catch (error) {
    console.error('❌ Error seeding categories:', error)
    throw error
  }
}

async function main() {
  await seedCategories()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
