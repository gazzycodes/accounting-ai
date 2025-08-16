import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

/**
 * AI-Powered Category Management Service
 * 
 * Handles dynamic category creation with AI suggestions and human approval
 */
class AICategoryService {
  
  /**
   * Comprehensive US Business Expense Category Mappings
   * Covers most common business expense types used in USA
   */
  static DEFAULT_ACCOUNT_MAPPINGS = {
    // Technology & Software (6030)
    'software': '6030', 'subscription': '6030', 'cloud': '6030', 'saas': '6030',
    'app': '6030', 'platform': '6030', 'digital': '6030', 'tech': '6030',
    'hosting': '6030', 'domain': '6030', 'server': '6030', 'api': '6030',
    'adobe': '6030', 'microsoft': '6030', 'google': '6030', 'amazon': '6030',
    'slack': '6030', 'zoom': '6030', 'dropbox': '6030', 'notion': '6030',
    
    // Office Supplies & Equipment (6020)
    'office': '6020', 'supplies': '6020', 'stationery': '6020', 'paper': '6020',
    'printer': '6020', 'ink': '6020', 'toner': '6020', 'desk': '6020',
    'chair': '6020', 'equipment': '6020', 'furniture': '6020', 'staples': '6020',
    'depot': '6020', 'costco': '6020', 'walmart': '6020', 'target': '6020',
    
    // Travel & Transportation (6060)
    'travel': '6060', 'flight': '6060', 'hotel': '6060', 'airfare': '6060',
    'airline': '6060', 'airport': '6060', 'uber': '6060', 'lyft': '6060',
    'taxi': '6060', 'rental': '6060', 'car': '6060', 'gas': '6060',
    'fuel': '6060', 'parking': '6060', 'toll': '6060', 'mileage': '6060',
    'conference': '6060', 'summit': '6060', 'expo': '6060', 'booking': '6060',
    
    // Meals & Entertainment (6140)
    'meal': '6140', 'food': '6140', 'restaurant': '6140', 'lunch': '6140',
    'dinner': '6140', 'breakfast': '6140', 'coffee': '6140', 'catering': '6140',
    'starbucks': '6140', 'doordash': '6140', 'grubhub': '6140', 'ubereats': '6140',
    'entertainment': '6140', 'client': '6140', 'business': '6140', 'meeting': '6140',
    
    // Utilities (6080)
    'utility': '6080', 'electric': '6080', 'electricity': '6080', 'power': '6080',
    'water': '6080', 'sewer': '6080', 'garbage': '6080', 'waste': '6080',
    'heating': '6080', 'cooling': '6080', 'hvac': '6080', 'energy': '6080',
    
    // Telecommunications (6100)
    'internet': '6100', 'phone': '6100', 'mobile': '6100', 'cellular': '6100',
    'wifi': '6100', 'broadband': '6100', 'data': '6100', 'plan': '6100',
    'verizon': '6100', 'att': '6100', 'tmobile': '6100', 'comcast': '6100',
    'spectrum': '6100', 'xfinity': '6100', 'fiber': '6100', 'telephone': '6100',
    
    // Rent & Facilities (6070)
    'rent': '6070', 'lease': '6070', 'office': '6070', 'space': '6070',
    'facility': '6070', 'building': '6070', 'warehouse': '6070', 'storage': '6070',
    'coworking': '6070', 'workspace': '6070', 'property': '6070', 'real': '6070',
    
    // Marketing & Advertising (6040)
    'marketing': '6040', 'advertising': '6040', 'ads': '6040', 'promotion': '6040',
    'facebook': '6040', 'google': '6040', 'linkedin': '6040', 'twitter': '6040',
    'instagram': '6040', 'youtube': '6040', 'social': '6040', 'media': '6040',
    'campaign': '6040', 'seo': '6040', 'ppc': '6040', 'content': '6040',
    'brand': '6040', 'design': '6040', 'graphic': '6040', 'website': '6040',
    
    // Professional Services (6090)
    'legal': '6090', 'attorney': '6090', 'lawyer': '6090', 'consulting': '6090',
    'consultant': '6090', 'accountant': '6090', 'accounting': '6090', 'audit': '6090',
    'tax': '6090', 'bookkeeping': '6090', 'financial': '6090', 'advisor': '6090',
    'coaching': '6090', 'mentor': '6090', 'expert': '6090', 'specialist': '6090',
    
    // Insurance (6110)
    'insurance': '6110', 'liability': '6110', 'coverage': '6110', 'policy': '6110',
    'premium': '6110', 'health': '6110', 'dental': '6110', 'vision': '6110',
    'workers': '6110', 'compensation': '6110', 'general': '6110', 'auto': '6110',
    'vehicle': '6110', 'property': '6110', 'business': '6110', 'commercial': '6110',
    
    // Training & Development (6120)
    'training': '6120', 'education': '6120', 'course': '6120', 'workshop': '6120',
    'seminar': '6120', 'certification': '6120', 'conference': '6120', 'learning': '6120',
    'development': '6120', 'skill': '6120', 'udemy': '6120', 'coursera': '6120',
    'pluralsight': '6120', 'linkedin': '6120', 'masterclass': '6120', 'book': '6120',
    
    // Bank Fees & Financial (6130)
    'bank': '6130', 'fee': '6130', 'charge': '6130', 'service': '6130',
    'transaction': '6130', 'wire': '6130', 'transfer': '6130', 'overdraft': '6130',
    'monthly': '6130', 'maintenance': '6130', 'atm': '6130', 'credit': '6130',
    'processing': '6130', 'merchant': '6130', 'paypal': '6130', 'stripe': '6130',
    
    // Payroll & Employee (6010)
    'salary': '6010', 'wage': '6010', 'payroll': '6010', 'employee': '6010',
    'contractor': '6010', 'freelancer': '6010', 'staff': '6010', 'benefits': '6010',
    'bonus': '6010', 'commission': '6010', 'overtime': '6010', 'holiday': '6010',
    
    // Repairs & Maintenance (6150)
    'repair': '6150', 'maintenance': '6150', 'fix': '6150', 'service': '6150',
    'cleaning': '6150', 'janitorial': '6150', 'hvac': '6150', 'plumbing': '6150',
    'electrical': '6150', 'landscaping': '6150', 'snow': '6150', 'pest': '6150',
    
    // Shipping & Delivery (6160)
    'shipping': '6160', 'postage': '6160', 'delivery': '6160', 'freight': '6160',
    'fedex': '6160', 'ups': '6160', 'usps': '6160', 'dhl': '6160',
    'mail': '6160', 'package': '6160', 'courier': '6160', 'express': '6160',
    
    // Taxes & Licenses (6170)
    'tax': '6170', 'taxes': '6170', 'license': '6170', 'permit': '6170',
    'registration': '6170', 'filing': '6170', 'compliance': '6170', 'regulatory': '6170',
    'state': '6170', 'federal': '6170', 'local': '6170', 'city': '6170',
    
    // Healthcare & Medical (6180)
    'medical': '6180', 'healthcare': '6180', 'doctor': '6180', 'clinic': '6180',
    'hospital': '6180', 'pharmacy': '6180', 'medicine': '6180', 'prescription': '6180',
    'wellness': '6180', 'fitness': '6180', 'gym': '6180', 'massage': '6180',
    
    // Security & Safety (6190)
    'security': '6190', 'alarm': '6190', 'camera': '6190', 'monitoring': '6190',
    'guard': '6190', 'safety': '6190', 'protection': '6190', 'surveillance': '6190',
    'fire': '6190', 'extinguisher': '6190', 'first': '6190', 'aid': '6190'
  };

