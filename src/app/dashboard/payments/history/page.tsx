"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AnalyticsCard,
  AnalyticsCardGrid,
} from "@/components/analytics/AnalyticsCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Download,
  Calendar,
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Eye,
  Loader2,
  ExternalLink,
  X,
} from "lucide-react";
import { PaymentStatus, PaymentType } from "@/types";
import { downloadInvoiceAsPDF, PrintableInvoice } from "@/lib/invoice-print";
import { normalizeInvoiceForPrint } from "@/lib/invoice/invoice-shared";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import GlobalSearch from "@/components/ui/global-search";
import { useAuthorization } from "@/hooks/useAuthorization";

interface PaymentHistoryItem {
  _id: string;
  amount: number;
  amountPaid?: number;
  type: PaymentType;
  status: PaymentStatus;
  paymentMethod?: string;
  dueDate: string;
  paidDate?: string;
  description?: string;
  notes?: string;
  receiptUrl?: string;
  stripePaymentIntentId?: string;
  lateFeeApplied?: number;
  referenceNumber?: string;
  propertyId: {
    _id?: string;
    name?: string;
    address?:
      | {
          street?: string;
          city?: string;
          state?: string;
          zipCode?: string;
          [key: string]: any;
        }
      | string;
  };
  tenantId?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  leaseId?: {
    _id: string;
    startDate: string;
    endDate: string;
  };
  invoiceId?: {
    _id: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    status: string;
    subtotal?: number;
    taxAmount?: number;
    totalAmount: number;
    amountPaid: number;
    balanceRemaining: number;
    notes?: string;
    lineItems?: Array<{
      description: string;
      amount?: number;
      type?: string;
      quantity?: number;
      unitPrice?: number;
    }>;
    propertyId?: {
      name?: string;
      address?:
        | {
            street?: string;
            city?: string;
            state?: string;
            zipCode?: string;
            [key: string]: any;
          }
        | string;
    };
    tenantId?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface PaymentSummary {
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  paymentsThisMonth: number;
  paymentsThisYear: number;
  averagePaymentAmount: number;
  onTimePaymentRate: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PaymentHistoryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isTenant } = useAuthorization();
  const { t, formatCurrency, formatDate } = useLocalizationContext();

  // State management
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0,
  });

  // Filter state
  const [filters, setFilters] = useState({
    status: "all",
    type: "all",
    search: "",
    startDate: "",
    endDate: "",
    paymentMethod: "all",
  });
  const [isSearching, setIsSearching] = useState(false);

  // Modal state
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentHistoryItem | null>(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState<
    string | null
  >(null);

  // Authentication check
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/auth/signin");
      return;
    }

    if (!isTenant) {
      toast.error(t("payments.history.toasts.accessDenied"));
      router.push("/dashboard");
      return;
    }
  }, [session, status, isTenant, router, t]);

  // Fetch payment history
  useEffect(() => {
    if (session?.user && isTenant) {
      fetchPaymentHistory();
    }
  }, [session, isTenant, pagination.page, filters]);

  const fetchPaymentHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const searchParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      // Add filters to search params
      if (filters.status !== "all") {
        searchParams.append("status", filters.status);
      }
      if (filters.type !== "all") {
        searchParams.append("type", filters.type);
      }
      if (filters.paymentMethod !== "all") {
        searchParams.append("paymentMethod", filters.paymentMethod);
      }
      if (filters.startDate) {
        searchParams.append("startDate", filters.startDate);
      }
      if (filters.endDate) {
        searchParams.append("endDate", filters.endDate);
      }
      if (filters.search) {
        searchParams.append("search", filters.search);
      }

      // Fetch payment history
      const historyResponse = await fetch(
        `/api/tenant/payments?${searchParams}`
      );
      if (!historyResponse.ok) {
        throw new Error(t("payments.history.toasts.loadFailed"));
      }
      const historyData = await historyResponse.json();

      // Fetch payment summary (only on first load or when filters change significantly)
      let summaryData = null;
      if (pagination.page === 1) {
        try {
          const summaryResponse = await fetch("/api/tenant/payments/summary");
          if (summaryResponse.ok) {
            summaryData = await summaryResponse.json();
            setPaymentSummary(summaryData.data?.summary || null);
          }
        } catch (summaryError) {
          // Failed to fetch payment summary
        }
      }

      setPayments(historyData.data?.payments || []);
      setPagination(historyData.data?.pagination || pagination);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("payments.history.toasts.loadFailed");
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Utility functions
  const formatPropertyAddress = (
    address?: PaymentHistoryItem["propertyId"]["address"]
  ) => {
    if (!address) return t("leases.details.common.notAvailable");
    if (typeof address === "string") return address;
    const parts = [address.street, address.city, address.state, address.zipCode]
      .filter(Boolean)
      .map((part) => part?.toString().trim())
      .filter(Boolean);
    return parts.length
      ? parts.join(", ")
      : t("leases.details.common.notAvailable");
  };

  const buildPrintableInvoice = (
    payment: PaymentHistoryItem
  ): PrintableInvoice | null => {
    const invoice = payment.invoiceId;
    if (!invoice) {
      const fallbackInvoice = {
        invoiceNumber:
          payment.referenceNumber ||
          `PAY-${payment._id?.slice?.(-8)?.toUpperCase?.() || Date.now()}`,
        issueDate: payment.paidDate || payment.createdAt,
        dueDate: payment.paidDate || payment.createdAt,
        status: payment.status === "paid" ? "paid" : "issued",
        subtotal: payment.amount,
        totalAmount: payment.amount,
        amountPaid: payment.amount,
        balanceRemaining: 0,
        notes: payment.notes,
        tenantId: payment.tenantId,
        propertyId: payment.propertyId,
        lineItems: [
          {
            description:
              payment.description ||
              payment.type
                .replace("_", " ")
                .replace(/\b\w/g, (l) => l.toUpperCase()),
            amount: payment.amount,
            quantity: 1,
            unitPrice: payment.amount,
            total: payment.amount,
            type: payment.type,
          },
        ],
      } as Record<string, unknown>;

      return normalizeInvoiceForPrint(fallbackInvoice) as PrintableInvoice;
    }

    const normalizedInvoice = normalizeInvoiceForPrint(
      {
        ...invoice,
        status: invoice.status || payment.status,
        propertyId: invoice.propertyId || payment.propertyId,
        lineItems:
          Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0
            ? invoice.lineItems
            : [
                {
                  description:
                    payment.description ||
                    payment.type
                      .replace("_", " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase()),
                  amount: payment.amount,
                  quantity: 1,
                  unitPrice: payment.amount,
                  total: payment.amount,
                  type: payment.type,
                },
              ],
      },
      { fallbackStatus: invoice.status || payment.status }
    );

    return normalizedInvoice as PrintableInvoice;
  };

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case PaymentStatus.FAILED:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case PaymentStatus.PENDING:
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case PaymentStatus.OVERDUE:
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return (
          <Badge variant="default" className="bg-green-500">
            {t("payments.history.statusBadge.paid")}
          </Badge>
        );
      case PaymentStatus.FAILED:
        return (
          <Badge variant="destructive">
            {t("payments.history.statusBadge.failed")}
          </Badge>
        );
      case PaymentStatus.PENDING:
        return (
          <Badge variant="secondary">
            {t("payments.history.statusBadge.pending")}
          </Badge>
        );
      case PaymentStatus.OVERDUE:
        return (
          <Badge variant="destructive">
            {t("payments.history.statusBadge.overdue") || "Overdue"}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentTypeLabel = (type: PaymentType) => {
    switch (type) {
      case "rent":
        return t("payments.history.filters.type.rent");
      case "security_deposit":
        return t("payments.history.filters.type.securityDeposit");
      case "late_fee":
        return t("payments.history.filters.type.lateFee");
      case "utility":
        return t("payments.history.filters.type.utility");
      default:
        return t("payments.history.filters.type.other");
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handleSearch = (value: string) => {
    setIsSearching(true);
    setFilters((prev) => ({ ...prev, search: value }));
    setTimeout(() => setIsSearching(false), 100);
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const downloadReceipt = async (payment: PaymentHistoryItem) => {
    try {
      setIsDownloadingReceipt(payment._id);

      if (payment.invoiceId) {
        const printable = buildPrintableInvoice(payment);
        if (!printable) {
          throw new Error(t("payments.history.toasts.receiptIncomplete"));
        }

        // Fetch company info from display settings
        const { getCompanyInfo } = await import("@/lib/utils/company-info");
        const companyInfo = await getCompanyInfo();

        // Normalize with company info
        const normalizedPrintable = normalizeInvoiceForPrint(printable, {
          companyInfo: companyInfo || undefined,
        }) as PrintableInvoice;

        await downloadInvoiceAsPDF(normalizedPrintable);
        toast.success(t("payments.history.toasts.receiptGenerated"));
        return;
      }

      throw new Error(t("payments.history.toasts.receiptNotAvailable"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("payments.history.toasts.receiptDownloadFailed")
      );
    } finally {
      setIsDownloadingReceipt(null);
    }
  };

  const viewPaymentDetails = (payment: PaymentHistoryItem) => {
    setSelectedPayment(payment);
    setShowPaymentDetails(true);
  };

  const exportPaymentHistory = async (format: "csv" | "pdf") => {
    try {
      const searchParams = new URLSearchParams({
        format,
        ...(filters.status !== "all" && { status: filters.status }),
        ...(filters.type !== "all" && { type: filters.type }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(
        `/api/tenant/payments/export?${searchParams}`
      );
      if (!response.ok) {
        throw new Error(t("payments.history.toasts.exportFailed"));
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payment-history.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(
        t("payments.history.toasts.exportSuccess", {
          values: { format: format.toUpperCase() },
        })
      );
    } catch (error) {
      toast.error(t("payments.history.toasts.exportFailed"));
    }
  };

  // Loading state handled by route-level loading.tsx

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl">
              {t("payments.history.header.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("payments.history.header.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Payment Summary Statistics */}
      {paymentSummary && (
        <AnalyticsCardGrid className="md:grid-cols-2 lg:grid-cols-4">
          <AnalyticsCard
            title={t("payments.history.stats.totalPaid.title")}
            value={formatCurrency(paymentSummary.totalPaid)}
            description={t("payments.history.stats.totalPaid.subtitle", {
              values: { count: paymentSummary.paymentsThisYear },
            })}
            icon={DollarSign}
            iconColor="success"
          />
          <AnalyticsCard
            title={t("payments.history.stats.averagePayment.title")}
            value={formatCurrency(paymentSummary.averagePaymentAmount)}
            description={t("payments.history.stats.averagePayment.subtitle")}
            icon={TrendingUp}
            iconColor="info"
          />
          <AnalyticsCard
            title={t("payments.history.stats.onTimeRate.title")}
            value={`${Math.round(paymentSummary.onTimePaymentRate)}%`}
            description={t("payments.history.stats.onTimeRate.subtitle")}
            icon={CheckCircle}
            iconColor="success"
          />
          <AnalyticsCard
            title={t("payments.history.stats.thisMonth.title")}
            value={paymentSummary.paymentsThisMonth}
            description={t("payments.history.stats.thisMonth.subtitle")}
            icon={Calendar}
            iconColor="warning"
          />
        </AnalyticsCardGrid>
      )}

      {/* Integrated Filters Bar */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-100 dark:border-green-800">
                <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t("payments.table.title")} ({pagination.total})
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("payments.table.description")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/60 dark:border-gray-700/60">
            <GlobalSearch
              placeholder={t("payments.filters.searchPlaceholder")}
              initialValue={filters.search}
              debounceDelay={300}
              onSearch={handleSearch}
              isLoading={isSearching}
              className="flex-1 min-w-0"
              ariaLabel="Search payments"
            />

            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={filters.status}
                onValueChange={(v) => handleFilterChange("status", v)}
              >
                <SelectTrigger className="h-10 w-[160px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <SelectValue
                    placeholder={t("payments.filters.allStatuses")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("payments.filters.allStatuses")}
                  </SelectItem>
                  <SelectItem value="pending">
                    {t("payments.filters.pending")}
                  </SelectItem>
                  <SelectItem value="paid">
                    {t("payments.filters.paid")}
                  </SelectItem>
                  <SelectItem value="partial">
                    {t("payments.filters.partial")}
                  </SelectItem>
                  <SelectItem value="overdue">
                    {t("payments.filters.overdue")}
                  </SelectItem>
                  <SelectItem value="cancelled">
                    {t("payments.filters.cancelled")}
                  </SelectItem>
                  <SelectItem value="refunded">
                    {t("payments.filters.refunded")}
                  </SelectItem>
                  <SelectItem value="failed">
                    {t("payments.filters.failed")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.type}
                onValueChange={(v) => handleFilterChange("type", v)}
              >
                <SelectTrigger className="h-10 w-[160px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <SelectValue placeholder={t("payments.filters.allTypes")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("payments.filters.allTypes")}
                  </SelectItem>
                  <SelectItem value="rent">
                    {t("payments.filters.rent")}
                  </SelectItem>
                  <SelectItem value="security_deposit">
                    {t("payments.filters.securityDeposit")}
                  </SelectItem>
                  <SelectItem value="invoice">
                    {t("payments.filters.invoice")}
                  </SelectItem>
                  <SelectItem value="late_fee">
                    {t("payments.filters.lateFee")}
                  </SelectItem>
                  <SelectItem value="utility">
                    {t("payments.filters.utility")}
                  </SelectItem>
                  <SelectItem value="maintenance">
                    {t("payments.filters.maintenance")}
                  </SelectItem>
                  <SelectItem value="pet_deposit">
                    {t("payments.filters.petDeposit")}
                  </SelectItem>
                  <SelectItem value="other">
                    {t("payments.filters.other")}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.paymentMethod}
                onValueChange={(v) => handleFilterChange("paymentMethod", v)}
              >
                <SelectTrigger className="h-10 w-[160px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <SelectValue placeholder={t("payments.filters.allMethods")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("payments.filters.allMethods")}
                  </SelectItem>
                  <SelectItem value="credit_card">
                    {t("payments.filters.creditCard")}
                  </SelectItem>
                  <SelectItem value="debit_card">
                    {t("payments.filters.debitCard")}
                  </SelectItem>
                  <SelectItem value="bank_transfer">
                    {t("payments.filters.bankTransfer")}
                  </SelectItem>
                  <SelectItem value="ach">
                    {t("payments.filters.ach")}
                  </SelectItem>
                  <SelectItem value="check">
                    {t("payments.filters.check")}
                  </SelectItem>
                  <SelectItem value="cash">
                    {t("payments.filters.cash")}
                  </SelectItem>
                  <SelectItem value="money_order">
                    {t("payments.filters.moneyOrder")}
                  </SelectItem>
                  <SelectItem value="other">
                    {t("payments.filters.other")}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value)
                }
                className="h-10 w-[160px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              />

              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="h-10 w-[160px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              />

              {(filters.search ||
                filters.status !== "all" ||
                filters.type !== "all" ||
                filters.paymentMethod !== "all" ||
                filters.startDate ||
                filters.endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilters({
                      status: "all",
                      type: "all",
                      search: "",
                      startDate: "",
                      endDate: "",
                      paymentMethod: "all",
                    });
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="h-10 px-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {t("payments.filters.clearAll")}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 border rounded"
                >
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-40 mb-2" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-24 ml-auto" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {t("payments.history.table.error.title")}
              </h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchPaymentHistory}>
                {t("payments.history.table.error.button")}
              </Button>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {t("payments.history.table.empty.title")}
              </h3>
              <p className="text-muted-foreground">
                {t("payments.history.table.empty.message")}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted text-muted dark:bg-muted dark:text-muted-foreground">
                    <TableHead className="w-[50px]">
                      {t("payments.history.table.headers.number")}
                    </TableHead>
                    <TableHead>
                      {t("payments.history.table.headers.date")}
                    </TableHead>
                    <TableHead>
                      {t("payments.history.table.headers.type")}
                    </TableHead>
                    <TableHead>
                      {t("payments.history.table.headers.property")}
                    </TableHead>
                    <TableHead>
                      {t("payments.history.table.headers.amount")}
                    </TableHead>
                    <TableHead>
                      {t("payments.history.table.headers.status")}
                    </TableHead>
                    <TableHead>
                      {t("payments.history.table.headers.dueDate")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("payments.history.table.headers.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment, index) => (
                    <TableRow key={payment._id}>
                      <TableCell className="font-medium">
                        {(pagination.page - 1) * pagination.limit + index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(payment.status)}
                          <span>
                            {payment.paidDate
                              ? formatDate(payment.paidDate)
                              : formatDate(payment.createdAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {getPaymentTypeLabel(payment.type)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {payment.propertyId?.name ||
                              t("payments.history.modal.propertyDefault")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatPropertyAddress(payment.propertyId?.address)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {formatCurrency(payment.amount)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        <span
                          className={`${
                            new Date(payment.dueDate) < new Date() &&
                            payment.status === PaymentStatus.PENDING
                              ? "text-destructive font-medium"
                              : ""
                          }`}
                        >
                          {formatDate(payment.dueDate)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewPaymentDetails(payment)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {t("payments.history.table.actions.details")}
                          </Button>
                          {payment.status === PaymentStatus.PAID && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadReceipt(payment)}
                              disabled={isDownloadingReceipt === payment._id}
                            >
                              {isDownloadingReceipt === payment._id ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4 mr-1" />
                              )}
                              {t("payments.history.table.actions.receipt")}
                            </Button>
                          )}
                          {payment.stripePaymentIntentId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                window.open(
                                  `https://dashboard.stripe.com/payments/${payment.stripePaymentIntentId}`,
                                  "_blank"
                                )
                              }
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              {t("payments.history.table.actions.stripe")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    {t("payments.history.pagination.showing", {
                      values: {
                        from: (pagination.page - 1) * pagination.limit + 1,
                        to: Math.min(
                          pagination.page * pagination.limit,
                          pagination.total
                        ),
                        total: pagination.total,
                      },
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      {t("payments.history.pagination.previous")}
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from(
                        { length: Math.min(5, pagination.pages) },
                        (_, i) => {
                          const pageNum = i + 1;
                          return (
                            <Button
                              key={pageNum}
                              variant={
                                pagination.page === pageNum
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        }
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.pages}
                    >
                      {t("payments.history.pagination.next")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Details Modal */}
      <Dialog open={showPaymentDetails} onOpenChange={setShowPaymentDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {t("payments.history.modal.title")}
            </DialogTitle>
            <DialogDescription>
              {t("payments.history.modal.subtitle")}
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-6">
              {/* Payment Overview */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">
                    {t("payments.history.modal.paymentAmount")}
                  </Label>
                  <p className="text-2xl font-bold">
                    {formatCurrency(selectedPayment.amount)}
                  </p>
                  {selectedPayment.lateFeeApplied &&
                    selectedPayment.lateFeeApplied > 0 && (
                      <p className="text-sm text-destructive">
                        {t("payments.history.modal.lateFee", {
                          values: {
                            amount: formatCurrency(
                              selectedPayment.lateFeeApplied
                            ),
                          },
                        })}
                      </p>
                    )}
                </div>
                <div>
                  <Label className="text-sm font-medium">
                    {t("payments.history.modal.status")}
                  </Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedPayment.status)}
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">
                    {t("payments.history.modal.paymentType")}
                  </Label>
                  <p className="font-medium">
                    {getPaymentTypeLabel(selectedPayment.type)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">
                    {t("payments.history.modal.paymentMethod")}
                  </Label>
                  <p className="font-medium">
                    {selectedPayment.paymentMethod
                      ? selectedPayment.paymentMethod
                          .replace("_", " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())
                      : t("payments.history.modal.paymentMethodNotSpecified")}
                  </p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-sm font-medium">
                    {t("payments.history.modal.dueDate")}
                  </Label>
                  <p className="font-medium">
                    {formatDate(selectedPayment.dueDate)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">
                    {t("payments.history.modal.paidDate")}
                  </Label>
                  <p className="font-medium">
                    {selectedPayment.paidDate
                      ? formatDate(selectedPayment.paidDate)
                      : t("payments.history.modal.paidDateNotPaid")}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">
                    {t("payments.history.modal.createdDate")}
                  </Label>
                  <p className="font-medium">
                    {formatDate(selectedPayment.createdAt)}
                  </p>
                </div>
              </div>

              {/* Property Information */}
              <div>
                <Label className="text-sm font-medium">
                  {t("payments.history.modal.property")}
                </Label>
                <div className="mt-1 p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium">
                    {selectedPayment.propertyId?.name ||
                      t("payments.history.modal.propertyDefault")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatPropertyAddress(selectedPayment.propertyId?.address)}
                  </p>
                </div>
              </div>

              {/* Description and Notes */}
              {(selectedPayment.description || selectedPayment.notes) && (
                <div className="space-y-3">
                  {selectedPayment.description && (
                    <div>
                      <Label className="text-sm font-medium">
                        {t("payments.history.modal.description")}
                      </Label>
                      <p className="text-sm">{selectedPayment.description}</p>
                    </div>
                  )}
                  {selectedPayment.notes && (
                    <div>
                      <Label className="text-sm font-medium">
                        {t("payments.history.modal.notes")}
                      </Label>
                      <p className="text-sm">{selectedPayment.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Transaction Details */}
              {selectedPayment.stripePaymentIntentId && (
                <div>
                  <Label className="text-sm font-medium">
                    {t("payments.history.modal.transactionId")}
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {selectedPayment.stripePaymentIntentId}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(
                          `https://dashboard.stripe.com/payments/${selectedPayment.stripePaymentIntentId}`,
                          "_blank"
                        )
                      }
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {t("payments.history.modal.viewInStripe")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                {selectedPayment.status === PaymentStatus.PAID && (
                  <Button
                    onClick={() => downloadReceipt(selectedPayment)}
                    disabled={isDownloadingReceipt === selectedPayment._id}
                  >
                    {isDownloadingReceipt === selectedPayment._id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {t("payments.history.modal.downloadReceipt")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowPaymentDetails(false)}
                >
                  {t("payments.history.modal.close")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Inline skeletons removed; route-level loading handled by loading.tsx
