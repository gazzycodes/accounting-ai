import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Expense Account Resolver - Unified Account Resolution Service
 * 
 * Implements precedence logic: USER > CATEGORY_KEY > KEYWORDS > FALLBACK
 * Maps categoryKey enum to seeded account codes with keyword fallbacks
 */
class ExpenseAccountResolver {
  
  /**
   * CategoryKey Enum → Account Code Mapping
   * Maps frontend categoryKey values to seeded account codes from prisma/seed.ts
   */
  static CATEGORY_ACCOUNT_MAPPING = {
    'SOFTWARE': '6030',                    // Software Subscriptions
    'TELECOMMUNICATIONS': '6150',          // Telecommunications  
    'BANK_FEES': '6100',                   // Bank Fees & Processing
    'UTILITIES': '6080',                   // Utilities
    'OFFICE_SUPPLIES': '6020',             // Office Supplies Expense
    'PROFESSIONAL_SERVICES': '6090',       // Professional Services
    'INSURANCE': '6110',                   // Insurance
    'LEGAL_COMPLIANCE': '6120',            // Legal & Compliance
    'TRAINING': '6130',                    // Training & Development
    'RENT': '6070',                        // Rent
    'TRAVEL': '6060',                      // Travel Expense
    'MARKETING': '6040',                   // Marketing Expense
    'COGS': '5010',                        // Cost of Goods Sold
    'MEALS': '6140',                       // Entertainment & Meals
    'GENERAL_EXPENSE': '6999'              // General Expense (fallback)
  };

  /**
   * Keyword Mapping for Vendor Names and Descriptions
   * Used when categoryKey is missing or empty
   */
  static KEYWORD_MAPPINGS = {
    // Software & Technology (6030)
    'SOFTWARE': ['software', 'adobe', 'microsoft', 'google', 'cloud', 'saas', 'app', 'platform', 'digital', 'hosting', 'domain', 'server', 'api', 'slack', 'zoom', 'dropbox', 'notion'],
    
    // Telecommunications (6150) 
    'TELECOMMUNICATIONS': ['phone', 'internet', 'wifi', 'mobile', 'cellular', 'data', 'plan', 'verizon', 'att', 'at&t', 'tmobile', 't-mobile', 'comcast', 'spectrum', 'xfinity', 'fiber', 'telephone'],
    
    // Bank Fees (6100)
    'BANK_FEES': ['bank', 'fee', 'charge', 'service', 'transaction', 'wire', 'transfer', 'overdraft', 'monthly', 'maintenance', 'atm', 'processing', 'merchant', 'paypal', 'stripe'],
    
    // Utilities (6080)
    'UTILITIES': ['utility', 'electric', 'electricity', 'power', 'water', 'sewer', 'garbage', 'waste', 'heating', 'cooling', 'hvac', 'energy'],
    
    // Office Supplies (6020)
    'OFFICE_SUPPLIES': ['office', 'supplies', 'stationery', 'paper', 'printer', 'ink', 'toner', 'desk', 'chair', 'equipment', 'furniture', 'staples', 'depot', 'costco'],
    
    // Professional Services (6090)
    'PROFESSIONAL_SERVICES': ['legal', 'attorney', 'lawyer', 'consulting', 'consultant', 'accountant', 'accounting', 'audit', 'tax', 'bookkeeping', 'financial', 'advisor'],
    
    // Insurance (6110)
    'INSURANCE': ['insurance', 'liability', 'coverage', 'policy', 'premium', 'health', 'dental', 'vision', 'workers', 'compensation', 'general', 'auto', 'vehicle', 'property', 'business'],
    
    // Training & Development (6130)
    'TRAINING': ['training', 'education', 'course', 'workshop', 'seminar', 'certification', 'conference', 'learning', 'development', 'skill', 'udemy', 'coursera', 'pluralsight'],
    
    // Rent (6070)
    'RENT': ['rent', 'lease', 'office', 'space', 'facility', 'building', 'warehouse', 'storage', 'coworking', 'workspace', 'property'],
    
    // Travel (6060)
    'TRAVEL': ['travel', 'flight', 'hotel', 'airfare', 'airline', 'airport', 'uber', 'lyft', 'taxi', 'rental', 'car', 'gas', 'fuel', 'parking', 'toll', 'mileage'],
    
    // Marketing (6040)
    'MARKETING': ['marketing', 'advertising', 'ads', 'promotion', 'facebook', 'linkedin', 'twitter', 'instagram', 'youtube', 'social', 'media', 'campaign', 'seo', 'ppc'],
    
    // Meals & Entertainment (6140)
    'MEALS': ['meal', 'food', 'restaurant', 'lunch', 'dinner', 'breakfast', 'coffee', 'catering', 'starbucks', 'doordash', 'grubhub', 'ubereats', 'entertainment']
  };

