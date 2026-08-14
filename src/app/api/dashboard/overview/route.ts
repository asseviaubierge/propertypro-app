/**
 * PropertyPro - Portfolio Dashboard Overview API
 * Aggregates cross-domain metrics for the manager/owner dashboard
 */

import { getScopedPropertyIds } from "@/lib/property-scope";
import {
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import {
  UserRole,
  LeaseStatus,
  MaintenanceStatus,
  MaintenancePriority,
  PaymentStatus,
  InvoiceStatus,
  EventStatus,
  EventPriority,
  EventType,
} from "@/types";
import {
  Property,
  Lease,
  User,
  MaintenanceRequest,
  Invoice,
  Payment,
  Event,
} from "@/models";
import {
  DashboardAlertSeverity,
  DashboardAlertType,
  DashboardOverviewResponse,
} from "@/types/dashboard";

const ALERT_COLOR_MAP = ["#0ea5e9", "#22c55e", "#f97316", "#ef4444", "#8b5cf6"];

const MONTH_LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sept",
  "Oct",
  "Nov",
  "Déc",
];

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  day: "numeric",
});

const padNumber = (value: number) => String(value).padStart(2, "0");

const buildMonthKey = (year: number, month: number) =>
  `${year}-${padNumber(month)}`;

const buildDayKey = (year: number, month: number, day: number) =>
  `${year}-${padNumber(month)}-${padNumber(day)}`;

