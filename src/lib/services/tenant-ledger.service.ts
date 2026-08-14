/**
 * PropertyPro - Tenant Ledger Service
 * Service for generating comprehensive tenant ledgers with running balances
 */

import { Types } from "mongoose";
import { Invoice, Payment } from "@/models";
import { InvoiceStatus, PaymentStatus } from "@/types";

export interface LedgerEntry {
  id: string;
  date: Date;
  type: "debit" | "credit";
  category:
    | "rent"
    | "security_deposit"
    | "late_fee"
    | "utility"
    | "maintenance"
    | "payment"
    | "other";
  description: string;
  reference: string; // Invoice number or payment reference
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  relatedId: string; // Invoice or Payment ID
  status: string;
}

export interface LedgerSummary {
  tenantId: string;
  tenantName: string;
  propertyName: string;
  leaseId?: string;
  periodStart: Date;
  periodEnd: Date;

  // Financial Summary
  totalDebits: number;
  totalCredits: number;
  currentBalance: number;

  // Breakdown by Category
  breakdown: {
    rent: { debits: number; credits: number };
    securityDeposit: { debits: number; credits: number };
    lateFees: { debits: number; credits: number };
    utilities: { debits: number; credits: number };
    maintenance: { debits: number; credits: number };
    other: { debits: number; credits: number };
  };

  // Status Counts
  statusCounts: {
    paidInvoices: number;
    unpaidInvoices: number;
    overdueInvoices: number;
    totalPayments: number;
  };
}

