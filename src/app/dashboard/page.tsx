"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AnalyticsCard,
  AnalyticsCardGrid,
} from "@/components/analytics/AnalyticsCard";
import { DashboardSkeleton } from "@/components/ui/skeleton-layouts";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DashboardAlert,
  DashboardOverviewResponse,
  DashboardRevenueTrendRange,
} from "@/types/dashboard";
import {
  Building2,
  Home,
  Users,
  DollarSign,
  Wrench,
  AlertTriangle,
  Calendar,
  CreditCard,
  FileText,
  Activity,
  Target,
  PieChart,
  LineChart,
  RefreshCw,
  BarChart3,
  ChevronRight,
  UserCheck,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { useAuthorization } from "@/hooks/useAuthorization";

const getActivityIcon = (type: string) => {
  switch (type) {
    case "payment":
      return DollarSign;
    case "maintenance":
      return Wrench;
    case "lease":
      return FileText;
    case "event":
      return Calendar;
    case "application":
      return UserCheck;
    default:
      return Activity;
  }
};

const getActivityColor = (type: string, status?: string) => {
  if (status === "paid") return "text-success";
  if (status === "pending") return "text-warning";
  if (status === "sent") return "text-info";
  if (status === "overdue") return "text-error";

  switch (type) {
    case "payment":
      return "text-success";
    case "maintenance":
      return "text-warning";
    case "lease":
      return "text-primary";
    case "event":
      return "text-info";
    case "application":
      return "text-info";
    default:
      return "text-muted-foreground";
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high":
      return "text-error";
    case "urgent":
      return "text-error";
    case "medium":
      return "text-warning";
    case "low":
      return "text-success";
    default:
      return "text-muted-foreground";
  }
};

const getAlertStyles = (type: string) => {
  switch (type) {
    case "payment":
      return {
        border: "border-yellow-400",
        bg: "bg-yellow-50/30",
        iconColor: "text-orange-500",
        textColor: "text-yellow-600",
        badgeBg: "bg-white/80",
      };
    case "maintenance":
      return {
        border: "border-red-400",
        bg: "bg-red-50/30",
        iconColor: "text-red-500",
        textColor: "text-red-600",
        badgeBg: "bg-white/80",
      };
    case "lease":
      return {
        border: "border-cyan-400",
        bg: "bg-cyan-50/30",
        iconColor: "text-cyan-500",
        textColor: "text-cyan-600",
        badgeBg: "bg-white/80",
      };
    default:
      return {
        border: "border-gray-300",
        bg: "bg-gray-50",
        iconColor: "text-gray-600",
        textColor: "text-gray-800",
        badgeBg: "bg-white/80",
      };
  }
};

const REVENUE_TREND_OPTIONS: Array<{
  value: DashboardRevenueTrendRange;
  label: string;
}> = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "12m", label: "12 mois" },
  { value: "lastYear", label: "Année précédente" },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isTenant, isCompanyStaff } = useAuthorization();
  const [dashboardData, setDashboardData] =
    useState<DashboardOverviewResponse | null>(null);
  const [selectedTrendRange, setSelectedTrendRange] =
    useState<DashboardRevenueTrendRange>("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = session?.user;
  const isDashboardAuthorized = isCompanyStaff;

  const loadDashboardData = useCallback(
    async ({ isRefresh = false }: { isRefresh?: boolean } = {}) => {
      if (!isDashboardAuthorized) {
        setError(null);
        setDashboardData(null);
        if (isRefresh) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
        return;
      }

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch("/api/dashboard/overview", {
          signal: controller.signal,
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Erreur inconnue");
          throw new Error(
            `Dashboard load failed: ${response.status} ${errorText}`,
          );
        }

        const payload = await response.json();
        const data = (payload?.data ?? payload) as DashboardOverviewResponse;

        if (!data?.overview) {
          throw new Error("Format de réponse du tableau de bord invalide");
        }

        setDashboardData(data);
      } catch (err) {
        // Ignore errors from aborted requests
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger le tableau de bord",
        );
      } finally {
        if (isRefresh) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [isDashboardAuthorized],
  );

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (!isDashboardAuthorized) {
      setIsLoading(false);
      return;
    }

    loadDashboardData();
  }, [status, isDashboardAuthorized, loadDashboardData]);

  // Keep the operational dashboard synchronized without requiring a manual
  // page reload. It refreshes every 30 seconds and whenever the user returns
  // to the tab/window.
  useEffect(() => {
    if (status !== "authenticated" || !isDashboardAuthorized) return;

    const refresh = () => loadDashboardData({ isRefresh: true });
    const intervalId = window.setInterval(refresh, 30_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const handleFocus = () => refresh();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [status, isDashboardAuthorized, loadDashboardData]);

  const { t, formatCurrency, formatPercentage, formatDate } =
    useLocalizationContext();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.greeting.morning");
    if (hour < 17) return t("dashboard.greeting.afternoon");
    return t("dashboard.greeting.evening");
  };

  const handleRefresh = useCallback(() => {
    loadDashboardData({ isRefresh: true });
  }, [loadDashboardData]);

  const formatTimeAgo = (input?: Date | string | null) => {
    if (!input) {
      return t("dashboard.time.justNow");
    }

    const date = typeof input === "string" ? new Date(input) : input;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return t("dashboard.time.justNow");
    }

    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 60) {
      return t("dashboard.time.minutesAgo", {
        values: { count: diffInMinutes },
      });
    }

    if (diffInMinutes < 1440) {
      return t("dashboard.time.hoursAgo", {
        values: { count: Math.floor(diffInMinutes / 60) },
      });
    }

    return t("dashboard.time.daysAgo", {
      values: { count: Math.floor(diffInMinutes / 1440) },
    });
  };

  const getPriorityLabel = (priority: string) => {
    if (!priority) return "";
    return t(`dashboard.priority.${priority}`, {
      defaultValue: priority,
    });
  };

  const handleExport = useCallback(async () => {
    try {
      setIsRefreshing(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for export

      const response = await fetch("/api/dashboard/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          format: "json",
          includeDetails: false,
          dateRange: {
            start: new Date(new Date().getFullYear(), 0, 1).toISOString(),
            end: new Date().toISOString(),
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Erreur inconnue");
        throw new Error(`Export failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();

      if (!result.data) {
        throw new Error("Données d’exportation invalides");
      }

      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dashboard-export-${
        new Date().toISOString().split("T")[0]
      }.json`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      // Ignore errors from aborted requests
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      setError(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Navigation handlers for alert cards
  const handleAlertClick = useCallback(
    (alertType: string) => {
      switch (alertType) {
        case "payment":
          router.push("/dashboard/payments/overdue");
          break;
        case "maintenance":
          router.push("/dashboard/maintenance/emergency");
          break;
        case "lease":
          router.push("/dashboard/leases/expiring");
          break;
        case "tenant":
          router.push("/dashboard/tenants/applications");
          break;
        default:
          break;
      }
    },
    [router],
  );

  // Navigation handler for upcoming tasks
  const handleTaskClick = useCallback(
    (task: any) => {
      const taskId = task.id;

      if (taskId.startsWith("lease-")) {
        router.push("/dashboard/leases/expiring");
      } else if (taskId.startsWith("maintenance-")) {
        const maintenanceId = taskId.replace("maintenance-", "");
        router.push(`/dashboard/maintenance/${maintenanceId}`);
      } else if (task.type === "lease_renewal") {
        router.push("/dashboard/leases/expiring");
      } else if (task.type === "maintenance") {
        router.push("/dashboard/maintenance");
      } else {
        router.push("/dashboard/calendar");
      }
    },
    [router],
  );

  if (isTenant) {
    // Import the TenantDashboard component dynamically to avoid SSR issues
    const TenantDashboard = dynamic(
      () => import("@/components/tenant/TenantDashboard"),
      {
        ssr: false,
        loading: () => (
          <ResponsiveLayout>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                      <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mb-1" />
                      <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </ResponsiveLayout>
        ),
      },
    );

    return (
      <ResponsiveLayout>
        <TenantDashboard />
      </ResponsiveLayout>
    );
  }

  if (!dashboardData && isLoading) {
    return (
      <ResponsiveLayout>
        <DashboardSkeleton />
      </ResponsiveLayout>
    );
  }

  if (!dashboardData && error) {
    return (
      <ResponsiveLayout className="space-y-6" padding="none">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("dashboard.error.unavailable.title")}</AlertTitle>
          <AlertDescription>
            {t("dashboard.error.unavailable.description", {
              values: { error },
            })}
          </AlertDescription>
        </Alert>
        <Button onClick={() => loadDashboardData()} className="w-min">
          {t("dashboard.actions.retry")}
        </Button>
      </ResponsiveLayout>
    );
  }

  const overview = dashboardData?.overview;
  const maintenance = overview?.maintenanceRequests;
  const payments = overview?.payments;
  const trendByRange = dashboardData?.trends?.revenueByRange;
  const monthlyRevenueTrend =
    trendByRange?.["12m"] && trendByRange["12m"].length > 0
      ? trendByRange["12m"]
      : dashboardData?.trends?.revenue ?? [];
  const selectedRevenueTrend = trendByRange?.[selectedTrendRange] ?? [];
  const chartRevenueTrend =
    selectedRevenueTrend.length > 0 ? selectedRevenueTrend : monthlyRevenueTrend;
  const propertyDistribution = dashboardData?.propertyTypes ?? [];
  const alerts = dashboardData?.alerts ?? [];
  const recentActivities = dashboardData?.recentActivities ?? [];
  const upcomingTasks = dashboardData?.upcomingTasks ?? [];

  const vacantUnits =
    (overview?.totalUnits ?? 0) - (overview?.occupiedUnits ?? 0);
  const vacancyRate = overview?.totalUnits
    ? (vacantUnits / overview.totalUnits) * 100
    : 0;

  const latestTrendPoint =
    monthlyRevenueTrend.length > 0
      ? monthlyRevenueTrend[monthlyRevenueTrend.length - 1]
      : null;
  const previousTrendPoint =
    monthlyRevenueTrend.length > 1
      ? monthlyRevenueTrend[monthlyRevenueTrend.length - 2]
      : null;
  const currentRevenueValue =
    latestTrendPoint?.totalRevenue ?? overview?.monthlyRevenue ?? 0;
  const currentExpenseValue = latestTrendPoint?.totalExpenses ?? 0;
  const chartRevenueValue = chartRevenueTrend.reduce(
    (sum, point) => sum + (point.totalRevenue || 0),
    0,
  );
  const chartExpenseValue = chartRevenueTrend.reduce(
    (sum, point) => sum + (point.totalExpenses || 0),
    0,
  );
  const revenueTrendDescriptionByRange: Record<
    DashboardRevenueTrendRange,
    string
  > = {
    "7d": "Daily financial performance (last 7 days)",
    "30d": "Daily financial performance (last 30 days)",
    "12m": t("dashboard.charts.revenueExpenses.description"),
    lastYear: `Monthly financial performance (${new Date().getFullYear() - 1})`,
  };
  const revenueTrendDescription =
    revenueTrendDescriptionByRange[selectedTrendRange];
  const netIncome = currentRevenueValue - currentExpenseValue;
  const outstandingAmount = (payments?.pending ?? 0) + (payments?.overdue ?? 0);
  const previousRevenue = previousTrendPoint?.totalRevenue ?? 0;
  const revenueChangePercent =
    previousRevenue > 0
      ? ((currentRevenueValue - previousRevenue) / previousRevenue) * 100
      : 0;

  const urgentActivityCount = recentActivities.filter(
    (activity) =>
      activity.priority === "high" || activity.priority === "urgent",
  ).length;

  const getAlertTitleText = (alert: DashboardAlert) => {
    switch (alert.id) {
      case "overdue-payments":
        return t("dashboard.alerts.overduePayments.title", {
          defaultValue: alert.title,
        });
      case "urgent-maintenance":
        return t("dashboard.alerts.urgentMaintenance.title", {
          defaultValue: alert.title,
        });
      case "expiring-leases":
        return t("dashboard.alerts.expiringLeases.title", {
          defaultValue: alert.title,
        });
      case "pending-applications":
        return t("dashboard.alerts.pendingApplications.title", {
          defaultValue: alert.title,
        });
      default:
        return alert.title;
    }
  };

  const getAlertMessageText = (alert: DashboardAlert) => {
    const count = alert.count;
    switch (alert.id) {
      case "overdue-payments":
        return t(
          count > 0
            ? "dashboard.alerts.overduePayments.message.withCount"
            : "dashboard.alerts.overduePayments.message.zero",
          {
            defaultValue: alert.message,
            values: { count },
          },
        );
      case "urgent-maintenance":
        return t(
          count > 0
            ? "dashboard.alerts.urgentMaintenance.message.withCount"
            : "dashboard.alerts.urgentMaintenance.message.zero",
          {
            defaultValue: alert.message,
            values: { count },
          },
        );
      case "expiring-leases":
        return t(
          count > 0
            ? "dashboard.alerts.expiringLeases.message.withCount"
            : "dashboard.alerts.expiringLeases.message.zero",
          {
            defaultValue: alert.message,
            values: { count },
          },
        );
      case "pending-applications":
        return t("dashboard.alerts.pendingApplications.message.withCount", {
          defaultValue: alert.message,
          values: { count },
        });
      default:
        return alert.message;
    }
  };

  // Manager/Admin Dashboard
  return (
    <ResponsiveLayout className="space-y-6" padding="none">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {getGreeting()}, {user?.firstName}!
          </h1>
          <p className="text-muted-foreground">
            {t("dashboard.header.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {t("dashboard.actions.refresh")}
          </Button>
          <Link href="/dashboard/accounting/reports">
            <Button size="sm" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              {t("dashboard.actions.reports")}
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("dashboard.error.staleData.title")}</AlertTitle>
          <AlertDescription>
            {t("dashboard.error.staleData.description", { values: { error } })}
          </AlertDescription>
        </Alert>
      )}

      {/* Alerts Section - Always show the main 3 alerts */}
      <div className="grid gap-4  md:grid-cols-3">
        {alerts?.slice(0, 3).map((alert) => {
          const styles = getAlertStyles(alert.type);
          return (
            <div
              key={alert.id}
              className={`rounded-xl border-l-4 border ${styles.border} ${styles.bg} px-4 py-2 cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]`}
              onClick={() => handleAlertClick(alert.type)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={`h-4 w-4 ${styles.iconColor}`} />
                    <h4 className={`font-medium text-sm ${styles.textColor}`}>
                      {getAlertTitleText(alert)}
                    </h4>
                    <span
                      className={`text-md font-bold ${styles.textColor} ml-auto`}
                    >
                      {alert.count}
                    </span>
                  </div>
                  <p className={`text-xs ${styles.textColor} opacity-80`}>
                    {getAlertMessageText(alert)}
                  </p>
                </div>
                <ChevronRight
                  className={`h-4 w-4 ${styles.iconColor} shrink-0 mt-1`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main KPI Cards */}
      <AnalyticsCardGrid>
        <AnalyticsCard
          title={t("dashboard.cards.totalProperties.title")}
          value={overview?.totalProperties ?? 0}
          description={t("dashboard.cards.totalProperties.description")}
          icon={Building2}
          iconColor="primary"
        />
        <AnalyticsCard
          title={t("dashboard.cards.occupancyRate.title")}
          value={formatPercentage(overview?.occupancyRate ?? 0)}
          description={t("dashboard.cards.occupancyRate.description", {
            values: {
              occupied: overview?.occupiedUnits ?? 0,
              total: overview?.totalUnits ?? 0,
            },
          })}
          icon={Home}
          iconColor="success"
        />
        <AnalyticsCard
          title={t("dashboard.cards.monthlyRevenue.title")}
          value={formatCurrency(overview?.monthlyRevenue ?? 0)}
          description={t("dashboard.cards.monthlyRevenue.description")}
          icon={DollarSign}
          iconColor="success"
        />
        <AnalyticsCard
          title={t("dashboard.cards.collectionRate.title")}
          value={formatPercentage(overview?.collectionRate ?? 0)}
          description={t("dashboard.cards.collectionRate.description")}
          icon={Target}
          iconColor="info"
        />
        <AnalyticsCard
          title={t("dashboard.cards.activeTenants.title")}
          value={overview?.activeTenants ?? 0}
          description={t("dashboard.cards.activeTenants.description", {
            values: { count: overview?.pendingApplications ?? 0 },
          })}
          icon={Users}
          iconColor="primary"
        />
        <AnalyticsCard
          title={t("dashboard.cards.maintenanceRequests.title")}
          value={maintenance?.open ?? 0}
          description={t("dashboard.cards.maintenanceRequests.description", {
            values: { count: maintenance?.urgent ?? 0 },
          })}
          icon={Wrench}
          iconColor="warning"
        />
        <AnalyticsCard
          title={t("dashboard.cards.vacantUnits.title")}
          value={vacantUnits}
          description={t("dashboard.cards.vacantUnits.description", {
            values: { rate: formatPercentage(vacancyRate) },
          })}
          icon={Home}
          iconColor="error"
        />
        <AnalyticsCard
          title={t("dashboard.cards.averageRent.title")}
          value={formatCurrency(overview?.averageRent ?? 0)}
          description={t("dashboard.cards.averageRent.description")}
          icon={DollarSign}
          iconColor="success"
        />
        <AnalyticsCard
          title={t("dashboard.cards.leaseRenewals.title")}
          value={overview?.expiringLeases ?? 0}
          description={t("dashboard.cards.leaseRenewals.description")}
          icon={FileText}
          iconColor="warning"
        />
        <AnalyticsCard
          title={t("dashboard.cards.recentEvents.title")}
          value={recentActivities.length}
          description={t("dashboard.cards.recentEvents.description", {
            values: { count: urgentActivityCount },
          })}
          icon={Activity}
          iconColor="info"
        />
      </AnalyticsCardGrid>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Charts and Analytics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue & Expenses Trends */}
          <Card className="hover-lift">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5 text-primary" />
                    {t("dashboard.charts.revenueExpenses.title")}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {revenueTrendDescription}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center rounded-md border border-border bg-muted/30 p-1">
                    {REVENUE_TREND_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedTrendRange(option.value)}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                          selectedTrendRange === option.value
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        aria-pressed={selectedTrendRange === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Legend */}
              <div className="flex items-center gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
                  <span className="text-sm text-muted-foreground">
                    {t("dashboard.charts.revenueExpenses.legend.revenue")}
                  </span>
                  <span className="text-lg font-semibold">
                    {formatCurrency(chartRevenueValue)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div>
                  <span className="text-sm text-muted-foreground">
                    {t("dashboard.charts.revenueExpenses.legend.expenses")}
                  </span>
                  <span className="text-lg font-semibold">
                    {formatCurrency(chartExpenseValue)}
                  </span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartRevenueTrend}>
                  <defs>
                    <linearGradient
                      id="incomeGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop
                        offset="95%"
                        stopColor="#10b981"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                    <linearGradient
                      id="expenseGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop
                        offset="95%"
                        stopColor="#f59e0b"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    minTickGap={selectedTrendRange === "30d" ? 20 : 10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickFormatter={(value) => `${value / 1000}k`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg">
                            <p className="text-sm font-medium mb-2">{label}</p>
                            {payload.map((entry, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 text-sm"
                              >
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                ></div>
                                <span className="text-muted-foreground">
                                  {entry.name}:
                                </span>
                                <span className="font-semibold">
                                  {formatCurrency(entry.value as number)}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalRevenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#incomeGradient)"
                    name={t("dashboard.charts.revenueExpenses.legend.revenue")}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalExpenses"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#expenseGradient)"
                    name={t("dashboard.charts.revenueExpenses.legend.expenses")}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <Card className="hover-lift">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                {t("dashboard.financialSummary.title")}
              </CardTitle>
              <CardDescription>
                {t("dashboard.financialSummary.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {/* Net Income */}
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">
                    {t("dashboard.financialSummary.netIncome")}
                  </div>
                  <div
                    className={`text-xl font-bold ${
                      netIncome >= 0 ? "text-success" : "text-error"
                    }`}
                  >
                    {formatCurrency(netIncome)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("dashboard.financialSummary.thisMonth")}
                  </div>
                </div>

                {/* Outstanding */}
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">
                    {t("dashboard.financialSummary.outstanding")}
                  </div>
                  <div className="text-xl font-bold text-warning">
                    {formatCurrency(outstandingAmount)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("dashboard.financialSummary.pendingAndOverdue", {
                      values: {
                        pending: payments?.pendingCount ?? 0,
                        overdue: payments?.overdueCount ?? 0,
                      },
                    })}
                  </div>
                </div>

                {/* Month-over-Month */}
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">
                    {t("dashboard.financialSummary.monthOverMonth")}
                  </div>
                  <div
                    className={`text-xl font-bold flex items-center justify-center gap-1 ${
                      revenueChangePercent >= 0 ? "text-success" : "text-error"
                    }`}
                  >
                    {revenueChangePercent >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {formatPercentage(Math.abs(revenueChangePercent))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("dashboard.financialSummary.vsLastMonth")}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Type Distribution and Payment Status */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Property Distribution */}
            <Card className="hover-lift">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  {t("dashboard.charts.propertyDistribution.title")}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {t("dashboard.charts.propertyDistribution.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPieChart>
                      <Pie
                        data={propertyDistribution as any}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {propertyDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const percentage = overview?.totalProperties
                              ? Math.round(
                                  (data.value / overview.totalProperties) * 100,
                                )
                              : 0;
                            return (
                              <div className="bg-white p-2 border rounded shadow-lg">
                                <p className="text-sm font-medium">
                                  {data.name}: {data.value} ({percentage}%)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>

                  {/* Center Total */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">
                        {t("dashboard.charts.propertyDistribution.total")}
                      </div>
                      <div className="text-2xl font-bold">
                        {overview?.totalProperties ?? 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                  {propertyDistribution.map((entry, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: entry.color }}
                      ></div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {entry.name}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Payment Status */}
            <Card className="hover-lift">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-success" />
                  {t("dashboard.paymentStatus.title")}
                </CardTitle>
                <CardDescription>
                  {t("dashboard.paymentStatus.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {t("dashboard.paymentStatus.collected")}
                    </span>
                    <span className="text-sm font-bold text-success">
                      {formatCurrency(payments?.collected ?? 0)}
                    </span>
                  </div>
                  <Progress
                    value={
                      payments?.totalDue
                        ? (payments.collected / payments.totalDue) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="text-center p-3 bg-warning/10 rounded-lg">
                    <div className="text-lg font-bold text-warning">
                      {formatCurrency(payments?.pending ?? 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("dashboard.paymentStatus.pending")}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-error/10 rounded-lg">
                    <div className="text-lg font-bold text-error">
                      {formatCurrency(payments?.overdue ?? 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("dashboard.paymentStatus.overdue")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column - Activities and Tasks */}
        <div className="space-y-6">
          {/* Recent Activities */}
          <Card className="hover-lift">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  {t("dashboard.recentActivity.title")}
                </CardTitle>
              </div>
              <CardDescription>
                {t("dashboard.recentActivity.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-4">
                  {recentActivities.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t("dashboard.recentActivity.empty")}
                    </p>
                  )}
                  {recentActivities.map((activity) => {
                    const IconComponent = getActivityIcon(activity.type);
                    return (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div
                          className={`p-2 rounded-lg bg-muted ${getActivityColor(
                            activity.type,
                            activity.status,
                          )}`}
                        >
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">
                            {activity.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {formatTimeAgo(activity.timestamp)}
                            </span>
                            {activity.amount && (
                              <Badge variant="outline" className="text-xs">
                                {formatCurrency(activity.amount)}
                              </Badge>
                            )}
                            {activity.priority && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${getPriorityColor(
                                  activity.priority,
                                )}`}
                              >
                                {getPriorityLabel(activity.priority)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Upcoming Tasks */}
          <Card className="hover-lift">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-warning" />
                  {t("dashboard.tasks.title")}
                </CardTitle>
              </div>
              <CardDescription>
                {t("dashboard.tasks.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingTasks.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("dashboard.tasks.empty")}
                  </p>
                )}
                {upcomingTasks.slice(0, 4).map((task) => {
                  const dueDate = new Date(task.dueDate);
                  const dueDateLabel = Number.isNaN(dueDate.getTime())
                    ? t("dashboard.tasks.datePending")
                    : formatDate(dueDate, { format: "medium" });

                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-border hover:shadow-sm cursor-pointer transition-all"
                      onClick={() => handleTaskClick(task)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {dueDateLabel}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${getPriorityColor(
                              task.priority,
                            )}`}
                          >
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ResponsiveLayout>
  );
}
