"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback } from "react";
import { GlobalSearch } from "@/components/ui/global-search";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { useViewPreferencesStore } from "@/stores/view-preferences.store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { showSimpleError, showSimpleSuccess } from "@/lib/toast-notifications";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  FileText,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Download,
  AlertTriangle,
  Home,
  Grid3X3,
  List,
  X,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import {
  AnalyticsCard,
  AnalyticsCardGrid,
} from "@/components/analytics/AnalyticsCard";
import { LeaseStatus } from "@/types";
import {
  leaseService,
  LeaseResponse,
  PaginatedLeasesResponse,
  LeaseQueryParams,
} from "@/lib/services/lease.service";
import { LeaseCard } from "@/components/leases/LeaseCard";
import { LeaseInvoiceModal } from "@/components/invoices";
import { GlobalPagination } from "@/components/ui/global-pagination";
import { LeaseStatusBadge } from "@/components/leases/LeaseStatusBadge";
import { DeleteConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useAuthorization } from "@/hooks/useAuthorization";

export default function LeasesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isTenant } = useAuthorization();
  const { t, formatCurrency, currentCurrency } = useLocalizationContext();
  const [leases, setLeases] = useState<LeaseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Track if this is the initial load (for showing skeleton loaders only on first load)
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [filters, setFilters] = useState<LeaseQueryParams>({
    page: 1,
    limit: 12,
    search: "",
    status: undefined,
    sortBy: "createdAt",
    sortOrder: "desc",
    archived: false,
  });

  // Redirect tenants to their "My Leases" page
  // UI state/hooks must be declared before any early returns so hooks order is stable
  const viewMode = useViewPreferencesStore((state) => state.leasesView);
  const setViewMode = useViewPreferencesStore((state) => state.setLeasesView);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    draft: 0,
    pending: 0,
    expired: 0,
    terminated: 0,
    expiringThisMonth: 0,
  });
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [leaseToTerminate, setLeaseToTerminate] =
    useState<LeaseResponse | null>(null);
  const [isTerminating, setIsTerminating] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [selectedLeases, setSelectedLeases] = useState<string[]>([]);
  const [leaseToDelete, setLeaseToDelete] = useState<LeaseResponse | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchLeases = async (
    currentFilters: LeaseQueryParams,
    showFullLoading = false
  ) => {
    try {
      // Only show full skeleton loaders on initial load, not during search
      if (showFullLoading) {
        setLoading(true);
      }
      console.log("🔍 fetchLeases called with filters:", currentFilters);

      // TENANT view: fetch from tenant dashboard, then apply filters/sort/pagination client-side
      if (session?.user && isTenant) {
        const response = await fetch("/api/tenant/dashboard");
        const data = await response.json();

        if (data.success) {
          const allLeases: LeaseResponse[] = (data.data?.allLeases ||
            []) as LeaseResponse[];

          // Apply status + search filters
          const search = (currentFilters.search || "").toLowerCase().trim();
          const filtered = allLeases.filter((lease) => {
            const matchesStatus =
              !currentFilters.status ||
              lease.status === currentFilters.status ||
              (currentFilters.status === LeaseStatus.PENDING &&
                lease.status === LeaseStatus.PENDING_SIGNATURE);
            console.log(
              `Lease ${lease._id}: status=${lease.status}, currentFilters.status=${currentFilters.status}, matchesStatus=${matchesStatus}`
            );
            if (!search) return matchesStatus;

            const haystack = [
              lease.propertyId?.name,
              lease.propertyId?.address?.street,
              lease.propertyId?.address?.city,
              lease.tenantId?.firstName,
              lease.tenantId?.lastName,
              lease.tenantId?.email,
              lease.unit?.unitNumber,
              lease.status,
            ]
              .filter(Boolean)
              .map((v) => String(v).toLowerCase());

            const matchesSearch = haystack.some((v) => v.includes(search));
            return matchesStatus && matchesSearch;
          });

          // Sorting
          const sortBy = currentFilters.sortBy || "createdAt";
          const sortOrder = currentFilters.sortOrder || "desc";
          const get = (obj: any, path: string) =>
            path
              .split(".")
              .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);

          const getSortVal = (lease: LeaseResponse) => {
            if (sortBy === "terms.rentAmount") {
              return lease.unit?.rentAmount ?? lease.terms?.rentAmount ?? 0;
            }
            const v = get(lease, sortBy);
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

          // Pagination
          const page = currentFilters.page || 1;
          const limit = currentFilters.limit || 10;
          const total = sorted.length;
          const pages = Math.max(1, Math.ceil(total / limit));
          const start = (page - 1) * limit;
          const paginated = sorted.slice(start, start + limit);

          setLeases(paginated);
          setPagination({
            page,
            limit,
            total,
            pages,
            hasNext: page < pages,
            hasPrev: page > 1,
          });
        } else {
          showSimpleError(
            "Load Error",
            t("leases.toasts.fetchYourLeasesError")
          );
        }
      } else {
        // ADMIN/MANAGER: fetch all leases and apply client-side filtering
        const baseParams = {
          search: currentFilters.search,
          sortBy: currentFilters.sortBy,
          sortOrder: currentFilters.sortOrder,
          archived: currentFilters.archived,
          page: 1,
          limit: 1000,
        } as LeaseQueryParams;

        console.log("📡 Fetching all leases for admin/manager");
        const response: PaginatedLeasesResponse = await leaseService.getLeases(
          baseParams
        );
        console.log("📥 Received all leases:", response.data.length);

        let allLeases = response.data;

        // Apply status filter client-side
        if (currentFilters.status) {
          console.log("🔍 Filtering by status:", currentFilters.status);
          allLeases = allLeases.filter((lease) => {
            const matchesStatus =
              lease.status === currentFilters.status ||
              (currentFilters.status === LeaseStatus.PENDING &&
                lease.status === LeaseStatus.PENDING_SIGNATURE);
            console.log(
              `Lease ${lease._id}: status=${lease.status}, currentFilters.status=${currentFilters.status}, match=${matchesStatus}`
            );
            return matchesStatus;
          });
          console.log("✅ Filtered leases count:", allLeases.length);
        }

        // Sort
        const sortBy = currentFilters.sortBy || "createdAt";
        const sortOrder = currentFilters.sortOrder || "desc";
        const get = (obj: any, path: string) =>
          path
            .split(".")
            .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
        const getSortVal = (lease: LeaseResponse) => {
          if (sortBy === "terms.rentAmount") {
            return lease.unit?.rentAmount ?? lease.terms?.rentAmount ?? 0;
          }
          const v = get(lease, sortBy);
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
        const sorted = [...allLeases].sort((a, b) => {
          const av = getSortVal(a);
          const bv = getSortVal(b);
          if (typeof av === "number" && typeof bv === "number") {
            return sortOrder === "asc" ? av - bv : bv - av;
          }
          return sortOrder === "asc"
            ? String(av).localeCompare(String(bv))
            : String(bv).localeCompare(String(av));
        });

        // Paginate client-side
        const page = currentFilters.page || 1;
        const limit = currentFilters.limit || 10;
        const total = sorted.length;
        const pages = Math.max(1, Math.ceil(total / limit));
        const start = (page - 1) * limit;
        const paginated = sorted.slice(start, start + limit);

        setLeases(paginated);
        setPagination({
          page,
          limit,
          total,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1,
        });
      }
    } catch {
      showSimpleError("Load Error", t("leases.toasts.fetchError"));
    } finally {
      setLoading(false);
      setIsSearching(false);
      setIsInitialLoad(false);
    }
  };

  const fetchStats = async () => {
    try {
      if (session?.user && isTenant) {
        // For tenants, calculate stats from their leases
        const response = await fetch("/api/tenant/dashboard");
        const data = await response.json();

        if (data.success && data.data.allLeases) {
          const tenantLeases = data.data.allLeases;
          const now = new Date();

          const statsData = {
            total: tenantLeases.length,
            active: tenantLeases.filter(
              (lease: any) => lease.status === LeaseStatus.ACTIVE
            ).length,
            draft: tenantLeases.filter(
              (lease: any) => lease.status === LeaseStatus.DRAFT
            ).length,
            pending: tenantLeases.filter(
              (lease: any) => lease.status === LeaseStatus.PENDING
            ).length,
            expired: tenantLeases.filter(
              (lease: any) => lease.status === LeaseStatus.EXPIRED
            ).length,
            terminated: tenantLeases.filter(
              (lease: any) => lease.status === LeaseStatus.TERMINATED
            ).length,
            expiringThisMonth: tenantLeases.filter((lease: any) => {
              const endDate = new Date(lease.endDate);
              const daysUntilExpiration = Math.ceil(
                (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              );
              return daysUntilExpiration <= 30 && daysUntilExpiration > 0;
            }).length,
          };

          setStats(statsData);
        }
      } else {
        // For admin/manager, use the existing lease service
        const statsData = await leaseService.getLeaseStats();
        setStats(statsData);
      }
    } catch {
      // Silently fail for stats - not critical
    }
  };

  const handleSearch = useCallback((value: string) => {
    setIsSearching(true);
    setSearchTerm(value);
    setFilters((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handleStatusFilter = (status: string) => {
    console.log("🎯 handleStatusFilter called with:", status);
    const newStatus = status === "all" ? undefined : (status as LeaseStatus);
    console.log("🎯 Setting filters.status to:", newStatus);
    setFilters((prev) => ({
      ...prev,
      status: newStatus,
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

  useEffect(() => {
    if (status === "authenticated" && session?.user && isTenant) {
      router.replace("/dashboard/leases/my-leases");
    }
  }, [status, session, isTenant, router]);

  // Initial load effect - runs once on mount
  useEffect(() => {
    fetchLeases(filters, true); // Show full loading on initial load
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect to refetch when filters change (but not on initial mount)
  useEffect(() => {
    if (!isInitialLoad) {
      fetchLeases(filters, false); // Don't show full loading during search
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Force re-render when currency changes to update all currency displays
  useEffect(() => {
    // This effect will trigger a re-render when currentCurrency changes
    // The formatCurrency function from the context will use the new currency
  }, [currentCurrency]);

  // Show loading while checking authentication
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render anything for tenants (they'll be redirected)
  if (session?.user && isTenant) {
    return null;
  }

  const handleLeaseUpdate = () => {
    fetchLeases(filters, false);
    fetchStats();
  };

  // Helper function to calculate days remaining
  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Define columns for the DataTable
  const leaseColumns: DataTableColumn<LeaseResponse>[] = [
    {
      id: "propertyUnit",
      header: t("leases.table.propertyUnit"),
      cell: (lease) => {
        const propertyContent = (
          <>
            <div className="flex-shrink-0">
              <Home className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {lease.propertyId?.name ||
                  t("leases.labels.propertyNotAvailable")}
                {lease.unit && (
                  <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {t("leases.labels.unit")} {lease.unit.unitNumber}
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {lease.propertyId?.address ? (
                  <>
                    {lease.propertyId.address.street},{" "}
                    {lease.propertyId.address.city}
                  </>
                ) : (
                  <span className="text-gray-400 italic">
                    {t("leases.labels.addressNotAvailable")}
                  </span>
                )}
              </div>
            </div>
          </>
        );

        if (!lease.propertyId?._id) {
          return (
            <div className="flex items-center space-x-3">{propertyContent}</div>
          );
        }

        return (
          <Link
            href={`/dashboard/properties/${lease.propertyId._id}`}
            className="group flex items-center space-x-3 text-foreground transition-colors"
          >
            {propertyContent}
          </Link>
        );
      },
      className: "min-w-[200px]",
    },
    {
      id: "tenant",
      header: t("leases.table.tenant"),
      cell: (lease) => {
        const tenantContent = (
          <>
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={lease.tenantId?.avatar}
                alt={`${lease.tenantId?.firstName || ""} ${
                  lease.tenantId?.lastName || ""
                }`}
              />
              <AvatarFallback>
                {lease.tenantId?.firstName?.[0] || "T"}
                {lease.tenantId?.lastName?.[0] || ""}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {lease.tenantId?.firstName && lease.tenantId?.lastName
                  ? `${lease.tenantId.firstName} ${lease.tenantId.lastName}`
                  : t("leases.labels.unknownTenant")}
              </div>
              <div className="text-sm text-muted-foreground">
                {lease.tenantId?.email || t("leases.labels.noEmail")}
              </div>
            </div>
          </>
        );

        if (!lease.tenantId?._id) {
          return <div className="flex items-center space-x-3">{tenantContent}</div>;
        }

        return (
          <Link
            href={`/dashboard/tenants/${lease.tenantId._id}`}
            className="group flex items-center space-x-3 text-foreground transition-colors"
          >
            {tenantContent}
          </Link>
        );
      },
    },
    {
      id: "status",
      header: t("leases.table.status"),
      cell: (lease) => <LeaseStatusBadge status={lease.status} />,
    },
    {
      id: "rentAmount",
      header: t("leases.table.rentAmount"),
      visibility: "md",
      cell: (lease) => (
        <div>
          <div className="font-medium">
            {formatCurrency(lease.unit?.rentAmount || lease.terms?.rentAmount)}
          </div>
          <div className="text-sm text-muted-foreground">
            {t("leases.labels.perMonth")}
          </div>
        </div>
      ),
    },
    {
      id: "startDate",
      header: t("leases.table.startDate"),
      visibility: "lg",
      cell: (lease) => (
        <div className="text-sm">
          {new Date(lease.startDate).toLocaleDateString()}
        </div>
      ),
    },
    {
      id: "endDate",
      header: t("leases.table.endDate"),
      visibility: "lg",
      cell: (lease) => (
        <div className="text-sm">
          {new Date(lease.endDate).toLocaleDateString()}
        </div>
      ),
    },
    {
      id: "daysRemaining",
      header: t("leases.table.daysRemaining"),
      visibility: "md",
      cell: (lease) => {
        const daysRemaining = getDaysRemaining(lease.endDate);
        return (
          <div
            className={`text-sm font-medium ${
              daysRemaining < 0
                ? "text-red-600"
                : daysRemaining <= 30
                ? "text-orange-600"
                : "text-green-600"
            }`}
          >
            {daysRemaining < 0
              ? t("leases.labels.expired")
              : t("leases.labels.days", { values: { days: daysRemaining } })}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: t("leases.table.actions"),
      align: "right",
      cell: (lease) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => router.push(`/dashboard/leases/${lease._id}`)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {t("leases.actions.viewDetails")}
            </DropdownMenuItem>
            {!isTenant && (
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/dashboard/leases/${lease._id}/edit`)
                }
              >
                <Edit className="h-4 w-4 mr-2" />
                {t("leases.actions.editLease")}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <LeaseInvoiceModal
              lease={lease}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t("leases.actions.viewInvoice")}
                </DropdownMenuItem>
              }
            />
            <LeaseInvoiceModal
              lease={lease}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Download className="h-4 w-4 mr-2" />
                  {t("leases.actions.downloadInvoice")}
                </DropdownMenuItem>
              }
            />
            <DropdownMenuSeparator />
            {/* Active leases can only be terminated (preserves finance) */}
            {lease.status === LeaseStatus.ACTIVE && (
              <DropdownMenuItem
                onClick={() => {
                  setLeaseToTerminate(lease);
                  setShowTerminateDialog(true);
                }}
                className="text-orange-600 focus:text-orange-600"
              >
                <XCircle className="h-4 w-4 mr-2" />
                {t("leases.actions.terminate", {
                  defaultValue: "Terminate Lease",
                })}
              </DropdownMenuItem>
            )}

            {/* Archived view: allow restoring */}
            {filters.archived && (
              <DropdownMenuItem onClick={() => handleUnarchiveLease(lease)}>
                <ArchiveRestore className="h-4 w-4 mr-2" />
                {t("leases.actions.unarchive", { defaultValue: "Restore" })}
              </DropdownMenuItem>
            )}

            {/* Ended leases (not archived view) can be archived to declutter */}
            {!filters.archived &&
              (lease.status === LeaseStatus.TERMINATED ||
                lease.status === LeaseStatus.EXPIRED) && (
                <DropdownMenuItem onClick={() => handleArchiveLease(lease)}>
                  <Archive className="h-4 w-4 mr-2" />
                  {t("leases.actions.archive", { defaultValue: "Archive" })}
                </DropdownMenuItem>
              )}

            {/* Only draft leases (no financial records) can be deleted */}
            {lease.status === LeaseStatus.DRAFT && (
              <DeleteConfirmationDialog
                itemName={
                  `${
                    lease.propertyId?.name ||
                    t("leases.labels.propertyNotAvailable")
                  } - ` +
                  `${
                    lease.tenantId?.firstName && lease.tenantId?.lastName
                      ? `${lease.tenantId.firstName} ${lease.tenantId.lastName}`
                      : t("leases.labels.unknownTenant")
                  }`
                }
                itemType="lease"
                onConfirm={async () => {
                  try {
                    setIsDeleting(true);
                    await leaseService.deleteLease(lease._id);
                    showSimpleSuccess(
                      "Lease Deleted",
                      t("leases.toasts.deleteSuccess")
                    );
                    setLeases((prev) =>
                      prev.filter((l) => l._id !== lease._id)
                    );
                    setStats((prev) => ({
                      ...prev,
                      total: Math.max(0, prev.total - 1),
                    }));
                  } catch (error) {
                    showSimpleError(
                      "Delete Failed",
                      error instanceof Error
                        ? error.message
                        : t("leases.toasts.deleteError")
                    );
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                loading={isDeleting}
              >
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("leases.actions.delete")}
                </DropdownMenuItem>
              </DeleteConfirmationDialog>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleLeaseDelete = async () => {
    if (!leaseToDelete) return;

    try {
      // setIsDeleting(true);
      await leaseService.deleteLease(leaseToDelete._id);
      showSimpleSuccess("Lease Deleted", "Lease deleted successfully");
      setLeases((prev) =>
        prev.filter((lease) => lease._id !== leaseToDelete._id)
      );
      setStats((prev) => ({ ...prev, total: prev.total - 1 }));
      fetchLeases(filters, false); // Refresh the list to ensure consistency
    } catch {
      showSimpleError("Delete Failed", "Failed to delete lease");
    } finally {
      // setIsDeleting(false);
      setLeaseToDelete(null);
    }
  };

  const handleTerminateLease = async () => {
    const lease = leaseToTerminate;
    if (!lease) return;

    try {
      setIsTerminating(true);
      // Terminate the lease: frees the unit and stops future charges while
      // keeping all financial history (invoices, payments) intact.
      const updated = await leaseService.changeLeaseStatus(
        lease._id,
        LeaseStatus.TERMINATED
      );
      showSimpleSuccess(
        "Lease Terminated",
        "Lease terminated successfully. Financial records have been preserved."
      );
      // Keep the lease in the list but reflect its new status
      setLeases((prev) =>
        prev.map((l) =>
          l._id === lease._id
            ? { ...l, status: updated?.status ?? LeaseStatus.TERMINATED }
            : l
        )
      );
      setStats((prev) => ({
        ...prev,
        active: Math.max(0, prev.active - 1),
        terminated: prev.terminated + 1,
      }));
    } catch (error) {
      showSimpleError(
        "Termination Failed",
        error instanceof Error ? error.message : "Failed to terminate lease"
      );
    } finally {
      setIsTerminating(false);
      setShowTerminateDialog(false);
      setLeaseToTerminate(null);
    }
  };

  const handleArchiveLease = async (lease: LeaseResponse) => {
    try {
      await leaseService.archiveLease(lease._id);
      showSimpleSuccess(
        "Lease Archived",
        "Lease archived. It's hidden from the list but kept for your records."
      );
      // Remove from the current (non-archived) list
      setLeases((prev) => prev.filter((l) => l._id !== lease._id));
    } catch (error) {
      showSimpleError(
        "Archive Failed",
        error instanceof Error ? error.message : "Failed to archive lease"
      );
    }
  };

  const handleUnarchiveLease = async (lease: LeaseResponse) => {
    try {
      await leaseService.unarchiveLease(lease._id);
      showSimpleSuccess("Lease Restored", "Lease restored to the active list.");
      // Remove from the current (archived) list view
      setLeases((prev) => prev.filter((l) => l._id !== lease._id));
    } catch (error) {
      showSimpleError(
        "Restore Failed",
        error instanceof Error ? error.message : "Failed to restore lease"
      );
    }
  };

  const handleBulkDelete = async () => {
    try {
      await leaseService.bulkDeleteLeases(selectedLeases);
      showSimpleSuccess(
        "Leases Deleted",
        `${selectedLeases.length} leases deleted successfully`
      );
      setSelectedLeases([]);
      setShowBulkDeleteDialog(false);
      fetchLeases(filters, false);
      fetchStats();
    } catch {
      showSimpleError("Delete Failed", "Failed to delete leases");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl">
            {t("leases.header.title")}
          </h1>
          <p className="text-muted-foreground">{t("leases.header.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => router.push("/dashboard/leases/new")}>
          <Plus className="mr-2 h-4 w-4" />
          {t("leases.actions.createLease")}
        </Button>
      </div>

      {/* Stats Cards */}
      <AnalyticsCardGrid className="md:grid-cols-3 lg:grid-cols-6">
        <AnalyticsCard
          title={t("leases.stats.total")}
          value={stats.total}
          icon={FileText}
          iconColor="primary"
        />

        <AnalyticsCard
          title={t("leases.stats.active")}
          value={stats.active}
          icon={CheckCircle}
          iconColor="success"
        />

        <AnalyticsCard
          title={t("leases.stats.pending")}
          value={stats.pending}
          icon={Clock}
          iconColor="warning"
        />

        <AnalyticsCard
          title={t("leases.stats.expired")}
          value={stats.expired}
          icon={XCircle}
          iconColor="error"
        />

        <AnalyticsCard
          title={t("leases.stats.terminated")}
          value={stats.terminated}
          icon={XCircle}
          iconColor="error"
        />

        <AnalyticsCard
          title={t("leases.stats.expiring")}
          value={stats.expiringThisMonth}
          icon={AlertTriangle}
          iconColor="warning"
        />
      </AnalyticsCardGrid>

      {/* Leases Display with Integrated Filters */}
      <Card className="gap-2">
        <CardHeader>
          {/* Main Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t("leases.header.title")}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("leases.header.subtitle")}
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
                  <Grid3X3 className="h-4 w-4" />
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
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/60 dark:border-gray-700/60">
            {/* Search - Using GlobalSearch with 300ms debounce */}
            <GlobalSearch
              placeholder={t("leases.filters.searchPlaceholder")}
              initialValue={searchTerm}
              debounceDelay={300}
              onSearch={handleSearch}
              isLoading={isSearching}
              className="flex-1 min-w-0"
              ariaLabel="Search leases"
            />

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Status Filter */}
              <Select
                value={filters.status || "all"}
                onValueChange={handleStatusFilter}
              >
                <SelectTrigger className="w-[140px] h-10 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <SelectValue placeholder={t("leases.filters.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("leases.filters.allStatus")}
                  </SelectItem>
                  <SelectItem value="draft">
                    {t("leases.status.draft")}
                  </SelectItem>
                  <SelectItem value="pending">
                    {t("leases.status.pending")}
                  </SelectItem>
                  <SelectItem value="active">
                    {t("leases.status.active")}
                  </SelectItem>
                  <SelectItem value="expired">
                    {t("leases.status.expired")}
                  </SelectItem>
                  <SelectItem value="terminated">
                    {t("leases.status.terminated")}
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Archived toggle */}
              <Button
                variant={filters.archived ? "default" : "outline"}
                className="h-10"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    archived: !prev.archived,
                    page: 1,
                  }))
                }
              >
                <Archive className="h-4 w-4 mr-2" />
                {filters.archived
                  ? t("leases.actions.viewActive", {
                      defaultValue: "View Active",
                    })
                  : t("leases.actions.viewArchived", {
                      defaultValue: "Archived",
                    })}
              </Button>

              {/* Sort */}
              <Select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onValueChange={(value) => {
                  const [sortBy, sortOrder] = value.split("-");
                  handleSort(sortBy, sortOrder as "asc" | "desc");
                }}
              >
                <SelectTrigger className="w-[140px] h-10 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <SelectValue placeholder={t("leases.filters.sort")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">
                    {t("leases.sort.newestFirst")}
                  </SelectItem>
                  <SelectItem value="createdAt-asc">
                    {t("leases.sort.oldestFirst")}
                  </SelectItem>
                  <SelectItem value="startDate-desc">
                    {t("leases.sort.startDateLatest")}
                  </SelectItem>
                  <SelectItem value="endDate-asc">
                    {t("leases.sort.endDateSoonest")}
                  </SelectItem>
                  <SelectItem value="terms.rentAmount-desc">
                    {t("leases.sort.rentHighToLow")}
                  </SelectItem>
                  <SelectItem value="terms.rentAmount-asc">
                    {t("leases.sort.rentLowToHigh")}
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {(searchTerm || filters.status) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setFilters({
                      page: 1,
                      limit: 12,
                      search: "",
                      status: undefined,
                      sortBy: "createdAt",
                      sortOrder: "desc",
                    });
                  }}
                  className="h-10 px-3 text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4 mr-1" />
                  {t("leases.filters.clear") || "Clear"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "cards" ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <Card key={i} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-5 w-5 rounded" />
                            <Skeleton className="h-5 w-32" />
                          </div>
                          <div className="flex items-center gap-1">
                            <Skeleton className="h-4 w-24" />
                            <span>•</span>
                            <Skeleton className="h-4 w-20" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-16 rounded-full" />
                          <Skeleton className="h-8 w-8 rounded" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-14" />
                          <Skeleton className="h-4 w-18" />
                        </div>
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-8 w-20 rounded" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : leases.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <div className="text-muted-foreground">
                    {filters.search || filters.status
                      ? t("leases.empty.noMatches")
                      : t("leases.empty.noLeases")}
                  </div>
                </div>
              ) : (
                leases.map((lease) => (
                  <LeaseCard
                    key={lease._id}
                    lease={lease}
                    onUpdate={handleLeaseUpdate}
                    // onDelete={handleLeaseDelete}
                  />
                ))
              )}
            </div>
          ) : (
            <DataTable<LeaseResponse>
              columns={leaseColumns}
              data={leases}
              loading={loading}
              loadingConfig={{
                rows: 6,
                columnSkeletons: {
                  propertyUnit: (
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ),
                  tenant: (
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ),
                  status: <Skeleton className="h-6 w-16 rounded-full" />,
                  rentAmount: (
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  ),
                  startDate: <Skeleton className="h-4 w-16" />,
                  endDate: <Skeleton className="h-4 w-20" />,
                  daysRemaining: <Skeleton className="h-4 w-20" />,
                  actions: <Skeleton className="h-8 w-8 rounded" />,
                },
              }}
              getRowKey={(lease) => lease._id}
              emptyState={{
                icon: <FileText className="h-8 w-8 text-gray-400" />,
                title: t("leases.empty.noLeases"),
                description: t("leases.empty.noLeasesDescription"),
                action: (
                  <Button onClick={() => router.push("/dashboard/leases/new")}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("leases.actions.createLease")}
                  </Button>
                ),
              }}
            />
          )}
          {pagination.total > 0 && (
            <GlobalPagination
              currentPage={filters.page || 1}
              totalPages={pagination.pages}
              totalItems={pagination.total}
              pageSize={filters.limit ?? 12}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              showingLabel={t("common.showing", { defaultValue: "Showing" })}
              previousLabel={t("common.previous", { defaultValue: "Previous" })}
              nextLabel={t("common.next", { defaultValue: "Next" })}
              pageLabel={t("common.page", { defaultValue: "Page" })}
              ofLabel={t("common.of", { defaultValue: "of" })}
              itemsPerPageLabel={t("common.perPage", {
                defaultValue: "per page",
              })}
              disabled={loading || isSearching}
            />
          )}
        </CardContent>
      </Card>

      {/* Bulk Delete Dialog */}
      <AlertDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leases</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedLeases.length} selected
              lease(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Leases
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terminate Lease Dialog */}
      <AlertDialog
        open={showTerminateDialog}
        onOpenChange={setShowTerminateDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              {t("leases.actions.terminate", {
                defaultValue: "Terminate Lease",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {leaseToTerminate ? (
                <>
                  This will terminate the lease for{" "}
                  <span className="font-medium">
                    {leaseToTerminate.propertyId?.name ||
                      t("leases.labels.propertyNotAvailable")}
                  </span>
                  {leaseToTerminate.tenantId?.firstName
                    ? ` (${leaseToTerminate.tenantId.firstName} ${
                        leaseToTerminate.tenantId.lastName ?? ""
                      })`
                    : ""}
                  . The unit will be freed and future charges stop. All invoices
                  and payment history are kept for your records. This action
                  cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={isTerminating}>
              {t("leases.dialog.bulkDelete.cancel")}
            </AlertDialogCancel>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={isTerminating}
              onClick={handleTerminateLease}
            >
              {isTerminating
                ? t("leases.actions.terminating", {
                    defaultValue: "Terminating...",
                  })
                : t("leases.actions.terminate", {
                    defaultValue: "Terminate Lease",
                  })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