  /**
   * Finds existing category or suggests a new one
   * @param {string} expenseDescription - The expense description to categorize
   * @param {string} vendorName - The vendor name for context
   * @returns {Promise<Object>} - Category match or AI suggestion
   */
  static async findOrSuggestCategory(expenseDescription, vendorName) {
    console.log(`🤖 AI Category Analysis: "${expenseDescription}" from "${vendorName}"`);
    
    try {
      // Step 1: Try to find existing approved category
      const existingMatch = await this.findBestExistingCategory(expenseDescription, vendorName);
      if (existingMatch) {
        console.log(`✅ Found existing category: ${existingMatch.name} (confidence: ${existingMatch.confidence})`);
        return {
          type: 'EXISTING',
          category: existingMatch,
          needsApproval: false
        };
      }

      // Step 2: Try simple keyword mapping first
      const keywordMatch = this.findKeywordMatch(expenseDescription, vendorName);
      if (keywordMatch) {
        console.log(`🎯 Keyword match found: ${keywordMatch.name} (${keywordMatch.accountCode})`);
        return {
          type: 'KEYWORD_MATCH',
          category: keywordMatch,
          needsApproval: false
        };
      }

      // Step 3: Generate AI suggestion for new category
      console.log(`🤖 Generating AI suggestion for: "${expenseDescription}"`);
      const aiSuggestion = await this.generateCategorySuggestion(expenseDescription, vendorName);
      
      return {
        type: 'NEW_SUGGESTION',
        suggestion: aiSuggestion,
        needsApproval: true
      };

    } catch (error) {
      console.error('❌ AI Category Service error:', error);
      
      // Fallback to OTHER category
      return {
        type: 'FALLBACK',
        category: await this.getFallbackCategory(),
        needsApproval: false
      };
    }
  }

