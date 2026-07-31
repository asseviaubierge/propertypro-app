"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp,
  DollarSign,
  Wallet,
  CheckCircle,
  AlertCircle,
  Percent,
  Building2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AnalyticsCard,
  AnalyticsCardGrid,
} from "@/components/analytics/AnalyticsCard";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface RevenueSummary {
  totalRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
  monthToDate: number;
  yearToDate: number;
  collectionRate: number;
  count: number;
}

interface RevenueByCategory {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

interface RevenueByProperty {
  propertyId: string;
  propertyName: string;
  revenue: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
}

interface MonthlyRevenue {
  year: number;
  month: number;
  revenue: number;
  collected: number;
  count: number;
}

const PIE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

const MONTH_NAMES = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

export default function RevenuesPage() {
  const { t, formatCurrency } = useLocalizationContext();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [byCategory, setByCategory] = useState<RevenueByCategory[]>([]);
  const [byProperty, setByProperty] = useState<RevenueByProperty[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyRevenue[]>([]);

  const fetchRevenues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounting/revenues?months=12");
      const data = await res.json();

      if (data?.success) {
        setSummary(data?.data?.summary || null);
        setByCategory(data?.data?.byCategory || []);
        setByProperty(data?.data?.byProperty || []);
        setMonthlyTrends(data?.data?.monthlyTrends || []);
      }
    } catch (error) {
      console.error("Échec du chargement des données de revenus :", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRevenues();
  }, [fetchRevenues]);

  const chartData = monthlyTrends.map((m) => ({
    name: `${MONTH_NAMES[(m?.month ?? 1) - 1] ?? "N/A"} ${m?.year ?? ""}`.trim(),
    revenue: m?.revenue ?? 0,
    collected: m?.collected ?? 0,
  }));

  const pieData = byCategory.map((c) => ({
    name: (c?.category || "other").replace(/_/g, " "),
    value: c?.amount ?? 0,
    count: c?.count ?? 0,
  }));

  const propertyColumns: DataTableColumn<RevenueByProperty>[] = [
    {
      id: "property",
      header: t("revenues.table.property", { defaultValue: "Bien" }),
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            {row?.propertyName || "Bien inconnu"}
          </span>
        </div>
      ),
      width: "min-w-[200px]",
    },
    {
      id: "revenue",
      header: t("revenues.table.totalRevenue", {
        defaultValue: "Revenus totaux",
      }),
      cell: (row) => (
        <span className="font-semibold text-sm">
          {formatCurrency(row.revenue)}
        </span>
      ),
      align: "right",
      width: "min-w-[130px]",
    },
    {
      id: "collected",
      header: t("revenues.table.collected", { defaultValue: "Montant encaissé" }),
      cell: (row) => (
        <span className="text-sm text-success font-medium">
          {formatCurrency(row.collected)}
        </span>
      ),
      align: "right",
      width: "min-w-[130px]",
    },
    {
      id: "outstanding",
      header: t("revenues.table.outstanding", { defaultValue: "Impayés" }),
      cell: (row) => (
        <span className="text-sm text-warning font-medium">
          {formatCurrency(row.outstanding)}
        </span>
      ),
      align: "right",
      width: "min-w-[130px]",
    },
    {
      id: "collectionRate",
      header: t("revenues.table.rate", { defaultValue: "Taux de recouvrement" }),
      cell: (row) => (
        <Badge
          variant="outline"
          className={`text-xs ${
            (row?.collectionRate ?? 0) >= 90
              ? "bg-success/10 text-success border-success/20"
              : (row?.collectionRate ?? 0) >= 70
                ? "bg-warning/10 text-warning border-warning/20"
                : "bg-error/10 text-error border-error/20"
          }`}
        >
          {row?.collectionRate ?? 0}%
        </Badge>
      ),
      align: "center",
      width: "min-w-[130px]",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {t("nav.accounting.revenues", { defaultValue: "Revenus" })}
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {t("revenues.subtitle", {
            defaultValue:
              "Suivez les revenus provenant des loyers, pénalités, dépôts et autres sources",
          })}
        </p>
      </div>

      {/* Summary Cards */}
      <AnalyticsCardGrid className="lg:grid-cols-4">
        <AnalyticsCard
          title={t("revenues.stats.totalRevenue", {
            defaultValue: "Revenus totaux",
          })}
          value={formatCurrency(summary?.totalRevenue || 0)}
          icon={DollarSign}
          iconColor="primary"
        />
        <AnalyticsCard
          title={t("revenues.stats.collected", { defaultValue: "Montant encaissé" })}
          value={formatCurrency(summary?.totalCollected || 0)}
          icon={CheckCircle}
          iconColor="success"
        />
        <AnalyticsCard
          title={t("revenues.stats.outstanding", {
            defaultValue: "Impayés",
          })}
          value={formatCurrency(summary?.totalOutstanding || 0)}
          icon={AlertCircle}
          iconColor="warning"
        />
        <AnalyticsCard
          title={t("revenues.stats.collectionRate", {
            defaultValue: "Taux de recouvrement",
          })}
          value={`${summary?.collectionRate || 0}%`}
          icon={Percent}
          iconColor="info"
          description={t("revenues.stats.ytd", {
            defaultValue: "Cumul annuel : {amount}",
            values: { amount: formatCurrency(summary?.yearToDate || 0) },
          })}
        />
      </AnalyticsCardGrid>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Trends Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {t("revenues.charts.monthlyTrends", {
                    defaultValue: "Évolution mensuelle des revenus",
                  })}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("revenues.charts.last12Months", {
                    defaultValue: "12 derniers mois",
                  })}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    tickFormatter={(v) =>
                      `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                    }
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number)}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--popover)",
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Bar
                    dataKey="collected"
                    name={t("revenues.charts.collected", {
                      defaultValue: "Montant encaissé",
                    })}
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="revenue"
                    name={t("revenues.charts.total", {
                      defaultValue: "Total",
                    })}
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    opacity={0.4}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                {t("revenues.charts.noData", {
                  defaultValue: "Aucune donnée de revenus disponible",
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenus par catégorie Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-100 dark:border-purple-800">
                <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {t("revenues.charts.byCategory", {
                    defaultValue: "Revenus par catégorie",
                  })}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("revenues.charts.breakdown", {
                    defaultValue: "Répartition des sources de revenus",
                  })}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number)}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--popover)",
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-xs capitalize">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                {t("revenues.charts.noData", {
                  defaultValue: "Aucune donnée de revenus disponible",
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Bien Table */}
      <Card className="gap-2">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-100 dark:border-green-800">
              <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-base">
                {t("revenues.table.title", {
                  defaultValue: "Revenus par bien",
                })}
              </CardTitle>
              <CardDescription className="text-xs">
                {t("revenues.table.subtitle", {
                  defaultValue:
                    "Répartition des revenus et taux de recouvrement par bien",
                })}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={propertyColumns}
            data={byProperty}
            loading={false}
            getRowKey={(row) => row.propertyId}
            emptyState={{
              icon: (
                <Building2 className="h-12 w-12 text-muted-foreground" />
              ),
              title: t("revenues.table.empty", {
                defaultValue: "Aucune donnée de revenus par bien",
              }),
              description: t("revenues.table.emptyDescription", {
                defaultValue:
                  "Les données de revenus apparaîtront une fois les paiements enregistrés",
              }),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
