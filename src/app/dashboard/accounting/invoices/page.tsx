"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import GlobalSearch from "@/components/ui/global-search";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Download,
  RefreshCw,
  LayoutGrid,
  List,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Send,
  CreditCard,
  CheckSquare,
  Printer,
  Building2,
  X,
} from "lucide-react";
import {
  downloadCanonicalInvoicePdf,
  printCanonicalInvoicePdf,
} from "@/lib/invoice/pdf-actions";
import {
  AnalyticsCard,
  AnalyticsCardGrid,
} from "@/components/analytics/AnalyticsCard";
import { useAuthorization } from "@/hooks/useAuthorization";
import { GlobalPagination } from "@/components/ui/global-pagination";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useViewPreferencesStore } from "@/stores/view-preferences.store";
import PaymentRecordDialog from "@/components/invoice/PaymentRecordDialog";
import BulkOperationsDialog from "@/components/invoice/BulkOperationsDialog";
import { showSimpleError, showSimpleSuccess } from "@/lib/toast-notifications";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface Facture {
  _id: string;
  invoiceNumber: string;
  tenantId?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  } | null;
  propertyId?: {
    _id?: string;
    name: string;
    address:
      | {
          street: string;
          city: string;
          state: string;
          zipCode: string;
          country: string;
        }
      | string;
  } | null;
  leaseId?: {
    _id: string;
    startDate: string;
    endDate: string;
    propertyId: {
      _id?: string;
      name: string;
      address:
        | {
            street: string;
            city: string;
            state: string;
            zipCode: string;
            country: string;
          }
        | string;
    };
  } | null;
  issueDate?: string;
  dueDate?: string;
  status?: string;
  totalAmount?: number;
  amountPaid?: number;
  balanceRemaining?: number;
  daysOverdue?: number;
  items?: Array<{
    description: string;
    amount: number;
    type: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

interface InvoiceQueryParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  tenantId?: string;
  propertyId?: string;
  leaseId?: string;
}

// Helper function to format address
const formatAddress = (
  address:
    | string
    | {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
      }
    | undefined,
): string => {
  if (typeof address === "string") {
    return address;
  }
  if (address && typeof address === "object") {
    const { street, city, state, zipCode } = address;
    return `${street}, ${city}, ${state} ${zipCode}`;
  }
  return "";
};

const formatDisplayDate = (value?: string | Date) => {
  if (!value) return "—";
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString();
};