  /**
   * Simple keyword matching for immediate category assignment
   */
  static findKeywordMatch(expenseDescription, vendorName) {
    const text = `${expenseDescription} ${vendorName}`.toLowerCase();
    
    // Find best account code based on keywords
    for (const [keyword, accountCode] of Object.entries(this.DEFAULT_ACCOUNT_MAPPINGS)) {
      if (text.includes(keyword)) {
        const categoryName = this.getAccountCategoryName(accountCode);
        const key = keyword.toUpperCase() + '_EXPENSE';
        
        return {
          id: null, // ✅ Don't use fake IDs for keyword matches
          name: categoryName,
          key: key,
          accountCode: accountCode,
          account: { code: accountCode },
          confidence: 0.8,
          reasoning: `Keyword match for "${keyword}" in expense text`,
          isKeywordMatch: true // Flag to indicate this is not a database category
        };
      }
    }
    
    return null;
  }

  /**
   * Attempts to match expense to existing approved categories
   */
  static async findBestExistingCategory(expenseDescription, vendorName) {
    const approvedCategories = await prisma.category.findMany({
      where: { isApproved: true },
      include: { account: true }
    });

    if (approvedCategories.length === 0) {
      return null;
    }

    // Use AI to find best match among existing categories
    const categoryNames = approvedCategories.map(cat => cat.name).join(', ');
    
    const prompt = `
      Match this expense to the BEST existing category, or return "NO_MATCH" if none fit well.
      
      Expense: "${expenseDescription}" from vendor "${vendorName}"
      
      Existing categories: ${categoryNames}
      
      Return JSON:
      {
        "bestMatch": "Category Name" or "NO_MATCH",
        "confidence": 0.85,
        "reasoning": "Why this category fits best"
      }
      
      Only return the JSON, nothing else.
    `;

    try {
      const response = await this.callGeminiAPI(prompt);
      
      // Clean up the response - remove markdown formatting if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const result = JSON.parse(cleanResponse);
      
      if (result.bestMatch === "NO_MATCH" || result.confidence < 0.7) {
        return null;
      }

      const matchedCategory = approvedCategories.find(cat => 
        cat.name.toLowerCase() === result.bestMatch.toLowerCase()
      );

      if (matchedCategory) {
        // Increment usage count for learning
        await prisma.category.update({
          where: { id: matchedCategory.id },
          data: { usageCount: { increment: 1 } }
        });

        return {
          ...matchedCategory,
          confidence: result.confidence,
          reasoning: result.reasoning
        };
      }

      return null;
    } catch (error) {
      console.error('Error matching existing categories:', error);
      return null;
    }
  }

  /**
   * Generates AI suggestion for new category
   */
  static async generateCategorySuggestion(expenseDescription, vendorName) {
    const prompt = `
      Create a professional accounting category for this business expense.
      
      Expense Description: "${expenseDescription}"
      Vendor: "${vendorName}"
      
      Guidelines:
      - Category name should be professional and broad enough for similar expenses
      - Choose appropriate expense account code (6XXX series)
      - Common account codes: 6010 (Salaries), 6020 (Office Supplies), 6030 (Software), 6040 (Marketing), 6060 (Travel), 6070 (Rent), 6080 (Utilities), 6090 (Professional Services), 6100 (Telecommunications), 6110 (Insurance), 6120 (Training), 6130 (Bank Fees), 6140 (Meals), 6999 (Other)
      
      Return JSON:
      {
        "name": "Professional Category Name",
        "key": "CATEGORY_KEY",
        "accountCode": "6XXX",
        "reasoning": "Detailed explanation of why this categorization makes sense",
        "confidence": 0.95,
        "examples": ["Similar expenses that would fit this category"]
      }
      
      Return only valid JSON, nothing else.
    `;

    try {
      const response = await this.callGeminiAPI(prompt);
      
      // Clean up the response - remove markdown formatting if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const suggestion = JSON.parse(cleanResponse);
      
      // Validate the suggestion
      if (!suggestion.name || !suggestion.key || !suggestion.accountCode) {
        throw new Error('Invalid AI suggestion format');
      }

      // Clean up the key (ensure it's uppercase and valid)
      suggestion.key = suggestion.key.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      
      return suggestion;
    } catch (error) {
      console.error('Error generating AI category suggestion:', error);
      
      // Fallback suggestion based on keywords
      return this.generateFallbackSuggestion(expenseDescription, vendorName);
    }
  }

