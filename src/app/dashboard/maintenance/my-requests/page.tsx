"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AnalyticsCard,
  AnalyticsCardGrid,
} from "@/components/analytics/AnalyticsCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Wrench,
  Plus,
  Eye,
  Calendar,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  ArrowLeft,
  Loader2,
  X,
} from "lucide-react";
import {
  MaintenancePriority,
  MaintenanceStatus,
  IMaintenanceRequest,
} from "@/types";
import { toast } from "sonner";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import { GlobalSearch } from "@/components/ui/global-search";
import { useAuthorization } from "@/hooks/useAuthorization";

interface MaintenanceRequestWithPopulated
  extends Omit<IMaintenanceRequest, "propertyId" | "assignedTo"> {
  propertyId: {
    _id: string;
    name: string;
    address: any;
  };
  assignedTo?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
}

export default function TenantMaintenanceRequestsPage() {
  const { data: session } = useSession();
  const { isTenant } = useAuthorization();
  const { t, formatDate: formatLocalizedDate } = useLocalizationContext();
  const [maintenanceRequests, setMaintenanceRequests] = useState<
    MaintenanceRequestWithPopulated[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isSearching, setIsSearching] = useState(false);

  // Redirect non-tenant users
  useEffect(() => {
    if (session?.user && !isTenant) {
      window.location.href = "/dashboard/maintenance";
    }
  }, [session, isTenant]);

  useEffect(() => {
    if (session?.user && isTenant) {
      fetchMaintenanceRequests();
    }
  }, [session, isTenant, statusFilter, priorityFilter, categoryFilter]);

  const fetchMaintenanceRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      if (categoryFilter !== "all") params.append("category", categoryFilter);

      const response = await fetch(
        `/api/tenant/maintenance?${params.toString()}`
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.error || t("maintenance.myRequests.toasts.loadError")
        );
      }

      const data = await response.json();
      setMaintenanceRequests(data.data?.maintenanceRequests || []);
    } catch (error: any) {
      const errorMessage =
        error.message || t("maintenance.myRequests.toasts.loadError");
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchMaintenanceRequests();
  };

  const handleSearch = (value: string) => {
    setIsSearching(true);
    setSearchTerm(value);
    setTimeout(() => setIsSearching(false), 100);
  };

  const filteredRequests = maintenanceRequests.filter((request) => {
    const matchesSearch =
      (request?.title?.toLowerCase() || "").includes(
        searchTerm.toLowerCase()
      ) ||
      (request?.description?.toLowerCase() || "").includes(
        searchTerm.toLowerCase()
      ) ||
      (request?.propertyId?.name?.toLowerCase() || "").includes(
        searchTerm.toLowerCase()
      );

    return matchesSearch;
  });

  const openRequests = filteredRequests.filter((request) =>
    [MaintenanceStatus.SUBMITTED, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS].includes(
      request.status
    )
  ).length;

  const highPriorityRequests = filteredRequests.filter((request) =>
    [MaintenancePriority.EMERGENCY, MaintenancePriority.HIGH].includes(
      request.priority
    )
  ).length;

  const formatRequestDate = (dateString: string) => {
    return formatLocalizedDate(new Date(dateString), {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const categoryLabel = (category?: string) => {
    const keyByValue: Record<string, string> = {
      Plumbing: "plumbing",
      Electrical: "electrical",
      HVAC: "hvac",
      Appliances: "appliances",
      Flooring: "flooring",
      Painting: "painting",
      Roofing: "roofing",
      Windows: "windows",
      Doors: "doors",
      Landscaping: "landscaping",
      Cleaning: "cleaning",
      "Pest Control": "pestControl",
      "General Repair": "generalRepair",
      Emergency: "emergency",
      Autre: "other",
    };
    const key = category ? keyByValue[category] : undefined;
    return key ? t(`maintenance.categories.${key}`) : category || "—";
  };

  const statusLabel = (requestStatus: MaintenanceStatus) => {
    const key =
      requestStatus === MaintenanceStatus.IN_PROGRESS
        ? "inProgress"
        : String(requestStatus).toLowerCase();
    return t(`maintenance.status.${key}`, {
      defaultValue: String(requestStatus).replaceAll("_", " "),
    });
  };

  const priorityLabel = (priority: MaintenancePriority) =>
    t(`maintenance.form.priority.${String(priority).toLowerCase()}`, {
      defaultValue: String(priority),
    });

  const getPriorityColor = (priority: MaintenancePriority) => {
    switch (priority) {
      case MaintenancePriority.EMERGENCY:
        return "destructive";
      case MaintenancePriority.HIGH:
        return "destructive";
      case MaintenancePriority.MEDIUM:
        return "default";
      case MaintenancePriority.LOW:
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getStatusColor = (status: MaintenanceStatus) => {
    switch (status) {
      case MaintenanceStatus.COMPLETED:
        return "default";
      case MaintenanceStatus.IN_PROGRESS:
        return "default";
      case MaintenanceStatus.ASSIGNED:
        return "secondary";
      case MaintenanceStatus.SUBMITTED:
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: MaintenanceStatus) => {
    switch (status) {
      case MaintenanceStatus.COMPLETED:
        return <CheckCircle className="h-4 w-4" />;
      case MaintenanceStatus.IN_PROGRESS:
        return <Clock className="h-4 w-4" />;
      case MaintenanceStatus.ASSIGNED:
        return <Clock className="h-4 w-4" />;
      case MaintenanceStatus.SUBMITTED:
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // Redirect non-tenant users (this will be handled by useEffect)
  if (!session || !isTenant) {
    return null;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("maintenance.myRequests.header.backToDashboard")}
              </Button>
            </Link>
            <div>
              <h1 className="text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl">
                {t("maintenance.myRequests.header.title")}
              </h1>
              <p className="text-muted-foreground">
                {t("maintenance.myRequests.header.subtitle")}
              </p>
            </div>
          </div>
          <Link href="/dashboard/maintenance/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("maintenance.myRequests.header.newRequest")}
            </Button>
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">
            {t("maintenance.myRequests.error.title")}
          </h2>
          <p className="text-muted-foreground text-center">{error}</p>
          <Button onClick={fetchMaintenanceRequests}>
            {t("maintenance.myRequests.error.tryAgain")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="tenant-account-page min-w-0 space-y-3 sm:space-y-6">
      <div className="mobile-page-header flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
            <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {t("maintenance.myRequests.header.title")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("maintenance.myRequests.header.subtitle")}
            </p>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 px-2 sm:w-auto sm:px-3"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            {t("maintenance.myRequests.error.tryAgain")}
          </Button>
          <Link href="/dashboard/maintenance/new">
            <Button size="sm" className="w-full gap-2 px-2 sm:w-auto sm:px-3">
              <Plus className="h-4 w-4" />
              {t("maintenance.myRequests.header.newRequest")}
            </Button>
          </Link>
        </div>
      </div>

      <AnalyticsCardGrid className="md:grid-cols-2 lg:grid-cols-4">
        <AnalyticsCard
          title={t("maintenance.myRequests.stats.totalRequests", {
            defaultValue: "Total des demandes",
          })}
          value={maintenanceRequests.length}
          description={t("maintenance.myRequests.stats.allLoadedRequests", {
            defaultValue: "Toutes les demandes chargées",
          })}
          icon={Wrench}
          iconColor="primary"
        />
        <AnalyticsCard
          title={t("maintenance.myRequests.stats.filteredResults", {
            defaultValue: "Résultats filtrés",
          })}
          value={filteredRequests.length}
          description={t("maintenance.myRequests.stats.matchingFilters", {
            defaultValue: "Correspondant aux filtres actuels",
          })}
          icon={Search}
          iconColor="info"
        />
        <AnalyticsCard
          title={t("maintenance.myRequests.stats.openRequests", {
            defaultValue: "Demandes ouvertes",
          })}
          value={openRequests}
          description={t("maintenance.myRequests.stats.awaitingAction", {
            defaultValue: "En attente d’action",
          })}
          icon={Clock}
          iconColor="warning"
        />
        <AnalyticsCard
          title={t("maintenance.myRequests.stats.highPriority", {
            defaultValue: "Priorité élevée",
          })}
          value={highPriorityRequests}
          description={t("maintenance.myRequests.stats.needsAttention", {
            defaultValue: "Nécessite une attention",
          })}
          icon={AlertTriangle}
          iconColor="error"
        />
      </AnalyticsCardGrid>

      <Card className="mobile-app-section gap-2">
        <CardHeader className="px-3 sm:px-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
              <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t("maintenance.myRequests.header.title")} ({filteredRequests.length})
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("maintenance.myRequests.header.subtitle")}
              </p>
            </div>
          </div>

          <div className="mobile-filter-panel flex flex-col gap-2 rounded-xl border border-gray-200/60 bg-gray-50/50 p-2.5 dark:border-gray-700/60 dark:bg-gray-800/50 sm:p-4 lg:flex-row lg:items-center lg:gap-4">
            <GlobalSearch
              placeholder={t(
                "maintenance.myRequests.filters.searchPlaceholder"
              )}
              initialValue={searchTerm}
              debounceDelay={300}
              onSearch={handleSearch}
              isLoading={isSearching}
              className="flex-1 min-w-0"
              ariaLabel={t("maintenance.myRequests.filters.search")}
            />

            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-full border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:w-[160px]">
                  <SelectValue
                    placeholder={t(
                      "maintenance.myRequests.filters.statusPlaceholder"
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("maintenance.myRequests.filters.allStatuses")}
                  </SelectItem>
                  <SelectItem value="submitted">
                    {t("maintenance.myRequests.filters.submitted")}
                  </SelectItem>
                  <SelectItem value="assigned">
                    {t("maintenance.myRequests.filters.assigned")}
                  </SelectItem>
                  <SelectItem value="in_progress">
                    {t("maintenance.myRequests.filters.inProgress")}
                  </SelectItem>
                  <SelectItem value="completed">
                    {t("maintenance.myRequests.filters.completed")}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-10 w-full border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:w-[160px]">
                  <SelectValue
                    placeholder={t(
                      "maintenance.myRequests.filters.priorityPlaceholder"
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("maintenance.myRequests.filters.allPriorities")}
                  </SelectItem>
                  <SelectItem value="emergency">
                    {t("maintenance.myRequests.filters.emergency")}
                  </SelectItem>
                  <SelectItem value="high">
                    {t("maintenance.myRequests.filters.high")}
                  </SelectItem>
                  <SelectItem value="medium">
                    {t("maintenance.myRequests.filters.medium")}
                  </SelectItem>
                  <SelectItem value="low">
                    {t("maintenance.myRequests.filters.low")}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-10 w-full border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 sm:w-[160px]">
                  <SelectValue
                    placeholder={t(
                      "maintenance.myRequests.filters.categoryPlaceholder"
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("maintenance.myRequests.filters.allCategories")}
                  </SelectItem>
                  <SelectItem value="Plumbing">{categoryLabel("Plumbing")}</SelectItem>
                  <SelectItem value="Electrical">{categoryLabel("Electrical")}</SelectItem>
                  <SelectItem value="HVAC">CVC</SelectItem>
                  <SelectItem value="Appliances">{categoryLabel("Appliances")}</SelectItem>
                  <SelectItem value="Autre">Autre</SelectItem>
                </SelectContent>
              </Select>

              {(searchTerm ||
                statusFilter !== "all" ||
                priorityFilter !== "all" ||
                categoryFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setPriorityFilter("all");
                    setCategoryFilter("all");
                  }}
                  className="h-10 px-3 text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4 mr-1" />
                  Effacer
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 border rounded"
                >
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20 ml-auto" />
                </div>
              ))}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Wrench className="h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-semibold">
                {searchTerm ||
                statusFilter !== "all" ||
                priorityFilter !== "all" ||
                categoryFilter !== "all"
                  ? t("maintenance.myRequests.empty.noMatching")
                  : t("maintenance.myRequests.empty.noRequests")}
              </h3>
              <p className="text-muted-foreground text-center">
                {searchTerm ||
                statusFilter !== "all" ||
                priorityFilter !== "all" ||
                categoryFilter !== "all"
                  ? t("maintenance.myRequests.empty.noMatchingDescription")
                  : t("maintenance.myRequests.empty.noRequestsDescription")}
              </p>
              {!searchTerm &&
                statusFilter === "all" &&
                priorityFilter === "all" &&
                categoryFilter === "all" && (
                  <Link href="/dashboard/maintenance/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("maintenance.myRequests.empty.submitFirst")}
                    </Button>
                  </Link>
                )}
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {filteredRequests.map((request) => (
                  <article
                    key={request._id.toString()}
                    className="min-w-0 rounded-xl border bg-card p-3 shadow-sm"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold" title={request.title}>
                          {request.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {request.description}
                        </p>
                      </div>
                      <Badge variant={getPriorityColor(request.priority)} className="shrink-0">
                        {priorityLabel(request.priority)}
                      </Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div className="min-w-0">
                        <span className="text-muted-foreground">Propriété</span>
                        <p className="truncate font-medium" title={request.propertyId?.name}>
                          {request.propertyId?.name || "Non renseignée"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Statut</span>
                        <div className="mt-0.5 flex min-w-0 items-center gap-1">
                          {getStatusIcon(request.status)}
                          <span className="truncate font-medium">{statusLabel(request.status)}</span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <span className="text-muted-foreground">Attribuée à</span>
                        <p className="truncate font-medium">
                          {request.assignedTo
                            ? `${request.assignedTo.firstName} ${request.assignedTo.lastName}`
                            : t("maintenance.myRequests.table.unassigned")}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Créée le</span>
                        <p className="font-medium">
                          {formatRequestDate(
                            typeof request.createdAt === "string"
                              ? request.createdAt
                              : request.createdAt.toISOString()
                          )}
                        </p>
                      </div>
                    </div>

                    <Button asChild variant="outline" size="sm" className="mt-3 w-full whitespace-nowrap">
                      <Link href={`/dashboard/maintenance/${request._id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        {t("maintenance.myRequests.table.view")}
                      </Link>
                    </Button>
                  </article>
                ))}
              </div>

              <div className="hidden max-w-full overflow-x-auto rounded-md border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t("maintenance.myRequests.table.request")}
                    </TableHead>
                    <TableHead>
                      {t("maintenance.myRequests.table.property")}
                    </TableHead>
                    <TableHead>
                      {t("maintenance.myRequests.table.priority")}
                    </TableHead>
                    <TableHead>
                      {t("maintenance.myRequests.table.status")}
                    </TableHead>
                    <TableHead>
                      {t("maintenance.myRequests.table.assignedTo")}
                    </TableHead>
                    <TableHead>
                      {t("maintenance.myRequests.table.created")}
                    </TableHead>
                    <TableHead>
                      {t("maintenance.myRequests.table.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request._id.toString()}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {request.description?.substring(0, 60)}
                            {request.description &&
                              request.description.length > 60 &&
                              "..."}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {request.propertyId?.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPriorityColor(request.priority)}>
                          {priorityLabel(request.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(request.status)}
                          <Badge variant={getStatusColor(request.status)}>
                            {statusLabel(request.status)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {request.assignedTo ? (
                          <div className="text-sm">
                            {request.assignedTo.firstName}{" "}
                            {request.assignedTo.lastName}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {t("maintenance.myRequests.table.unassigned")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {formatRequestDate(
                              typeof request.createdAt === "string"
                                ? request.createdAt
                                : request.createdAt.toISOString()
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/maintenance/${request._id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            {t("maintenance.myRequests.table.view")}
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
