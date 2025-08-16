import { PrismaClient } from '@prisma/client';
import { ExpenseAccountResolver } from './expense-account-resolver.service.js';

const prisma = new PrismaClient();

/**
 * PostingService - Centralized Double-Entry Bookkeeping Engine
 * 
 * Phase 2 Implementation: Handles expense transactions with proper double-entry logic
 * Phase 3 Ready: Extensible for invoices and other transaction types
 * 
 * Features:
 * - Atomic transaction processing with Prisma transactions
 * - Idempotency protection via unique references
 * - Account resolution via ExpenseAccountResolver
 * - Complete double-entry validation
 * - Comprehensive error handling and rollback
 */
class PostingService {

  /**
   * Main posting method for expense transactions
   * Implements Phase 2 MVP requirements with full double-entry bookkeeping
   * 
   * @param {Object} expenseData - Canonical expense data
   * @returns {Promise<Object>} - Posting result with transaction details
   */
  static async postTransaction(expenseData) {
    console.log(`📝 PostingService.postTransaction() starting for ${expenseData.vendorName}`);
    console.log(`🔍 EXPENSE DATA RECEIVED:`, JSON.stringify({
      vendor: expenseData.vendorName,
      amount: expenseData.amount,
      amountPaid: expenseData.amountPaid,
      balanceDue: expenseData.balanceDue,
      paymentStatus: expenseData.paymentStatus
    }, null, 2));
    
    try {
      // Step 1: Generate idempotent reference if not provided
      const reference = expenseData.reference || this.generateReference('EXP', expenseData);
      console.log(`🔗 Using reference: ${reference}`);
      
      // Step 2: Check for existing transaction (idempotency)
      const existingTransaction = await this.checkExistingTransaction(reference);
      if (existingTransaction) {
        console.log(`🔄 Idempotent response: Transaction ${reference} already exists`);
        return this.formatExistingTransactionResponse(existingTransaction);
      }
      
      // Step 3: Resolve accounts using ExpenseAccountResolver
      const accountResolution = await ExpenseAccountResolver.resolveExpenseAccounts(expenseData);
      console.log(`✅ Accounts resolved: Dr ${accountResolution.debit.accountCode}, Cr ${accountResolution.credit.accountCode}`);
      
      // Step 4: Get account IDs from database
      const accounts = await this.getAccountsByCode([
        accountResolution.debit.accountCode,
        accountResolution.credit.accountCode
      ]);
      
      // Step 5: Create complete transaction with double-entry in atomic operation
      const result = await prisma.$transaction(async (tx) => {
        // Create Transaction header
        const transaction = await tx.transaction.create({
          data: {
            date: new Date(accountResolution.dateUsed),
            description: this.buildTransactionDescription(expenseData),
            reference: reference,
            amount: parseFloat(expenseData.amount),
            customFields: {
              type: 'expense',
              vendorName: expenseData.vendorName,
              categoryKey: expenseData.categoryKey,
              paymentStatus: expenseData.paymentStatus,
              policy: accountResolution.policy,
              source: 'PostingService'
            }
          }
        });
        
        // Create Expense record linked to transaction
        const expense = await tx.expense.create({
          data: {
            transactionId: transaction.id,
            vendor: expenseData.vendorName,
            categoryKey: expenseData.categoryKey, // Keep enum for compatibility
            date: new Date(accountResolution.dateUsed),
            amount: parseFloat(expenseData.amount),
            description: expenseData.description || `Expense from ${expenseData.vendorName}`,
            receiptUrl: expenseData.receiptUrl || null,
            customFields: {
              paymentStatus: expenseData.paymentStatus,
              notes: expenseData.notes || null
            },
            isRecurring: false,
            isPending: false
          }
        });
        
        // 🔥 ENHANCED: Check for overpaid expense scenario
        const totalExpense = parseFloat(expenseData.amount) || 0;
        const amountPaid = parseFloat(expenseData.amountPaid || expenseData.amount) || 0;
        const balanceDue = parseFloat(expenseData.balanceDue || '0') || 0;
        const overpaidAmount = amountPaid - totalExpense;
        const isOverpaid = overpaidAmount > 0.01 || balanceDue < -0.01;

        console.log(`💰 Overpaid check: Total=$${totalExpense}, Paid=$${amountPaid}, Overpaid=$${overpaidAmount}, IsOverpaid=${isOverpaid}`);

        let entries;
        
        if (isOverpaid) {
          // 🔥 OVERPAID: Create 3-line posting manually
          console.log(`💎 Creating overpaid expense posting: $${overpaidAmount.toFixed(2)} overpaid`);
          
          // Get Customer Credits Payable account for overpaid amount
          const creditsAccount = await tx.account.findFirst({ where: { code: '2050' } });
          if (!creditsAccount) {
            throw new Error('Customer Credits Payable account (2050) not found');
          }
          
          entries = [];
          
          // Entry 1: DEBIT expense account (invoice amount)
          const debitEntry = await tx.transactionEntry.create({
            data: {
              transactionId: transaction.id,
              debitAccountId: accounts.debit.id,
              creditAccountId: null,
              amount: totalExpense,
              description: `${accountResolution.debit.accountName} - ${expenseData.vendorName}`
            }
          });
          entries.push(debitEntry);
          
          // Entry 2: CREDIT cash (amount paid)
          const cashCreditEntry = await tx.transactionEntry.create({
            data: {
              transactionId: transaction.id,
              debitAccountId: null,
              creditAccountId: accounts.credit.id,
              amount: amountPaid,
              description: `Cash paid to ${expenseData.vendorName}`
            }
          });
          entries.push(cashCreditEntry);
          
          // Entry 3: DEBIT customer credits payable (prepaid/asset - vendor owes us refund)
          const vendorCreditEntry = await tx.transactionEntry.create({
            data: {
              transactionId: transaction.id,
              debitAccountId: creditsAccount.id,
              creditAccountId: null,
              amount: overpaidAmount,
              description: `Prepaid/Vendor credit - overpaid by $${overpaidAmount.toFixed(2)}`
            }
          });
          entries.push(vendorCreditEntry);
          
        } else {
          // 🔥 STANDARD: Use normal 2-line posting
          console.log(`💸 Creating standard expense posting`);
          entries = await this.createDoubleEntryRecords(
            tx,
            transaction.id,
            accounts,
            accountResolution,
            expenseData
          );
        }
        
        // Validate double-entry balance (critical accounting invariant)
        this.validateDoubleEntryBalance(entries);
        
        console.log(`🎉 Transaction posted successfully: ${transaction.id}`);
        
        return {
          transactionId: transaction.id,
          expenseId: expense.id,
          reference: reference,
          amount: expenseData.amount,
          entries: entries,
          accounts: accountResolution,
          dateUsed: accountResolution.dateUsed,
          policy: accountResolution.policy
        };
      });
      
      return {
        ...result,
        isExisting: false,
        message: `Expense posted successfully: $${expenseData.amount} for ${expenseData.vendorName}`
      };
      
    } catch (error) {
      console.error(`❌ PostingService.postTransaction() failed:`, error);
      
      // Re-throw with enhanced context for debugging
      if (error.message.includes('Unique constraint')) {
        throw new Error(`Duplicate transaction reference: ${reference}. Use different reference or rely on idempotency.`);
      }
      
      if (error.message.includes('not found in Chart of Accounts')) {
        throw new Error(`Missing accounts in Chart of Accounts: ${error.message}`);
      }
      
      if (error.message.includes('BALANCED JOURNAL INVARIANT')) {
        throw new Error(`CRITICAL: Double-entry bookkeeping failed - ${error.message}`);
      }
      
      throw new Error(`PostingService error: ${error.message}`);
    }
  }