  /**
   * Creates fallback suggestion when AI fails
   */
  static generateFallbackSuggestion(expenseDescription, vendorName) {
    const text = `${expenseDescription} ${vendorName}`.toLowerCase();
    
    // Find best account code based on keywords
    let accountCode = '6999'; // Default to Other
    let categoryName = 'Other Business Expense';
    let key = 'OTHER_BUSINESS';

    for (const [keyword, code] of Object.entries(this.DEFAULT_ACCOUNT_MAPPINGS)) {
      if (text.includes(keyword)) {
        accountCode = code;
        categoryName = this.getAccountCategoryName(code);
        key = keyword.toUpperCase() + '_EXPENSE';
        break;
      }
    }

    return {
      name: categoryName,
      key: key,
      accountCode: accountCode,
      reasoning: `Fallback categorization based on keyword matching in expense description.`,
      confidence: 0.6,
      examples: [`Similar ${categoryName.toLowerCase()} expenses`]
    };
  }

  /**
   * Gets category name based on account code
   */
  static getAccountCategoryName(accountCode) {
    const accountNames = {
      '6010': 'Salaries & Wages',
      '6020': 'Office Supplies & Equipment',
      '6030': 'Software & Technology', 
      '6040': 'Marketing & Advertising',
      '6060': 'Travel & Transportation',
      '6070': 'Rent & Facilities',
      '6080': 'Utilities',
      '6090': 'Professional Services',
      '6100': 'Telecommunications',
      '6110': 'Insurance',
      '6120': 'Training & Development',
      '6130': 'Bank Fees & Financial',
      '6140': 'Meals & Entertainment',
      '6150': 'Repairs & Maintenance',
      '6160': 'Shipping & Delivery',
      '6170': 'Taxes & Licenses',
      '6180': 'Healthcare & Medical',
      '6190': 'Security & Safety',
      '6999': 'Other Business Expense'
    };

    return accountNames[accountCode] || 'Other Business Expense';
  }

  /**
   * Gets fallback category for errors
   */
  static async getFallbackCategory() {
    let fallback = await prisma.category.findFirst({
      where: { key: 'OTHER' },
      include: { account: true }
    });

    if (!fallback) {
      // Create OTHER category if it doesn't exist
      fallback = await prisma.category.create({
        data: {
          name: 'Other Business Expense',
          key: 'OTHER',
          accountCode: '6999',
          description: 'Fallback category for unclassified business expenses',
          isApproved: true,
          aiGenerated: false
        },
        include: { account: true }
      });
    }

    return fallback;
  }

  /**
   * Gets EZE Ledger AI System Prompt for CPA-level expertise
   */
  static getSystemPrompt() {
    try {
      // Try to load the system prompt from file
      const systemPromptPath = path.resolve(process.cwd(), 'SystemPrompt_Gemini_2.0_Flash.md');
      if (fs.existsSync(systemPromptPath)) {
        return fs.readFileSync(systemPromptPath, 'utf-8');
      }
    } catch (error) {
      console.warn('Could not load system prompt file, using fallback');
    }

    // Fallback system prompt for expense categorization
    return `# EZE Ledger AI - Professional Expense Categorization Assistant

You are EZE AI, the advanced financial intelligence engine powering EZE Ledger - a next-generation AI-first accounting platform. You are a CPA-level financial expert with deep expertise in accounting principles, business intelligence, and automated financial analysis.

## Core Expertise:
- 🧠 **Financial Intelligence**: Context-aware analysis across P&L, Balance Sheet, Trial Balance, and Chart of Accounts
- 🔍 **Smart Categorization**: Intelligent expense classification across 25+ business categories
- 💼 **Accounting Domain Expertise**: GAAP compliance, double-entry bookkeeping, CPA-level accuracy

## Communication Standards:
- **Professional & Authoritative**: Maintain CPA-level expertise in all financial discussions
- **Clear & Actionable**: Provide specific, implementable recommendations
- **Accurate**: Ensure all categorizations maintain CPA-grade accuracy and GAAP compliance
- **Concise**: Deliver maximum value in minimal words

## US Business Expense Categories:
- Technology & Software (6030): Software, SaaS, cloud services, hosting, apps
- Office Supplies & Equipment (6020): Office supplies, furniture, equipment, stationery
- Travel & Transportation (6060): Flights, hotels, car rentals, Uber, gas, parking
- Meals & Entertainment (6140): Business meals, client entertainment, coffee, catering
- Utilities (6080): Electric, water, gas, garbage, heating, cooling
- Telecommunications (6100): Internet, phone, mobile, data plans, WiFi
- Rent & Facilities (6070): Office rent, warehouse, coworking spaces, storage
- Marketing & Advertising (6040): Social media ads, SEO, content creation, campaigns
- Professional Services (6090): Legal, accounting, consulting, advisory services
- Insurance (6110): Liability, health, property, business insurance
- Training & Development (6120): Courses, certifications, conferences, books
- Bank Fees & Financial (6130): Banking fees, payment processing, merchant services
- Healthcare & Medical (6180): Medical expenses, wellness, fitness, healthcare
- Security & Safety (6190): Security systems, alarms, safety equipment

Always provide professional, accurate expense categorization with proper accounting principles.`;
  }

