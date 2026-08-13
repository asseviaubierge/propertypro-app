"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  FileText,
  CreditCard,
  Receipt,
  ExternalLink,
  FileSpreadsheet,
  ArrowUpDown,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AnalyticsCard,
  AnalyticsCardGrid,
} from "@/components/analytics/AnalyticsCard";
import { TransactionType } from "@/types";
import GlobalSearch from "@/components/ui/global-search";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GlobalPagination } from "@/components/ui/global-pagination";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import type { IUnifiedTransaction, ITransactionSummary } from "@/types";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import { useAuthorization } from "@/hooks/useAuthorization";
import { toast } from "sonner";

interface TransactionResponse {
  success: boolean;
  data: {
    transactions: IUnifiedTransaction[];
    summary: ITransactionSummary;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const EMPTY_TRANSACTION_SUMMARY: ITransactionSummary = {
  totalIncome: 0,
  totalExpenses: 0,
  netMontant: 0,
  outstanding: 0,
  transactionCount: 0,
};

export default function TransactionsPage() {
  const { isLocataire } = useAuthorization();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, formatCurrency, formatDate } = useLocalizationContext();

  // State
  const [transactions, setTransactions] = useState<IUnifiedTransaction[]>([]);
  const [summary, setSummary] = useState<ITransactionSummary>(
    EMPTY_TRANSACTION_SUMMARY,
  );
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  const [limit, setLimit] = useState(
    parseInt(searchParams.get("limit") || "12"),
  );
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [typeFilter, setTypeFilter] = useState(
    searchParams.get("type") || "all",
  );
  const [categoryFilter, setCatégorieFilter] = useState(
    searchParams.get("category") || "all",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isExporting, setIsExporting] = useState(false);

  const buildQueryParams = useCallback(
    (pageValue: number, limitValue: number) => {
      const params = new URLSearchParams();
      params.set("page", pageValue.toString());
      params.set("limit", limitValue.toString());
      params.set("sortOrder", sortOrder);
      if (search) params.set("search", search);
      if (typeFilter && typeFilter !== "all") params.set("type", typeFilter);
      if (categoryFilter && categoryFilter !== "all")
        params.set("category", categoryFilter);
      return params;
    },
    [categoryFilter, search, sortOrder, typeFilter],
  );

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildQueryParams(page, limit);
      const res = await fetch(`/api/accounting/transactions?${params}`);
      const data: TransactionResponse = await res.json();

      if (data?.success) {
        setTransactions(data?.data?.transactions ?? []);
        setSummary(data?.data?.summary ?? EMPTY_TRANSACTION_SUMMARY);
        setTotalPages(data?.pagination?.totalPages ?? 1);
        setTotalItems(data?.pagination?.total ?? 0);
      }
    } catch (error) {
      console.error("Échec du chargement des transactions :", error);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, limit, page]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Navigate to source document
  const handleRowClick = (transaction: IUnifiedTransaction) => {
    if (transaction.sourceType === "payment") {
      router.push(`/dashboard/payments/${transaction.sourceId}`);
    } else if (transaction.sourceType === "invoice") {
      router.push(`/dashboard/accounting/invoices/${transaction.sourceId}`);
    } else if (transaction.sourceType === "expense") {
      router.push(`/dashboard/accounting/expenses/${transaction.sourceId}`);
    } else if (transaction.sourceType === "bill") {
      router.push(`/dashboard/accounting/bills/${transaction.sourceId}`);
    }
  };