export interface LedgerReport {
  summary: LedgerSummary;
  entries: LedgerEntry[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class TenantLedgerService {
  /**
   * Generate comprehensive tenant ledger
   */
  async generateTenantLedger(
    tenantId: string,
    options: {
      leaseId?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
      includeZeroBalanceEntries?: boolean;
    } = {}
  ): Promise<LedgerReport> {
    const {
      leaseId,
      startDate = new Date(new Date().getFullYear(), 0, 1), // Start of current year
      endDate = new Date(),
      page = 1,
      limit = 100,
      includeZeroBalanceEntries = true,
    } = options;

    // Build filter for invoices and payments
    const filter: any = {
      tenantId: new Types.ObjectId(tenantId),
      createdAt: { $gte: startDate, $lte: endDate },
    };

    if (leaseId) {
      filter.leaseId = new Types.ObjectId(leaseId);
    }

    // Get all invoices and payments for the period
    const [invoices, payments] = await Promise.all([
      Invoice.find(filter)
        .populate("tenantId", "firstName lastName")
        .populate("propertyId", "name")
        .sort({ createdAt: 1 })
        .lean(),
      Payment.find(filter)
        .populate("tenantId", "firstName lastName")
        .populate("propertyId", "name")
        .sort({ createdAt: 1 })
        .lean(),
    ]);

    // Convert to ledger entries
    const entries = await this.convertToLedgerEntries(invoices, payments);

    // Calculate running balances
    this.calculateRunningBalances(entries);

    // Filter out zero balance entries if requested
    const filteredEntries = includeZeroBalanceEntries
      ? entries
      : entries.filter(
          (entry) => entry.debitAmount > 0 || entry.creditAmount > 0
        );

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedEntries = filteredEntries.slice(
      startIndex,
      startIndex + limit
    );

    // Generate summary
    const summary = this.generateLedgerSummary(
      tenantId,
      invoices,
      payments,
      startDate,
      endDate,
      leaseId
    );

    return {
      summary,
      entries: paginatedEntries,
      pagination: {
        page,
        limit,
        total: filteredEntries.length,
        pages: Math.ceil(filteredEntries.length / limit),
      },
    };
  }

  /**
   * Convert invoices and payments to ledger entries
   */
  private async convertToLedgerEntries(
    invoices: any[],
    payments: any[]
  ): Promise<LedgerEntry[]> {
    const entries: LedgerEntry[] = [];

    // Add invoice entries (debits)
    for (const invoice of invoices) {
      for (const lineItem of invoice.lineItems) {
        entries.push({
          id: `invoice-${invoice._id}-${lineItem.type}`,
          date: invoice.issueDate,
          type: "debit",
          category: this.mapInvoiceTypeToCategory(lineItem.type),
          description: lineItem.description,
          reference: invoice.invoiceNumber,
          debitAmount: lineItem.amount,
          creditAmount: 0,
          runningBalance: 0, // Will be calculated later
          relatedId: invoice._id.toString(),
          status: invoice.status,
        });
      }
    }

    // Add payment entries (credits)
    for (const payment of payments) {
      entries.push({
        id: `payment-${payment._id}`,
        date: payment.paidDate || payment.createdAt,
        type: "credit",
        category: "payment",
        description:
          payment.description || `Payment - ${payment.paymentMethod}`,
        reference: `PAY-${payment._id.toString().slice(-6).toUpperCase()}`,
        debitAmount: 0,
        creditAmount: payment.amount,
        runningBalance: 0, // Will be calculated later
        relatedId: payment._id.toString(),
        status: payment.status,
      });
    }

    // Sort by date
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    return entries;
  }

  /**
   * Calculate running balances for ledger entries
   */
  private calculateRunningBalances(entries: LedgerEntry[]): void {
    let runningBalance = 0;

    for (const entry of entries) {
      if (entry.type === "debit") {
        runningBalance += entry.debitAmount;
      } else {
        runningBalance -= entry.creditAmount;
      }
      entry.runningBalance = Math.round(runningBalance * 100) / 100;
    }
  }

  /**
   * Generate ledger summary
   */
  private generateLedgerSummary(
    tenantId: string,
    invoices: any[],
    payments: any[],
    startDate: Date,
    endDate: Date,
    leaseId?: string
  ): LedgerSummary {
    // Calculate totals
    const totalDebits = invoices.reduce(
      (sum, invoice) =>
        sum +
        invoice.lineItems.reduce(
          (itemSum: number, item: any) => itemSum + item.amount,
          0
        ),
      0
    );

    const totalCredits = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );
    const currentBalance = totalDebits - totalCredits;

    // Calculate breakdown by category
    const breakdown = {
      rent: { debits: 0, credits: 0 },
      securityDeposit: { debits: 0, credits: 0 },
      lateFees: { debits: 0, credits: 0 },
      utilities: { debits: 0, credits: 0 },
      maintenance: { debits: 0, credits: 0 },
      other: { debits: 0, credits: 0 },
    };

    // Sum debits by category
    for (const invoice of invoices) {
      for (const lineItem of invoice.lineItems) {
        const category = this.mapInvoiceTypeToCategory(lineItem.type);
        if (breakdown[category as keyof typeof breakdown]) {
          breakdown[category as keyof typeof breakdown].debits +=
            lineItem.amount;
        }
      }
    }

    // All payments are credits (simplified - could be more granular)
    breakdown.rent.credits = totalCredits; // Simplified allocation

    // Calculate status counts
    const statusCounts = {
      paidInvoices: invoices.filter((inv) => inv.status === InvoiceStatus.PAID)
        .length,
      unpaidInvoices: invoices.filter(
        (inv) =>
          inv.status === InvoiceStatus.ISSUED ||
          inv.status === InvoiceStatus.PARTIAL
      ).length,
      overdueInvoices: invoices.filter(
        (inv) => inv.status === InvoiceStatus.OVERDUE
      ).length,
      totalPayments: payments.length,
    };

    // Get tenant and property names
    const tenantName =
      invoices.length > 0
        ? `${invoices[0].tenantId.firstName} ${invoices[0].tenantId.lastName}`
        : payments.length > 0
        ? `${payments[0].tenantId.firstName} ${payments[0].tenantId.lastName}`
        : "Unknown Tenant";

    const propertyName =
      invoices.length > 0
        ? invoices[0].propertyId.name
        : payments.length > 0
        ? payments[0].propertyId.name
        : "Unknown Property";

    return {
      tenantId,
      tenantName,
      propertyName,
      leaseId,
      periodStart: startDate,
      periodEnd: endDate,
      totalDebits,
      totalCredits,
      currentBalance,
      breakdown,
      statusCounts,
    };
  }

  /**
   * Map invoice type to ledger category
   */
  private mapInvoiceTypeToCategory(invoiceType: string): string {
    const mapping: Record<string, string> = {
      rent: "rent",
      security_deposit: "securityDeposit",
      late_fee: "lateFees",
      utility: "utilities",
      maintenance: "maintenance",
    };

    return mapping[invoiceType] || "other";
  }

  /**
   * Export ledger to CSV format
   */
  async exportLedgerToCSV(
    tenantId: string,
    options: {
      leaseId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<string> {
    const ledger = await this.generateTenantLedger(tenantId, {
      ...options,
      limit: 10000, // Get all entries for export
    });

    const headers = [
      "Date",
      "Type",
      "Catégorie",
      "Description",
      "Référence",
      "Debit Amount",
      "Credit Amount",
      "Running Balance",
      "Statut",
    ];

    const rows = ledger.entries.map((entry) => [
      entry.date.toLocaleDateString(),
      entry.type,
      entry.category,
      entry.description,
      entry.reference,
      entry.debitAmount.toFixed(2),
      entry.creditAmount.toFixed(2),
      entry.runningBalance.toFixed(2),
      entry.status,
    ]);

    // Convert to CSV
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    return csvContent;
  }

  /**
   * Get current tenant balance
   */
  async getCurrentBalance(
    tenantId: string,
    leaseId?: string
  ): Promise<{
    currentBalance: number;
    totalOutstanding: number;
    overdueAmount: number;
    lastPaymentDate?: Date;
    lastPaymentAmount?: number;
  }> {
    const filter: any = { tenantId: new Types.ObjectId(tenantId) };
    if (leaseId) filter.leaseId = new Types.ObjectId(leaseId);

    // Get outstanding invoices
    const outstandingInvoices = await Invoice.find({
      ...filter,
      balanceRemaining: { $gt: 0 },
    });

    // Get recent payment
    const recentPayment = await Payment.findOne({
      ...filter,
      status: PaymentStatus.PAID,
    }).sort({ paidDate: -1 });

    const totalOutstanding = outstandingInvoices.reduce(
      (sum, inv) => sum + inv.balanceRemaining,
      0
    );

    const overdueAmount = outstandingInvoices
      .filter((inv) => inv.status === InvoiceStatus.OVERDUE)
      .reduce((sum, inv) => sum + inv.balanceRemaining, 0);

    return {
      currentBalance: totalOutstanding,
      totalOutstanding,
      overdueAmount,
      lastPaymentDate: recentPayment?.paidDate,
      lastPaymentAmount: recentPayment?.amount,
    };
  }
}

export const tenantLedgerService = new TenantLedgerService();