  /**
   * Creates proper double-entry records for expense transaction
   * Debit: Expense Account | Credit: Cash/Accounts Payable
   */
  static async createDoubleEntryRecords(tx, transactionId, accounts, accountResolution, expenseData) {
    const amount = parseFloat(expenseData.amount);
    const entries = [];
    
    // Entry 1: DEBIT the expense account
    const debitEntry = await tx.transactionEntry.create({
      data: {
        transactionId: transactionId,
        debitAccountId: accounts.debit.id,
        creditAccountId: null, // Only debit side for this entry
        amount: amount,
        description: `${accountResolution.debit.accountName} - ${expenseData.vendorName}`
      }
    });
    entries.push(debitEntry);
    
    // Entry 2: CREDIT cash or accounts payable based on payment status
    const creditEntry = await tx.transactionEntry.create({
      data: {
        transactionId: transactionId,
        debitAccountId: null, // Only credit side for this entry
        creditAccountId: accounts.credit.id,
        amount: amount,
        description: this.buildCreditDescription(expenseData, accountResolution.credit.accountName)
      }
    });
    entries.push(creditEntry);
    
    console.log(`📊 Double-entry created: Dr ${accountResolution.debit.accountCode} $${amount} | Cr ${accountResolution.credit.accountCode} $${amount}`);
    
    return entries;
  }

  /**
   * Validates that debits equal credits (fundamental accounting equation)
   */
  static validateDoubleEntryBalance(entries) {
    const totalDebits = entries
      .filter(entry => entry.debitAccountId !== null)
      .reduce((sum, entry) => sum + parseFloat(entry.amount), 0);
      
    const totalCredits = entries
      .filter(entry => entry.creditAccountId !== null)
      .reduce((sum, entry) => sum + parseFloat(entry.amount), 0);
    
    const difference = Math.abs(totalDebits - totalCredits);
    
    if (difference > 0.001) { // Allow for tiny rounding differences
      throw new Error(`BALANCED JOURNAL INVARIANT FAILED: Debits ($${totalDebits}) ≠ Credits ($${totalCredits}), Difference: $${difference}`);
    }
    
    console.log(`⚖️ Double-entry validated: Debits=$${totalDebits}, Credits=$${totalCredits} ✅`);
    return true;
  }

  /**
   * Generates unique, idempotent reference for transactions
   */
  static generateReference(type, transactionData) {
    const timestamp = Date.now();
    // Handle both expense (vendorName) and invoice (customerName) data
    const entityName = transactionData.vendorName || transactionData.customerName || 'Unknown';
    const entityHash = this.simpleHash(entityName);
    const amountHash = this.simpleHash(transactionData.amount.toString());
    
    return `${type}-${timestamp}-${entityHash}-${amountHash}`;
  }

