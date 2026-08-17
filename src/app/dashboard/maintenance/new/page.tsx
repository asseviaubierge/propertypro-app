"use client";

import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { LeaseStatus } from "@/types";
import { useAuthorization } from "@/hooks/useAuthorization";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import { MaintenanceRequestForm } from "@/components/forms/maintenance-request-form";

interface Property {
  id: string;
  name: string;
  address: string;
  isMultiUnit?: boolean;
  units?: Array<{
    _id: string;
    unitNumber: string;
    unitType: string;
    status: string;
    currentTenantId?: string;
    currentLeaseId?: string;
  }>;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  propertyName?: string;
  phone?: string;
  tenantStatus?: string;
}

interface TenantApiResponse {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  tenantStatus?: string;
  currentLeaseId?: {
    propertyId?: {
      name: string;
    };
  };
}

interface LeaseItem {
  _id: string;
  propertyId?: {
    _id?: string;
    name?: string;
    address?: any;
    isMultiUnit?: boolean;
    type?: string;
  } | null;
  unitId?: string;
  unit?: {
    unitNumber?: string;
    unitType?: string;
    type?: string;
  } | null;
  status?: string;
}

const getLeasePropertyId = (lease?: LeaseItem | null) =>
  lease?.propertyId?._id ? String(lease.propertyId._id) : undefined;

const isActiveLeaseStatus = (status?: string) =>
  (status || "").toLowerCase() === LeaseStatus.ACTIVE;