export default function FacturesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { isTenant } = useAuthorization();
  const { t, formatCurrency: formatCurrencyLocalized } =
    useLocalizationContext();
  const initialLeaseId = searchParams.get("leaseId") || undefined;
  const initialPropertyId = searchParams.get("propertyId") || undefined;
  const [invoices, setInvoices] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] =
    useState<Facture | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [filters, setFilters] = useState<InvoiceQueryParams>({
    page: 1,
    limit: 12,
    search: "",
    status: undefined,
    sortBy: "createdAt",
    sortOrder: "desc",
    ...(initialPropertyId ? { propertyId: initialPropertyId } : {}),
    ...(initialLeaseId ? { leaseId: initialLeaseId } : {}),
  });
  const viewMode = useViewPreferencesStore((state) => state.invoicesView);
  const setViewMode = useViewPreferencesStore((state) => state.setInvoicesView);
  const [selectedInvoices, setSelectedFactures] = useState<string[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    scheduled: 0,
    issued: 0,
    paid: 0,
    partial: 0,
    overdue: 0,
    cancelled: 0,
    totalAmount: 0,
    paidAmount: 0,
    overdueAmount: 0,
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    fetchFactures(filters, true);
    fetchStats();
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || isInitialLoad) {
      return;
    }

    fetchFactures(filters, false);
  }, [filters, isInitialLoad, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    fetchStats();
  }, [filters.propertyId, filters.tenantId, filters.leaseId, status]);

  const fetchFactures = async (
    currentFilters?: InvoiceQueryParams,
    showFullLoading: boolean = false,
  ) => {
    try {
      const activeFilters = currentFilters ?? filters;

      if (showFullLoading) {
        setLoading(true);
      }

      if (isTenant) {
        // For tenants, use the tenant invoices API
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "1000");
        const response = await fetch(
          `/api/tenant/invoices?${params.toString()}`,
        );
        const data = await response.json();

        if (data?.success) {
          const allInv: Facture[] = data.data?.invoices || [];

          // Source unique de vérité : les cartes et la liste utilisent le même
          // périmètre d'accès renvoyé par /api/invoices. Ainsi, si le Manager
          // voit 7 factures dans les compteurs, ces 7 factures existent bien
          // dans son jeu de données et sont affichables dans la liste.
          setStats({
            total: allInv.length,
            scheduled: allInv.filter((inv) => inv.status === "scheduled").length,
            issued: allInv.filter((inv) => inv.status === "issued").length,
            paid: allInv.filter((inv) => inv.status === "paid").length,
            partial: allInv.filter((inv) => inv.status === "partial").length,
            overdue: allInv.filter((inv) => inv.status === "overdue").length,
            cancelled: allInv.filter((inv) => inv.status === "cancelled").length,
            totalAmount: allInv.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0),
            paidAmount: allInv.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0),
            overdueAmount: allInv
              .filter((inv) => inv.status === "overdue")
              .reduce((sum, inv) => sum + (inv.balanceRemaining || 0), 0),
          });

          const search = (activeFilters.search || "").toLowerCase().trim();
          const filtered = allInv.filter((inv) => {
            const matchesStatus =
              !activeFilters.status || inv.status === activeFilters.status;
            if (!search) return matchesStatus;
            const haystack = [
              inv.invoiceNumber,
              inv.propertyId?.name,
              inv.tenantId?.firstName,
              inv.tenantId?.lastName,
              inv.tenantId?.email,
            ]
              .filter(Boolean)
              .map((v) => String(v).toLowerCase());
            const matchesSearch = haystack.some((v) => v.includes(search));
            return matchesStatus && matchesSearch;
          });
          const sortBy = activeFilters.sortBy || "createdAt";
          const sortOrder = activeFilters.sortOrder || "desc";
          const get = (obj: any, path: string) =>
            path
              .split(".")
              .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
          const getSortVal = (inv: Facture) => {
            const v = get(inv, sortBy);
            if (!v) return 0;
            const key = sortBy.toLowerCase();
            if (
              key.includes("date") ||
              key.includes("createdat") ||
              key.includes("updatedat")
            ) {
              const t = new Date(v as any).getTime();
              return Number.isNaN(t) ? 0 : t;
            }
            return typeof v === "number" ? v : String(v).toLowerCase();
          };
          const sorted = [...filtered].sort((a, b) => {
            const av = getSortVal(a);
            const bv = getSortVal(b);
            if (typeof av === "number" && typeof bv === "number") {
              return sortOrder === "asc" ? av - bv : bv - av;
            }
            return sortOrder === "asc"
              ? String(av).localeCompare(String(bv))
              : String(bv).localeCompare(String(av));
          });
          const page = activeFilters.page || 1;
          const limit = activeFilters.limit || 10;
          const total = sorted.length;
          const pages = Math.max(1, Math.ceil(total / limit));
          const start = (page - 1) * limit;
          const paginated = sorted.slice(start, start + limit);
          setInvoices(paginated);
          setPagination({
            page,
            limit,
            total,
            pages,
            hasNext: page < pages,
            hasPrev: page > 1,
          });

          // Keep tenant stats in sync with the currently filtered dataset
          setStats({
            total: filtered.length,
            scheduled: filtered.filter((inv) => inv.status === "scheduled")
              .length,
            issued: filtered.filter((inv) => inv.status === "issued").length,
            paid: filtered.filter((inv) => inv.status === "paid").length,
            partial: filtered.filter((inv) => inv.status === "partial").length,
            overdue: filtered.filter((inv) => inv.status === "overdue").length,
            cancelled: filtered.filter((inv) => inv.status === "cancelled")
              .length,
            totalAmount: filtered.reduce(
              (sum, inv) => sum + (inv.totalAmount || 0),
              0,
            ),
            paidAmount: filtered.reduce(
              (sum, inv) => sum + (inv.amountPaid || 0),
              0,
            ),
            overdueAmount: filtered.reduce(
              (sum, inv) => sum + (inv.balanceRemaining || 0),
              0,
            ),
          });
        } else {
          showSimpleError(
            "Erreur de chargement",
            t("leases.invoices.toasts.fetchTenantError"),
          );
        }
      } else {
        // For admin/manager, use the existing invoices API
        const params = new URLSearchParams();

        Object.entries(activeFilters).forEach(([key, value]) => {
          if (value !== undefined && value !== "") {
            params.append(key, value.toString());
          }
        });

        params.set("page", "1");
        params.set("limit", "1000");
        // La page Factures doit afficher toutes les factures du périmètre du compte,
        // y compris les factures déjà payées. Les compteurs sont calculés depuis
        // exactement ce même jeu de données afin d'éviter toute incohérence.
        params.set("includeSettled", "true");
        const response = await fetch(`/api/invoices?${params}`);
        const data = await response.json();

        if (data?.success) {
          const allInv: Facture[] = data.data?.invoices || [];

          // Source unique de vérité : les cartes et la liste utilisent le même
          // périmètre d'accès renvoyé par /api/invoices. Ainsi, si le Manager
          // voit 7 factures dans les compteurs, ces 7 factures existent bien
          // dans son jeu de données et sont affichables dans la liste.
          setStats({
            total: allInv.length,
            scheduled: allInv.filter((inv) => inv.status === "scheduled").length,
            issued: allInv.filter((inv) => inv.status === "issued").length,
            paid: allInv.filter((inv) => inv.status === "paid").length,
            partial: allInv.filter((inv) => inv.status === "partial").length,
            overdue: allInv.filter((inv) => inv.status === "overdue").length,
            cancelled: allInv.filter((inv) => inv.status === "cancelled").length,
            totalAmount: allInv.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0),
            paidAmount: allInv.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0),
            overdueAmount: allInv
              .filter((inv) => inv.status === "overdue")
              .reduce((sum, inv) => sum + (inv.balanceRemaining || 0), 0),
          });

          const search = (activeFilters.search || "").toLowerCase().trim();
          const filtered = allInv.filter((inv) => {
            const matchesStatus =
              !activeFilters.status || inv.status === activeFilters.status;
            if (!search) return matchesStatus;
            const haystack = [
              inv.invoiceNumber,
              inv.propertyId?.name,
              inv.tenantId?.firstName,
              inv.tenantId?.lastName,
              inv.tenantId?.email,
            ]
              .filter(Boolean)
              .map((v) => String(v).toLowerCase());
            const matchesSearch = haystack.some((v) => v.includes(search));
            return matchesStatus && matchesSearch;
          });
          const sortBy = activeFilters.sortBy || "createdAt";
          const sortOrder = activeFilters.sortOrder || "desc";
          const get = (obj: any, path: string) =>
            path
              .split(".")
              .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
          const getSortVal = (inv: Facture) => {
            const v = get(inv, sortBy);
            if (!v) return 0;
            const key = sortBy.toLowerCase();
            if (
              key.includes("date") ||
              key.includes("createdat") ||
              key.includes("updatedat")
            ) {
              const t = new Date(v as any).getTime();
              return Number.isNaN(t) ? 0 : t;
            }
            return typeof v === "number" ? v : String(v).toLowerCase();
          };
          const sorted = [...filtered].sort((a, b) => {
            const av = getSortVal(a);
            const bv = getSortVal(b);
            if (typeof av === "number" && typeof bv === "number") {
              return sortOrder === "asc" ? av - bv : bv - av;
            }
            return sortOrder === "asc"
              ? String(av).localeCompare(String(bv))
              : String(bv).localeCompare(String(av));
          });
          const page = activeFilters.page || 1;
          const limit = activeFilters.limit || 10;
          const total = sorted.length;
          const pages = Math.max(1, Math.ceil(total / limit));
          const start = (page - 1) * limit;
          const paginated = sorted.slice(start, start + limit);
          setInvoices(paginated);
          setPagination({
            page,
            limit,
            total,
            pages,
            hasNext: page < pages,
            hasPrev: page > 1,
          });
        } else {
          showSimpleError("Erreur de chargement", t("leases.invoices.toasts.fetchError"));
        }
      }
    } catch {
      showSimpleError("Erreur de chargement", t("leases.invoices.toasts.fetchError"));
    } finally {
      setLoading(false);
      setIsSearching(false);
      if (showFullLoading) {
        setIsInitialLoad(false);
      }
    }
  };

  const fetchStats = async () => {
    // Les statistiques de cette page sont volontairement calculées dans
    // fetchInvoices() depuis le même jeu de factures que la liste.
    // Ne pas réintroduire ici une seconde API de statistiques avec un scope différent.
    return;
  };

  const handleSearch = (value: string) => {
    setIsSearching(true);
    setFilters((prev) => ({ ...prev, search: value, page: 1 }));
  };

  const handleStatusFilter = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: status === "all" ? undefined : status,
      page: 1,
    }));
  };

  const handleSort = (sortBy: string, sortOrder: "asc" | "desc") => {
    setFilters((prev) => ({ ...prev, sortBy, sortOrder, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };
  const handlePageSizeChange = (newLimit: number) => {
    setFilters((prev) => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const handleDownloadInvoice = async (inv: Facture) => {
    try {
      await downloadCanonicalInvoicePdf(inv._id, inv.invoiceNumber);
      showSimpleSuccess(
        "Téléchargement terminé",
        t("leases.invoices.toasts.downloadSuccess"),
      );
    } catch {
      showSimpleError(
        "Échec du téléchargement",
        t("leases.invoices.toasts.downloadError"),
      );
    }
  };

  const handlePrintInvoice = async (inv: Facture) => {
    try {
      await printCanonicalInvoicePdf(inv._id);
    } catch {
      showSimpleError(
        "Échec de l'impression",
        t("leases.invoices.toasts.printError"),
      );
    }
  };

  const handleSendInvoice = async (inv: Facture) => {
    if (!inv?.tenantId?.email) {
      showSimpleError("Échec de l'envoi de l'e-mail", t("leases.invoices.toasts.emailError"));
      return;
    }
    try {
      const body = {
        leaseId: inv.leaseId?._id || (inv as any).leaseId,
        invoiceId: inv._id,
        to: inv.tenantId?.email,
        invoiceNumber: inv.invoiceNumber || "Non renseigné",
        subject: `Facture ${inv.invoiceNumber || "Non renseigné"}`,
        message: `Veuillez trouver ci-joint votre facture ${inv.invoiceNumber || "Non renseigné"}.`,
      };
      const res = await fetch("/api/invoices/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        showSimpleSuccess(
          "E-mail envoyé",
          t("leases.invoices.toasts.emailSuccess"),
        );
      } else {
        throw new Error(data?.error || t("leases.invoices.toasts.emailError"));
      }
    } catch {
      showSimpleError("Échec de l'envoi de l'e-mail", t("leases.invoices.toasts.emailError"));
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      setDeletingId(invoiceId);
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        showSimpleSuccess(
          "Facture supprimée",
          t("leases.invoices.toasts.refreshed"),
        );
        fetchFactures(filters, false);
      } else {
        throw new Error(data?.error || "Échec de la suppression de la facture");
      }
    } catch {
      showSimpleError("Échec de la suppression", "Impossible de supprimer la facture.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatCurrency = useCallback(
    (amount: number) => formatCurrencyLocalized(amount ?? 0),
    [formatCurrencyLocalized],
  );

  const getStatusBadge = (status?: string | null, daysOverdue?: number) => {
    const safeStatus = status || "unknown";
    const statusConfig = {
      scheduled: {
        variant: "secondary" as const,
        label: t("leases.invoices.status.scheduled"),
        icon: Calendar,
      },
      issued: {
        variant: "outline" as const,
        label: t("leases.invoices.status.issued"),
        icon: Send,
      },
      paid: {
        variant: "default" as const,
        label: t("leases.invoices.status.paid"),
        icon: CheckCircle,
      },
      partial: {
        variant: "secondary" as const,
        label: t("leases.invoices.status.partial"),
        icon: Clock,
      },
      overdue: {
        variant: "destructive" as const,
        label:
          daysOverdue && daysOverdue > 0
            ? `${t("leases.invoices.status.overdue")} (${daysOverdue}d)`
            : t("leases.invoices.status.overdue"),
        icon: AlertTriangle,
      },
      cancelled: {
        variant: "outline" as const,
        label: t("leases.invoices.status.cancelled"),
        icon: Trash2,
      },
    };

    const config = statusConfig[safeStatus as keyof typeof statusConfig] || {
      variant: "outline" as const,
      label: safeStatus,
      icon: FileText,
    };

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <config.icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const handleProcessLateFees = async () => {
    try {
      const response = await fetch("/api/invoices/late-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });

      const data = await response.json();
      if (data?.success) {
        showSimpleSuccess(
          "Pénalités de retard appliquées",
          t("leases.invoices.toasts.lateFeesSuccess", {
            values: { count: data?.data?.feesApplied ?? 0 },
          }),
        );
        fetchFactures(filters, false);
        fetchStats();
      } else {
        showSimpleError(
          "Échec de l'application des pénalités de retard",
          t("leases.invoices.toasts.lateFeesError"),
        );
      }
    } catch {
      showSimpleError(
        "Échec de l'application des pénalités de retard",
        t("leases.invoices.toasts.lateFeesError"),
      );
    }
  };

  const handleBulkAction = async () => {
    if (selectedInvoices.length === 0) {
      showSimpleError("Aucune sélection", t("leases.invoices.toasts.noSelection"));
      return;
    }

    // Open bulk operations dialog instead of direct action
    setBulkDialogOpen(true);
  };

  const handleRecordPayment = (invoice: Facture) => {
    setSelectedInvoiceForPayment(invoice);
    setPaymentDialogOpen(true);
  };

  const handleViewInvoice = (invoiceId: string) => {
    router.push(`/dashboard/accounting/invoices/${invoiceId}`);
  };

  const handleEditInvoice = (invoiceId: string) => {
    router.push(`/dashboard/accounting/invoices/${invoiceId}/edit`);
  };

  // Define columns for DataTable
  const invoiceColumns: DataTableColumn<Facture>[] = [
    {
      id: "invoiceNumber",
      header: t("leases.invoices.table.invoiceNumber"),
      cell: (invoice) => (
        <Link
          href={`/dashboard/accounting/invoices/${invoice._id}`}
          className="group inline-flex items-center gap-2 text-foreground transition-colors hover:text-blue-600 dark:hover:text-blue-400"
        >
          <FileText className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          <span className="font-mono font-medium">
            {invoice.invoiceNumber || "—"}
          </span>
        </Link>
      ),
    },
    ...(!isTenant
      ? [
          {
            id: "tenant",
            header: t("leases.invoices.table.tenant"),
            cell: (invoice: Facture) => {
              const tenantContent = (
                <>
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={invoice.tenantId?.avatar}
                      alt={`${invoice.tenantId?.firstName || ""} ${
                        invoice.tenantId?.lastName || ""
                      }`}
                    />
                    <AvatarFallback className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      {invoice.tenantId?.firstName?.[0] || "T"}
                      {invoice.tenantId?.lastName?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {invoice.tenantId?.firstName ||
                        t("leases.labels.unknownFirstName")}{" "}
                      {invoice.tenantId?.lastName ||
                        t("leases.labels.unknownLastName")}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {invoice.tenantId?.email}
                    </div>
                  </div>
                </>
              );

              if (!invoice.tenantId?._id) {
                return <div className="flex items-center gap-2">{tenantContent}</div>;
              }

              return (
                <Link
                  href={`/dashboard/tenants/${invoice.tenantId._id}`}
                  className="group flex items-center gap-2 text-foreground transition-colors"
                >
                  {tenantContent}
                </Link>
              );
            },
            visibility: "md" as const,
          },
        ]
      : []),
    {
      id: "property",
      header: t("leases.invoices.table.property"),
      cell: (invoice) => {
        const propertyId = invoice.propertyId?._id || invoice.leaseId?.propertyId?._id;
        const propertyName =
          invoice.propertyId?.name ||
          invoice.leaseId?.propertyId?.name ||
          "Bien inconnu";
        const propertyAddress =
          invoice.propertyId?.address || invoice.leaseId?.propertyId?.address;
        const address = formatAddress(propertyAddress);
        const words = address.split(" ");
        const truncatedAddress =
          words.length > 3 ? words.slice(0, 3).join(" ") + "..." : address;
        const propertyContent = (
          <>
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 max-w-[180px]">
              <div className="font-medium truncate transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {propertyName}
              </div>
              <div
                className="text-xs text-muted-foreground truncate"
                title={address}
              >
                {truncatedAddress}
              </div>
            </div>
          </>
        );

        if (!propertyId) {
          return <div className="flex items-center gap-2">{propertyContent}</div>;
        }

        return (
          <Link
            href={`/dashboard/properties/${propertyId}`}
            className="group flex items-center gap-2 text-foreground transition-colors"
          >
            {propertyContent}
          </Link>
        );
      },
      visibility: "lg" as const,
    },
    {
      id: "issueDate",
      header: t("leases.invoices.table.issueDate"),
      cell: (invoice) => (
        <span className="text-sm">
          {formatDisplayDate(invoice.issueDate)}
        </span>
      ),
      visibility: "md" as const,
    },
    {
      id: "dueDate",
      header: t("leases.invoices.table.dueDate"),
      cell: (invoice) => (
        <span className="text-sm">
          {formatDisplayDate(invoice.dueDate)}
        </span>
      ),
    },
    {
      id: "amount",
      header: t("leases.invoices.table.amount"),
      cell: (invoice) => (
        <span className="font-medium">
          {formatCurrency(invoice.totalAmount ?? 0)}
        </span>
      ),
    },
    {
      id: "paid",
      header: t("leases.invoices.table.paid"),
      cell: (invoice) => (
        <span className="text-green-600 dark:text-green-400">
          {formatCurrency(invoice.amountPaid ?? 0)}
        </span>
      ),
      visibility: "lg" as const,
    },
    {
      id: "balance",
      header: t("leases.invoices.table.balance"),
      cell: (invoice) => (
        <span
          className={
            (invoice.balanceRemaining ?? 0) > 0
              ? "text-red-600 dark:text-red-400 font-medium"
              : ""
          }
        >
          {formatCurrency(invoice.balanceRemaining ?? 0)}
        </span>
      ),
      visibility: "md" as const,
    },
    {
      id: "status",
      header: t("leases.invoices.table.status"),
      cell: (invoice) => getStatusBadge(invoice.status, invoice.daysOverdue),
    },
    {
      id: "actions",
      header: t("leases.invoices.table.actions"),
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
              {t("leases.invoices.actions.menuLabel")}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleViewInvoice(invoice._id)}>
              <Eye className="mr-2 h-4 w-4" />
              {t("leases.invoices.actions.viewDetails")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDownloadInvoice(invoice)}>
              <Download className="mr-2 h-4 w-4" />
              {t("leases.invoices.actions.downloadPdf")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlePrintInvoice(invoice)}>
              <Printer className="mr-2 h-4 w-4" />
              {t("leases.invoices.actions.print")}
            </DropdownMenuItem>
            {!isTenant && (
              <>
                <DropdownMenuSeparator />
                {invoice.status !== "paid" && (
                  <DropdownMenuItem
                    onClick={() => handleRecordPayment(invoice)}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    {t("leases.invoices.actions.recordPayment")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => handleSendInvoice(invoice)}>
                  <Send className="mr-2 h-4 w-4" />
                  {t("leases.invoices.actions.sendToTenant")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleEditInvoice(invoice._id)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  {t("leases.invoices.actions.editInvoice")}
                </DropdownMenuItem>
                <ConfirmationDialog
                  title={t("leases.invoices.dialog.delete.title")}
                  description={t("leases.invoices.dialog.delete.description", {
                    values: { invoiceNumber: invoice.invoiceNumber },
                  })}
                  confirmText={t("leases.invoices.dialog.delete.confirm")}
                  cancelText={t("leases.invoices.dialog.delete.cancel")}
                  variant="destructive"
                  onConfirm={() => handleDeleteInvoice(invoice._id)}
                  loading={deletingId === invoice._id}
                >
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("leases.invoices.actions.deleteInvoice")}
                  </DropdownMenuItem>
                </ConfirmationDialog>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const paymentDialogInvoice = selectedInvoiceForPayment
    ? {
        _id: selectedInvoiceForPayment._id,
        invoiceNumber: selectedInvoiceForPayment.invoiceNumber || "—",
        totalAmount: selectedInvoiceForPayment.totalAmount ?? 0,
        amountPaid: selectedInvoiceForPayment.amountPaid ?? 0,
        balanceRemaining: selectedInvoiceForPayment.balanceRemaining ?? 0,
        tenantId: selectedInvoiceForPayment.tenantId
          ? {
              firstName: selectedInvoiceForPayment.tenantId?.firstName || "",
              lastName: selectedInvoiceForPayment.tenantId?.lastName || "",
            }
          : null,
      }
    : null;

  return (
    <div className="mobile-invoices-page min-w-0 space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="mobile-page-header flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl">
            {isTenant
              ? t("invoices.header.myTitle", {
                  defaultValue: "Mes factures",
                })
              : t("invoices.header.title", {
                  defaultValue: "Factures",
                })}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {isTenant
              ? t("invoices.header.mySubtitle", {
                  defaultValue: "Consultez et payez vos factures",
                })
              : t("invoices.header.subtitle", {
                  defaultValue: "Baux, services et frais",
                })}
          </p>
        </div>
        <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:flex-nowrap sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-10 min-w-0 flex-1 justify-center px-1 text-[10px] leading-none sm:h-9 sm:flex-none sm:px-3 sm:text-sm"
            onClick={() => {
              fetchFactures(filters, true);
              fetchStats();
              showSimpleSuccess(
                "Actualisé",
                t("leases.invoices.toasts.refreshed"),
              );
            }}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5 shrink-0 sm:mr-2 sm:h-4 sm:w-4" />
            {t("leases.actions.refresh")}
          </Button>
          {!isTenant && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-10 min-w-0 flex-1 justify-center px-1 text-[10px] leading-none sm:h-9 sm:flex-none sm:px-3 sm:text-sm"
                onClick={handleProcessLateFees}
              >
                <AlertTriangle className="mr-1 h-3.5 w-3.5 shrink-0 sm:mr-2 sm:h-4 sm:w-4" />
                {t("leases.invoices.actions.processLateFees")}
              </Button>
              <Button
                size="sm"
                className="h-10 min-w-0 flex-1 justify-center px-1 text-[10px] leading-none sm:h-9 sm:flex-none sm:px-3 sm:text-sm"
                onClick={() =>
                  router.push("/dashboard/accounting/invoices/new")
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5 shrink-0 sm:mr-2 sm:h-4 sm:w-4" />
                {t("invoices.actions.createInvoice", {
                  defaultValue: "Facture",
                })}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {isTenant ? (
        <AnalyticsCardGrid className="md:grid-cols-4 lg:grid-cols-4">
          <AnalyticsCard
            title={t("leases.invoices.stats.total")}
            value={stats.total}
            description={t("leases.invoices.stats.totalDescription", {
              defaultValue: "Toutes les factures",
            })}
            icon={FileText}
            iconColor="primary"
          />
          <AnalyticsCard
            title={t("leases.invoices.stats.paid")}
            value={stats.paid}
            description={t("leases.invoices.stats.paidDescription", {
              defaultValue: "Payées avec succès",
            })}
            icon={CheckCircle}
            iconColor="success"
          />
          <AnalyticsCard
            title={t("leases.invoices.stats.overdue")}
            value={stats.overdue}
            description={t("leases.invoices.stats.overdueDescription", {
              defaultValue: "Nécessite une attention",
            })}
            icon={AlertTriangle}
            iconColor="warning"
          />
          <AnalyticsCard
            title={t("leases.invoices.stats.balance", {
              defaultValue: "Solde",
            })}
            value={formatCurrency(stats.overdueAmount)}
            description={t("leases.invoices.stats.balanceDescription", {
              defaultValue: "Solde impayé",
            })}
            icon={DollarSign}
            iconColor="error"
          />
        </AnalyticsCardGrid>
      ) : (
        <AnalyticsCardGrid className="md:grid-cols-4 lg:grid-cols-4">
          <AnalyticsCard
            title={t("leases.invoices.stats.total")}
            value={stats.total}
            description={t("leases.invoices.stats.totalDescription", {
              defaultValue: "Toutes les factures",
            })}
            icon={FileText}
            iconColor="primary"
          />

          <AnalyticsCard
            title={t("leases.invoices.stats.paid")}
            value={stats.paid}
            description={t("leases.invoices.stats.paidDescription", {
              defaultValue: "Payées avec succès",
            })}
            icon={CheckCircle}
            iconColor="success"
          />

          <AnalyticsCard
            title={t("leases.invoices.stats.issued")}
            value={stats.issued}
            description={t("leases.invoices.stats.issuedDescription", {
              defaultValue: "Émises et en attente de paiement",
            })}
            icon={Send}
            iconColor="info"
          />

          <AnalyticsCard
            title={t("leases.invoices.stats.overdue")}
            value={stats.overdue}
            description={t("leases.invoices.stats.overdueDescription", {
              defaultValue: "Nécessite une attention",
            })}
            icon={AlertTriangle}
            iconColor="error"
          />
        </AnalyticsCardGrid>
      )}

      {/* Facture List with Integrated Filters */}
      <Card className="gap-2">
        <CardHeader className="px-3 py-4 sm:px-6 sm:py-6">
          {/* Main Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t("leases.invoices.list.title")}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("leases.invoices.list.subtitle")}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-lg p-1 w-full sm:w-auto">
                <Button
                  variant={viewMode === "cards" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("cards")}
                  className="h-8 flex-1 sm:flex-none sm:px-3"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="h-8 flex-1 sm:flex-none sm:px-3"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Integrated Filters Bar */}
          <div className="flex flex-col gap-4 p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/60 dark:border-gray-700/60">
            {/* Search and Filter Controls in one row */}
            <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center lg:gap-3">
              {/* Search */}
              <GlobalSearch
                placeholder={t("leases.invoices.filters.searchPlaceholder")}
                initialValue={filters.search || ""}
                debounceDelay={300}
                onSearch={handleSearch}
                isLoading={isSearching}
                className="col-span-2 min-w-0 lg:flex-1"
                inputClassName="h-10 border-gray-200 dark:border-gray-700 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 bg-white dark:bg-gray-800"
                ariaLabel="Rechercher des factures"
              />

              {/* Filter Controls */}
              <Select
                value={filters.status || "all"}
                onValueChange={handleStatusFilter}
              >
                <SelectTrigger className="h-10 w-full border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:w-40">
                  <SelectValue
                    placeholder={t("leases.invoices.filters.statusPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("leases.invoices.filters.status.all")}
                  </SelectItem>
                  <SelectItem value="scheduled">
                    {t("leases.invoices.status.scheduled")}
                  </SelectItem>
                  <SelectItem value="issued">
                    {t("leases.invoices.status.issued")}
                  </SelectItem>
                  <SelectItem value="partial">
                    {t("leases.invoices.status.partial")}
                  </SelectItem>
                  <SelectItem value="paid">
                    {t("leases.invoices.status.paid")}
                  </SelectItem>
                  <SelectItem value="overdue">
                    {t("leases.invoices.status.overdue")}
                  </SelectItem>
                  <SelectItem value="cancelled">
                    {t("leases.invoices.status.cancelled")}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onValueChange={(value) => {
                  const [sortBy, sortOrder] = value.split("-");
                  handleSort(sortBy, sortOrder as "asc" | "desc");
                }}
              >
                <SelectTrigger className="h-10 w-full border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:w-40">
                  <SelectValue placeholder={t("leases.filters.sortBy")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">
                    {t("leases.sort.newestFirst")}
                  </SelectItem>
                  <SelectItem value="createdAt-asc">
                    {t("leases.sort.oldestFirst")}
                  </SelectItem>
                  <SelectItem value="dueDate-asc">
                    {t("leases.invoices.sort.dueDateEarliest")}
                  </SelectItem>
                  <SelectItem value="dueDate-desc">
                    {t("leases.invoices.sort.dueDateLatest")}
                  </SelectItem>
                  <SelectItem value="totalAmount-desc">
                    {t("leases.invoices.sort.amountHighToLow")}
                  </SelectItem>
                  <SelectItem value="totalAmount-asc">
                    {t("leases.invoices.sort.amountLowToHigh")}
                  </SelectItem>
                  <SelectItem value="status-asc">
                    {t("leases.invoices.sort.statusAZ")}
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Effacer Filters */}
              {(filters.search || filters.status) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      search: "",
                      status: undefined,
                      page: 1,
                    }))
                  }
                  className="h-10 px-3 text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4 mr-1" />
                  {t("leases.filters.clear") || "Effacer"}
                </Button>
              )}
            </div>

            {/* Bulk Actions - When items selected */}
            {selectedInvoices.length > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm text-muted-foreground">
                  {t("leases.invoices.bulk.selected", {
                    values: { count: selectedInvoices.length },
                  })}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      {t("leases.invoices.bulk.actions")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setBulkDialogOpen(true)}>
                      <CheckSquare className="mr-2 h-4 w-4" />
                      {t("leases.invoices.bulk.openDialog")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleBulkAction}>
                      <Send className="mr-2 h-4 w-4" />
                      {t("leases.invoices.bulk.sendFactures")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBulkAction}>
                      <Download className="mr-2 h-4 w-4" />
                      {t("leases.invoices.bulk.downloadPdfs")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBulkAction}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      {t("leases.invoices.bulk.markAsPaid")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleBulkAction}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("leases.invoices.bulk.cancelFactures")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="p-6">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[200px]" />
                    </div>
                    <Skeleton className="h-4 w-[100px]" />
                    <Skeleton className="h-4 w-[80px]" />
                  </div>
                ))}
              </div>
            </div>
          ) : viewMode === "cards" ? (
            <div className="grid gap-3 p-0 sm:gap-4 sm:p-4 md:grid-cols-2 lg:grid-cols-3">
              {invoices.length === 0 ? (
                <div className="col-span-full flex flex-col items-center gap-2 py-12">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">
                    {t("leases.invoices.empty.noFactures", {
                      defaultValue: "Aucune facture trouvée",
                    })}
                  </h3>
                  <p className="text-muted-foreground mb-2">
                    {t("leases.invoices.empty.description", {
                      defaultValue: "Aucune facture ne correspond aux filtres actuels.",
                    })}
                  </p>
                  {!isTenant && !filters.search && !filters.status && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push("/dashboard/accounting/invoices/new")
                      }
                    >
                      {t("invoices.empty.createFirst", {
                        defaultValue: "Créer une facture",
                      })}
                    </Button>
                  )}
                </div>
              ) : (
                invoices.map((invoice) => (
                  <Card
                    key={invoice._id}
                    className="invoice-mobile-card transition-shadow hover:shadow-md"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="min-w-0 truncate font-mono text-sm font-semibold sm:text-base">
                              {invoice.invoiceNumber || "—"}
                            </span>
                          </div>
                          {!isTenant && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Avatar className="h-6 w-6">
                                <AvatarImage
                                  src={invoice.tenantId?.avatar}
                                  alt={`${invoice.tenantId?.firstName || ""} ${
                                    invoice.tenantId?.lastName || ""
                                  }`}
                                />
                                <AvatarFallback className="text-xs">
                                  {invoice.tenantId?.firstName?.[0] || "T"}
                                  {invoice.tenantId?.lastName?.[0] || "U"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">
                                {invoice.tenantId?.firstName ||
                                  t("leases.labels.unknownFirstName")}{" "}
                                {invoice.tenantId?.lastName ||
                                  t("leases.labels.unknownLastName")}
                              </span>
                            </div>
                          )}
                        </div>
                        {!isTenant && (
                          <input
                            type="checkbox"
                            checked={selectedInvoices.includes(invoice._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedFactures([
                                  ...selectedInvoices,
                                  invoice._id,
                                ]);
                              } else {
                                setSelectedFactures(
                                  selectedInvoices.filter(
                                    (id) => id !== invoice._id,
                                  ),
                                );
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium truncate">
                            {invoice.leaseId?.propertyId?.name ||
                              invoice.propertyId?.name ||
                              t("leases.labels.addressNotAvailable")}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {formatAddress(
                            invoice.leaseId?.propertyId?.address ||
                              invoice.propertyId?.address,
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {t("leases.invoices.table.issueDate")}
                          </div>
                          <div className="font-medium">
                            {formatDisplayDate(invoice.issueDate)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {t("leases.invoices.table.dueDate")}
                          </div>
                          <div
                            className={`font-medium ${
                              new Date(invoice.dueDate || "") < new Date() &&
                              invoice.status !== "paid"
                                ? "text-red-600"
                                : ""
                            }`}
                          >
                            {formatDisplayDate(invoice.dueDate)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1 text-xs sm:gap-2 sm:text-sm">
                        <div>
                          <div className="text-[10px] text-muted-foreground sm:text-xs">
                            {t("leases.invoices.table.total")}
                          </div>
                          <div className="whitespace-nowrap text-[11px] font-semibold sm:text-sm">
                            {formatCurrency(invoice.totalAmount ?? 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground sm:text-xs">
                            {t("leases.invoices.table.paid")}
                          </div>
                          <div className="whitespace-nowrap text-[11px] font-medium text-green-600 sm:text-sm">
                            {formatCurrency(invoice.amountPaid ?? 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground sm:text-xs">
                            {t("leases.invoices.table.balance")}
                          </div>
                          <div
                            className={`whitespace-nowrap text-[11px] font-semibold sm:text-sm ${
                              (invoice.balanceRemaining ?? 0) > 0
                                ? "text-red-600"
                                : "text-green-600"
                            }`}
                          >
                            {formatCurrency(invoice.balanceRemaining ?? 0)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        {getStatusBadge(invoice.status, invoice.daysOverdue)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/dashboard/accounting/invoices/${invoice._id}`,
                                )
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              {t("leases.invoices.actions.viewDetails")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDownloadInvoice(invoice)}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              {t("leases.invoices.actions.downloadPdf")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handlePrintInvoice(invoice)}
                            >
                              <Printer className="mr-2 h-4 w-4" />
                              {t("leases.invoices.actions.print")}
                            </DropdownMenuItem>
                            {!isTenant && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedInvoiceForPayment(invoice);
                                    setPaymentDialogOpen(true);
                                  }}
                                  disabled={invoice.status === "paid"}
                                >
                                  <CreditCard className="mr-2 h-4 w-4" />
                                  {t("leases.invoices.actions.recordPayment")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleSendInvoice(invoice)}
                                >
                                  <Send className="mr-2 h-4 w-4" />
                                  {t("leases.invoices.actions.sendToTenant")}
                                </DropdownMenuItem>
                                <ConfirmationDialog
                                  title={t(
                                    "leases.invoices.dialog.delete.title",
                                  )}
                                  description={t(
                                    "leases.invoices.dialog.delete.description",
                                    {
                                      values: {
                                        invoiceNumber: invoice.invoiceNumber,
                                      },
                                    },
                                  )}
                                  confirmText={t(
                                    "leases.invoices.dialog.delete.confirm",
                                  )}
                                  cancelText={t(
                                    "leases.invoices.dialog.delete.cancel",
                                  )}
                                  variant="destructive"
                                  onConfirm={() =>
                                    handleDeleteInvoice(invoice._id)
                                  }
                                  loading={deletingId === invoice._id}
                                >
                                  <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {t("leases.invoices.actions.deleteInvoice")}
                                  </DropdownMenuItem>
                                </ConfirmationDialog>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <DataTable<Facture>
              columns={invoiceColumns}
              data={invoices}
              getRowKey={(invoice: Facture) => invoice._id}
              selection={
                !isTenant
                  ? {
                      enabled: true,
                      selectedIds: selectedInvoices,
                      onSelectAll: (checked: boolean) => {
                        if (checked) {
                          setSelectedFactures(invoices.map((inv) => inv._id));
                        } else {
                          setSelectedFactures([]);
                        }
                      },
                      onSelectRow: (id: string, checked: boolean) => {
                        if (checked) {
                          setSelectedFactures((prev) => [...prev, id]);
                        } else {
                          setSelectedFactures((prev) =>
                            prev.filter((i) => i !== id),
                          );
                        }
                      },
                      getRowId: (invoice: Facture) => invoice._id,
                      selectAllLabel: t("leases.invoices.selection.selectAll", {
                        defaultValue: "Tout sélectionner",
                      }),
                      selectRowLabel: () =>
                        t("leases.invoices.selection.selectInvoice", {
                          defaultValue: "Sélectionner la facture",
                        }),
                    }
                  : undefined
              }
              emptyState={{
                icon: <FileText className="h-12 w-12 text-muted-foreground" />,
                title: t("leases.invoices.empty.noFactures", {
                  defaultValue: "Aucune facture trouvée",
                }),
                description: t("leases.invoices.empty.description", {
                  defaultValue: "Aucune facture ne correspond aux filtres actuels.",
                }),
              }}
              striped
            />
          )}
          {!loading && pagination.total > 0 && (
            <GlobalPagination
              currentPage={filters.page || 1}
              totalPages={pagination.pages}
              totalItems={pagination.total}
              pageSize={filters.limit ?? 12}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              showingLabel={t("common.showing", { defaultValue: "Affichage de" })}
              previousLabel={t("common.previous", { defaultValue: "Précédent" })}
              nextLabel={t("common.next", { defaultValue: "Suivant" })}
              pageLabel={t("common.page", { defaultValue: "Page" })}
              ofLabel={t("common.of", { defaultValue: "sur" })}
              itemsPerPageLabel={t("common.perPage", {
                defaultValue: "par page",
              })}
              disabled={loading || isSearching}
            />
          )}
        </CardContent>
      </Card>

      {/* Payment Record Dialog */}
      <PaymentRecordDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoice={paymentDialogInvoice}
        onPaymentRecorded={() => {
          fetchFactures(filters, false);
          setSelectedInvoiceForPayment(null);
        }}
      />

      {/* Bulk Operations Dialog */}
      <BulkOperationsDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        selectedInvoices={selectedInvoices}
        onOperationComplete={() => {
          fetchFactures(filters, false);
          setSelectedFactures([]);
        }}
      />
    </div>
  );
}
