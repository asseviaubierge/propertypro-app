/**
 * Shared dashboard data contracts between API routes and client components.
 */

export type DashboardAlertType = "payment" | "maintenance" | "lease" | "tenant";
export type DashboardAlertSeverity = "low" | "medium" | "high" | "critical";
export type DashboardActivityType =
  | "payment"
  | "maintenance"
  | "lease"
  | "event"
  | "application";
export type DashboardTaskPriority = "low" | "medium" | "high" | "urgent";
export type DashboardRevenueTrendRange = "7d" | "30d" | "12m" | "lastYear";
export type DashboardTrendGranularity = "day" | "month";

export interface DashboardMaintenanceSummary {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  urgent: number;
}

export interface DashboardPaymentsSummary {
  collected: number;
  collectedCount: number;
  pending: number;
  pendingCount: number;
  overdue: number;
  overdueCount: number;
  totalDue: number;
}

export interface DashboardOverviewMetrics {
  totalProperties: number;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  averageRent: number;
  collectionRate: number;
  totalTenants: number;
  activeTenants: number;
  pendingApplications: number;
  expiringLeases: number;
  maintenanceRequests: DashboardMaintenanceSummary;
  payments: DashboardPaymentsSummary;
}

export interface DashboardAlert {
  id: string;
  type: DashboardAlertType;
  title: string;
  message: string;
  severity: DashboardAlertSeverity;
  count: number;
}

export interface DashboardTrendPoint {
  month: string;
  label?: string;
  periodStart?: string;
  granularity?: DashboardTrendGranularity;
  totalRevenue: number;
  totalExpenses: number;
  maintenance: number;
  occupancy: number;
}

export interface DashboardActivity {
  id: string;
  type: DashboardActivityType;
  description: string;
  timestamp: string;
  status?: string;
  amount?: number;
  priority?: string;
}

export interface DashboardTask {
  id: string;
  title: string;
  dueDate: string;
  priority: DashboardTaskPriority;
  type: string;
}

export interface DashboardPropertyTypeSlice {
  name: string;
  value: number;
  color: string;
}

export interface DashboardOverviewResponse {
  overview: DashboardOverviewMetrics;
  alerts: DashboardAlert[];
  trends: {
    revenue: DashboardTrendPoint[];
    revenueByRange?: Partial<
      Record<DashboardRevenueTrendRange, DashboardTrendPoint[]>
    >;
  };
  propertyTypes: DashboardPropertyTypeSlice[];
  recentActivities: DashboardActivity[];
  upcomingTasks: DashboardTask[];
}