  /**
   * Payment Status → Credit Account Mapping
   * Determines where to credit based on payment status  
   */
  static PAYMENT_ACCOUNT_MAPPING = {
    'paid': '1010',        // Cash and Cash Equivalents
    'unpaid': '2010',      // Accounts Payable
    'overpaid': '1010',    // Preview uses cash; posting engine handles overage to 1350
    'partial': '2010'      // Preview shows A/P; posting engine adds cash line
  };

  /**
   * Main resolution method - implements full precedence logic
   * @param {Object} expenseData - Expense data from request
   * @returns {Promise<Object>} - Resolved account mapping with metadata
   */
  static async resolveExpenseAccounts(expenseData) {
    console.log(`🔍 ExpenseAccountResolver.resolveExpenseAccounts() starting for ${expenseData.vendorName}`);
    
    try {
      // Step 1: Resolve debit account using precedence logic
      const debitResolution = await this.resolveDebitAccount(expenseData);
      
      // Step 2: Resolve credit account based on payment status
      const creditResolution = await this.resolveCreditAccount(expenseData.paymentStatus);
      
      // Step 3: Determine posting date and policy
      const datePolicy = this.determineDatePolicy(expenseData);
      
      // Step 4: Validate that all accounts exist in database
      await this.validateAccountsExist([debitResolution.accountCode, creditResolution.accountCode]);
      
      console.log(`✅ Resolution complete: Dr ${debitResolution.accountCode} (${debitResolution.source}), Cr ${creditResolution.accountCode} (${creditResolution.source})`);
      
      return {
        dateUsed: datePolicy.dateUsed,
        policy: datePolicy.policy,
        debit: {
          accountCode: debitResolution.accountCode,
          accountName: debitResolution.accountName,
          amount: expenseData.amount,
          source: debitResolution.source
        },
        credit: {
          accountCode: creditResolution.accountCode,
          accountName: creditResolution.accountName,
          amount: expenseData.amount,
          source: creditResolution.source
        },
        isFallback: debitResolution.source === 'FALLBACK'
      };
      
    } catch (error) {
      console.error('❌ ExpenseAccountResolver error:', error);
      throw error;
    }
  }

  /**
   * Resolves the debit account using precedence logic
   * Order: USER > CATEGORY_KEY > KEYWORDS > FALLBACK
   */
  static async resolveDebitAccount(expenseData) {
    const { categoryKey, vendorName = '', description = '' } = expenseData;
    
    // Step 1: USER selection (explicit categoryKey provided)
    if (categoryKey && categoryKey !== 'OTHER' && categoryKey !== 'GENERAL_EXPENSE') {
      const accountCode = this.CATEGORY_ACCOUNT_MAPPING[categoryKey];
      if (accountCode) {
        const account = await this.getAccountByCode(accountCode);
        if (account) {
          console.log(`👤 USER precedence: ${categoryKey} → ${accountCode}`);
          return {
            accountCode,
            accountName: account.name,
            source: 'USER'
          };
        }
      }
    }
    
    // Step 2: CATEGORY_KEY mapping (AI guess or explicit category)
    if (categoryKey && this.CATEGORY_ACCOUNT_MAPPING[categoryKey]) {
      const accountCode = this.CATEGORY_ACCOUNT_MAPPING[categoryKey];
      const account = await this.getAccountByCode(accountCode);
      if (account) {
        console.log(`🤖 CATEGORY_KEY precedence: ${categoryKey} → ${accountCode}`);
        return {
          accountCode,
          accountName: account.name,
          source: 'CATEGORY_KEY'
        };
      }
    }
    
    // Step 3: KEYWORDS matching (from vendor/description)
    const keywordMatch = this.findKeywordMatch(vendorName, description);
      if (keywordMatch) {
      const account = await this.getAccountByCode(keywordMatch.accountCode);
      if (account) {
        console.log(`🔍 KEYWORDS precedence: "${keywordMatch.keyword}" → ${keywordMatch.accountCode}`);
        return {
          accountCode: keywordMatch.accountCode,
          accountName: account.name,
          source: 'KEYWORDS'
        };
      }
    }
    
    // Step 4: FALLBACK (6999 General Expense)
    console.log(`⚠️ FALLBACK precedence: No specific match found, using 6999 General Expense`);
    const fallbackAccount = await this.getAccountByCode('6999');
    if (!fallbackAccount) {
      throw new Error('Fallback account 6999 (General Expense) not found in Chart of Accounts');
    }
    
    return {
      accountCode: '6999',
      accountName: fallbackAccount.name,
      source: 'FALLBACK'
    };
  }

