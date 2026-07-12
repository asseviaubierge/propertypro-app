"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  DollarSign,
  Download,
  FileText,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Users,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AnalyticsCard,
  AnalyticsCardGrid,
} from "@/components/analytics/AnalyticsCard";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
} from "recharts";

// ============================================================================
// Types
// ============================================================================

interface IncomeExpenseReport {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    profitMargin: number;
  };
  incomeByCategory: Array<{ _id: string; amount: number; count: number }>;
  expenseByCategory: Array<{ _id: string; amount: number; count: number }>;
  incomeByProperty: Array<{ _id: string; propertyName: string; amount: number; count: number }>;
  expenseByProperty: Array<{ _id: string; propertyName: string; amount: number; count: number }>;
  monthlyTrend: Array<{ month: string; year: number; income: number; expenses: number; net: number }>;
  period: { startDate: string; endDate: string };
}

interface RentRollReport {
  rentRoll: Array<{
    _id: string;
    propertyName: string;
    unitId?: string;
    tenantName: string;
    tenantEmail: string;
    startDate: string;
    endDate: string;
    rentAmount: number;
    securityDeposit: number;
    status: string;
  }>;
  totals: {
    totalUnits: number;
    totalMonthlyRent: number;
    totalDeposits: number;
    annualizedRent: number;
  };
}

interface CollectionsReport {
  summary: {
    totalDue: number;
    collected: number;
    pending: number;
    overdue: number;
    totalCount: number;
    paidCount: number;
    collectionRate: number;
  };
  collectionsByProperty: Array<{
    _id: string;
    propertyName: string;
    totalDue: number;
    collected: number;
    overdueAmount: number;
    collectionRate: number;
    totalCount: number;
    collectedCount: number;
  }>;
  overdueAging: Array<{ range: string; count: number; amount: number }>;
  period: { startDate: string; endDate: string };
}

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#6366f1", "#84cc16", "#a855f7"];

const DATE_RANGES = [
  { value: "this-month", label: "reports.dateRange.thisMonth" },
  { value: "last-month", label: "reports.dateRange.lastMonth" },
  { value: "this-quarter", label: "reports.dateRange.thisQuarter" },
  { value: "this-year", label: "reports.dateRange.thisYear" },
  { value: "last-year", label: "reports.dateRange.lastYear" },
];

function getDateRange(range: string): { start: Date; end: Date } {
  const now = new Date();
  switch (range) {
    case "last-month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start, end };
    }
    case "this-quarter": {
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      return { start, end: now };
    }
    case "this-year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end: now };
    }
    case "last-year": {
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear() - 1, 11, 31);
      return { start, end };
    }
    default: {
      // this-month
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: now };
    }
  }
}