  // Statut badge color mapping
  const getStatutColor = (status?: string | null) => {
    const normalizedStatut = (status ?? "").toLowerCase();
    const colors: Record<string, string> = {
      completed: "bg-success/10 text-success border-success/20",
      paid: "bg-success/10 text-success border-success/20",
      pending: "bg-warning/10 text-warning border-warning/20",
      processing: "bg-info/10 text-info border-info/20",
      overdue: "bg-error/10 text-error border-error/20",
      late: "bg-error/10 text-error border-error/20",
      severely_overdue: "bg-error/10 text-error border-error/20",
      failed: "bg-error/10 text-error border-error/20",
      cancelled: "bg-muted text-muted-foreground border-muted",
      issued: "bg-info/10 text-info border-info/20",
      scheduled: "bg-muted text-muted-foreground border-muted",
      partial: "bg-warning/10 text-warning border-warning/20",
      refunded: "bg-muted text-muted-foreground border-muted",
      draft: "bg-muted text-muted-foreground border-muted",
      approved: "bg-success/10 text-success border-success/20",
    };
    return (
      colors[normalizedStatut] || "bg-muted text-muted-foreground border-muted"
    );
  };

  const getTransactionTypeLabel = (type?: string | null) => {
    const normalizedType = (type ?? "unknown").toLowerCase();
    return t(`transactions.types.${normalizedType}`, {
      defaultValue:
        normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1),
    });
  };

  const getCatégorieLabel = (category?: string | null) => {
    const normalizedCatégorie = (category ?? "unknown").toLowerCase();
    return t(`transactions.categories.${normalizedCatégorie}`, {
      defaultValue: normalizedCatégorie.replace(/_/g, " "),
    });
  };

  const getStatutLabel = (status?: string | null) => {
    const normalizedStatut = (status ?? "unknown").toLowerCase();
    return t(`transactions.status.${normalizedStatut}`, {
      defaultValue: normalizedStatut.replace(/_/g, " "),
    });
  };

  const getSourceTypeLabel = (sourceType?: string | null) => {
    const normalizedSourceType = (sourceType ?? "transaction").toLowerCase();
    return t(`transactions.sourceTypes.${normalizedSourceType}`, {
      defaultValue:
        normalizedSourceType.charAt(0).toUpperCase() +
        normalizedSourceType.slice(1),
    });
  };

  const escapeCsvValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return "";
    const normalized = String(value);
    if (normalized.includes(",") || normalized.includes('"') || normalized.includes("\n")) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }
    return normalized;
  };

  const getSignedMontant = (transaction: IUnifiedTransaction) => {
    const isOutflow =
      transaction.type === TransactionType.EXPENSE ||
      transaction.type === TransactionType.CREDIT;
    const baseMontant = Number(transaction.amount ?? 0);
    return isOutflow ? -Math.abs(baseMontant) : Math.abs(baseMontant);
  };

  const buildStatementCsv = (statementTransactions: IUnifiedTransaction[]) => {
    const header = [
      "Date",
      "Type de transaction",
      "Source",
      "Catégorie",
      "Description",
      "Référence",
      "Locataire",
      "Bien",
      "Montant",
      "Statut",
    ];

    const rows = statementTransactions.map((transaction) => {
      const tenantName = transaction.tenantId
        ? `${transaction.tenantId.firstName || ""} ${
            transaction.tenantId.lastName || ""
          }`.trim()
        : "";
      const signedMontant = getSignedMontant(transaction);

      return [
        transaction.date ? formatDate(transaction.date) : "",
        getTransactionTypeLabel(transaction.type),
        getSourceTypeLabel(transaction.sourceType),
        getCatégorieLabel(transaction.category),
        transaction.description || "",
        transaction.reference || "",
        tenantName,
        transaction.propertyId?.name || "",
        signedMontant.toFixed(2),
        getStatutLabel(transaction.status),
      ];
    });

    return [header, ...rows]
      .map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
      .join("\n");
  };

  const handleStatementExport = async () => {
    setIsExporting(true);
    try {
      const exportLimit = 100;
      let currentPage = 1;
      let totalPageCount = 1;
      const allTransactions: IUnifiedTransaction[] = [];

      while (currentPage <= totalPageCount) {
        const params = buildQueryParams(currentPage, exportLimit);
        const response = await fetch(`/api/accounting/transactions?${params}`);
        if (!response.ok) {
          throw new Error("Échec du chargement des transactions pour l'export");
        }

        const data: TransactionResponse = await response.json();
        if (!data?.success) {
          throw new Error("Données d'export invalides");
        }

        const pageTransactions = data?.data?.transactions ?? [];
        allTransactions.push(...pageTransactions);
        totalPageCount = Math.max(data?.pagination?.totalPages ?? currentPage, 1);
        currentPage += 1;
      }

      if (allTransactions.length === 0) {
        toast.info(
          t("transactions.export.noData", {
            defaultValue: "Aucune transaction à exporter",
          }),
        );
        return;
      }

      const csvContent = buildStatementCsv(allTransactions);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const exportDate = new Date().toISOString().split("T")[0];

      link.href = url;
      link.download = `transactions-statement-${exportDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(
        t("transactions.export.success", {
          defaultValue: "Relevé exporté avec succès",
        }),
      );
    } catch (error) {
      console.error("Failed to export transaction statement:", error);
      toast.error(
        t("transactions.export.error", {
          defaultValue: "Échec de l'export du relevé",
        }),
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Source type icon
  const getSourceIcon = (sourceType?: string | null) => {
    switch (sourceType?.toLowerCase()) {
      case "payment":
        return <CreditCard className="h-4 w-4" />;
      case "invoice":
        return <FileText className="h-4 w-4" />;
      case "expense":
        return <Receipt className="h-4 w-4" />;
      case "bill":
        return <Receipt className="h-4 w-4" />;
      default:
        return <ArrowLeftRight className="h-4 w-4" />;
    }
  };

  // Table columns
  const columns: DataTableColumn<IUnifiedTransaction>[] = [
    {
      id: "date",
      header: t("transactions.table.date", { defaultValue: "Date" }),
      cell: (row) => (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{row.date ? formatDate(row.date) : "—"}</span>
        </div>
      ),
      width: "min-w-[130px]",
    },
    {
      id: "source",
      header: t("transactions.table.type", { defaultValue: "Type" }),
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {getSourceIcon(row?.sourceType)}
          </span>
          <span className="text-sm">
            {getSourceTypeLabel(row?.sourceType)}
          </span>
        </div>
      ),
      width: "min-w-[100px]",
    },
    {
      id: "category",
      header: t("transactions.table.category", { defaultValue: "Catégorie" }),
      cell: (row) => (
        <Badge variant="outline" className="capitalize text-xs font-normal">
          {getCatégorieLabel(row?.category)}
        </Badge>
      ),
      visibility: "md",
      width: "min-w-[120px]",
    },
    {
      id: "description",
      header: t("transactions.table.description", {
        defaultValue: "Description",
      }),
      cell: (row) => (
        <div
          className="max-w-62.5 truncate text-sm"
          title={row?.description ?? "—"}
        >
          {row?.description || "—"}
        </div>
      ),
      width: "min-w-[180px]",
    },
    {
      id: "reference",
      header: t("transactions.table.reference", { defaultValue: "Référence" }),
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row?.reference || "—"}
        </span>
      ),
      visibility: "lg",
      width: "min-w-[140px]",
    },
    {
      id: "tenant",
      header: t("transactions.table.tenant", { defaultValue: "Locataire" }),
      cell: (row) =>
        row.tenantId ? (
          <Link
            href={`/dashboard/tenants/${row.tenantId._id}`}
            className="group inline-flex text-sm text-foreground transition-colors"
          >
            <span className="transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {row.tenantId?.firstName || "—"} {row.tenantId?.lastName || ""}
            </span>
          </Link>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
      visibility: "lg",
      width: "min-w-[140px]",
    },
    {
      id: "property",
      header: t("transactions.table.property", { defaultValue: "Bien" }),
      cell: (row) =>
        row.propertyId ? (
          <Link
            href={`/dashboard/properties/${row.propertyId._id}`}
            className="group text-sm truncate max-w-30 block text-foreground transition-colors"
          >
            <span className="transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {row.propertyId?.name || "—"}
            </span>
          </Link>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
      visibility: "xl",
      width: "min-w-[120px]",
    },
    {
      id: "amount",
      header: t("transactions.table.amount", { defaultValue: "Montant" }),
      cell: (row) => (
        <span
          className={`font-semibold text-sm ${
            row.type === TransactionType.EXPENSE ||
            row.type === TransactionType.CREDIT
              ? "text-error"
              : "text-success"
          }`}
        >
          {row.type === TransactionType.EXPENSE ||
          row.type === TransactionType.CREDIT
            ? "-"
            : "+"}
          {formatCurrency(row?.amount ?? 0)}
        </span>
      ),
      align: "right",
      width: "min-w-[110px]",
    },
    {
      id: "status",
      header: t("transactions.table.status", { defaultValue: "Statut" }),
      cell: (row) => (
        <Badge
          variant="outline"
          className={`capitalize text-xs ${getStatutColor(row?.status)}`}
        >
          {getStatutLabel(row?.status)}
        </Badge>
      ),
      width: "min-w-[110px]",
    },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(e) => {
            e.stopPropagation();
            handleRowClick(row);
          }}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      ),
      width: "w-10",
      align: "center",
    },
  ];

  // Filter out tenant-only hidden columns
  const visibleColumns = isLocataire
    ? columns.filter((c) => c.id !== "tenant")
    : columns;

  const hasActiveFilters =
    !!search || typeFilter !== "all" || categoryFilter !== "all";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl">
            {t("nav.accounting.transactions", { defaultValue: "Transactions" })}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t("transactions.header.bankSubtitle", {
              defaultValue: "Uniquement les mouvements bancaires confirmés",
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
        >
          <ArrowUpDown className="h-4 w-4 mr-2" />
          {sortOrder === "desc"
            ? t("transactions.sort.newestFirst", {
                defaultValue: "Plus récentes d'abord",
              })
            : t("transactions.sort.oldestFirst", {
                defaultValue: "Plus anciennes d'abord",
              })}
        </Button>
      </div>

      {/* Stats Cards */}
      <AnalyticsCardGrid className="lg:grid-cols-4">
        <AnalyticsCard
          title={t("transactions.stats.totalIncome", {
            defaultValue: "Revenus totaux",
          })}
          value={formatCurrency(summary.totalIncome)}
          icon={TrendingUp}
          iconColor="success"
          description={t("transactions.stats.transactionCount", {
            defaultValue: "{count} transactions",
            values: { count: summary.transactionCount },
          })}
        />
        <AnalyticsCard
          title={t("transactions.stats.totalExpenses", {
            defaultValue: "Dépenses totales",
          })}
          value={formatCurrency(summary.totalExpenses)}
          icon={TrendingDown}
          iconColor="error"
        />
        <AnalyticsCard
          title={t("transactions.stats.netMontant", {
            defaultValue: "Net Montant",
          })}
          value={formatCurrency(summary.netMontant)}
          icon={DollarSign}
          iconColor="primary"
        />
        <AnalyticsCard
          title={t("transactions.stats.outstanding", {
            defaultValue: "Impayés",
          })}
          value={formatCurrency(summary.outstanding)}
          icon={AlertTriangle}
          iconColor="warning"
        />
      </AnalyticsCardGrid>

      {/* Transactions Table with Integrated Filters */}
      <Card className="gap-2">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
                <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t("nav.accounting.transactions", {
                    defaultValue: "Transactions",
                  })}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("transactions.header.bankSubtitle", {
                    defaultValue: "Uniquement les mouvements bancaires confirmés",
                  })}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStatementExport}
              disabled={loading || isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {t("transactions.actions.exportStatement", {
                defaultValue: "Exporter le relevé",
              })}
            </Button>
          </div>

          <div className="flex flex-col gap-4 p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/60 dark:border-gray-700/60">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <GlobalSearch
                placeholder={t("transactions.filters.searchPlaceholder", {
                  defaultValue: "Rechercher des transactions...",
                })}
                initialValue={search}
                debounceDelay={300}
                onSearch={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                isLoading={loading}
                className="flex-1 min-w-0"
                inputClassName="h-10 border-gray-200 dark:border-gray-700 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 bg-white dark:bg-gray-800"
                ariaLabel={t("transactions.filters.searchAriaLabel", {
                  defaultValue: "Rechercher des transactions",
                })}
              />

              <Select
                value={typeFilter}
                onValueChange={(val) => {
                  setTypeFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-42.5 h-10 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <SelectValue
                    placeholder={t("transactions.filters.allTypes", {
                      defaultValue: "Tous les types",
                    })}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("transactions.filters.allTypes", {
                      defaultValue: "Tous les types",
                    })}
                  </SelectItem>
                  <SelectItem value={TransactionType.INCOME}>
                    {getTransactionTypeLabel(TransactionType.INCOME)}
                  </SelectItem>
                  <SelectItem value={TransactionType.EXPENSE}>
                    {getTransactionTypeLabel(TransactionType.EXPENSE)}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={categoryFilter}
                onValueChange={(val) => {
                  setCatégorieFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-42.5 h-10 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <SelectValue
                    placeholder={t("transactions.filters.allCategories", {
                      defaultValue: "Toutes les catégories",
                    })}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("transactions.filters.allCategories", {
                      defaultValue: "Toutes les catégories",
                    })}
                  </SelectItem>
                  <SelectItem value="rent">
                    {getCatégorieLabel("rent")}
                  </SelectItem>
                  <SelectItem value="security_deposit">
                    {getCatégorieLabel("security_deposit")}
                  </SelectItem>
                  <SelectItem value="late_fee">
                    {getCatégorieLabel("late_fee")}
                  </SelectItem>
                  <SelectItem value="utility">
                    {getCatégorieLabel("utility")}
                  </SelectItem>
                  <SelectItem value="maintenance">
                    {getCatégorieLabel("maintenance")}
                  </SelectItem>
                  <SelectItem value="other">
                    {getCatégorieLabel("other")}
                  </SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setCatégorieFilter("all");
                    setPage(1);
                  }}
                  className="h-10 px-3 text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4 mr-1" />
                  {t("transactions.filters.clear", { defaultValue: "Effacer" })}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <DataTable
            columns={visibleColumns}
            data={transactions}
            loading={loading}
            getRowKey={(row) => row.id}
            emptyState={{
              icon: (
                <ArrowLeftRight className="h-12 w-12 text-muted-foreground" />
              ),
              title: t("transactions.empty.title", {
                defaultValue: "Aucune transaction trouvée",
              }),
              description: hasActiveFilters
                ? t("transactions.empty.filtered", {
                    defaultValue: "Essayez de modifier vos filtres",
                  })
                : t("transactions.empty.default", {
                    defaultValue:
                      "Les transactions apparaîtront ici une fois les paiements ou factures créés",
                  }),
            }}
          />
          {!loading && totalItems > 0 && (
            <GlobalPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={limit}
              onPageChange={setPage}
              onPageSizeChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
              showingLabel={t("common.showing", { defaultValue: "Affichage" })}
              previousLabel={t("common.previous", { defaultValue: "Précédent" })}
              nextLabel={t("common.next", { defaultValue: "Suivant" })}
              pageLabel={t("common.page", { defaultValue: "Page" })}
              surLabel={t("common.sur", { defaultValue: "sur" })}
              itemsPerPageLabel={t("common.perPage", {
                defaultValue: "par page",
              })}
              disabled={loading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
