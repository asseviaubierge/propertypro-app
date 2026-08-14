"use client";

import Link from "next/link";
import {
  showSimpleError,
  showSimpleSuccess,
} from "@/lib/toast-notifications";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import GlobalSearch from "@/components/ui/global-search";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CreditCard,
  Plus,
  MoreHorizontal,
  Edit,
  Eye,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Send,
  Grid3X3,
  List,
  BarChart3,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PaymentType, PaymentStatus, PaymentMethod } from "@/types";
import { GlobalPagination } from "@/components/ui/global-pagination";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AnalyticsCard,
  AnalyticsCardGrid,
} from "@/components/analytics/AnalyticsCard";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

// Mock data removed - using real API data

interface Payment {
  _id: string;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  dueDate: string;
  paidDate?: string;
  description?: string;
  notes?: string;
  tenantId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  propertyId: {
    _id: string;
    name: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  leaseId?: {
    _id: string;
    startDate: string;
    endDate: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function PaymentsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, formatCurrency, formatDate } = useLocalizationContext();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  // const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  // const [isDeleting, setIsDeleting] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [paymentToRefund, setPaymentToRefund] = useState<string | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);

  const paymentStatusLabel = (status: PaymentStatus) =>
    ({
      [PaymentStatus.PENDING]: "En attente",
      [PaymentStatus.PAID]: "Payé",
      [PaymentStatus.PARTIAL]: "Partiellement payé",
      [PaymentStatus.OVERDUE]: "En retard",
      [PaymentStatus.CANCELLED]: "Annulé",
      [PaymentStatus.FAILED]: "Échoué",
      [PaymentStatus.REFUNDED]: "Remboursé",
    })[status] || String(status).replaceAll("_", " ");

  const paymentTypeLabel = (type: PaymentType) =>
    ({
      [PaymentType.RENT]: "Loyer",
      [PaymentType.SECURITY_DEPOSIT]: "Garantie",
      [PaymentType.INVOICE]: "Facture",
      [PaymentType.LATE_FEE]: "Frais de retard",
      [PaymentType.UTILITY]: "Services publics",
      [PaymentType.MAINTENANCE]: "Maintenance",
      [PaymentType.PET_DEPOSIT]: "Dépôt pour animaux",
      [PaymentType.OTHER]: "Autre",
    })[type] || String(type).replaceAll("_", " ");

  const paymentMethodLabel = (method: PaymentMethod) =>
    ({
      [PaymentMethod.CREDIT_CARD]: "Carte de crédit",
      [PaymentMethod.DEBIT_CARD]: "Carte de débit",
      [PaymentMethod.BANK_TRANSFER]: "Virement bancaire",
      [PaymentMethod.ACH]: "Prélèvement bancaire",
      [PaymentMethod.CHECK]: "Chèque",
      [PaymentMethod.CASH]: "Espèces",
      [PaymentMethod.MONEY_ORDER]: "Mandat postal",
      [PaymentMethod.PAYPAL]: "PayPal",
      [PaymentMethod.RAZORPAY]: "Razorpay",
      [PaymentMethod.PAYSTACK]: "Paystack",
      [PaymentMethod.OTHER]: "Autre",
    })[method] || String(method).replaceAll("_", " ");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const [pageSize, setPageSize] = useState(12);

  // Fetch payments function
  const fetchPayments = async (
    page: number = currentPage,
    limit: number = pageSize
  ) => {
    if (!session) return;

    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (searchTerm) params.set("search", searchTerm);
      if (statusFilter && statusFilter !== "all")
        params.set("status", statusFilter);
      if (typeFilter && typeFilter !== "all") params.set("type", typeFilter);
      if (paymentMethodFilter && paymentMethodFilter !== "all")
        params.set("paymentMethod", paymentMethodFilter);

      const response = await fetch(`/api/payments?${params.toString()}`);

      if (response.ok) {
        const result = await response.json();
        setPayments(result.data || []);
        // Update pagination state from API response
        if (result.pagination) {
          setTotalPages(result.pagination.totalPages || 1);
          setTotalPayments(result.pagination.total || 0);
        }
      } else {
        throw new Error("Impossible de charger les paiements");
      }
    } catch (error) {
      showSimpleError(
        "Erreur de chargement",
        error instanceof Error ? error.message : t("payments.toasts.loadError")
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchPayments(page, pageSize);
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    fetchPayments(1, newPageSize);
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    const filter = searchParams?.get("filter");
    if (filter === "overdue") {
      router.replace("/dashboard/payments/overdue");
      return;
    }
    setCurrentPage(1);
    fetchPayments(1, pageSize);
  }, [session, searchTerm, statusFilter, typeFilter, paymentMethodFilter, searchParams, router]);

  // Note: Filtering is now handled server-side via API parameters
  // The payments array already contains filtered results from the API

  // Delete payment handler
  // DISABLED: Delete functionality temporarily disabled
  // const handleDeletePayment = async () => {
  //   if (!paymentToDelete) return;

  //   try {
  //     setIsDeleting(true);
  //     const response = await fetch(`/api/payments/${paymentToDelete}`, {
  //       method: "DELETE",
  //     });

  //     if (response.ok) {
  //       setPayments(payments.filter((p) => p._id !== paymentToDelete));
  //       toast.success("Payment deleted successfully.");
  //     } else {
  //       const error = await response.json();
  //       throw new Error(error.error || "Failed to delete payment");
  //     }
  //   } catch (error) {
  //     toast.error(
  //       error instanceof Error
  //         ? error.message
  //         : "Failed to delete payment. Please try again."
  //     );
  //   } finally {
  //     setIsDeleting(false);
  //     setShowDeleteDialog(false);
  //     setPaymentToDelete(null);
  //   }
  // };

  // const confirmDelete = (paymentId: string) => {
  //   setPaymentToDelete(paymentId);
  //   setShowDeleteDialog(true);
  // };

  // Refund handler
  const confirmRefund = (paymentId: string) => {
    setPaymentToRefund(paymentId);
    setShowRefundDialog(true);
  };

  const handleRefund = async () => {
    if (!paymentToRefund) return;

    try {
      setIsRefunding(true);

      const response = await fetch(`/api/payments/${paymentToRefund}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "refund",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to refund payment");
      }

      showSimpleSuccess("Refund Processed", t("payments.toasts.refundSuccess"));
      fetchPayments();
      setShowRefundDialog(false);
      setPaymentToRefund(null);
    } catch (error) {
      showSimpleError(
        "Refund Failed",
        error instanceof Error
          ? error.message
          : t("payments.toasts.refundError")
      );
    } finally {
      setIsRefunding(false);
    }
  };

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PENDING:
        return "default";
      case PaymentStatus.PAID:
        return "secondary";
      case PaymentStatus.OVERDUE:
        return "destructive";
      case PaymentStatus.FAILED:
        return "destructive";
      case PaymentStatus.REFUNDED:
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PENDING:
        return Clock;
      case PaymentStatus.PAID:
        return CheckCircle;
      case PaymentStatus.OVERDUE:
        return XCircle;
      case PaymentStatus.FAILED:
        return XCircle;
      case PaymentStatus.REFUNDED:
        return RefreshCw;
      default:
        return Clock;
    }
  };

  const getTypeColor = (type: PaymentType) => {
    switch (type) {
      case PaymentType.RENT:
        return "default";
      case PaymentType.SECURITY_DEPOSIT:
        return "secondary";
      case PaymentType.INVOICE:
        return "secondary";
      case PaymentType.PET_DEPOSIT:
        return "secondary";
      case PaymentType.LATE_FEE:
        return "destructive";
      case PaymentType.UTILITY:
        return "outline";
      case PaymentType.MAINTENANCE:
        return "outline";
      case PaymentType.OTHER:
        return "outline";
      default:
        return "outline";
    }
  };

  const getDaysOverdue = (dueDate: string, status: PaymentStatus) => {
    if (
      status === PaymentStatus.PAID ||
      status === PaymentStatus.REFUNDED
    ) {
      return 0;
    }
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = now.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Define columns for DataTable
  const paymentColumns: DataTableColumn<Payment>[] = [
    {
      id: "tenant",
      header: t("payments.table.tenant"),
      cell: (payment) => (
        <div>
          <div className="font-medium">
            {payment.tenantId?.firstName || "N/A"}{" "}
            {payment.tenantId?.lastName || ""}
          </div>
          <div className="text-sm text-muted-foreground">
            {payment.tenantId?.email || "N/A"}
          </div>
        </div>
      ),
    },
    {
      id: "property",
      header: t("payments.table.property"),
      visibility: "lg" as const,
      cell: (payment) => (
        <div>
          <div className="font-medium">{payment.propertyId?.name || "N/A"}</div>
          <div className="text-sm text-muted-foreground">
            {payment.propertyId?.address?.city || "N/A"},{" "}
            {payment.propertyId?.address?.state || "N/A"}
          </div>
        </div>
      ),
    },
    {
      id: "type",
      header: t("payments.table.type"),
      cell: (payment) => (
        <Badge
          variant={getTypeColor(payment.type) as any}
          className="capitalize"
        >
          {paymentTypeLabel(payment.type)}
        </Badge>
      ),
    },
    {
      id: "amount",
      header: t("payments.table.amount"),
      cell: (payment) => (
        <div className="font-medium">{formatCurrency(payment.amount)}</div>
      ),
    },
    {
      id: "status",
      header: t("payments.table.status"),
      cell: (payment) => {
        const StatusIcon = getStatusIcon(payment.status);
        return (
          <Badge
            variant={getStatusColor(payment.status) as any}
            className="flex items-center gap-1 w-fit"
          >
            <StatusIcon className="h-3 w-3" />
            {paymentStatusLabel(payment.status)}
          </Badge>
        );
      },
    },
    {
      id: "dueDate",
      header: t("payments.table.dueDate"),
      visibility: "md" as const,
      cell: (payment) => (
        <div className="flex items-center space-x-1 text-sm">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span>{formatDate(payment.dueDate)}</span>
        </div>
      ),
    },
    {
      id: "paidDate",
      header: t("payments.table.paidDate"),
      visibility: "lg" as const,
      cell: (payment) =>
        payment.paidDate ? (
          <div className="flex items-center space-x-1 text-sm text-green-600">
            <CheckCircle className="h-3 w-3" />
            <span>{formatDate(payment.paidDate)}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">
            {t("payments.table.notPaid")}
          </span>
        ),
    },
    {
      id: "overdue",
      header: t("payments.table.overdue"),
      visibility: "xl" as const,
      cell: (payment) => {
        const daysOverdue = getDaysOverdue(payment.dueDate, payment.status);
        return daysOverdue > 0 ? (
          <div className="text-sm text-red-600 font-medium">
            {daysOverdue} {t("payments.table.days")}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      },
    },
    {
      id: "actions",
      header: t("payments.table.actions"),
      align: "right" as const,
      cell: (payment) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("payments.actions.title")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/payments/${payment._id}`}>
                <Eye className="mr-2 h-4 w-4" />
                {t("payments.actions.viewDetails")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/payments/${payment._id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                {t("payments.actions.edit")}
              </Link>
            </DropdownMenuItem>
            {payment.status === PaymentStatus.PENDING && (
              <DropdownMenuItem asChild>
                <Link
                  href={`/dashboard/payments/record?paymentId=${payment._id}`}
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  {t("payments.actions.recordPayment")}
                </Link>
              </DropdownMenuItem>
            )}
            {payment.status === PaymentStatus.PENDING && (
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/payments/${payment._id}/reminder`}>
                  <Send className="mr-2 h-4 w-4" />
                  {t("payments.actions.sendReminder")}
                </Link>
              </DropdownMenuItem>
            )}
            {payment.status === PaymentStatus.PAID && (
              <DropdownMenuItem
                onClick={() => confirmRefund(payment._id)}
                className="text-orange-600"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("payments.actions.refund")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const totalAmount = payments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );
  const completedAmount = payments
    .filter((p) => p.status === PaymentStatus.PAID)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const pendingAmount = payments
    .filter((p) => p.status === PaymentStatus.PENDING)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const overduePayments = payments.filter(
    (p) =>
      (p.status === PaymentStatus.PENDING ||
        p.status === PaymentStatus.FAILED) &&
      getDaysOverdue(p.dueDate, p.status) > 0
  );

  return (
    <div className="mobile-payments-page min-w-0 space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="mobile-page-header flex min-w-0 flex-col gap-2 rounded-2xl bg-background px-1 py-1 sm:flex-row sm:items-start sm:justify-between sm:rounded-none sm:bg-transparent sm:p-0">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("payments.header.title")}
          </h1>
          <p className="max-w-2xl text-xs leading-4 text-muted-foreground sm:text-base sm:leading-normal">
            {t("payments.header.subtitle")}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <Link href="/dashboard/payments/analytics" className="min-w-0">
            <Button variant="outline" size="sm" className="h-11 w-full justify-center px-2 text-xs sm:h-9 sm:w-auto sm:px-3 sm:text-sm">
              <BarChart3 className="mr-1.5 h-4 w-4 shrink-0 sm:mr-2" />
              {t("payments.header.analytics")}
            </Button>
          </Link>
          <Link href="/dashboard/payments/new" className="min-w-0">
            <Button size="sm" className="h-11 w-full justify-center px-2 text-xs sm:h-9 sm:w-auto sm:px-3 sm:text-sm">
              <Plus className="mr-1.5 h-4 w-4 shrink-0 sm:mr-2" />
              {t("payments.header.addPayment")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <AnalyticsCardGrid className="lg:grid-cols-4">
        <AnalyticsCard
          title={t("payments.stats.totalAmount")}
          value={formatCurrency(totalAmount)}
          description={`${totalPayments} ${t("payments.stats.payments")}`}
          icon={DollarSign}
          iconColor="primary"
        />

        <AnalyticsCard
          title={t("payments.stats.collected")}
          value={formatCurrency(completedAmount)}
          description={`${payments.filter((p) => p.status === PaymentStatus.PAID).length} ${t("payments.stats.completed")}`}
          icon={CheckCircle}
          iconColor="success"
        />

        <AnalyticsCard
          title={t("payments.stats.pending")}
          value={formatCurrency(pendingAmount)}
          description={`${payments.filter((p) => p.status === PaymentStatus.PENDING).length} ${t("payments.stats.pendingCount")}`}
          icon={Clock}
          iconColor="warning"
        />

        <AnalyticsCard
          title={t("payments.stats.overdue")}
          value={overduePayments.length}
          description={`${formatCurrency(overduePayments.reduce((sum, p) => sum + p.amount, 0))} ${t("payments.stats.total")}`}
          icon={AlertTriangle}
          iconColor="error"
        />
      </AnalyticsCardGrid>

      {/* Payments Display */}
      {!isLoading && viewMode === "card" ? (
        <Card className="mobile-app-section gap-2">
          <CardHeader>
            {/* Main Header */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4 mb-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-100 dark:border-green-800">
                  <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-lg">
                    {t("payments.table.title")} ({totalPayments})
                  </h2>
                  <p className="text-xs leading-4 text-gray-600 dark:text-gray-300 sm:text-sm">
                    {t("payments.table.description")}
                  </p>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-lg p-1 w-full sm:w-auto">
                <Button
                  variant={viewMode === "card" ? "ghost" : "default"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="h-8 flex-1 sm:flex-none sm:px-3"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "card" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("card")}
                  className="h-8 flex-1 sm:flex-none sm:px-3"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Integrated Filters Bar - Single Row */}
            <div className="mobile-filter-panel flex flex-col gap-2 rounded-xl border border-gray-200/70 bg-gray-50/70 p-2.5 dark:border-gray-700/60 dark:bg-gray-800/50 sm:p-4 lg:flex-row lg:items-center lg:gap-4">
              {/* Search */}
              <GlobalSearch
                placeholder={t("payments.filters.searchPlaceholder")}
                initialValue={searchTerm}
                debounceDelay={300}
                onSearch={(val) => setSearchTerm(val)}
                isLoading={isLoading}
                className="flex-1 min-w-0"
                inputClassName="h-10 border-gray-200 dark:border-gray-700 focus:border-green-400 dark:focus:border-green-500 focus:ring-1 focus:ring-green-400 dark:focus:ring-green-500 bg-white dark:bg-gray-800"
                ariaLabel="Rechercher des paiements"
              />

              {/* Filters */}
              <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 w-full min-w-0 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:w-[130px]">
                    <SelectValue
                      placeholder={t("payments.filters.allStatuses")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("payments.filters.allStatuses")}
                    </SelectItem>
                    <SelectItem value={PaymentStatus.PENDING}>
                      {t("payments.filters.pending")}
                    </SelectItem>
                    <SelectItem value={PaymentStatus.PENDING}>
                      {t("payments.filters.processing")}
                    </SelectItem>
                    <SelectItem value={PaymentStatus.PAID}>
                      {t("payments.filters.completed")}
                    </SelectItem>
                    <SelectItem value={PaymentStatus.FAILED}>
                      {t("payments.filters.failed")}
                    </SelectItem>
                    <SelectItem value={PaymentStatus.REFUNDED}>
                      {t("payments.filters.refunded")}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-10 w-full min-w-0 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:w-[130px]">
                    <SelectValue placeholder={t("payments.filters.allTypes")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("payments.filters.allTypes")}
                    </SelectItem>
                    <SelectItem value={PaymentType.RENT}>
                      {t("payments.filters.rent")}
                    </SelectItem>
                    <SelectItem value={PaymentType.SECURITY_DEPOSIT}>
                      {t("payments.filters.securityDeposit")}
                    </SelectItem>
                    <SelectItem value={PaymentType.INVOICE}>
                      {t("payments.filters.invoice")}
                    </SelectItem>
                    <SelectItem value={PaymentType.LATE_FEE}>
                      {t("payments.filters.lateFee")}
                    </SelectItem>
                    <SelectItem value={PaymentType.UTILITY}>
                      {t("payments.filters.utility")}
                    </SelectItem>
                    <SelectItem value={PaymentType.MAINTENANCE}>
                      {t("payments.filters.maintenance")}
                    </SelectItem>
                    <SelectItem value={PaymentType.PET_DEPOSIT}>
                      {t("payments.filters.petDeposit")}
                    </SelectItem>
                    <SelectItem value={PaymentType.OTHER}>
                      {t("payments.filters.other")}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={paymentMethodFilter}
                  onValueChange={setPaymentMethodFilter}
                >
                  <SelectTrigger className="h-10 w-full min-w-0 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:w-[130px]">
                    <SelectValue
                      placeholder={t("payments.filters.allMethods")}
                    />
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

                {/* Clear Button - only show when filters are active */}
                {(searchTerm ||
                  statusFilter !== "all" ||
                  typeFilter !== "all" ||
                  paymentMethodFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                      setTypeFilter("all");
                      setPaymentMethodFilter("all");
                    }}
                    className="h-10 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {t("payments.filters.clearAll") || "Effacer les filtres"}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <div className="col-span-full flex flex-col items-center gap-2 py-12">
                <CreditCard className="h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">
                  {t("payments.empty.title", {
                    defaultValue: "Aucun paiement trouvé",
                  })}
                </h3>
                <p className="text-muted-foreground mb-2">
                  {t("payments.empty.descriptionStart", {
                    defaultValue: "Aucun paiement n’a encore été créé.",
                  })}
                </p>
                <Link href="/dashboard/payments/new">
                  <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t("payments.header.addPayment", {
                      defaultValue: "Ajouter un paiement",
                    })}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {payments.map((payment) => {
                  const StatusIcon = getStatusIcon(payment.status);
                  const daysOverdue = getDaysOverdue(
                    payment.dueDate,
                    payment.status
                  );

                  return (
                    <Card
                      key={payment._id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                            <Badge
                              variant={getStatusColor(payment.status) as any}
                              className="text-xs"
                            >
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {paymentStatusLabel(payment.status)}
                            </Badge>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>
                                {t("payments.actions.label")}
                              </DropdownMenuLabel>
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/dashboard/payments/${payment._id}`}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  {t("payments.actions.viewDetails")}
                                </Link>
                              </DropdownMenuItem>
                              {payment.status !== PaymentStatus.PAID &&
                                payment.status !== PaymentStatus.REFUNDED && (
                                  <DropdownMenuItem asChild>
                                    <Link
                                      href={`/dashboard/payments/${payment._id}/edit`}
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      {t("payments.actions.editPayment")}
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                              {/* Only allow delete for PENDING payments that haven't been processed */}
                              {/*
                        {payment.status === PaymentStatus.PENDING && (
                          <>
                            {/* DISABLED: Delete functionality temporarily disabled */}
                              {/* <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => confirmDelete(payment._id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Payment
                          </>
                            </DropdownMenuItem>
                        )}
                        */}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="text-2xl font-bold">
                          {formatCurrency(payment.amount)}
                        </div>
                        <Badge
                          variant={getTypeColor(payment.type) as any}
                          className="w-fit text-xs capitalize"
                        >
                          {paymentTypeLabel(payment.type)}
                        </Badge>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm font-medium">
                            {payment.tenantId?.firstName || "N/A"}{" "}
                            {payment.tenantId?.lastName || ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payment.tenantId?.email || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {payment.propertyId?.name || "N/A"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payment.propertyId?.address?.city || "N/A"},{" "}
                            {payment.propertyId?.address?.state || "N/A"}
                          </p>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t("payments.card.due")}
                          </span>
                          <span>{formatDate(payment.dueDate)}</span>
                        </div>
                        {payment.paidDate && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {t("payments.card.paid")}
                            </span>
                            <span>{formatDate(payment.paidDate)}</span>
                          </div>
                        )}
                        {daysOverdue > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {t("payments.card.overdue")}
                            </span>
                            <span className="text-red-600 font-medium">
                              {daysOverdue} {t("payments.table.days")}
                            </span>
                          </div>
                        )}
                        {payment.paymentMethod && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {t("payments.card.method")}
                            </span>
                            <span className="capitalize">
                              {paymentMethodLabel(payment.paymentMethod)}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            {/* Global Pagination for Card View */}
            {totalPayments > 0 && (
              <GlobalPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalPayments}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                showingLabel={t("common.showing", {
                  defaultValue: "Affichage de",
                })}
                previousLabel={t("common.previous", {
                  defaultValue: "Précédent",
                })}
                nextLabel={t("common.next", { defaultValue: "Suivant" })}
                pageLabel={t("common.page", { defaultValue: "Page" })}
                ofLabel={t("common.of", { defaultValue: "sur" })}
                itemsPerPageLabel={t("common.perPage", {
                  defaultValue: "par page",
                })}
                disabled={isLoading}
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-2">
          <CardHeader>
            {/* Main Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-100 dark:border-green-800">
                  <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t("payments.table.title")} ({totalPayments})
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("payments.table.description")}
                  </p>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-lg p-1 w-full sm:w-auto">
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="h-8 flex-1 sm:flex-none sm:px-3"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "card" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("card")}
                  className="h-8 flex-1 sm:flex-none sm:px-3"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Integrated Filters Bar - Single Row */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/60 dark:border-gray-700/60">
              {/* Search */}
              <GlobalSearch
                placeholder={t("payments.filters.searchPlaceholder")}
                initialValue={searchTerm}
                debounceDelay={300}
                onSearch={(val) => setSearchTerm(val)}
                isLoading={isLoading}
                className="flex-1 min-w-0"
                inputClassName="h-10 border-gray-200 dark:border-gray-700 focus:border-green-400 dark:focus:border-green-500 focus:ring-1 focus:ring-green-400 dark:focus:ring-green-500 bg-white dark:bg-gray-800"
                ariaLabel="Rechercher des paiements"
              />

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 w-full min-w-0 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:w-[130px]">
                    <SelectValue
                      placeholder={t("payments.filters.allStatuses")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("payments.filters.allStatuses")}
                    </SelectItem>
                    <SelectItem value={PaymentStatus.PENDING}>
                      {t("payments.filters.pending")}
                    </SelectItem>
                    <SelectItem value={PaymentStatus.PENDING}>
                      {t("payments.filters.processing")}
                    </SelectItem>
                    <SelectItem value={PaymentStatus.PAID}>
                      {t("payments.filters.completed")}
                    </SelectItem>
                    <SelectItem value={PaymentStatus.FAILED}>
                      {t("payments.filters.failed")}
                    </SelectItem>
                    <SelectItem value={PaymentStatus.REFUNDED}>
                      {t("payments.filters.refunded")}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-10 w-full min-w-0 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:w-[130px]">
                    <SelectValue placeholder={t("payments.filters.allTypes")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("payments.filters.allTypes")}
                    </SelectItem>
                    <SelectItem value={PaymentType.RENT}>
                      {t("payments.filters.rent")}
                    </SelectItem>
                    <SelectItem value={PaymentType.SECURITY_DEPOSIT}>
                      {t("payments.filters.securityDeposit")}
                    </SelectItem>
                    <SelectItem value={PaymentType.INVOICE}>
                      {t("payments.filters.invoice")}
                    </SelectItem>
                    <SelectItem value={PaymentType.LATE_FEE}>
                      {t("payments.filters.lateFee")}
                    </SelectItem>
                    <SelectItem value={PaymentType.UTILITY}>
                      {t("payments.filters.utility")}
                    </SelectItem>
                    <SelectItem value={PaymentType.MAINTENANCE}>
                      {t("payments.filters.maintenance")}
                    </SelectItem>
                    <SelectItem value={PaymentType.PET_DEPOSIT}>
                      {t("payments.filters.petDeposit")}
                    </SelectItem>
                    <SelectItem value={PaymentType.OTHER}>
                      {t("payments.filters.other")}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={paymentMethodFilter}
                  onValueChange={setPaymentMethodFilter}
                >
                  <SelectTrigger className="h-10 w-full min-w-0 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:w-[130px]">
                    <SelectValue
                      placeholder={t("payments.filters.allMethods")}
                    />
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

                {/* Clear Button - only show when filters are active */}
                {(searchTerm ||
                  statusFilter !== "all" ||
                  typeFilter !== "all" ||
                  paymentMethodFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                      setTypeFilter("all");
                      setPaymentMethodFilter("all");
                    }}
                    className="h-10 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {t("payments.filters.clearAll") || "Effacer les filtres"}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable<Payment>
              columns={paymentColumns}
              data={payments}
              getRowKey={(payment) => payment._id}
              loading={isLoading}
              emptyState={{
                icon: (
                  <CreditCard className="h-12 w-12 text-muted-foreground" />
                ),
                title: t("payments.empty.title", {
                  defaultValue: "Aucun paiement trouvé",
                }),
                description:
                  searchTerm ||
                  statusFilter !== "all" ||
                  typeFilter !== "all" ||
                  paymentMethodFilter !== "all"
                    ? t("payments.empty.description", {
                        defaultValue: "Aucun paiement ne correspond aux filtres actuels.",
                      })
                    : t("payments.empty.descriptionStart", {
                        defaultValue: "Aucun paiement n’a encore été créé.",
                      }),
                action: (
                  <Link href="/dashboard/payments/new">
                    <Button variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      {t("payments.header.addPayment", {
                        defaultValue: "Ajouter un paiement",
                      })}
                    </Button>
                  </Link>
                ),
              }}
              striped
            />
            {/* Global Pagination */}
            {totalPayments > 0 && (
              <GlobalPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalPayments}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                showingLabel={t("common.showing", {
                  defaultValue: "Affichage de",
                })}
                previousLabel={t("common.previous", {
                  defaultValue: "Précédent",
                })}
                nextLabel={t("common.next", { defaultValue: "Suivant" })}
                pageLabel={t("common.page", { defaultValue: "Page" })}
                ofLabel={t("common.of", { defaultValue: "sur" })}
                itemsPerPageLabel={t("common.perPage", {
                  defaultValue: "par page",
                })}
                disabled={isLoading}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      {/* <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer cette action ?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              payment record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePayment}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog> */}

      {/* Refund Confirmation Dialog */}
      <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("payments.refundDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("payments.refundDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("payments.refundDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRefund}
              disabled={isRefunding}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {isRefunding
                ? t("payments.refundDialog.refunding")
                : t("payments.refundDialog.refund")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