  /**
   * Simple hash function for reference generation
   */
  static simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 6);
  }

  /**
   * Checks for existing transaction by reference (idempotency)
   */
  static async checkExistingTransaction(reference) {
    try {
      const existing = await prisma.transaction.findUnique({
        where: { reference: reference },
        include: {
          entries: {
            include: {
              debitAccount: { select: { code: true, name: true } },
              creditAccount: { select: { code: true, name: true } }
            }
          },
          expense: true
        }
      });
      
      return existing;
    } catch (error) {
      console.error('Error checking existing transaction:', error);
      return null;
    }
  }

  /**
   * Formats response for existing transaction (idempotency)
   */
  static formatExistingTransactionResponse(existingTransaction) {
    return {
      transactionId: existingTransaction.id,
      expenseId: existingTransaction.expense?.id,
      reference: existingTransaction.reference,
      amount: existingTransaction.amount.toString(),
      dateUsed: existingTransaction.date.toISOString().split('T')[0],
      entries: existingTransaction.entries,
      isExisting: true,
      message: `Transaction already exists (idempotent): $${existingTransaction.amount}`
    };
  }

  /**
   * Gets account records by codes with validation
   */
  static async getAccountsByCode(accountCodes) {
    try {
      const accounts = await prisma.account.findMany({
        where: {
          code: { in: accountCodes }
        },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          normalBalance: true
        }
      });

      // Create lookup object
      const accountLookup = {};
      accounts.forEach(account => {
        accountLookup[account.code] = account;
      });

      // Validate all required accounts exist
      const missingCodes = accountCodes.filter(code => !accountLookup[code]);
      if (missingCodes.length > 0) {
        throw new Error(`Missing accounts in Chart of Accounts: ${missingCodes.join(', ')}`);
      }

      // Return structured object
      return {
        debit: accountLookup[accountCodes[0]],
        credit: accountLookup[accountCodes[1]]
      };
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }
  }

  /**
   * Builds transaction description for main Transaction record
   */
  static buildTransactionDescription(expenseData) {
    const category = expenseData.categoryKey || 'General';
    return `${category} - ${expenseData.vendorName}`;
  }

  /**
   * Builds credit entry description based on payment status
   */
  static buildCreditDescription(expenseData, creditAccountName) {
    const { paymentStatus, vendorName } = expenseData;
    
    switch (paymentStatus) {
      case 'paid':
        return `Payment to ${vendorName} (Cash)`;
      case 'unpaid':
        return `Bill from ${vendorName} (A/P)`;
      case 'partial':
        return `Partial payment to ${vendorName}`;
      case 'overpaid':
        return `Overpayment to ${vendorName}`;
      default:
        return `Payment to ${vendorName} (${creditAccountName})`;
    }
  }

  /**
   * Validates expense payload and normalizes data
   * Used by server endpoints before calling postTransaction
   */
  static validateExpensePayload(requestBody) {
    const errors = [];
    
    // Required fields validation
    if (!requestBody.vendorName || typeof requestBody.vendorName !== 'string') {
      errors.push('vendorName is required and must be a string');
    }
    
    if (!requestBody.amount || isNaN(parseFloat(requestBody.amount)) || parseFloat(requestBody.amount) <= 0) {
      errors.push('amount is required and must be a positive number');
    }
    
    if (!requestBody.date) {
      errors.push('date is required');
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (requestBody.date && !dateRegex.test(requestBody.date)) {
      errors.push('date must be in YYYY-MM-DD format');
    }
    
    // Validate payment status
    const validPaymentStatuses = ['paid', 'unpaid', 'partial', 'overpaid'];
    const paymentStatus = requestBody.paymentStatus || 'unpaid';
    if (!validPaymentStatuses.includes(paymentStatus)) {
      errors.push(`paymentStatus must be one of: ${validPaymentStatuses.join(', ')}`);
    }
    
    if (errors.length > 0) {
      return {
        isValid: false,
        errors: errors
      };
    }
    
    // Normalize and return clean data
    const normalizedData = {
      vendorName: requestBody.vendorName.trim(),
      amount: parseFloat(requestBody.amount).toFixed(2),
      date: requestBody.date,
      categoryKey: requestBody.categoryKey || requestBody.category || null,
      paymentStatus: paymentStatus,
      description: requestBody.description || requestBody.notes || `Expense from ${requestBody.vendorName}`,
      notes: requestBody.notes || null,
      receiptUrl: requestBody.receiptUrl || null,
      datePaid: requestBody.datePaid || (paymentStatus === 'paid' ? requestBody.date : null),
      reference: requestBody.reference || null,
      // 🔥 CRITICAL: Include overpaid detection fields
      amountPaid: requestBody.amountPaid ? parseFloat(requestBody.amountPaid).toFixed(2) : null,
      balanceDue: requestBody.balanceDue ? parseFloat(requestBody.balanceDue).toFixed(2) : null,
      invoiceNumber: requestBody.invoiceNumber || null,
      dueDate: requestBody.dueDate || null,
      recurring: requestBody.recurring || false,
      overdue: requestBody.overdue || false
    };
    
    return {
      isValid: true,
      errors: [],
      normalizedData: normalizedData
    };
  }

  /**
   * Invoice/Revenue Posting with Overpayment Support
   * Handles revenue transactions with proper A/R, revenue, and customer credit posting
   * 
   * @param {Object} invoiceData - Invoice data with payment details
   * @returns {Promise<Object>} - Posting result with transaction details
   */
  static async postInvoiceTransaction(invoiceData) {
    console.log(`💰 PostingService.postInvoiceTransaction() starting for ${invoiceData.customerName}`);
    
    try {
      // Step 1: Generate idempotent reference if not provided
      const reference = invoiceData.reference || this.generateReference('INV', invoiceData);
      console.log(`🔗 Using reference: ${reference}`);
      
      // Step 2: Check for existing transaction (idempotency)
      const existingTransaction = await this.checkExistingTransaction(reference);
      if (existingTransaction) {
        console.log(`🔄 Idempotent response: Invoice ${reference} already exists`);
        return this.formatExistingTransactionResponse(existingTransaction);
      }
      
      // Step 3: Calculate amounts and determine posting logic
      const totalInvoice = parseFloat(invoiceData.amount);
      const amountPaid = parseFloat(invoiceData.amountPaid || invoiceData.amount);
      const balanceDue = parseFloat(invoiceData.balanceDue || (totalInvoice - amountPaid));
      const overpaidAmount = amountPaid > totalInvoice ? amountPaid - totalInvoice : 0;
      
      console.log(`📊 Invoice amounts: Total=$${totalInvoice}, Paid=$${amountPaid}, Balance=$${balanceDue}, Overpaid=$${overpaidAmount}`);
      
      // Step 4: Resolve accounts for revenue posting
      const accounts = await this.resolveInvoiceAccounts(invoiceData, overpaidAmount);
      
      // Step 5: Create complete transaction with revenue posting in atomic operation
      const result = await prisma.$transaction(async (tx) => {
        // Create Transaction header
        const transaction = await tx.transaction.create({
          data: {
            date: new Date(invoiceData.date),
            description: this.buildInvoiceDescription(invoiceData),
            reference: reference,
            amount: amountPaid, // Total amount received (can be different from invoice total)
            customFields: {
              type: 'invoice',
              customerName: invoiceData.customerName,
              invoiceNumber: invoiceData.invoiceNumber,
              invoiceTotal: totalInvoice,
              amountPaid: amountPaid,
              balanceDue: balanceDue,
              overpaidAmount: overpaidAmount,
              paymentStatus: invoiceData.paymentStatus,
              source: 'PostingService'
            }
          }
        });
        
        // Create Invoice record linked to transaction
        const invoice = await tx.invoice.create({
          data: {
            transactionId: transaction.id,
            customer: invoiceData.customerName,
            invoiceNumber: invoiceData.invoiceNumber || `INV-${Date.now()}`,
            date: new Date(invoiceData.date),
            amount: totalInvoice,
            description: invoiceData.description || `Invoice for ${invoiceData.customerName}`,
            status: this.determineInvoiceStatus(invoiceData.paymentStatus, balanceDue),
            dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null
          }
        });
        
        // Create revenue posting entries based on payment scenario
        console.log(`🔍 BEFORE createInvoiceEntries - DATA PASSED:`);
        console.log(`   🏦 Accounts:`, {
          cash: accounts.cash ? `${accounts.cash.code} - ${accounts.cash.name}` : 'NULL',
          arAccount: accounts.arAccount ? `${accounts.arAccount.code} - ${accounts.arAccount.name}` : 'NULL',
          revenue: accounts.revenue ? `${accounts.revenue.code} - ${accounts.revenue.name}` : 'NULL',
          taxPayable: accounts.taxPayable ? `${accounts.taxPayable.code} - ${accounts.taxPayable.name}` : 'NULL',
          salesDiscounts: accounts.salesDiscounts ? `${accounts.salesDiscounts.code} - ${accounts.salesDiscounts.name}` : 'NULL'
        });
        console.log(`   💰 Amounts:`, { totalInvoice, amountPaid, balanceDue, overpaidAmount });
        console.log(`   📋 Invoice Data (tax/discount):`, {
          taxSettings: invoiceData.taxSettings,
          discount: invoiceData.discount
        });
        
        const entries = await this.createInvoiceEntries(
          tx,
          transaction.id,
          accounts,
          {
            totalInvoice,
            amountPaid,
            balanceDue,
            overpaidAmount,
            categoryKey: invoiceData.categoryKey || 'OFFICE_SUPPLIES'
          },
          invoiceData
        );
        
        // Validate double-entry balance (critical accounting invariant)
        this.validateDoubleEntryBalance(entries);
        
        console.log(`🎉 Invoice posted successfully: ${transaction.id}`);
        
        return {
          transactionId: transaction.id,
          invoiceId: invoice.id,
          reference: reference,
          totalInvoice: totalInvoice,
          amountPaid: amountPaid,
          balanceDue: balanceDue,
          overpaidAmount: overpaidAmount,
          entries: entries,
          accounts: accounts,
          dateUsed: invoiceData.date
        };
      });
      
      return {
        ...result,
        isExisting: false,
        message: `Invoice posted successfully: $${amountPaid} received from ${invoiceData.customerName}`
      };
      
    } catch (error) {
      console.error(`❌ PostingService.postInvoiceTransaction() failed:`, error);
      throw new Error(`Invoice posting error: ${error.message}`);
    }
  }

  /**
   * Creates invoice transaction entries with proper double-entry accounting
   * Supports both single-line and multi-line invoices
   */
  static async createInvoiceEntries(tx, transactionId, accounts, amounts, invoiceData) {
    const entries = [];
    const { totalInvoice, amountPaid, overpaidAmount } = amounts;
    
    console.log(`🔄 Creating invoice entries for ${invoiceData.customerName}`);
    console.log(`📊 Amounts: Total=$${totalInvoice}, Paid=$${amountPaid}, Overpaid=$${overpaidAmount}`);
    
    // Extract tax and discount amounts for separate posting
    console.log(`🔍 RAW INVOICE DATA:`, JSON.stringify({
      taxSettings: invoiceData.taxSettings,
      discount: invoiceData.discount,
      subtotal: invoiceData.subtotal,
      amount: invoiceData.amount
    }, null, 2));
    
    // FIXED: Support both percentage rate and fixed amount for tax calculation
    let taxAmount = 0;
    if (invoiceData.taxSettings?.enabled) {
      if (invoiceData.taxSettings.type === 'percentage' && invoiceData.taxSettings.rate) {
        // Calculate tax as percentage of subtotal (before discount)
        const afterDiscount = parseFloat(invoiceData.subtotal || totalInvoice) - parseFloat(invoiceData.discount?.amount || 0);
        taxAmount = afterDiscount * (parseFloat(invoiceData.taxSettings.rate) / 100);
      } else {
        // Use fixed tax amount
        taxAmount = parseFloat(invoiceData.taxSettings.amount || 0);
      }
    }
    
    const discountAmount = invoiceData.discount?.enabled ? parseFloat(invoiceData.discount.amount || 0) : 0;
    
    console.log(`🔍 SUBTOTAL DEBUG:`);
    console.log(`   📊 invoiceData.subtotal: ${invoiceData.subtotal} (type: ${typeof invoiceData.subtotal})`);
    console.log(`   📊 totalInvoice: ${totalInvoice} (type: ${typeof totalInvoice})`);
    
    // FIXED: Explicitly calculate subtotal as total minus tax and discount to ensure accuracy
    let subtotalAmount;
    if (invoiceData.subtotal && parseFloat(invoiceData.subtotal) > 0) {
      subtotalAmount = parseFloat(invoiceData.subtotal);
      console.log(`   ✅ Using provided subtotal: ${subtotalAmount}`);
    } else {
      // Calculate subtotal by backing out tax and discount from total
      subtotalAmount = totalInvoice - taxAmount - discountAmount;
      console.log(`   🔧 Calculated subtotal: ${totalInvoice} - ${taxAmount} - ${discountAmount} = ${subtotalAmount}`);
    }
    
    console.log(`   🎯 FINAL subtotalAmount: ${subtotalAmount}`);
    
    console.log(`🔍 TAX CALCULATION DETAILS:`);
    console.log(`   📊 Tax Settings:`, invoiceData.taxSettings);
    console.log(`   📊 Tax Type: ${invoiceData.taxSettings?.type || 'fixed'}`);
    console.log(`   📊 Tax Rate: ${invoiceData.taxSettings?.rate || 'N/A'}%`);
    console.log(`   📊 Tax Amount: $${invoiceData.taxSettings?.amount || 'N/A'}`);
    console.log(`   💸 CALCULATED TAX AMOUNT: $${taxAmount}`);
    
    console.log(`🏷️  CALCULATED AMOUNTS:`);
    console.log(`   📊 Subtotal: $${subtotalAmount}`);
    console.log(`   💸 Tax Amount: $${taxAmount} (enabled: ${invoiceData.taxSettings?.enabled})`);
    console.log(`   💳 Discount Amount: $${discountAmount} (enabled: ${invoiceData.discount?.enabled})`);
    console.log(`   🎯 Final Total: $${totalInvoice}`);
    
    // Determine if we have line items for multi-line posting
    const hasLineItems = invoiceData.lineItems && invoiceData.lineItems.length > 0;
    
    if (hasLineItems) {
      console.log(`📋 Multi-line invoice with ${invoiceData.lineItems.length} line items`);
      
      // MULTI-LINE POSTING: Create separate entries for each line item
      let totalRevenueCredits = 0;
      
      for (const [index, lineItem] of invoiceData.lineItems.entries()) {
        const lineAmount = parseFloat(lineItem.amount);
        const revenueAccountCode = this.mapLineItemToRevenueAccount(lineItem);
        
        console.log(`📄 Line ${index + 1}: ${lineItem.description} = $${lineAmount} → Account ${revenueAccountCode}`);
        
        // Get the specific revenue account for this line item
        const revenueAccount = await this.getAccountByCode(revenueAccountCode);
        if (!revenueAccount) {
          throw new Error(`Revenue account ${revenueAccountCode} not found for line item: ${lineItem.description}`);
        }
        
        // CREDIT: Revenue account for this line item
        const revenueEntry = await tx.transactionEntry.create({
          data: {
            transactionId: transactionId,
            debitAccountId: null,
            creditAccountId: revenueAccount.id,
            amount: lineAmount,
            description: `${lineItem.description} - ${invoiceData.customerName} (Invoice ${invoiceData.invoiceNumber || 'N/A'})`
          }
        });
        entries.push(revenueEntry);
        totalRevenueCredits += lineAmount;
      }
      
      console.log(`💰 Total revenue credits: $${totalRevenueCredits}`);
      
    } else {
      console.log(`📄 Single-line invoice posting`);
      
      // SINGLE-LINE POSTING: Credit revenue for subtotal (before tax/discount)
      const revenueEntry = await tx.transactionEntry.create({
        data: {
          transactionId: transactionId,
          debitAccountId: null,
          creditAccountId: accounts.revenue.id,
          amount: subtotalAmount,
          description: `Revenue from ${invoiceData.customerName} - ${invoiceData.description || 'Services'}`
        }
      });
      entries.push(revenueEntry);
    }
    
    // CREDIT: Sales Tax Payable (if tax is applied)
    console.log(`🔍 TAX DEBUG: taxAmount=${taxAmount}, accounts.taxPayable=${accounts.taxPayable ? 'EXISTS' : 'NULL'}`);
    console.log(`🔍 TAX SETTINGS:`, JSON.stringify(invoiceData.taxSettings, null, 2));
    
    // TAX ENTRY CREATION (CRITICAL FOR BALANCE) - FIXED WITH FALLBACK
    console.log(`🔍 TAX ENTRY CHECK: taxAmount=${taxAmount}, accounts.taxPayable=${accounts.taxPayable ? 'EXISTS' : 'NULL'}`);
    console.log(`🔍 CONDITION EVALUATION: (taxAmount > 0) = ${taxAmount > 0}, (accounts.taxPayable) = ${!!accounts.taxPayable}`);
    console.log(`🔍 FINAL CONDITION: ${taxAmount > 0 && !!accounts.taxPayable}`);
    
    if (taxAmount > 0) {
      // FALLBACK: If accounts.taxPayable is missing, use fallback account
      const taxAccount = accounts.taxPayable || { accountCode: '2150', name: 'Sales Tax Payable' };
      
      console.log(`💸 Creating tax entry: $${taxAmount} using account:`, taxAccount);
      
      // If using fallback, get the account from database
      let taxAccountId;
      if (accounts.taxPayable) {
        taxAccountId = accounts.taxPayable.id;
      } else {
        console.log(`🚨 Using fallback account lookup for Sales Tax Payable (2150)`);
        const fallbackAccount = await this.getAccountByCode('2150');
        if (!fallbackAccount) {
          throw new Error('Sales Tax Payable account (2150) not found in database');
        }
        taxAccountId = fallbackAccount.id;
      }
      
      const taxEntry = await tx.transactionEntry.create({
        data: {
          transactionId: transactionId,
          debitAccountId: null,
          creditAccountId: taxAccountId,
          amount: taxAmount,
          description: `Sales Tax - ${invoiceData.customerName}`
        }
      });
      
      entries.push(taxEntry);
      console.log(`✅ Tax entry created: ${taxEntry.id} for $${taxAmount}`);
      console.log(`✅ Current entries count: ${entries.length}`);
    } else {
      console.log(`⚠️ Tax entry skipped: taxAmount=${taxAmount}, condition failed`);
    }
    

    
    // DEBIT: Sales Discounts (if discount is applied)
    console.log(`🔍 DISCOUNT DEBUG: discountAmount=${discountAmount}, accounts.salesDiscounts=${accounts.salesDiscounts ? 'EXISTS' : 'NULL'}`);
    console.log(`🔍 DISCOUNT SETTINGS:`, JSON.stringify(invoiceData.discount, null, 2));
    
    // DISCOUNT ENTRY CREATION (CRITICAL FOR BALANCE) - FIXED WITH FALLBACK
    console.log(`🔍 DISCOUNT ENTRY CHECK: discountAmount=${discountAmount}, accounts.salesDiscounts=${accounts.salesDiscounts ? 'EXISTS' : 'NULL'}`);
    console.log(`🔍 CONDITION EVALUATION: (discountAmount > 0) = ${discountAmount > 0}, (accounts.salesDiscounts) = ${!!accounts.salesDiscounts}`);
    
    if (discountAmount > 0) {
      // FALLBACK: If accounts.salesDiscounts is missing, use fallback account
      const discountAccount = accounts.salesDiscounts || { accountCode: '4910', name: 'Sales Discounts' };
      
      console.log(`💳 Creating discount entry: $${discountAmount} using account:`, discountAccount);
      
      // If using fallback, get the account from database
      let discountAccountId;
      if (accounts.salesDiscounts) {
        discountAccountId = accounts.salesDiscounts.id;
      } else {
        console.log(`🚨 Using fallback account lookup for Sales Discounts (4910)`);
        const fallbackAccount = await this.getAccountByCode('4910');
        if (!fallbackAccount) {
          throw new Error('Sales Discounts account (4910) not found in database');
        }
        discountAccountId = fallbackAccount.id;
      }
      
      const discountEntry = await tx.transactionEntry.create({
        data: {
          transactionId: transactionId,
          debitAccountId: discountAccountId,
          creditAccountId: null,
          amount: discountAmount,
          description: `Sales Discount - ${invoiceData.customerName}`
        }
      });
      
      entries.push(discountEntry);
      console.log(`✅ Discount entry created: ${discountEntry.id} for $${discountAmount}`);
      console.log(`✅ Current entries count: ${entries.length}`);
    } else {
      console.log(`⚠️ Discount entry skipped: discountAmount=${discountAmount}, condition failed`);
    }
    
    // DEBIT: Cash or Accounts Receivable for FINAL TOTAL (after tax/discount)
    const isPaymentReceived = invoiceData.paymentStatus === 'paid';
    const debitAccountId = isPaymentReceived ? accounts.cash.id : accounts.arAccount?.id || accounts.cash.id;
    const debitDescription = isPaymentReceived 
      ? `Cash received from ${invoiceData.customerName}`
      : `Accounts Receivable - ${invoiceData.customerName} (Invoice ${invoiceData.invoiceNumber || 'N/A'})`;
    
    console.log(`🏦 A/R Entry: ${isPaymentReceived ? 'Cash' : 'A/R'} debit for $${amountPaid} (final amount after tax/discount)`);
    
    const debitEntry = await tx.transactionEntry.create({
      data: {
        transactionId: transactionId,
        debitAccountId: debitAccountId,
        creditAccountId: null,
        amount: amountPaid,
        description: debitDescription
      }
    });
    entries.push(debitEntry);
    
    // CREDIT: Customer Credits Payable for overpaid amount (if any)
    if (overpaidAmount > 0) {
      const creditEntry = await tx.transactionEntry.create({
        data: {
          transactionId: transactionId,
          debitAccountId: null,
          creditAccountId: accounts.customerCredits.id,
          amount: overpaidAmount,
          description: `Customer credit balance - ${invoiceData.customerName} overpaid by $${overpaidAmount}`
        }
      });
      entries.push(creditEntry);
    }
    
    // Validate double-entry balance with detailed breakdown
    const debitEntries = entries.filter(entry => entry.debitAccountId);
    const creditEntries = entries.filter(entry => entry.creditAccountId);
    
    const totalDebits = debitEntries.reduce((sum, entry) => sum + parseFloat(entry.amount), 0);
    const totalCreditsCheck = creditEntries.reduce((sum, entry) => sum + parseFloat(entry.amount), 0);
    
    console.log(`⚖️  DETAILED BALANCE CHECK:`);
    console.log(`   📊 Debit Entries (${debitEntries.length}):`);
    debitEntries.forEach(entry => {
      console.log(`      - Debit: $${entry.amount} (${entry.description})`);
    });
    console.log(`   📊 Credit Entries (${creditEntries.length}):`);
    creditEntries.forEach(entry => {
      console.log(`      - Credit: $${entry.amount} (${entry.description})`);
    });
    console.log(`   🎯 TOTALS: Debits=$${totalDebits.toFixed(2)}, Credits=$${totalCreditsCheck.toFixed(2)}`);
    
    if (Math.abs(totalDebits - totalCreditsCheck) > 0.01) {
      throw new Error(`Invoice entries not balanced: Debits=$${totalDebits}, Credits=$${totalCreditsCheck}`);
    }
    
    console.log(`✅ Invoice entries created successfully: ${entries.length} entries`);
    return entries;
  }

  /**
   * Resolves accounts for invoice/revenue posting
   */
  static async resolveInvoiceAccounts(invoiceData, overpaidAmount) {
    const accountCodes = {
      cash: '1010',           // Cash and Cash Equivalents
      arAccount: '1200',      // Accounts Receivable
      revenue: this.mapCategoryToRevenueAccount(invoiceData.categoryKey || 'OFFICE_SUPPLIES'),
      customerCredits: '2050', // Customer Credits Payable (for overpayments)
      taxPayable: '2150',     // Sales Tax Payable (for tax amounts)
      salesDiscounts: '4910'  // Sales Discounts (contra-revenue for discounts)
    };
    
    console.log(`🏦 ACCOUNT RESOLUTION DEBUG:`);
    console.log(`   📋 Account Codes:`, accountCodes);
    console.log(`   💸 Tax enabled: ${invoiceData.taxSettings?.enabled}`);
    console.log(`   💳 Discount enabled: ${invoiceData.discount?.enabled}`);
    
    const requiredCodes = Object.values(accountCodes).filter(Boolean);
    console.log(`   🔍 Required codes: [${requiredCodes.join(', ')}]`);
    
    const accounts = await this.getAccountsByCodeLookup(requiredCodes);
    console.log(`   🗂️  Fetched accounts:`, Object.keys(accounts));
    
    const resolvedAccounts = {
      cash: accounts[accountCodes.cash],
      arAccount: accounts[accountCodes.arAccount],
      revenue: accounts[accountCodes.revenue],
      customerCredits: overpaidAmount > 0 ? accounts[accountCodes.customerCredits] : null,
      taxPayable: accounts[accountCodes.taxPayable], // Always include - conditional logic in createInvoiceEntries
      salesDiscounts: accounts[accountCodes.salesDiscounts] // Always include - conditional logic in createInvoiceEntries
    };
    
    console.log(`🔧 SIMPLIFIED RESOLUTION: Always including tax/discount accounts for conditional use`);
    console.log(`   Tax account: ${resolvedAccounts.taxPayable ? resolvedAccounts.taxPayable.code : 'NULL'}`);
    console.log(`   Discount account: ${resolvedAccounts.salesDiscounts ? resolvedAccounts.salesDiscounts.code : 'NULL'}`);
    
    console.log(`   ✅ Final resolved accounts:`, {
      cash: resolvedAccounts.cash ? `${resolvedAccounts.cash.code} - ${resolvedAccounts.cash.name}` : 'NULL',
      arAccount: resolvedAccounts.arAccount ? `${resolvedAccounts.arAccount.code} - ${resolvedAccounts.arAccount.name}` : 'NULL',
      revenue: resolvedAccounts.revenue ? `${resolvedAccounts.revenue.code} - ${resolvedAccounts.revenue.name}` : 'NULL',
      taxPayable: resolvedAccounts.taxPayable ? `${resolvedAccounts.taxPayable.code} - ${resolvedAccounts.taxPayable.name}` : 'NULL',
      salesDiscounts: resolvedAccounts.salesDiscounts ? `${resolvedAccounts.salesDiscounts.code} - ${resolvedAccounts.salesDiscounts.name}` : 'NULL'
    });
    
    return resolvedAccounts;
  }

  /**
   * Maps expense category to appropriate revenue account
   * (Used when expense documents are actually revenue - like invoices)
   */
  static mapCategoryToRevenueAccount(categoryKey) {
    const revenueMapping = {
      'SOFTWARE': '4020',           // Services Revenue (software development)
      'PROFESSIONAL_SERVICES': '4020', // Services Revenue
      'OFFICE_SUPPLIES': '4010',    // Product Sales
      'MARKETING': '4020',          // Services Revenue (marketing services)
      'TRAINING': '4020',           // Services Revenue (training services)
      'CONSULTING': '4020',         // Services Revenue
      'OTHER': '4020'               // Default to Services Revenue
    };
    
    return revenueMapping[categoryKey] || '4020'; // Default to Services Revenue
  }

  /**
   * Maps line item category/description to specific revenue account
   * For detailed multi-line invoice posting
   */
  static mapLineItemToRevenueAccount(lineItem) {
    // Enhanced mapping based on line item description and category
    const description = (lineItem.description || '').toLowerCase();
    const category = (lineItem.category || '').toLowerCase();
    
    // Specific service mappings
    if (description.includes('web development') || description.includes('website') || category.includes('development')) {
      return '4020'; // Services Revenue - Development
    }
    if (description.includes('seo') || description.includes('marketing') || category.includes('marketing')) {
      return '4030'; // Services Revenue - Marketing  
    }
    if (description.includes('design') || description.includes('ui/ux') || category.includes('design')) {
      return '4020'; // Services Revenue - Design
    }
    if (description.includes('consulting') || description.includes('consultation') || category.includes('consulting')) {
      return '4020'; // Services Revenue - Consulting
    }
    if (description.includes('training') || description.includes('documentation') || category.includes('support')) {
      return '4040'; // Services Revenue - Training/Support
    }
    if (description.includes('hosting') || description.includes('maintenance') || category.includes('support')) {
      return '4040'; // Services Revenue - Support
    }
    
    // Default to general services revenue
    return '4020'; // Services Revenue
  }

  /**
   * Helper method to get a single account by code
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
      return account;
    } catch (error) {
      console.error(`❌ Error fetching account ${accountCode}:`, error);
      throw new Error(`Failed to fetch account ${accountCode}: ${error.message}`);
    }
  }

  /**
   * Helper method to get accounts by code as lookup object
   */
  static async getAccountsByCodeLookup(accountCodes) {
    try {
      const accounts = await prisma.account.findMany({
        where: {
          code: { in: accountCodes }
        },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          normalBalance: true
        }
      });

      // Create lookup object
      const accountLookup = {};
      accounts.forEach(account => {
        accountLookup[account.code] = account;
      });

      // Validate all required accounts exist
      const missingCodes = accountCodes.filter(code => !accountLookup[code]);
      if (missingCodes.length > 0) {
        throw new Error(`Missing accounts in Chart of Accounts: ${missingCodes.join(', ')}`);
      }

      return accountLookup;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }
  }

  /**
   * Determines invoice status based on payment information
   */
  static determineInvoiceStatus(paymentStatus, balanceDue) {
    if (paymentStatus === 'paid' || Math.abs(balanceDue) < 0.01) {
      return 'PAID';
    } else if (paymentStatus === 'partial') {
      return 'SENT'; // Partially paid but still open
    } else if (paymentStatus === 'overpaid') {
      return 'PAID'; // Overpaid invoices are considered paid
    } else {
      return 'SENT'; // Default to sent for unpaid invoices
    }
  }

  /**
   * Builds invoice description for Transaction record
   */
  static buildInvoiceDescription(invoiceData) {
    const invoiceNum = invoiceData.invoiceNumber || 'Invoice';
    return `${invoiceNum} - ${invoiceData.customerName}`;
  }

  /**
   * Validates invoice payload and normalizes data
   * Used by server endpoints before calling postInvoiceTransaction
   */
  static validateInvoicePayload(requestBody) {
    const errors = [];
    
    // Required fields validation
    if (!requestBody.customerName || typeof requestBody.customerName !== 'string') {
      errors.push('customerName is required and must be a string');
    }
    
    if (!requestBody.amount || isNaN(parseFloat(requestBody.amount)) || parseFloat(requestBody.amount) <= 0) {
      errors.push('amount is required and must be a positive number');
    }
    
    if (!requestBody.date) {
      errors.push('date is required');
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (requestBody.date && !dateRegex.test(requestBody.date)) {
      errors.push('date must be in YYYY-MM-DD format');
    }
    
    // Validate payment status
    const validPaymentStatuses = ['paid', 'invoice', 'overpaid', 'partial'];
    const paymentStatus = requestBody.paymentStatus || 'paid';
    if (!validPaymentStatuses.includes(paymentStatus)) {
      errors.push(`paymentStatus must be one of: ${validPaymentStatuses.join(', ')}`);
    }
    
    if (errors.length > 0) {
      return {
        isValid: false,
        errors: errors
      };
    }
    
    // Calculate amounts
    const totalAmount = parseFloat(requestBody.amount);
    const amountPaid = parseFloat(requestBody.amountPaid || requestBody.amount);
    const balanceDue = parseFloat(requestBody.balanceDue || (totalAmount - amountPaid));
    
    // Validate and normalize line items (if provided)
    let lineItems = [];
    if (requestBody.lineItems && Array.isArray(requestBody.lineItems)) {
      if (requestBody.lineItems.length === 0) {
        errors.push('lineItems array cannot be empty if provided');
      } else {
        lineItems = requestBody.lineItems.map((item, index) => {
          if (!item.description || typeof item.description !== 'string') {
            errors.push(`lineItems[${index}].description is required and must be a string`);
          }
          if (!item.amount || isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0) {
            errors.push(`lineItems[${index}].amount is required and must be a positive number`);
          }
          return {
            description: item.description || `Line Item ${index + 1}`,
            amount: parseFloat(item.amount || 0).toFixed(2),
            quantity: parseInt(item.quantity || 1),
            rate: parseFloat(item.rate || item.amount || 0).toFixed(2),
            category: item.category || 'PROFESSIONAL_SERVICES'
          };
        });
      }
    }

    // Final validation check
    if (errors.length > 0) {
      return {
        isValid: false,
        errors: errors
      };
    }

    // Validate and normalize tax settings
    let taxSettings = { enabled: false };
    if (requestBody.taxSettings && requestBody.taxSettings.enabled) {
      taxSettings = {
        enabled: true,
        name: requestBody.taxSettings.name || 'Sales Tax',
        type: requestBody.taxSettings.type || 'percentage',
        rate: parseFloat(requestBody.taxSettings.rate || 0),
        amount: parseFloat(requestBody.taxSettings.amount || 0),
        taxExempt: requestBody.taxSettings.taxExempt || false
      };
    }

    // Validate and normalize discount settings
    let discount = { enabled: false };
    if (requestBody.discount && requestBody.discount.enabled) {
      discount = {
        enabled: true,
        description: requestBody.discount.description || 'Discount',
        type: requestBody.discount.type || 'fixed',
        value: parseFloat(requestBody.discount.value || 0),
        amount: parseFloat(requestBody.discount.amount || 0)
      };
    }

    // Calculate subtotal if not provided
    const subtotal = parseFloat(requestBody.subtotal || requestBody.amount || 0);

    // Normalize and return clean data
    const normalizedData = {
      customerName: requestBody.customerName.trim(),
      amount: totalAmount.toFixed(2),
      subtotal: subtotal.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      balanceDue: balanceDue.toFixed(2),
      date: requestBody.date,
      categoryKey: requestBody.categoryKey || requestBody.category || 'OFFICE_SUPPLIES',
      paymentStatus: paymentStatus,
      description: requestBody.description || requestBody.notes || `Invoice from ${requestBody.customerName}`,
      invoiceNumber: requestBody.invoiceNumber || null,
      dueDate: requestBody.dueDate || null,
      reference: requestBody.reference || null,
      lineItems: lineItems, // Add line items to normalized data
      taxSettings: taxSettings, // Add tax settings
      discount: discount // Add discount settings
    };
    
    return {
      isValid: true,
      errors: [],
      normalizedData: normalizedData
    };
  }
}

export { PostingService };
