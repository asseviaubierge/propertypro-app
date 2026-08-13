"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthorization } from "@/hooks/useAuthorization";

interface MaintenanceRow {
  _id: string;
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
  scheduledDate?: string;
  property?: {
    _id?: string;
    name?: string;
    address?: {
      city?: string;
      state?: string;
    };
  } | null;
  tenant?: {
    user?: {
      _id?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
    };
  } | null;
  assignedTo?: {
    firstName?: string;
    lastName?: string;
  } | null;
}

const statusLabels: Record<string, string> = {
  submitted: "Soumise",
  assigned: "Affectée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

const priorityLabels: Record<string, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Haute",
  emergency: "Urgence",
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normalizeRows(payload: unknown): MaintenanceRow[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as Record<string, unknown>;
  const candidate = body.data;

  if (Array.isArray(candidate)) return candidate.filter(Boolean) as MaintenanceRow[];
  if (candidate && typeof candidate === "object") {
    const nested = candidate as Record<string, unknown>;
    if (Array.isArray(nested.requests)) {
      return nested.requests.filter(Boolean) as MaintenanceRow[];
    }
    if (Array.isArray(nested.data)) {
      return nested.data.filter(Boolean) as MaintenanceRow[];
    }
  }

  if (Array.isArray(body.requests)) {
    return body.requests.filter(Boolean) as MaintenanceRow[];
  }
  return [];
}

export default function MaintenancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const { isTenant } = useAuthorization();

  const [rows, setRows] = useState<MaintenanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/maintenance?limit=100", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload?.error ||
          payload?.message ||
          `Impossible de charger les demandes (HTTP ${response.status})`;
        throw new Error(message);
      }

      setRows(normalizeRows(payload));
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Impossible de charger les demandes de maintenance";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (session?.user && isTenant) {
      router.replace("/dashboard/maintenance/my-requests");
      return;
    }
    if (session?.user) void loadRequests();
  }, [session, sessionStatus, isTenant, router, loadRequests]);

  useEffect(() => {
    if (searchParams.get("filter") === "urgent") {
      setPriorityFilter("urgent");
    }
  }, [searchParams]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const status = String(row.status || "").toLowerCase();
      const priority = String(row.priority || "").toLowerCase();
      const urgent = priority === "high" || priority === "emergency";
      const tenantName = `${row.tenant?.user?.firstName || ""} ${
        row.tenant?.user?.lastName || ""
      }`.toLowerCase();
      const haystack = [
        row.title,
        row.description,
        row.category,
        row.property?.name,
        tenantName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !needle || haystack.includes(needle);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" ||
        (priorityFilter === "urgent" ? urgent : priority === priorityFilter);

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [rows, search, statusFilter, priorityFilter]);

  const stats = useMemo(() => {
    const active = rows.filter((row) =>
      ["submitted", "assigned", "in_progress"].includes(
        String(row.status || "").toLowerCase(),
      ),
    ).length;
    const urgent = rows.filter((row) =>
      ["high", "emergency"].includes(String(row.priority || "").toLowerCase()),
    ).length;
    const completed = rows.filter(
      (row) => String(row.status || "").toLowerCase() === "completed",
    ).length;
    return { total: rows.length, active, urgent, completed };
  }, [rows]);

  if (sessionStatus === "loading" || (isTenant && session?.user)) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Toutes les demandes
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Consultez et suivez les demandes de maintenance de vos biens.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Button className="min-w-0 px-2 text-xs sm:px-4 sm:text-sm" variant="outline" onClick={() => void loadRequests()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          <Button asChild className="min-w-0 px-2 text-xs sm:px-4 sm:text-sm">
            <Link href="/dashboard/maintenance/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle demande
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></div><Wrench className="h-6 w-6 text-blue-600" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">Actives</p><p className="text-2xl font-bold">{stats.active}</p></div><Clock3 className="h-6 w-6 text-amber-600" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">Urgentes</p><p className="text-2xl font-bold">{stats.urgent}</p></div><AlertTriangle className="h-6 w-6 text-red-600" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">Terminées</p><p className="text-2xl font-bold">{stats.completed}</p></div><CheckCircle2 className="h-6 w-6 text-emerald-600" /></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle>Demandes de maintenance</CardTitle>
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher une demande..."
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="submitted">Soumise</SelectItem>
                <SelectItem value="assigned">Affectée</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="completed">Terminée</SelectItem>
                <SelectItem value="cancelled">Annulée</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger><SelectValue placeholder="Toutes les priorités" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les priorités</SelectItem>
                <SelectItem value="urgent">Urgentes</SelectItem>
                <SelectItem value="emergency">Urgence</SelectItem>
                <SelectItem value="high">Haute</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="low">Faible</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 text-center">
              <AlertTriangle className="h-10 w-10 text-red-600" />
              <div>
                <p className="font-semibold">Impossible d’afficher les demandes</p>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={() => void loadRequests()}>Réessayer</Button>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
              <Wrench className="h-10 w-10 text-muted-foreground" />
              <p className="font-semibold">Aucune demande trouvée</p>
              <p className="text-sm text-muted-foreground">
                Modifiez les filtres ou créez une nouvelle demande.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredRows.map((row) => {
                const status = String(row.status || "").toLowerCase();
                const priority = String(row.priority || "").toLowerCase();
                return (
                  <Link key={row._id} href={`/dashboard/maintenance/${row._id}`} className="block">
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="min-w-0 break-words text-base">
                            {row.title || "Demande sans titre"}
                          </CardTitle>
                          <Badge variant={priority === "emergency" || priority === "high" ? "destructive" : "secondary"}>
                            {priorityLabels[priority] || row.priority || "—"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <p className="line-clamp-2 break-words text-muted-foreground">
                          {row.description || "Aucune description"}
                        </p>
                        <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-muted-foreground" /><span className="break-words">{row.property?.name || "Bien non renseigné"}</span></div>
                        <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-muted-foreground" /><span className="break-words">{`${row.tenant?.user?.firstName || ""} ${row.tenant?.user?.lastName || ""}`.trim() || "Locataire non renseigné"}</span></div>
                        <div className="flex items-center justify-between gap-3 border-t pt-3">
                          <span className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" />{formatDate(row.createdAt)}</span>
                          <Badge variant="outline">{statusLabels[status] || row.status || "—"}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
