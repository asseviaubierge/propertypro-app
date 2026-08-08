/**
 * PropertyPro - Dashboard Data Export API
 * Exports dashboard data in various formats
 */

import {
  createSuccessResponse,
  handleApiError,
  withPermissionAndDB,
} from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { Property, Lease, User, MaintenanceRequest, Payment } from "@/models";
import { formatCurrency } from "@/lib/utils/formatting";

export const POST = withPermissionAndDB("data_export")(
  async (_user: any, request: NextRequest) => {
    try {
      const {
        format = "json",
        dateRange,
        includeDetails = false,
      } = await request.json();

      const now = new Date();
      const startDate = dateRange?.start
        ? new Date(dateRange.start)
        : new Date(now.getFullYear(), 0, 1);
      const endDate = dateRange?.end ? new Date(dateRange.end) : now;

      // Fetch dashboard data
      const [properties, leases, tenants, maintenance, payments] =
        await Promise.all([
          Property.find({ deletedAt: null })
            .select(
              includeDetails ? undefined : "name type totalUnits rentAmount"
            )
            .lean(),
          Lease.find({
            deletedAt: null,
            createdAt: { $gte: startDate, $lte: endDate },
          })
            .select(
              includeDetails
                ? undefined
                : "status startDate endDate monthlyRent"
            )
            .populate(
              includeDetails
                ? [
                    { path: "tenantId", select: "firstName lastName email" },
                    { path: "propertyId", select: "name" },
                  ]
                : []
            )
            .lean(),
          User.find({
            role: "tenant",
            deletedAt: null,
            createdAt: { $gte: startDate, $lte: endDate },
          })
            .select(
              includeDetails
                ? undefined
                : "firstName lastName email tenantStatus"
            )
            .lean(),
          MaintenanceRequest.find({
            deletedAt: null,
            createdAt: { $gte: startDate, $lte: endDate },
          })
            .select(
              includeDetails
                ? undefined
                : "title status priority estimatedCost actualCost"
            )
            .populate(
              includeDetails ? [{ path: "propertyId", select: "name" }] : []
            )
            .lean(),
          Payment.find({
            deletedAt: null,
            createdAt: { $gte: startDate, $lte: endDate },
          })
            .select(
              includeDetails ? undefined : "amount status type paidDate dueDate"
            )
            .populate(
              includeDetails
                ? [
                    { path: "tenantId", select: "firstName lastName" },
                    { path: "propertyId", select: "name" },
                  ]
                : []
            )
            .lean(),
        ]);

      // Calculate summary metrics
      const summary = {
        totalProperties: properties.length,
        totalUnits: properties.reduce((sum, p) => sum + (p.totalUnits || 1), 0),
        totalTenants: tenants.length,
        activeTenants: tenants.filter((t) => t.tenantStatus === "active")
          .length,
        totalLeases: leases.length,
        activeLeases: leases.filter((l) => l.status === "active").length,
        totalMaintenance: maintenance.length,
        openMaintenance: maintenance.filter((m) =>
          ["submitted", "assigned"].includes(m.status)
        ).length,
        totalPayments: payments.length,
        paidPayments: payments.filter((p) => p.status === "paid").length,
        totalRevenue: payments
          .filter((p) => p.status === "paid")
          .reduce((sum, p) => sum + (p.amount || 0), 0),
        totalMaintenanceCost: maintenance.reduce(
          (sum, m) => sum + (m.actualCost || m.estimatedCost || 0),
          0
        ),
      };

      const exportData = {
        generatedAt: now.toISOString(),
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        summary,
        data: includeDetails
          ? {
              properties,
              leases,
              tenants,
              maintenance,
              payments,
            }
          : {
              propertyCount: properties.length,
              leaseCount: leases.length,
              tenantCount: tenants.length,
              maintenanceCount: maintenance.length,
              paymentCount: payments.length,
            },
      };

      if (format === "csv") {
        // Convert to CSV format for summary data
        const csvData = [
          ["Metric", "Value"],
          ["Total Properties", summary.totalProperties],
          ["Total Units", summary.totalUnits],
          ["Total Tenants", summary.totalTenants],
          ["Active Tenants", summary.activeTenants],
          ["Total Leases", summary.totalLeases],
          ["Active Leases", summary.activeLeases],
          ["Total Maintenance", summary.totalMaintenance],
          ["Open Maintenance", summary.openMaintenance],
          ["Total Payments", summary.totalPayments],
          ["Paid Payments", summary.paidPayments],
          ["Total Revenue", formatCurrency(summary.totalRevenue)],
          ["Maintenance Cost", formatCurrency(summary.totalMaintenanceCost)],
        ];

        const csvContent = csvData.map((row) => row.join(",")).join("\n");

        return new Response(csvContent, {
          status: 200,
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="dashboard-export-${
              now.toISOString().split("T")[0]
            }.csv"`,
          },
        });
      }

      return createSuccessResponse(
        exportData,
        "Dashboard data exported successfully"
      );
    } catch (error) {
      return handleApiError(error, "Failed to export dashboard data");
    }
  }
);
