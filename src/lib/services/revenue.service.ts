/**
 * PropertyPro - Revenue Service
 * Read-only aggregation of income from Payments and Invoices
 */

import { Types } from "mongoose";
import { Payment, Invoice } from "@/models";
import { PaymentStatus, PaymentType, InvoiceStatus } from "@/types";

export interface RevenueSummary {
  totalRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
  monthToDate: number;
  yearToDate: number;
  collectionRate: number;
  count: number;
}

export interface RevenueByCategory {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface RevenueByProperty {
  propertyId: string;
  propertyName: string;
  revenue: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
}

export interface MonthlyRevenue {
  year: number;
  month: number;
  revenue: number;
  collected: number;
  count: number;
}

export class RevenueService {
  /**
   * Get revenue summary stats
   */
  async getRevenueSummary(propertyId?: string): Promise<RevenueSummary> {
    const baseMatch: any = {};
    if (propertyId) {
      baseMatch.propertyId = new Types.ObjectId(propertyId);
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const completedStatuses = [PaymentStatus.PAID];
    const outstandingStatuses = [
      PaymentStatus.PENDING,
      PaymentStatus.OVERDUE,
      PaymentStatus.PARTIAL,
    ];

    const [collected, outstanding, mtd, ytd, totalC