export default function NewMaintenanceRequestPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { isTenant } = useAuthorization();
  const { t } = useLocalizationContext();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenantLeases, setTenantLeases] = useState<LeaseItem[]>([]);
  const [tenantInitialData, setTenantInitialData] = useState<{
    propertyId?: string;
    unitId?: string;
    tenantId?: string;
  }>({});
  const [hasActiveLease, setHasActiveLease] = useState<boolean>(false);

  useEffect(() => {
    // Only fetch form data for admin/manager users
    if (!isTenant) {
      fetchFormData();
    } else {
      fetchTenantData();
    }
  }, [isTenant]);

  const fetchFormData = async () => {
    try {
      setDataLoading(true);

      // Assignment is handled centrally by E-IMMO. Only load properties and tenants.
      const [propertiesRes, tenantsRes] = await Promise.all([
        fetch("/api/properties?limit=100"),
        fetch("/api/tenants?limit=100"),
      ]);

      if (propertiesRes.ok) {
        const propertiesData = await propertiesRes.json();
        setProperties(
          Array.isArray(propertiesData.data)
            ? propertiesData.data.map((property: any) => ({
                id: property._id,
                name: property.name,
                address: `${property.address.street}, ${property.address.city}, ${property.address.state}`,
                isMultiUnit: property.isMultiUnit,
                units: property.units || [],
              }))
            : [],
        );
      } else {
        toast.error(t("maintenance.new.toasts.loadPropertiesError"));
      }

      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json();

        // Handle the new User model structure for tenants
        setTenants(
          Array.isArray(tenantsData.data)
            ? tenantsData.data
                .filter((tenant: TenantApiResponse) => tenant && tenant._id) // Filter out invalid entries
                .map((tenant: TenantApiResponse) => ({
                  id: tenant._id,
                  name:
                    `${tenant.firstName || ""} ${
                      tenant.lastName || ""
                    }`.trim() || "Locataire",
                  email: tenant.email || "",
                  propertyName:
                    tenant.currentLeaseId?.propertyId?.name ||
                    t("maintenance.tenant.form.noLeases.title", {
                      defaultValue: "Aucun bail actif",
                    }),
                  phone: tenant.phone || "",
                  tenantStatus: tenant.tenantStatus || "",
                }))
            : [],
        );
      } else {
        toast.error(t("maintenance.new.toasts.loadTenantsError"));
      }

    } catch (error) {
      toast.error(t("maintenance.new.toasts.loadFormDataError"));
    } finally {
      setDataLoading(false);
    }
  };

  const fetchTenantData = async () => {
    try {
      setDataLoading(true);
      const res = await fetch("/api/tenant/dashboard");
      const data = await res.json();
      if (res.ok && data?.success) {
        const leases: LeaseItem[] = Array.isArray(data?.data?.allLeases)
          ? data.data.allLeases
          : [];
        setTenantLeases(leases);

        const activeLeases = leases.filter((l) => isActiveLeaseStatus(l.status));
        const candidateLeases = activeLeases.length > 0 ? activeLeases : leases;
        const currentLease = data?.data?.currentLease as LeaseItem | null;

        setHasActiveLease(leases.some((l) => isActiveLeaseStatus(l.status)));
        if (!leases.some((l) => isActiveLeaseStatus(l.status))) {
          toast.error(
            t("maintenance.new.toasts.noActiveLease", {
              defaultValue:
                "Vous ne pouvez pas envoyer de demande sans bail actif.",
            }),
          );
        }

        const tenantId = session?.user?.id || undefined;
        const uniquePropertyIds = Array.from(
          new Set(
            candidateLeases
              .map((lease) => lease?.propertyId?._id)
              .filter((value): value is string => Boolean(value)),
          ),
        );
        const currentPropertyId = getLeasePropertyId(currentLease);
        const propertyId =
          currentPropertyId && uniquePropertyIds.includes(currentPropertyId)
            ? currentPropertyId
            : uniquePropertyIds.length === 1
              ? uniquePropertyIds[0]
              : undefined;
        const uniqueUnitIds = propertyId
          ? Array.from(
              new Set(
                candidateLeases
                  .filter((lease) => lease?.propertyId?._id === propertyId)
                  .map((lease) => lease?.unitId)
                  .filter((value): value is string => Boolean(value)),
              ),
            )
          : [];
        const currentUnitId =
          currentLease && getLeasePropertyId(currentLease) === propertyId
            ? currentLease.unitId
            : undefined;
        const unitId =
          currentUnitId && uniqueUnitIds.includes(currentUnitId)
            ? currentUnitId
            : uniqueUnitIds.length === 1
              ? uniqueUnitIds[0]
              : undefined;

        // Les propriétés autorisées proviennent directement des baux du
        // locataire. Aucune route « propriétés du gestionnaire » n'est
        // appelée ici : elle refuserait légitimement l'accès au Locataire et
        // viderait alors le sélecteur.
        const leasesForForm = activeLeases.length > 0 ? activeLeases : leases;
        const propertyMap = new Map<string, Property>();

        for (const lease of leasesForForm) {
          const pid = getLeasePropertyId(lease);
          if (!pid || !lease.propertyId) continue;

          const address = lease.propertyId.address;
          const addressStr =
            typeof address === "string"
              ? address
              : address && typeof address === "object"
                ? [address.street, address.city, address.state, address.zipCode]
                    .filter(Boolean)
                    .join(", ")
                : "";

          if (!propertyMap.has(pid)) {
            propertyMap.set(pid, {
              id: pid,
              name: lease.propertyId.name || "Propriété",
              address: addressStr,
              isMultiUnit: Boolean(lease.propertyId.isMultiUnit || lease.unitId),
              units: [],
            });
          }

          const property = propertyMap.get(pid)!;
          if (
            lease.unitId &&
            !property.units?.some((unit) => unit._id === lease.unitId)
          ) {
            property.units = [
              ...(property.units ?? []),
              {
                _id: lease.unitId,
                unitNumber:
                  lease.unit?.unitNumber || lease.unitId.slice(-6).toUpperCase(),
                unitType:
                  lease.unit?.unitType ||
                  lease.unit?.type ||
                  lease.propertyId.type ||
                  "Logement",
                status: "occupied",
                currentTenantId: tenantId,
                currentLeaseId: lease._id,
              },
            ];
          }
        }

        setProperties([...propertyMap.values()]);

        setTenants([
          {
            id: tenantId || "",
            name: session?.user?.name || "",
            email: session?.user?.email || "",
            phone: session?.user?.phone || "",
          },
        ]);

        // Auto-select only when the tenant has a single leased property/unit.
        setTenantInitialData({ propertyId, unitId, tenantId });
      } else {
        toast.error(t("maintenance.new.toasts.loadFormDataError"));
      }
    } catch (error) {
      toast.error(t("maintenance.new.toasts.loadFormDataError"));
    } finally {
      setDataLoading(false);
    }
  };

  const handleSubmit = async (data: {
    title: string;
    description: string;
    category: string;
    priority: string;
    propertyId: string;
    unitId?: string;
    tenantId: string;
    assignedTo?: string;
    estimatedCost?: number;
    scheduledDate?: string;
    images?: string[];
  }) => {
    try {
      if (isTenant && !hasActiveLease) {
        toast.error(
          t("maintenance.new.toasts.noActiveLease", {
              defaultValue:
                "Vous ne pouvez pas envoyer de demande sans bail actif.",
          }),
        );
        return;
      }
      setLoading(true);
      const endpoint = isTenant
        ? "/api/tenant/maintenance"
        : "/api/maintenance";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          category: data.category,
          priority: data.priority,
          propertyId: data.propertyId,
          unitId: data.unitId || undefined,
          ...(isTenant
            ? {}
            : {
                tenantId: data.tenantId,
                estimatedCost: data.estimatedCost || undefined,
                scheduledDate: data.scheduledDate || undefined,
              }),
          images: data.images || [],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || t("maintenance.new.toasts.createError"),
        );
      }

      toast.success(t("maintenance.new.toasts.createSuccess"));
      const createdId = result?.data?._id || result?._id;
      if (createdId) {
        router.push(`/dashboard/maintenance/${createdId}`);
      } else {
        router.push(
          isTenant
            ? "/dashboard/maintenance/my-requests"
            : "/dashboard/maintenance",
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("maintenance.new.toasts.createError");
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tenant-account-page flex w-full justify-center">
      <div className="w-full max-w-240 space-y-3 sm:space-y-6">
        {/* Header */}
        <div className="mobile-page-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {t("maintenance.new.header.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("maintenance.new.header.subtitle")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full border hover:bg-blue-50 hover:text-blue-600 sm:w-auto"
            onClick={() =>
              router.push(
                isTenant
                  ? "/dashboard/maintenance/my-requests"
                  : "/dashboard/maintenance",
              )
            }
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("maintenance.new.header.back")}
          </Button>
        </div>

        {/* Form Container */}
        {isTenant && !hasActiveLease && (
          <Card className="border-0 shadow-lg bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                {t("maintenance.tenant.form.noLeases.title", {
                  defaultValue: "Aucun bail actif",
                })}
              </CardTitle>
              <CardDescription>
                {t("maintenance.tenant.form.noLeases.description", {
                  defaultValue:
                    "Un bail actif est nécessaire pour envoyer une demande de maintenance.",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("maintenance.new.noActiveLease.help", {
                  defaultValue:
                    "Contactez votre gestionnaire ou consultez vos baux.",
                })}
              </p>
            </CardContent>
          </Card>
        )}
        <MaintenanceRequestForm
          onSubmit={handleSubmit}
          isLoading={loading}
          initialData={isTenant ? tenantInitialData : undefined}
          isTenantView={isTenant}
          showPropertyTenantSection={true}
          showAssignmentSchedulingSection={!isTenant}
          showAssigneeField={false}
          defaultAssigneeLabel="E-IMMO — Équipe Gestion E-Immo"
          submitLabel={t("maintenance.form.buttons.submitRequest")}
          submitDisabled={isTenant && !hasActiveLease}
          properties={properties}
          tenants={tenants}
        />
      </div>
    </div>
  );
}
