"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PaymentStatistics,
  PaymentTypeBreakdown,
  PaymentMethodBreakdown,
} from "@/components/payments/payment-statistics";
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Download,
  Filter,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { PaymentStatus, PaymentType, PaymentMethod } from "@/types";

interface PaymentData {
  _id: string;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  dueDate: string;
  paidDate?: string;
  createdAt: string;
  updatedAt: string;
}

export default function PaymentAnalyticsPage() {
  const { data: session } = useSession();
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<string>("30"); // days
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Fetch payments data
  useEffect(() => {
    const fetchPayments = async () => {
      if (!session) return;

      try {
        setIsLoading(true);

        // Build query parameters
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (typeFilter !== "all") params.append("type", typeFilter);

        // Add date range filter
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - parseInt(dateRange));
        params.append("startDate", startDate.toISOString());
        params.append("endDate", endDate.toISOString());

        const response = await fetch(`/api/payments?${params.toString()}`);

        if (response.ok) {
          const result = await response.json();
          setPayments(result.data || []);
        } else {
          throw new Error("Failed to fetch payments");
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load payment analytics. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayments();
  }, [session, dateRange, statusFilter, typeFilter]);

  const handleExport = async () => {
    try {
      // Build query parameters for export
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(dateRange));
      params.append("startDate", startDate.toISOString());
      params.append("endDate", endDate.toISOString());
      params.append("export", "true");

      const response = await fetch(`/api/payments?${params.toString()}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payment-analytics-${
          new Date().toISOString().split("T")[0]
        }.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success("Payment analytics exported successfully.");
      } else {
        throw new Error("Failed to export data");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to export payment analytics. Please try again."
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted rounded animate-pulse" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-muted rounded animate-pulse" />
        </div>

        {/* Stats Skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 w-32 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/dashboard/payments">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Payments
              </Button>
            </Link>
          </div>
          <h1 className="text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Payment Analytics
          </h1>
          <p className="text-muted-foreground">
            Comprehensive payment analytics and financial insights
          </p>
        </div>

        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Analytics Filters
          </CardTitle>
          <CardDescription>
            Filter the analytics data by date range, status, and payment type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 3 months</SelectItem>
                  <SelectItem value="180">Last 6 months</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value={PaymentStatus.PENDING}>Pending</SelectItem>
                <SelectItem value={PaymentStatus.PENDING}>
                  Processing
                </SelectItem>
                <SelectItem value={PaymentStatus.PAID}>
                  Completed
                </SelectItem>
                <SelectItem value={PaymentStatus.FAILED}>Failed</SelectItem>
                <SelectItem value={PaymentStatus.REFUNDED}>Refunded</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value={PaymentType.RENT}>Rent</SelectItem>
                <SelectItem value={PaymentType.SECURITY_DEPOSIT}>
                  Security Deposit
                </SelectItem>
                <SelectItem value={PaymentType.INVOICE}>Invoice</SelectItem>
                <SelectItem value={PaymentType.LATE_FEE}>Late Fee</SelectItem>
                <SelectItem value={PaymentType.PET_DEPOSIT}>
                  Pet Deposit
                </SelectItem>
                <SelectItem value={PaymentType.UTILITY}>Utility</SelectItem>
                <SelectItem value={PaymentType.MAINTENANCE}>
                  Maintenance
                </SelectItem>
                <SelectItem value={PaymentType.OTHER}>Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payment Statistics */}
      <PaymentStatistics payments={payments} />

      {/* Breakdown Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <PaymentTypeBreakdown payments={payments} />
        <PaymentMethodBreakdown payments={payments} />
      </div>

      {/* Additional Analytics Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Insights
            </CardTitle>
            <CardDescription>
              Key performance indicators and trends
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Total Transactions
              </span>
              <span className="font-medium">{payments.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Successful Payments
              </span>
              <span className="font-medium">
                {
                  payments.filter((p) => p.status === PaymentStatus.PAID)
                    .length
                }
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Failed Payments
              </span>
              <span className="font-medium text-red-600">
                {
                  payments.filter((p) => p.status === PaymentStatus.FAILED)
                    .length
                }
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Pending Payments
              </span>
              <span className="font-medium text-orange-600">
                {
                  payments.filter((p) => p.status === PaymentStatus.PENDING)
                    .length
                }
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Date Range Summary
            </CardTitle>
            <CardDescription>
              Summary for the selected time period
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Date Range</span>
              <span className="font-medium">
                {dateRange === "7" && "Last 7 days"}
                {dateRange === "30" && "Last 30 days"}
                {dateRange === "90" && "Last 3 months"}
                {dateRange === "180" && "Last 6 months"}
                {dateRange === "365" && "Last year"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Total Revenue
              </span>
              <span className="font-medium">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(payments.reduce((sum, p) => sum + p.amount, 0))}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Average per Day
              </span>
              <span className="font-medium">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(
                  payments.reduce((sum, p) => sum + p.amount, 0) /
                    parseInt(dateRange)
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