export const GET = withPermissionAndDB("profile_management")(
  async (user: any) => {
    try {
      const now = new Date();
      const propertyIds = await getScopedPropertyIds(user);
      const scopedPropertyFilter =
        propertyIds === null ? {} : { propertyId: { $in: propertyIds } };
      const scopedPropertyDocumentFilter =
        propertyIds === null ? {} : { _id: { $in: propertyIds } };
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const twelveMonthsAgo = new Date(
        now.getFullYear(),
        now.getMonth() - 11,
        1,
      );
      const lastYear = now.getFullYear() - 1;
      const startOfLastYear = new Date(lastYear, 0, 1);
      const endOfLastYear = new Date(lastYear + 1, 0, 1);
      endOfLastYear.setMilliseconds(endOfLastYear.getMilliseconds() - 1);
      const thirtyDaysAgo = new Date(startOfToday);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      const thirtyDaysFromNow = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000,
      );

      // -----------------------------------------------------------------------
      // Core portfolio information (properties, units, rent distribution)
      // -----------------------------------------------------------------------
      const properties = await Property.find({
        deletedAt: null,
        ...scopedPropertyDocumentFilter,
      })
        .select("type totalUnits units rentAmount isMultiUnit")
        .lean();

      const totalProperties = properties.length;

      let totalUnits = 0;
      let occupiedUnits = 0;
      let totalRent = 0;
      let rentSampleCount = 0;

      const propertyTypeCounts: Record<string, number> = {};

      for (const property of properties) {
        const unitsCount = property?.isMultiUnit
          ? property?.units?.length || property?.totalUnits || 1
          : 1;

        totalUnits += unitsCount;

        propertyTypeCounts[property?.type ?? "unknown"] =
          (propertyTypeCounts[property?.type ?? "unknown"] || 0) + 1;

        if (property?.isMultiUnit && property?.units?.length) {
          for (const unit of property.units) {
            if (
              typeof unit?.rentAmount === "number" &&
              (unit?.rentAmount ?? 0) > 0
            ) {
              totalRent += unit.rentAmount;
              rentSampleCount += 1;
            }
          }
        }
        // Note: rentAmount is now only stored in units, no fallback to property-level
      }

      const averageRent = rentSampleCount > 0 ? totalRent / rentSampleCount : 0;

      // -----------------------------------------------------------------------
      // Lease and tenant metrics
      // -----------------------------------------------------------------------
      const directTenantFilter = user.isAdmin
        ? { role: UserRole.TENANT, deletedAt: null }
        : {
            role: UserRole.TENANT,
            deletedAt: null,
            $or: [{ managerId: user.id }, { createdBy: user.id }],
          };

      const [activeLeasesCount, expiringLeasesCount, leaseTenantIds, directTenantIds] =
        await Promise.all([
          Lease.countDocuments({
            status: LeaseStatus.ACTIVE,
            deletedAt: null,
            ...scopedPropertyFilter,
          }),
          Lease.countDocuments({
            status: LeaseStatus.ACTIVE,
            endDate: { $gte: now, $lte: thirtyDaysFromNow },
            deletedAt: null,
            ...scopedPropertyFilter,
          }),
          Lease.distinct("tenantId", {
            deletedAt: null,
            ...scopedPropertyFilter,
          }),
          User.distinct("_id", directTenantFilter),
        ]);

      const scopedTenantIds = Array.from(
        new Map(
          [...leaseTenantIds, ...directTenantIds].map((id: any) => [id.toString(), id]),
        ).values(),
      );

      const tenantStatusBuckets = await User.aggregate([
        {
          $match: {
            _id: { $in: scopedTenantIds },
            role: UserRole.TENANT,
            deletedAt: null,
          },
        },
        {
          $group: {
            _id: "$tenantStatus",
            count: { $sum: 1 },
          },
        },
      ]);

      occupiedUnits = activeLeasesCount;

      const tenantStatusMap = tenantStatusBuckets.reduce<
        Record<string, number>
      >((acc, bucket) => {
        acc[bucket?._id || "unknown"] = bucket?.count ?? 0;
        return acc;
      }, {});

      const totalTenants = Object.values(tenantStatusMap).reduce(
        (sum, current) => sum + current,
        0,
      );
      const activeTenants =
        (tenantStatusMap["active"] || 0) +
        (tenantStatusMap["approved"] || 0);
      const pendingApplications =
        (tenantStatusMap["application_submitted"] || 0) +
        (tenantStatusMap["submitted"] || 0) +
        (tenantStatusMap["pending"] || 0) +
        (tenantStatusMap["under_review"] || 0);

      const occupancyRate =
        totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

      // -----------------------------------------------------------------------
      // Maintenance metrics
      // -----------------------------------------------------------------------
      const maintenanceBuckets = await MaintenanceRequest.aggregate([
        {
          $match: {
            deletedAt: null,
            ...scopedPropertyFilter,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            open: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$status",
                      [MaintenanceStatus.SUBMITTED, MaintenanceStatus.ASSIGNED],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            inProgress: {
              $sum: {
                $cond: [
                  { $eq: ["$status", MaintenanceStatus.IN_PROGRESS] },
                  1,
                  0,
                ],
              },
            },
            completed: {
              $sum: {
                $cond: [
                  { $eq: ["$status", MaintenanceStatus.COMPLETED] },
                  1,
                  0,
                ],
              },
            },
            urgent: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $eq: ["$priority", MaintenancePriority.EMERGENCY],
                      },
                      {
                        $in: [
                          "$status",
                          [
                            MaintenanceStatus.SUBMITTED,
                            MaintenanceStatus.ASSIGNED,
                            MaintenanceStatus.IN_PROGRESS,
                          ],
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);

      const maintenanceStats = maintenanceBuckets[0] || {
        total: 0,
        open: 0,
        inProgress: 0,
        completed: 0,
        urgent: 0,
      };

      // -----------------------------------------------------------------------
      // Payment metrics (collection, overdue, trends)
      // -----------------------------------------------------------------------
      // Calculate grace period threshold (5 days ago)
      const gracePeriodThreshold = new Date(now);
      gracePeriodThreshold.setDate(gracePeriodThreshold.getDate() - 5);

      const paymentStats = await Payment.aggregate([
        {
          $match: {
            deletedAt: null,
            ...scopedPropertyFilter,
          },
        },
        {
          $group: {
            _id: null,
            collected: {
              $sum: {
                $cond: [
                  { $eq: ["$status", PaymentStatus.PAID] },
                  "$amount",
                  0,
                ],
              },
            },
            collectedCount: {
              $sum: {
                $cond: [
                  { $eq: ["$status", PaymentStatus.PAID] },
                  1,
                  0,
                ],
              },
            },
            pending: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$status",
                      [PaymentStatus.PENDING, PaymentStatus.OVERDUE],
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            pendingCount: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$status",
                      [PaymentStatus.PENDING, PaymentStatus.OVERDUE],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$status", PaymentStatus.OVERDUE] },
                      {
                        $and: [
                          { $ne: ["$status", PaymentStatus.PAID] },
                          { $lt: ["$dueDate", gracePeriodThreshold] },
                        ],
                      },
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            overdueCount: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$status", PaymentStatus.OVERDUE] },
                      {
                        $and: [
                          { $ne: ["$status", PaymentStatus.PAID] },
                          { $lt: ["$dueDate", gracePeriodThreshold] },
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalDue: { $sum: "$amount" },
          },
        },
      ]);

      const paymentSummary = paymentStats[0] || {
        collected: 0,
        collectedCount: 0,
        pending: 0,
        pendingCount: 0,
        overdue: 0,
        overdueCount: 0,
        totalDue: 0,
      };

      const collectionRate =
        paymentSummary.totalDue > 0
          ? (paymentSummary.collected / paymentSummary.totalDue) * 100
          : 0;

      const monthlyRevenueAgg = await Payment.aggregate([
        {
          $match: {
            deletedAt: null,
            ...scopedPropertyFilter,
            status: PaymentStatus.PAID,
            $expr: {
              $and: [
                {
                  $gte: [{ $ifNull: ["$paidDate", "$dueDate"] }, startOfMonth],
                },
                {
                  $lte: [{ $ifNull: ["$paidDate", "$dueDate"] }, now],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]);

      const yearlyRevenueAgg = await Payment.aggregate([
        {
          $match: {
            deletedAt: null,
            ...scopedPropertyFilter,
            status: PaymentStatus.PAID,
            $expr: {
              $and: [
                {
                  $gte: [{ $ifNull: ["$paidDate", "$dueDate"] }, startOfYear],
                },
                {
                  $lte: [{ $ifNull: ["$paidDate", "$dueDate"] }, now],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]);

      const monthlyRevenue = monthlyRevenueAgg[0]?.total || 0;
      const yearlyRevenue = yearlyRevenueAgg[0]?.total || 0;

      const paidDateExpression = { $ifNull: ["$paidDate", "$dueDate"] };

      const [
        revenueByMonth,
        revenueByDay,
        revenueByMonthLastYear,
        maintenanceCostsByMonth,
        maintenanceCostsByDay,
        maintenanceCostsByMonthLastYear,
      ] = await Promise.all([
        Payment.aggregate([
          {
            $match: {
              deletedAt: null,
              ...scopedPropertyFilter,
              status: PaymentStatus.PAID,
              $expr: {
                $and: [
                  {
                    $gte: [paidDateExpression, twelveMonthsAgo],
                  },
                  {
                    $lte: [paidDateExpression, now],
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: paidDateExpression },
                month: { $month: paidDateExpression },
              },
              total: { $sum: "$amount" },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),
        Payment.aggregate([
          {
            $match: {
              deletedAt: null,
              ...scopedPropertyFilter,
              status: PaymentStatus.PAID,
              $expr: {
                $and: [
                  {
                    $gte: [paidDateExpression, thirtyDaysAgo],
                  },
                  {
                    $lte: [paidDateExpression, now],
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: paidDateExpression },
                month: { $month: paidDateExpression },
                day: { $dayOfMonth: paidDateExpression },
              },
              total: { $sum: "$amount" },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
        ]),
        Payment.aggregate([
          {
            $match: {
              deletedAt: null,
              ...scopedPropertyFilter,
              status: PaymentStatus.PAID,
              $expr: {
                $and: [
                  {
                    $gte: [paidDateExpression, startOfLastYear],
                  },
                  {
                    $lte: [paidDateExpression, endOfLastYear],
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: paidDateExpression },
                month: { $month: paidDateExpression },
              },
              total: { $sum: "$amount" },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),
        MaintenanceRequest.aggregate([
          {
            $match: {
              deletedAt: null,
              ...scopedPropertyFilter,
              createdAt: { $gte: twelveMonthsAgo, $lte: now },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
              },
              cost: {
                $sum: {
                  $ifNull: ["$actualCost", { $ifNull: ["$estimatedCost", 0] }],
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),
        MaintenanceRequest.aggregate([
          {
            $match: {
              deletedAt: null,
              ...scopedPropertyFilter,
              createdAt: { $gte: thirtyDaysAgo, $lte: now },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
                day: { $dayOfMonth: "$createdAt" },
              },
              cost: {
                $sum: {
                  $ifNull: ["$actualCost", { $ifNull: ["$estimatedCost", 0] }],
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
        ]),
        MaintenanceRequest.aggregate([
          {
            $match: {
              deletedAt: null,
              ...scopedPropertyFilter,
              createdAt: { $gte: startOfLastYear, $lte: endOfLastYear },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
              },
              cost: {
                $sum: {
                  $ifNull: ["$actualCost", { $ifNull: ["$estimatedCost", 0] }],
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),
      ]);

      const revenueByMonthMap = new Map<string, number>();
      for (const bucket of revenueByMonth) {
        const key = buildMonthKey(bucket._id.year, bucket._id.month);
        revenueByMonthMap.set(key, bucket.total);
      }

      const revenueByDayMap = new Map<string, number>();
      for (const bucket of revenueByDay) {
        const key = buildDayKey(
          bucket._id.year,
          bucket._id.month,
          bucket._id.day,
        );
        revenueByDayMap.set(key, bucket.total);
      }

      const revenueByMonthLastYearMap = new Map<string, number>();
      for (const bucket of revenueByMonthLastYear) {
        const key = buildMonthKey(bucket._id.year, bucket._id.month);
        revenueByMonthLastYearMap.set(key, bucket.total);
      }

      const expenseByMonthMap = new Map<string, { cost: number; count: number }>();
      for (const bucket of maintenanceCostsByMonth) {
        const key = buildMonthKey(bucket._id.year, bucket._id.month);
        expenseByMonthMap.set(key, { cost: bucket.cost, count: bucket.count });
      }

      const expenseByDayMap = new Map<string, { cost: number; count: number }>();
      for (const bucket of maintenanceCostsByDay) {
        const key = buildDayKey(
          bucket._id.year,
          bucket._id.month,
          bucket._id.day,
        );
        expenseByDayMap.set(key, { cost: bucket.cost, count: bucket.count });
      }

      const expenseByMonthLastYearMap = new Map<
        string,
        { cost: number; count: number }
      >();
      for (const bucket of maintenanceCostsByMonthLastYear) {
        const key = buildMonthKey(bucket._id.year, bucket._id.month);
        expenseByMonthLastYearMap.set(key, {
          cost: bucket.cost,
          count: bucket.count,
        });
      }

      const occupancyRounded = Math.round(occupancyRate * 10) / 10;
      const buildTrendPoint = (
        label: string,
        periodStart: Date,
        granularity: "day" | "month",
        totalRevenue: number,
        expenseEntry: { cost: number; count: number },
      ): DashboardOverviewResponse["trends"]["revenue"][number] => ({
        month: label,
        label,
        periodStart: periodStart.toISOString(),
        granularity,
        totalRevenue,
        totalExpenses: expenseEntry.cost,
        maintenance: expenseEntry.count,
        occupancy: occupancyRounded,
      });

      const trendData12Months: DashboardOverviewResponse["trends"]["revenue"] = [];
      for (let i = 0; i < 12; i += 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
        const key = buildMonthKey(date.getFullYear(), date.getMonth() + 1);
        const revenue = revenueByMonthMap.get(key) || 0;
        const expenseEntry = expenseByMonthMap.get(key) || { cost: 0, count: 0 };

        trendData12Months.push(
          buildTrendPoint(
            MONTH_LABELS[date.getMonth()],
            date,
            "month",
            revenue,
            expenseEntry,
          ),
        );
      }

      const trendDataLastYear: DashboardOverviewResponse["trends"]["revenue"] = [];
      for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
        const date = new Date(lastYear, monthIndex, 1);
        const key = buildMonthKey(lastYear, monthIndex + 1);
        const revenue = revenueByMonthLastYearMap.get(key) || 0;
        const expenseEntry = expenseByMonthLastYearMap.get(key) || {
          cost: 0,
          count: 0,
        };

        trendDataLastYear.push(
          buildTrendPoint(
            MONTH_LABELS[monthIndex],
            date,
            "month",
            revenue,
            expenseEntry,
          ),
        );
      }

      const trendData30Days: DashboardOverviewResponse["trends"]["revenue"] = [];
      for (let i = 0; i < 30; i += 1) {
        const date = new Date(thirtyDaysAgo);
        date.setDate(thirtyDaysAgo.getDate() + i);
        const key = buildDayKey(
          date.getFullYear(),
          date.getMonth() + 1,
          date.getDate(),
        );
        const revenue = revenueByDayMap.get(key) || 0;
        const expenseEntry = expenseByDayMap.get(key) || { cost: 0, count: 0 };

        trendData30Days.push(
          buildTrendPoint(
            DAY_LABEL_FORMATTER.format(date),
            date,
            "day",
            revenue,
            expenseEntry,
          ),
        );
      }

      const trendData7Days = trendData30Days.slice(-7);

      // -----------------------------------------------------------------------
      // Recent activity feed (payments, maintenance, leases)
      // -----------------------------------------------------------------------
      const [recentPayments, recentMaintenance, recentLeases, recentTenants] =
        await Promise.all([
          Payment.find({ deletedAt: null, ...scopedPropertyFilter })
            .sort({ updatedAt: -1 })
            .limit(5)
            .select(
              "amount status type paidDate dueDate updatedAt tenantId propertyId",
            )
            .populate([
              { path: "tenantId", select: "firstName lastName" },
              { path: "propertyId", select: "name" },
            ])
            .lean(),
          MaintenanceRequest.find({ deletedAt: null, ...scopedPropertyFilter })
            .sort({ updatedAt: -1 })
            .limit(5)
            .select("title priority status updatedAt propertyId")
            .populate({ path: "propertyId", select: "name" })
            .lean(),
          Lease.find({ deletedAt: null, ...scopedPropertyFilter })
            .sort({ updatedAt: -1 })
            .limit(5)
            .select("status startDate endDate updatedAt tenantId propertyId")
            .populate([
              { path: "tenantId", select: "firstName lastName" },
              { path: "propertyId", select: "name" },
            ])
            .lean(),
          User.find({
            _id: { $in: scopedTenantIds },
            role: UserRole.TENANT,
            deletedAt: null,
          })
            .sort({ updatedAt: -1 })
            .limit(5)
            .select("firstName lastName tenantStatus createdAt updatedAt")
            .lean(),
        ]);

      const formatName = (
        record?:
          | {
              firstName?: string | null;
              lastName?: string | null;
              email?: string | null;
              name?: string | null;
            }
          | string
          | null,
      ) => {
        if (!record) return "Inconnu";
        if (typeof record === "string") return record;

        const first = record.firstName || record.name || "";
        const last = record.lastName || "";
        return `${first} ${last}`.trim() || record.email || "Inconnu";
      };

      const paymentTypeLabels: Record<string, string> = {
        rent: "le loyer",
        security_deposit: "le dépôt de garantie",
        invoice: "une facture",
        late_fee: "des frais de retard",
        utility: "des charges",
        maintenance: "des frais de maintenance",
        pet_deposit: "un dépôt pour animaux",
        other: "un paiement",
      };

      const leaseStatusLabels: Record<string, string> = {
        draft: "en préparation",
        pending: "en attente",
        pending_signature: "en attente de signature",
        active: "actif",
        expired: "expiré",
        terminated: "résilié",
        cancelled: "annulé",
        renewed: "renouvelé",
      };

      const activities: DashboardOverviewResponse["recentActivities"] = [
        ...recentPayments.map((payment) => {
          const tenantName = formatName(payment?.tenantId);
          const propertyName = payment?.propertyId?.name || "Portefeuille";
          const paymentLabel =
            paymentTypeLabels[String(payment?.type || "rent")] || "un paiement";
          const description = `${tenantName} a réglé ${paymentLabel} pour ${propertyName}`;
          const timestamp =
            payment?.paidDate?.toISOString?.() ||
            payment?.updatedAt?.toISOString?.() ||
            new Date().toISOString();

          return {
            id: payment?._id?.toString() ?? "unknown",
            type: "payment" as const,
            description,
            timestamp,
            status: payment?.status,
            amount: payment?.amount,
          };
        }),
        ...recentMaintenance.map((request) => {
          const propertyName = request?.propertyId?.name || "Portefeuille";
          const description = `${
            request?.title || "Demande de maintenance"
          } — ${propertyName}`;
          const timestamp =
            request?.updatedAt?.toISOString?.() || new Date().toISOString();

          return {
            id: request?._id?.toString() ?? "unknown",
            type: "maintenance" as const,
            description,
            timestamp,
            status: request?.status,
            priority: request?.priority,
          };
        }),
        ...recentTenants.map((tenant: any) => {
          const tenantName = formatName(tenant);
          const status = String(tenant?.tenantStatus || "submitted");
          const statusLabels: Record<string, string> = {
            application_submitted: "candidature soumise",
            submitted: "candidature soumise",
            pending: "candidature en attente",
            under_review: "candidature en examen",
            approved: "locataire approuvé",
            active: "locataire actif",
            rejected: "candidature rejetée",
            terminated: "location résiliée",
            moved_out: "locataire sorti",
          };
          const timestamp =
            tenant?.updatedAt?.toISOString?.() ||
            tenant?.createdAt?.toISOString?.() ||
            new Date().toISOString();
          return {
            id: tenant?._id?.toString() ?? "unknown",
            type: "application" as const,
            description: `${tenantName} — ${statusLabels[status] || status.replace(/_/g, " ")}`,
            timestamp,
            status,
          };
        }),
        ...recentLeases.map((lease) => {
          const tenantName = formatName(lease?.tenantId);
          const propertyName = lease?.propertyId?.name || "Portefeuille";
          const rawStatus = String(lease?.status || "pending");
          const description = `${tenantName} — bail ${
            leaseStatusLabels[rawStatus] || rawStatus.replace(/_/g, " ")
          } à ${propertyName}`;
          const timestamp =
            lease?.updatedAt?.toISOString?.() || new Date().toISOString();

          return {
            id: lease?._id?.toString() ?? "unknown",
            type: "lease" as const,
            description,
            timestamp,
            status: lease?.status,
          };
        }),
      ]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 8);

      // -----------------------------------------------------------------------
      // Upcoming tasks (calendar events + expiring lease reminders + open maintenance)
      // -----------------------------------------------------------------------
      const [
        upcomingEvents,
        upcomingExpiringLeases,
        openHighPriorityMaintenance,
      ] = await Promise.all([
        Event.find({
          deletedAt: null,
          ...scopedPropertyFilter,
          status: { $in: [EventStatus.SCHEDULED, EventStatus.CONFIRMED] },
          startDate: { $gte: now },
        })
          .sort({ startDate: 1 })
          .limit(5)
          .select("title startDate priority type")
          .lean(),
        Lease.find({
          ...scopedPropertyFilter,
          status: LeaseStatus.ACTIVE,
          endDate: { $gte: now, $lte: thirtyDaysFromNow },
          deletedAt: null,
        })
          .sort({ endDate: 1 })
          .limit(3)
          .select("endDate tenantId propertyId")
          .populate([
            { path: "tenantId", select: "firstName lastName" },
            { path: "propertyId", select: "name" },
          ])
          .lean(),
        MaintenanceRequest.find({
          deletedAt: null,
          ...scopedPropertyFilter,
          status: {
            $in: [MaintenanceStatus.SUBMITTED, MaintenanceStatus.ASSIGNED],
          },
          priority: {
            $in: [MaintenancePriority.HIGH, MaintenancePriority.EMERGENCY],
          },
        })
          .sort({ createdAt: 1 })
          .limit(3)
          .select("title createdAt priority propertyId")
          .populate({ path: "propertyId", select: "name" })
          .lean(),
      ]);

      const upcomingTasks: DashboardOverviewResponse["upcomingTasks"] = [];

      for (const event of upcomingEvents) {
        upcomingTasks.push({
          id: event?._id?.toString() ?? "unknown",
          title: event?.title ?? "Event",
          dueDate: event?.startDate
            ? new Date(event.startDate).toISOString()
            : now.toISOString(),
          priority: (event?.priority ||
            EventPriority.MEDIUM) as DashboardOverviewResponse["upcomingTasks"][number]["priority"],
          type: event?.type || EventType.GENERAL,
        });
      }

      for (const lease of upcomingExpiringLeases) {
        const tenantName = formatName(lease?.tenantId);
        const propertyName = lease?.propertyId?.name || "Portfolio";
        upcomingTasks.push({
          id: `lease-${lease?._id?.toString() ?? "unknown"}`,
          title: `Lease renewal - ${tenantName} (${propertyName})`,
          dueDate: lease?.endDate?.toISOString?.() || now.toISOString(),
          priority: "high",
          type: "lease_renewal",
        });
      }

      for (const request of openHighPriorityMaintenance) {
        const propertyName = request?.propertyId?.name || "Portfolio";
        upcomingTasks.push({
          id: `maintenance-${request?._id?.toString() ?? "unknown"}`,
          title: `${
            request?.title || "Maintenance follow-up"
          } (${propertyName})`,
          dueDate: request?.createdAt?.toISOString?.() || now.toISOString(),
          priority:
            request?.priority === MaintenancePriority.EMERGENCY
              ? "urgent"
              : "high",
          type: "maintenance",
        });
      }

      upcomingTasks.sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );

      const trimmedTasks = upcomingTasks.slice(0, 8);

      const overdueInvoicesCount = await Invoice.countDocuments({
        deletedAt: null,
        ...scopedPropertyFilter,
        status: InvoiceStatus.OVERDUE,
        balanceRemaining: { $gt: 0 },
        dueDate: { $lt: now },
      });

      // -----------------------------------------------------------------------
      // Alert summaries
      // -----------------------------------------------------------------------
      // Always show the main 3 alerts (payment, maintenance, lease)
      const mainAlerts: DashboardOverviewResponse["alerts"] = [
        {
          id: "overdue-payments",
          type: "payment",
          title: "Overdue Payments",
          message:
            overdueInvoicesCount > 0
              ? `${overdueInvoicesCount} tenants have overdue payments`
              : "No overdue payments at this time",
          severity: overdueInvoicesCount > 0 ? "high" : "low",
          count: overdueInvoicesCount,
        },
        {
          id: "urgent-maintenance",
          type: "maintenance",
          title: "Urgent Maintenance",
          message:
            maintenanceStats.urgent > 0
              ? `${maintenanceStats.urgent} urgent maintenance requests require immediate attention`
              : "No urgent maintenance requests",
          severity:
            maintenanceStats.urgent >= 3
              ? "critical"
              : maintenanceStats.urgent > 0
                ? "high"
                : "low",
          count: maintenanceStats.urgent,
        },
        {
          id: "expiring-leases",
          type: "lease",
          title: "Expiring Leases",
          message:
            expiringLeasesCount > 0
              ? `${expiringLeasesCount} leases expiring within the next 30 days`
              : "No leases expiring soon",
          severity: expiringLeasesCount >= 5 ? "medium" : "low",
          count: expiringLeasesCount,
        },
      ];

      // Optional: Add pending applications alert only if there are any
      const alerts: DashboardOverviewResponse["alerts"] = [
        ...mainAlerts,
        ...(pendingApplications > 0
          ? [
              {
                id: "pending-applications",
                type: UserRole.TENANT as DashboardAlertType,
                title: "Pending Applications",
                message: `${pendingApplications} tenant applications awaiting review`,
                severity: "medium" as DashboardAlertSeverity,
                count: pendingApplications,
              },
            ]
          : []),
      ];

      const propertyTypes = Object.entries(propertyTypeCounts).map(
        ([type, count], index) => ({
          name:
            ({
              furnished_apartment: "Appartement Meublé",
              multi_family: "Plusieurs Ménages",
              private_house: "Maison individuelle",
              residence: "Résidence",
              single_family: "Maison individuelle",
              apartment: "Appartement",
              house: "Maison",
              condo: "Condominium",
              townhouse: "Maison en rangée",
              commercial: "Commercial",
            } as Record<string,string>)[type] ??
            type
              .split("_")
              .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
              .join(" "),
          value: count,
          color: ALERT_COLOR_MAP[index % ALERT_COLOR_MAP.length],
        }),
      );

      const response: DashboardOverviewResponse = {
        overview: {
          totalProperties,
          totalUnits,
          occupiedUnits,
          occupancyRate,
          monthlyRevenue,
          yearlyRevenue,
          averageRent,
          collectionRate,
          totalTenants,
          activeTenants,
          pendingApplications,
          expiringLeases: expiringLeasesCount,
          maintenanceRequests: {
            total: maintenanceStats.total,
            open: maintenanceStats.open,
            inProgress: maintenanceStats.inProgress,
            completed: maintenanceStats.completed,
            urgent: maintenanceStats.urgent,
          },
          payments: {
            collected: paymentSummary.collected,
            collectedCount: paymentSummary.collectedCount,
            pending: paymentSummary.pending,
            pendingCount: paymentSummary.pendingCount,
            overdue: paymentSummary.overdue,
            overdueCount: paymentSummary.overdueCount,
            totalDue: paymentSummary.totalDue,
          },
        },
        alerts,
        trends: {
          revenue: trendData12Months,
          revenueByRange: {
            "7d": trendData7Days,
            "30d": trendData30Days,
            "12m": trendData12Months,
            lastYear: trendDataLastYear,
          },
        },
        propertyTypes,
        recentActivities: activities,
        upcomingTasks: trimmedTasks,
      };

      return createSuccessResponse(
        response,
        "Dashboard overview metrics retrieved successfully",
      );
    } catch (error) {
      return handleApiError(error, "Failed to load dashboard overview");
    }
  },
);