  /**
   * Calls Gemini AI API with integrated system prompt
   */
  static async callGeminiAPI(userPrompt) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    // Combine system prompt with user prompt
    const systemPrompt = this.getSystemPrompt();
    const fullPrompt = `${systemPrompt}\n\n---\n\nUser Request:\n${userPrompt}`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: fullPrompt }] }]
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const content = response.data.candidates[0]?.content?.parts[0]?.text;
    if (!content) {
      throw new Error('No response from Gemini API');
    }

    return content.trim();
  }

  /**
   * Creates and stores pending approval request
   */
  static async createPendingApproval(expenseId, suggestion, expenseDetails) {
    try {
      const pending = await prisma.pendingCategoryApproval.create({
        data: {
          expenseId: expenseId,
          suggestedName: suggestion.name,
          suggestedKey: suggestion.key,
          suggestedAccount: suggestion.accountCode,
          aiReasoning: suggestion.reasoning,
          confidence: suggestion.confidence || 0.8,
          expenseDetails: expenseDetails,
          status: 'PENDING'
        }
      });

      console.log(`📋 Created pending approval: ${pending.id} for category "${suggestion.name}"`);
      return pending;
    } catch (error) {
      console.error('Error creating pending approval:', error);
      throw error;
    }
  }

  /**
   * Approves a pending category suggestion
   */
  static async approveCategory(pendingId, userModifications = {}) {
    try {
      const pending = await prisma.pendingCategoryApproval.findUnique({
        where: { id: pendingId },
        include: { expense: true }
      });

      if (!pending) {
        throw new Error('Pending approval not found');
      }

      // Create the new category with user modifications
      const categoryData = {
        name: userModifications.name || pending.suggestedName,
        key: userModifications.key || pending.suggestedKey,
        accountCode: userModifications.accountCode || pending.suggestedAccount,
        description: userModifications.description || pending.aiReasoning,
        aiGenerated: true,
        isApproved: true,
        usageCount: 1
      };

      const newCategory = await prisma.category.create({
        data: categoryData
      });

      // Update the expense to use the new category
      await prisma.expense.update({
        where: { id: pending.expenseId },
        data: {
          categoryId: newCategory.id,
          isPending: false
        }
      });

      // Mark pending approval as approved
      await prisma.pendingCategoryApproval.update({
        where: { id: pendingId },
        data: { status: 'APPROVED' }
      });

      console.log(`✅ Approved category: ${newCategory.name} (${newCategory.key})`);
      
      return newCategory;
    } catch (error) {
      console.error('Error approving category:', error);
      throw error;
    }
  }

  /**
   * Rejects a pending category and maps to existing category
   */
  static async rejectCategory(pendingId, existingCategoryId) {
    try {
      const pending = await prisma.pendingCategoryApproval.findUnique({
        where: { id: pendingId }
      });

      if (!pending) {
        throw new Error('Pending approval not found');
      }

      // Update expense to use existing category
      await prisma.expense.update({
        where: { id: pending.expenseId },
        data: {
          categoryId: existingCategoryId,
          isPending: false
        }
      });

      // Mark as rejected
      await prisma.pendingCategoryApproval.update({
        where: { id: pendingId },
        data: { status: 'REJECTED' }
      });

      console.log(`❌ Rejected category suggestion for expense: ${pending.expenseId}`);
      
      return true;
    } catch (error) {
      console.error('Error rejecting category:', error);
      throw error;
    }
  }

  /**
   * Gets all pending approvals for admin review
   */
  static async getPendingApprovals() {
    try {
      return await prisma.pendingCategoryApproval.findMany({
        where: { status: 'PENDING' },
        include: {
          expense: {
            include: {
              transaction: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      throw error;
    }
  }
}

export { AICategoryService };