function formatCategoryLabel(category?: string | null): string {
  return (category || "other")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// Main Page
// ============================================================================

export default function ReportsPage() {
  const { t, formatCurrency, formatPercentage, formatDate } = useLocalizationContext();
  const [activeTab, setActiveTab] = useState("income-expense");
  const [dateRange, setDateRange] = useState("this-year");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Report data
  const [incomeExpenseData, setIncomeExpenseData] = useState<IncomeExpenseReport | null>(null);
  const [rentRollData, setRentRollData] = useState<RentRollReport | null>(null);
  const [collectionsData, setCollectionsData] = useState<CollectionsReport | null>(null);

  const fetchReport = useCallback(async (tab: string, range: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { start, end } = getDateRange(range);
      const params = new URLSearchParams({
        type: tab,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      const res = await fetch(`/api/reports/financial?${params}`);
      if (!res.ok) throw new Error("Failed to load report");
      const json = await res.json();
      const data = json?.data ?? json ?? null;

      switch (tab) {
        case "income-expense":
          setIncomeExpenseData(data);
          break;
        case "rent-roll":
          setRentRollData(data);
          break;
        case "collections":
          setCollectionsData(data);
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(activeTab, dateRange);
  }, [activeTab, dateRange, fetchReport]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const handleExport = () => {
    let data: any = null;
    let filename = "report";
    switch (activeTab) {
      case "income-expense":
        data = incomeExpenseData;
        filename = "income-expense-report";
        break;
      case "rent-roll":
        data = rentRollData;
        filename = "rent-roll-report";
        break;
      case "collections":
        data = collectionsData;
        filename = "collections-report";
        break;
    }
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("reports.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("reports.description")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {t(r.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchReport(activeTab, dateRange)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            {t("reports.actions.refresh")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isLoading}>
            <Download className="h-4 w-4 mr-2" />
            {t("reports.actions.export")}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="income-expense" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t("reports.tabs.incomeExpense")}</span>
          </TabsTrigger>
          <TabsTrigger value="rent-roll" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t("reports.tabs.rentRoll")}</span>
          </TabsTrigger>
          <TabsTrigger value="collections" className="gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">{t("reports.tabs.collections")}</span>
          </TabsTrigger>
        </TabsList>

        {/* Income & Expense Tab */}
        <TabsContent value="income-expense" className="space-y-6 mt-6">
          {incomeExpenseData && <IncomeExpenseTab data={incomeExpenseData} />}
          {isLoading && !incomeExpenseData && <ReportSkeleton />}
        </TabsContent>

        {/* Rent Roll Tab */}
        <TabsContent value="rent-roll" className="space-y-6 mt-6">
          {rentRollData && <RentRollTab data={rentRollData} />}
          {isLoading && !rentRollData && <ReportSkeleton />}
        </TabsContent>

        {/* Collections Tab */}
        <TabsContent value="collections" className="space-y-6 mt-6">
          {collectionsData && <CollectionsTab data={collectionsData} />}
          {isLoading && !collectionsData && <ReportSkeleton />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Income & Expense Tab
// ============================================================================

function IncomeExpenseTab({ data }: { data: IncomeExpenseReport }) {
  const { t, formatCurrency } = useLocalizationContext();
  const summary = data?.summary ?? {
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
    profitMargin: 0,
  };
  const monthlyTrend = Array.isArray(data?.monthlyTrend) ? data.monthlyTrend : [];
  const incomeByCategory = Array.isArray(data?.incomeByCategory)
    ? data.incomeByCategory
    : [];
  const expenseByCategory = Array.isArray(data?.expenseByCategory)
    ? data.expenseByCategory
    : [];
  const incomeByProperty = Array.isArray(data?.incomeByProperty)
    ? data.incomeByProperty
    : [];

  return (
    <>
      {/* Summary KPIs */}
      <AnalyticsCardGrid className="md:grid-cols-4 lg:grid-cols-4">
        <AnalyticsCard
          title={t("reports.incomeExpense.totalIncome")}
          value={formatCurrency(summary.totalIncome)}
          icon={TrendingUp}
          iconColor="success"
        />
        <AnalyticsCard
          title={t("reports.incomeExpense.totalExpenses")}
          value={formatCurrency(summary.totalExpenses)}
          icon={TrendingDown}
          iconColor="error"
        />
        <AnalyticsCard
          title={t("reports.incomeExpense.netIncome")}
          value={formatCurrency(summary.netIncome)}
          icon={DollarSign}
          iconColor={summary.netIncome >= 0 ? "success" : "error"}
        />
        <AnalyticsCard
          title={t("reports.incomeExpense.profitMargin")}
          value={`${summary.profitMargin}%`}
          icon={BarChart3}
          iconColor="info"
        />
      </AnalyticsCardGrid>

      {/* Monthly Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("reports.incomeExpense.monthlyTrend")}</CardTitle>
          <CardDescription>{t("reports.incomeExpense.monthlyTrendDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-white p-3 border rounded-lg shadow-lg">
                        <p className="text-sm font-medium mb-2">{label}</p>
                        {payload.map((entry, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-muted-foreground">{entry.name}:</span>
                            <span className="font-semibold">{formatCurrency(entry.value as number)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="income" name={t("reports.incomeExpense.income")} fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name={t("reports.incomeExpense.expenses")} fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{t("reports.noData")}</p>
          )}
        </CardContent>
      </Card>

      {/* Income & Expense by Category */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("reports.incomeExpense.incomeByCategory")}</CardTitle>
          </CardHeader>
          <CardContent>
            {incomeByCategory.length > 0 ? (
              <div className="space-y-3">
                {incomeByCategory.map((item, i) => (
                  <div key={item?._id || `${item?.amount ?? 0}-${i}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-sm">{formatCategoryLabel(item?._id || "other")}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">{formatCurrency(item?.amount ?? 0)}</span>
                      <span className="text-xs text-muted-foreground ml-2">({item?.count ?? 0})</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">{t("reports.noData")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("reports.incomeExpense.expenseByCategory")}</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseByCategory.length > 0 ? (
              <div className="space-y-3">
                {expenseByCategory.map((item, i) => (
                  <div key={item?._id || `${item?.amount ?? 0}-${i}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-sm">{formatCategoryLabel(item?._id || "other")}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">{formatCurrency(item?.amount ?? 0)}</span>
                      <span className="text-xs text-muted-foreground ml-2">({item?.count ?? 0})</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">{t("reports.noData")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Income by Property Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("reports.incomeExpense.incomeByProperty")}</CardTitle>
        </CardHeader>
        <CardContent>
          {incomeByProperty.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">{t("reports.table.property")}</th>
                    <th className="text-right py-2 font-medium">{t("reports.table.income")}</th>
                    <th className="text-right py-2 font-medium">{t("reports.table.transactions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeByProperty.map((item) => (
                    <tr key={item?._id || item?.propertyName || "property"} className="border-b last:border-0">
                      <td className="py-2">{item?.propertyName || "Unknown Property"}</td>
                      <td className="py-2 text-right font-medium text-success">{formatCurrency(item?.amount ?? 0)}</td>
                      <td className="py-2 text-right text-muted-foreground">{item?.count ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{t("reports.noData")}</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ============================================================================
// Rent Roll Tab
// ============================================================================

function RentRollTab({ data }: { data: RentRollReport }) {
  const { t, formatCurrency, formatDate } = useLocalizationContext();
  const rentRoll = Array.isArray(data?.rentRoll) ? data.rentRoll : [];
  const totals = data?.totals ?? {
    totalUnits: 0,
    totalMonthlyRent: 0,
    totalDeposits: 0,
    annualizedRent: 0,
  };

  const columns: DataTableColumn<(typeof rentRoll)[0]>[] = [
    {
      id: "propertyName",
      header: t("reports.table.property"),
      cell: (row) => (
        <span className="font-medium">{row?.propertyName || "—"}</span>
      ),
    },
    {
      id: "tenantName",
      header: t("reports.table.tenant"),
      cell: (row) => (
        <div>
          <p className="font-medium">{row.tenantName?.trim() || "—"}</p>
          <p className="text-xs text-muted-foreground">{row.tenantEmail || ""}</p>
        </div>
      ),
    },
    {
      id: "leasePeriod",
      header: t("reports.table.leasePeriod"),
      cell: (row) => (
        <span className="text-sm">
          {row.startDate ? formatDate(new Date(row.startDate), { format: "short" }) : "—"}
          {" — "}
          {row.endDate ? formatDate(new Date(row.endDate), { format: "short" }) : "—"}
        </span>
      ),
    },
    {
      id: "rentAmount",
      header: t("reports.table.monthlyRent"),
      cell: (row) => (
        <span className="font-medium">{formatCurrency(row.rentAmount || 0)}</span>
      ),
      align: "right",
    },
    {
      id: "securityDeposit",
      header: t("reports.table.deposit"),
      cell: (row) => (
        <span>{formatCurrency(row.securityDeposit || 0)}</span>
      ),
      align: "right",
    },
  ];

  return (
    <>
      {/* Summary KPIs */}
      <AnalyticsCardGrid className="md:grid-cols-4 lg:grid-cols-4">
        <AnalyticsCard
          title={t("reports.rentRoll.totalUnits")}
          value={totals.totalUnits}
          icon={Building2}
          iconColor="primary"
        />
        <AnalyticsCard
          title={t("reports.rentRoll.monthlyRent")}
          value={formatCurrency(totals.totalMonthlyRent)}
          icon={DollarSign}
          iconColor="success"
        />
        <AnalyticsCard
          title={t("reports.rentRoll.annualRent")}
          value={formatCurrency(totals.annualizedRent)}
          icon={TrendingUp}
          iconColor="info"
        />
        <AnalyticsCard
          title={t("reports.rentRoll.totalDeposits")}
          value={formatCurrency(totals.totalDeposits)}
          icon={FileText}
          iconColor="warning"
        />
      </AnalyticsCardGrid>

      {/* Rent Roll Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("reports.rentRoll.activeLeases")}</CardTitle>
          <CardDescription>{t("reports.rentRoll.activeLeasesDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {rentRoll.length > 0 ? (
            <DataTable data={rentRoll} columns={columns} getRowKey={(row) => row._id} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{t("reports.noData")}</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ============================================================================
// Collections Tab
// ============================================================================

function CollectionsTab({ data }: { data: CollectionsReport }) {
  const { t, formatCurrency } = useLocalizationContext();
  const summary = data?.summary ?? {
    totalDue: 0,
    collected: 0,
    pending: 0,
    overdue: 0,
    totalCount: 0,
    paidCount: 0,
    collectionRate: 0,
  };
  const collectionsByProperty = Array.isArray(data?.collectionsByProperty)
    ? data.collectionsByProperty
    : [];
  const overdueAging = Array.isArray(data?.overdueAging) ? data.overdueAging : [];

  return (
    <>
      {/* Summary KPIs */}
      <AnalyticsCardGrid className="md:grid-cols-4 lg:grid-cols-4">
        <AnalyticsCard
          title={t("reports.collections.totalDue")}
          value={formatCurrency(summary.totalDue)}
          icon={DollarSign}
          iconColor="primary"
        />
        <AnalyticsCard
          title={t("reports.collections.collected")}
          value={formatCurrency(summary.collected)}
          description={`${summary.paidCount} / ${summary.totalCount} ${t("reports.collections.payments")}`}
          icon={TrendingUp}
          iconColor="success"
        />
        <AnalyticsCard
          title={t("reports.collections.collectionRate")}
          value={`${summary.collectionRate}%`}
          icon={BarChart3}
          iconColor="info"
        />
        <AnalyticsCard
          title={t("reports.collections.overdue")}
          value={formatCurrency(summary.overdue)}
          icon={AlertTriangle}
          iconColor="error"
        />
      </AnalyticsCardGrid>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Overdue Aging */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("reports.collections.overdueAging")}</CardTitle>
            <CardDescription>{t("reports.collections.overdueAgingDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {overdueAging.length > 0 ? (
              <div className="space-y-3">
                {overdueAging.map((bucket) => {
                  const maxAmount = Math.max(
                    ...overdueAging.map((b) => b?.amount ?? 0),
                  );
                  const widthPercent =
                    maxAmount > 0 ? ((bucket?.amount ?? 0) / maxAmount) * 100 : 0;
                  return (
                    <div key={bucket?.range || "bucket"}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {bucket?.range || "Unknown"}
                        </span>
                        <span className="font-medium">{formatCurrency(bucket?.amount ?? 0)} ({bucket?.count ?? 0})</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-error rounded-full transition-all"
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <TrendingUp className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("reports.collections.noOverdue")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collections by Property Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("reports.collections.byProperty")}</CardTitle>
            <CardDescription>{t("reports.collections.byPropertyDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {collectionsByProperty.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={collectionsByProperty} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                  <YAxis
                    dataKey="propertyName"
                    type="category"
                    tick={{ fontSize: 11 }}
                    width={120}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded-lg shadow-lg text-sm">
                          <p className="font-medium mb-1">
                            {d?.propertyName || "Unknown Property"}
                          </p>
                          <p>{t("reports.collections.collected")}: {formatCurrency(d?.collected ?? 0)}</p>
                          <p>{t("reports.collections.totalDue")}: {formatCurrency(d?.totalDue ?? 0)}</p>
                          <p>{t("reports.collections.collectionRate")}: {d?.collectionRate ?? 0}%</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="collectionRate" name={t("reports.collections.collectionRate")} radius={[0, 4, 4, 0]}>
                    {collectionsByProperty.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          (entry?.collectionRate ?? 0) >= 80
                            ? "#10b981"
                            : (entry?.collectionRate ?? 0) >= 50
                              ? "#f59e0b"
                              : "#ef4444"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t("reports.noData")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Collections Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("reports.collections.detailTable")}</CardTitle>
        </CardHeader>
        <CardContent>
          {collectionsByProperty.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">{t("reports.table.property")}</th>
                    <th className="text-right py-2 font-medium">{t("reports.collections.totalDue")}</th>
                    <th className="text-right py-2 font-medium">{t("reports.collections.collected")}</th>
                    <th className="text-right py-2 font-medium">{t("reports.collections.overdue")}</th>
                    <th className="text-right py-2 font-medium">{t("reports.collections.collectionRate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionsByProperty.map((item) => (
                    <tr key={item?._id || item?.propertyName || "property"} className="border-b last:border-0">
                      <td className="py-2 font-medium">{item?.propertyName || "Unknown Property"}</td>
                      <td className="py-2 text-right">{formatCurrency(item?.totalDue ?? 0)}</td>
                      <td className="py-2 text-right text-success">{formatCurrency(item?.collected ?? 0)}</td>
                      <td className="py-2 text-right text-error">{formatCurrency(item?.overdueAmount ?? 0)}</td>
                      <td className="py-2 text-right">
                        <Badge variant={(item?.collectionRate ?? 0) >= 80 ? "default" : (item?.collectionRate ?? 0) >= 50 ? "secondary" : "destructive"}>
                          {item?.collectionRate ?? 0}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{t("reports.noData")}</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ============================================================================
// Skeleton loader
// ============================================================================

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2" />
              <div className="h-8 w-32 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="h-64 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    </div>
  );
}
