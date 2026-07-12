"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { showSimpleError } from "@/lib/toast-notifications";
import Link from "next/link";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AnalyticsCard,
  AnalyticsCardGrid,
} from "@/components/analytics/AnalyticsCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import GlobalSearch from "@/components/ui/global-search";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { GlobalPagination } from "@/components/ui/global-pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  MoreHorizontal,
  Edit,
  Eye,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  Send,
  Phone,
  Mail,
  FileText,
  RefreshCw,
  CreditCard,
  XCircle,
} from "lucide-react";

interface OverdueInvoice {
  _id: string;
  invoiceNumber: string;
  amount: number;
  balanceRemaining: number;
  dueDate: string;
  issueDate: string;
  status: string;
  description?: string;
  notes?: string;
  daysOverdue: number;
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

export default function OverduePaymentsPage() {
  const { data: session } = useSession();
  const { t, formatCurrency, formatDate } = useLocalizationContext();
  const [overduePayments, setOverduePayments] = useState<OverdueInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("daysOverdue");
  const [filterBy, setFilterBy] = useState<string>("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOverdue, setTotalOverdue] = useState(0);
  const [pageSize, setPageSize] = useState(12);

  // Fetch overdue invoices
  const fetchOverduePayments = async (
    page: number = currentPage,
    limit: number = pageSize
  ) => {
    if (!session) return;

    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      params.set("status", "overdue");
      if (searchTerm) params.set("search", searchTerm);
      const response = await fetch(`/api/invoices?${params.toString()}`);

      if (response.ok) {
        const result = await response.json();
        const invoices = result.data?.invoices || [];

        // Update pagination from API response
        if (result.data?.pagination) {
          setTotalPages(result.data.pagination.pages || 1);
          setTotalOverdue(result.data.pagination.total || 0);
        }

        // Calculate days overdue for invoices with outstanding balances
        const overdueInvoices = invoices
          .map((invoice: any) => {
            const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
            if (!dueDate || Number.isNaN(dueDate.getTime())) {
              return null;
            }

            const now = new Date();
            const daysOverdue = Math.ceil(
              (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Only include invoices that are actually overdue (past due date)
            // and have outstanding balance
            const hasBalance = (invoice.balanceRemaining || invoice.amount) > 0;
            const isOverdue = daysOverdue > 0;

            if (!hasBalance || !isOverdue) {
              return null;
            }

            return {
              ...invoice,
              daysOverdue,
              amount: invoice.amount || 0,
              balanceRemaining: invoice.balanceRemaining || invoice.amount || 0,
            } as OverdueInvoice;
          })
          .filter(
            (invoice: OverdueInvoice | null): invoice is OverdueInvoice =>
              invoice !== null
          );

        setOverduePayments(overdueInvoices);
      } else {
        throw new Error("Failed to fetch overdue invoices");
      }
    } catch (error) {
      showSimpleError(
        "Load Error",
        error instanceof Error
          ? error.message
          : t("payments.overdue.toasts.loadError")
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchOverduePayments(page, pageSize);
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    fetchOverduePayments(1, newPageSize);
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    fetchOverduePayments(1, pageSize);
  }, [session, searchTerm, filterBy]);

  const filteredPayments = overduePayments.filter((invoice) => {
    const matchesSearch =
      (invoice.invoiceNumber &&
        invoice.invoiceNumber
          .toLowerCase()
          .includes(searchTerm.toLowerCase())) ||
      (invoice.tenantId?.firstName &&
        invoice.tenantId.firstName
          .toLowerCase()
          .includes(searchTerm.toLowerCase())) ||
      (invoice.tenantId?.lastName &&
        invoice.tenantId.lastName
          .toLowerCase()
          .includes(searchTerm.toLowerCase())) ||
      (invoice.propertyId?.name &&
        invoice.propertyId.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()));

    const matchesFilter =
      filterBy === "all" ||
      (filterBy === "critical" && invoice.daysOverdue > 30) ||
      (filterBy === "severe" &&
        invoice.daysOverdue > 14 &&
        invoice.daysOverdue <= 30) ||
      (filterBy === "moderate" &&
        invoice.daysOverdue > 7 &&
        invoice.daysOverdue <= 14) ||
      (filterBy === "recent" && invoice.daysOverdue <= 7);

    return matchesSearch && matchesFilter;
  });

  // Sort invoices
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    switch (sortBy) {
      case "daysOverdue":
        return b.daysOverdue - a.daysOverdue;
      case "amount":
        return (
          (b.balanceRemaining || b.amount) - (a.balanceRemaining || a.amount)
        );
      case "dueDate":
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      case "tenant":
        return (a.tenantId?.lastName || "").localeCompare(
          b.tenantId?.lastName || ""
        );
      case "invoice":
        return (a.invoiceNumber || "").localeCompare(b.invoiceNumber || "");
      default:
        return b.daysOverdue - a.daysOverdue;
    }
  });

  const getOverdueSeverity = (daysOverdue: number) => {
    if (daysOverdue > 30)
      return {
        label: t("payments.overdue.severity.critical"),
        color: "destructive",
      };
    if (daysOverdue > 14)
      return {
        label: t("payments.overdue.severity.severe"),
        color: "destructive",
      };
    if (daysOverdue > 7)
      return {
        label: t("payments.overdue.severity.moderate"),
        color: "secondary",
      };
    return { label: t("payments.overdue.severity.recent"), color: "outline" };
  };

  const totalOverdueAmount = sortedPayments.reduce(
    (sum, payment) => sum + (payment.balanceRemaining || payment.amount),
    0
  );
  const criticalCount = sortedPayments.filter((p) => p.daysOverdue > 30).length;
  const severeCount = sortedPayments.filter(
    (p) => p.daysOverdue > 14 && p.daysOverdue <= 30
  ).length;

  // Define columns for DataTable
  const overdueColumns: DataTableColumn<OverdueInvoice>[] = [
    {
      id: "invoiceNumber",
      header: t("payments.overdue.table.invoiceNumber"),
      cell: (invoice) => (
        <div className="font-medium text-blue-600">
          {invoice.invoiceNumber || t("payments.common.na")}
        </div>
      ),
    },
    {
      id: "tenant",
      header: t("payments.overdue.table.tenant"),
      cell: (invoice) => (
        <div>
          <div className="font-medium">
            {invoice.tenantId?.firstName || t("payments.common.na")}{" "}
            {invoice.tenantId?.lastName || ""}
          </div>
          <div className="text-sm text-muted-foreground">
            {invoice.tenantId?.email || t("payments.common.na")}
          </div>
        </div>
      ),
    },
    {
      id: "property",
      header: t("payments.overdue.table.property"),
      visibility: "lg" as const,
      cell: (invoice) => (
        <div>
          <div className="font-medium">
            {invoice.propertyId?.name || t("payments.common.na")}
          </div>
          <div className="text-sm text-muted-foreground">
            {invoice.propertyId?.address?.city || t("payments.common.na")},{" "}
            {invoice.propertyId?.address?.state || t("payments.common.na")}
          </div>
        </div>
      ),
    },
    {
      id: "amount",
      header: t("payments.overdue.table.amount"),
      cell: (invoice) => (
        <div className="font-medium">{formatCurrency(invoice.amount)}</div>
      ),
    },
    {
      id: "balance",
      header: t("payments.overdue.table.balance"),
      cell: (invoice) => (
        <div className="font-medium text-red-600">
          {formatCurrency(invoice.balanceRemaining || invoice.amount)}
        </div>
      ),
    },
    {
      id: "dueDate",
      header: t("payments.overdue.table.dueDate"),
      visibility: "md" as const,
      cell: (invoice) => (
        <div className="flex items-center space-x-1 text-sm">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span>{formatDate(invoice.dueDate)}</span>
        </div>
      ),
    },
    {
      id: "daysOverdue",
      header: t("payments.overdue.table.daysOverdue"),
      cell: (invoice) => (
        <div className="text-sm font-medium text-red-600">
          {invoice.daysOverdue} {t("payments.overdue.table.days")}
        </div>
      ),
    },
    {
      id: "severity",
      header: t("payments.overdue.table.severity"),
      cell: (invoice) => {
        const severity = getOverdueSeverity(invoice.daysOverdue);
        return (
          <Badge
            variant={
              severity.color as
                | "default"
                | "secondary"
                | "destructive"
                | "outline"
            }
            className="text-xs"
          >
            {severity.label}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: t("payments.overdue.table.actions"),
      align: "right" as const,
      cell: (invoice) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {t("payments.overdue.actions.actions")}
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/leases/invoices/${invoice._id}`}>
                <Eye className="mr-2 h-4 w-4" />
                {t("payments.overdue.actions.viewInvoice")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/leases/invoices/${invoice._id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                {t("payments.overdue.actions.editInvoice")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Send className="mr-2 h-4 w-4" />
              {t("payments.overdue.actions.sendReminder")}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Phone className="mr-2 h-4 w-4" />
              {t("payments.overdue.actions.callTenant")}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Mail className="mr-2 h-4 w-4" />
              {t("payments.overdue.actions.emailInvoice")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-green-600">
              <CreditCard className="mr-2 h-4 w-4" />
              {t("payments.overdue.actions.recordPayment")}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <FileText className="mr-2 h-4 w-4" />
              {t("payments.overdue.actions.generateNotice")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            {t("payments.overdue.header.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("payments.overdue.header.subtitle")}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("payments.overdue.header.refresh")}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <AnalyticsCardGrid className="lg:grid-cols-4">
        <AnalyticsCard
          title={t("payments.overdue.stats.totalOverdue")}
          value={formatCurrency(totalOverdueAmount)}
          description={`${totalOverdue} ${t("payments.overdue.stats.payments")}`}
          icon={DollarSign}
          iconColor="error"
        />

        <AnalyticsCard
          title={t("payments.overdue.stats.critical")}
          value={criticalCount}
          description={t("payments.overdue.stats.criticalDesc")}
          icon={AlertTriangle}
          iconColor="error"
        />

        <AnalyticsCard
          title={t("payments.overdue.stats.severe")}
          value={severeCount}
          description={t("payments.overdue.stats.severeDesc")}
          icon={Clock}
          iconColor="warning"
        />

        <AnalyticsCard
          title={t("payments.overdue.stats.averageDays")}
          value={
            sortedPayments.length > 0
              ? Math.round(
                  sortedPayments.reduce((sum, p) => sum + p.daysOverdue, 0) /
                    sortedPayments.length
                )
              : 0
          }
          description={t("payments.overdue.stats.daysOverdue")}
          icon={Calendar}
          iconColor="info"
        />
      </AnalyticsCardGrid>

      {!isLoading &&
      overduePayments.length === 0 &&
      !searchTerm &&
      filterBy === "all" ? (
        <Card>
          <CardContent className="text-center py-12">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {t("payments.overdue.empty.title")}
            </h3>
            <p className="text-muted-foreground mb-4">
              {t("payments.overdue.empty.description")}
            </p>
            <Link href="/dashboard/payments">
              <Button>{t("payments.overdue.empty.viewAll")}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-2">
          <CardHeader>
            {/* Main Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-100 dark:border-red-800">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t("payments.overdue.table.title")} ({totalOverdue})
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("payments.overdue.table.description")}
                  </p>
                </div>
              </div>
            </div>

            {/* Integrated Filters Bar - Single Row */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/60 dark:border-gray-700/60">
              {/* Search */}
              <GlobalSearch
                placeholder={t("payments.overdue.filters.searchPlaceholder")}
                initialValue={searchTerm}
                debounceDelay={300}
                onSearch={(val) => setSearchTerm(val)}
                isLoading={isLoading}
                className="flex-1 min-w-0"
                inputClassName="h-10 border-gray-200 dark:border-gray-700 focus:border-red-400 dark:focus:border-red-500 focus:ring-1 focus:ring-red-400 dark:focus:ring-red-500 bg-white dark:bg-gray-800"
                ariaLabel="Search overdue invoices"
              />

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <Select value={filterBy} onValueChange={setFilterBy}>
                  <SelectTrigger className="h-10 w-[140px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <SelectValue
                      placeholder={t("payments.overdue.filters.allOverdue")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("payments.overdue.filters.allOverdue")}
                    </SelectItem>
                    <SelectItem value="critical">
                      {t("payments.overdue.filters.critical")}
                    </SelectItem>
                    <SelectItem value="severe">
                      {t("payments.overdue.filters.severe")}
                    </SelectItem>
                    <SelectItem value="moderate">
                      {t("payments.overdue.filters.moderate")}
                    </SelectItem>
                    <SelectItem value="recent">
                      {t("payments.overdue.filters.recent")}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-10 w-[150px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <SelectValue
                      placeholder={t("payments.overdue.filters.sortBy")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daysOverdue">
                      {t("payments.overdue.filters.sortDaysOverdue")}
                    </SelectItem>
                    <SelectItem value="amount">
                      {t("payments.overdue.filters.sortBalance")}
                    </SelectItem>
                    <SelectItem value="dueDate">
                      {t("payments.overdue.filters.sortDueDate")}
                    </SelectItem>
                    <SelectItem value="tenant">
                      {t("payments.overdue.filters.sortTenant")}
                    </SelectItem>
                    <SelectItem value="invoice">
                      {t("payments.overdue.filters.sortInvoice")}
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Clear Button - only show when filters are active */}
                {(searchTerm ||
                  filterBy !== "all" ||
                  sortBy !== "daysOverdue") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterBy("all");
                      setSortBy("daysOverdue");
                    }}
                    className="h-10 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {t("common.clearFilters") || "Clear"}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable<OverdueInvoice>
              columns={overdueColumns}
              data={sortedPayments}
              getRowKey={(invoice) => invoice._id}
              loading={isLoading}
              emptyState={{
                icon: <FileText className="h-12 w-12 text-muted-foreground" />,
                title: t("payments.overdue.empty.title", {
                  defaultValue: "No payments found",
                }),
                description: t("payments.overdue.empty.description", {
                  defaultValue: "No payments match your current filters.",
                }),
              }}
              striped
            />
            {/* Global Pagination */}
            {totalOverdue > 0 && (
              <GlobalPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalOverdue}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                showingLabel={t("common.showing", {
                  defaultValue: "Showing",
                })}
                previousLabel={t("common.previous", {
                  defaultValue: "Previous",
                })}
                nextLabel={t("common.next", { defaultValue: "Next" })}
                pageLabel={t("common.page", { defaultValue: "Page" })}
                ofLabel={t("common.of", { defaultValue: "of" })}
                itemsPerPageLabel={t("common.perPage", {
                  defaultValue: "per page",
                })}
                disabled={isLoading}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