  /**
   * Resolves the credit account based on payment status
   */
  static async resolveCreditAccount(paymentStatus) {
    const accountCode = this.PAYMENT_ACCOUNT_MAPPING[paymentStatus] || this.PAYMENT_ACCOUNT_MAPPING['unpaid'];
    const account = await this.getAccountByCode(accountCode);
    
    if (!account) {
      throw new Error(`Credit account ${accountCode} not found in Chart of Accounts`);
    }
    
    console.log(`💳 Payment status: ${paymentStatus} → ${accountCode} (${account.name})`);
    
    return {
      accountCode,
      accountName: account.name,
      source: 'PAYMENT_STATUS'
    };
  }

  /**
   * Determines posting date and policy based on payment status and dates
   */
  static determineDatePolicy(expenseData) {
    const { paymentStatus, date, datePaid } = expenseData;
    
    // Cash basis: paid expenses use date paid
    if (paymentStatus === 'paid' && datePaid) {
      return {
        policy: 'CASH',
        dateUsed: datePaid
      };
    }
    
    // Cash basis: paid expenses without datePaid use transaction date
    if (paymentStatus === 'paid') {
      return {
        policy: 'CASH', 
        dateUsed: date
      };
    }
    
    // Accrual basis: unpaid expenses use invoice date
    return {
      policy: 'ACCRUAL_STEP1',
      dateUsed: date
    };
  }

  /**
   * Finds keyword matches in vendor name and description
   */
  static findKeywordMatch(vendorName, description) {
    const searchText = `${vendorName} ${description}`.toLowerCase();
    
    for (const [categoryKey, keywords] of Object.entries(this.KEYWORD_MAPPINGS)) {
      for (const keyword of keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          const accountCode = this.CATEGORY_ACCOUNT_MAPPING[categoryKey];
          if (accountCode) {
            return {
              keyword,
              categoryKey,
              accountCode
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Gets account details by code from database
   */
  static async getAccountByCode(accountCode) {
    try {
      const account = await prisma.account.findUnique({
        where: { code: accountCode },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          normalBalance: true
        }
      });

      if (!account) {
        console.log(`❌ Account not found: ${accountCode}`);
        return null;
      }

      return account;
    } catch (error) {
      console.error(`❌ Database error fetching account ${accountCode}:`, error);
      return null;
    }
  }

  /**
   * Validates that required accounts exist in the database
   */
  static async validateAccountsExist(accountCodes) {
    try {
      const accounts = await prisma.account.findMany({
        where: {
          code: { in: accountCodes }
        },
        select: {
          code: true,
          name: true
        }
      });

      const foundCodes = accounts.map(acc => acc.code);
      const missingCodes = accountCodes.filter(code => !foundCodes.includes(code));

      if (missingCodes.length > 0) {
        throw new Error(`Required accounts not found in Chart of Accounts: ${missingCodes.join(', ')}`);
      }

      console.log(`✅ All required accounts exist: ${foundCodes.join(', ')}`);
      return true;
    } catch (error) {
      console.error('❌ Account validation error:', error);
      throw error;
    }
  }

  /**
   * Get all available category mappings for frontend
   */
  static getAvailableCategories() {
    return Object.keys(this.CATEGORY_ACCOUNT_MAPPING).map(key => ({
      key,
      accountCode: this.CATEGORY_ACCOUNT_MAPPING[key],
      displayName: key.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ')
    }));
  }
}

export { ExpenseAccountResolver };