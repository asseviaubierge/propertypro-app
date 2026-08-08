"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, ClipboardCheck, FileText, Home, UserRound } from "lucide-react";
import { InspectionType } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { useAuthorization } from "@/hooks/useAuthorization";

interface PropertyOption {
  _id: string;
  name: string;
  address?: { street?: string; city?: string; state?: string };
}

interface LeaseOption {
  _id: string;
  propertyId: string | { _id?: string; name?: string };
  tenantId: string | { _id?: string; firstName?: string; lastName?: string; email?: string };
  status: string;
  startDate: string;
  endDate: string;
  unit?: { _id?: string; unitNumber?: string; name?: string };
  unitId?: string;
}

function idOf(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String((value as { _id?: unknown })._id ?? "");
}

function formatName(value: LeaseOption["tenantId"]): string {
  if (!value || typeof value === "string") return "Locataire du bail";
  return [value.firstName, value.lastName].filter(Boolean).join(" ") || value.email || "Locataire du bail";
}

function buildDate(day: string, month: string, year: string, hour: string, minute: string): string {
  if (!day || !month || !year || !hour || !minute) return "";
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) return "";
  return date.toISOString();
}

export default function NewInspectionPage() {
  const router = useRouter();
  const { status } = useSession();
  const { isCompanyStaff } = useAuthorization();

  const now = useMemo(() => new Date(), []);
  const [propertyId, setPropertyId] = useState("");
  const [leaseId, setLeaseId] = useState("");
  const [type, setType] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [day, setDay] = useState(String(now.getDate()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [hour, setHour] = useState(String(now.getHours()).padStart(2, "0"));
  const [minute, setMinute] = useState("00");
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    try {
      const [propertiesResponse, leasesResponse] = await Promise.all([
        fetch("/api/properties?limit=100", { cache: "no-store" }),
        fetch("/api/leases?limit=100&status=active", { cache: "no-store" }),
      ]);

      if (!propertiesResponse.ok) throw new Error("Impossible de charger les propriétés.");
      if (!leasesResponse.ok) throw new Error("Impossible de charger les baux actifs.");

      const [propertiesPayload, leasesPayload] = await Promise.all([
        propertiesResponse.json(),
        leasesResponse.json(),
      ]);

      setProperties(Array.isArray(propertiesPayload?.data) ? propertiesPayload.data : []);
      setLeases(Array.isArray(leasesPayload?.data) ? leasesPayload.data : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger les options.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!isCompanyStaff) {
      toast.error("Accès refusé.");
      router.replace("/dashboard");
      return;
    }
    void fetchOptions();
  }, [status, isCompanyStaff, router, fetchOptions]);

  useEffect(() => {
    setLeaseId("");
  }, [propertyId]);

  const selectedLease = useMemo(
    () => leases.find((lease) => lease._id === leaseId),
    [leases, leaseId],
  );

  const filteredLeases = useMemo(
    () => leases.filter((lease) => idOf(lease.propertyId) === propertyId && String(lease.status).toLowerCase() === "active"),
    [leases, propertyId],
  );

  const propertyOptions = useMemo<SearchableSelectOption[]>(
    () => properties.map((property) => ({
      value: property._id,
      label: property.name,
      subtitle: [property.address?.street, property.address?.city, property.address?.state].filter(Boolean).join(", "),
      icon: <Home className="h-4 w-4 text-muted-foreground" />,
    })),
    [properties],
  );

  const leaseOptions = useMemo<SearchableSelectOption[]>(
    () => filteredLeases.map((lease) => ({
      value: lease._id,
      label: lease.unit?.unitNumber
        ? `${lease.unit.unitNumber} — ${formatName(lease.tenantId)}`
        : `Bail actif — ${formatName(lease.tenantId)}`,
      subtitle: `${new Date(lease.startDate).toLocaleDateString("fr-FR")} au ${new Date(lease.endDate).toLocaleDateString("fr-FR")}`,
      icon: <FileText className="h-4 w-4 text-muted-foreground" />,
    })),
    [filteredLeases],
  );

  const typeOptions = useMemo<SearchableSelectOption[]>(() => [
    { value: InspectionType.MOVE_IN, label: "Inspection d’entrée", icon: <ClipboardCheck className="h-4 w-4" /> },
    { value: InspectionType.MOVE_OUT, label: "Inspection de sortie", icon: <ClipboardCheck className="h-4 w-4" /> },
    { value: InspectionType.ROUTINE, label: "Inspection de routine", icon: <ClipboardCheck className="h-4 w-4" /> },
    { value: InspectionType.MAINTENANCE, label: "Inspection de maintenance", icon: <ClipboardCheck className="h-4 w-4" /> },
  ], []);

  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  const years = Array.from({ length: 16 }, (_, index) => now.getFullYear() + index);
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const scheduledDate = buildDate(day, month, year, hour, minute);
    if (!propertyId || !type || !scheduledDate) {
      toast.error("La propriété, le type et la date sont obligatoires.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          leaseId: leaseId || undefined,
          type,
          scheduledDate,
          notes: notes || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Impossible de planifier l’inspection.");
      toast.success("Inspection planifiée avec succès.");
      router.push(`/dashboard/inspections/${payload.data._id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de planifier l’inspection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Planifier l’inspection</h1>
          <p className="text-muted-foreground">Créer une nouvelle inspection de propriété</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Détails de l’inspection</CardTitle>
            <CardDescription>Choisissez d’abord la propriété, puis éventuellement son bail actif.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Propriété *</Label>
              <SearchableSelect value={propertyId} onValueChange={setPropertyId} options={propertyOptions} placeholder="Sélectionner une propriété" disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label>Type d’inspection *</Label>
              <SearchableSelect value={type} onValueChange={setType} options={typeOptions} placeholder="Sélectionner un type" />
            </div>
            <div className="space-y-2">
              <Label>Date planifiée *</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <select className="h-10 rounded-md border bg-background px-3" value={day} onChange={(e) => setDay(e.target.value)}>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select className="h-10 rounded-md border bg-background px-3" value={month} onChange={(e) => setMonth(e.target.value)}>
                  {months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
                </select>
                <select className="h-10 rounded-md border bg-background px-3" value={year} onChange={(e) => setYear(e.target.value)}>
                  {years.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select className="h-10 rounded-md border bg-background px-3" value={hour} onChange={(e) => setHour(e.target.value)}>
                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((value) => <option key={value} value={value}>{value} h</option>)}
                </select>
                <select className="h-10 rounded-md border bg-background px-3" value={minute} onChange={(e) => setMinute(e.target.value)}>
                  {["00", "15", "30", "45"].map((value) => <option key={value} value={value}>{value} min</option>)}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personnes et bail</CardTitle>
            <CardDescription>Le locataire et l’unité sont déterminés automatiquement par le bail choisi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Inspecteur *</Label>
              <div className="flex min-h-10 items-center rounded-md border bg-muted/40 px-3 font-medium">E-IMMO — Staff Gestion E-Immo</div>
            </div>
            <div className="space-y-2">
              <Label>Bail actif de cette propriété (optionnel)</Label>
              <SearchableSelect
                value={leaseId}
                onValueChange={setLeaseId}
                options={leaseOptions}
                placeholder={!propertyId ? "Choisissez d’abord une propriété" : filteredLeases.length ? "Sélectionner un bail actif" : "Aucun bail actif — inspection hors location"}
                disabled={!propertyId || loading || filteredLeases.length === 0}
              />
              <p className="text-xs text-muted-foreground">Sans bail, l’inspection sera enregistrée comme inspection hors location.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Locataire</Label>
                <div className="flex min-h-10 items-center rounded-md border bg-muted/40 px-3">
                  <UserRound className="mr-2 h-4 w-4" /> {selectedLease ? formatName(selectedLease.tenantId) : "Aucun locataire"}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Unité</Label>
                <div className="flex min-h-10 items-center rounded-md border bg-muted/40 px-3">
                  <Home className="mr-2 h-4 w-4" /> {selectedLease?.unit?.unitNumber || "Aucune unité"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={2000} placeholder="Instructions ou observations particulières" />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Annuler</Button>
          <Button type="submit" disabled={submitting || loading}>{submitting ? "Planification…" : "Planifier l’inspection"}</Button>
        </div>
      </form>
    </div>
  );
}
