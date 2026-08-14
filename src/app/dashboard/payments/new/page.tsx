"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, ArrowLeft } from "lucide-react";
import { PaymentForm } from "@/components/forms/payment-form";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface Tenant {
  id: string;
  name: string;
  email: string;
}

interface Unit {
  _id: string;
  unitNumber: string;
  type?: string;
  rentAmount?: number;
  status?: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  isMultiUnit?: boolean;
  units?: Unit[];
}

interface Lease {
  id: string;
  tenantId: string;
  propertyId: string;
  unitId?: string;
  propertyName: string;
  tenantName: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

function referenceId(value: any): string {
  return String(value?._id || value?.id || value || "");
}

function propertyAddress(property: any): string {
  if (typeof property?.address === "string") return property.address;
  return [
    property?.address?.street,
    property?.address?.city,
    property?.address?.state,
  ]
    .filter(Boolean)
    .join(", ");
}

async function fetchAllScopedLeases(): Promise<any[]> {
  const allLeases: any[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await fetch(`/api/leases?page=${page}&limit=100`);
    if (!response.ok) {
      throw new Error("Impossible de charger les baux associés.");
    }

    const payload = await response.json();
    allLeases.push(...(Array.isArray(payload?.data) ? payload.data : []));
    totalPages = Math.max(
      1,
      Number(
        payload?.pagination?.totalPages ||
          payload?.pagination?.pages ||
          payload?.pagination?.total_pages ||
          1,
      ),
    );
    page += 1;
  } while (page <= totalPages);

  return allLeases;
}

export default function NewPaymentPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLocalizationContext();

  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);

  // Fetch required data for form
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsDataLoading(true);

        // Les baux constituent la source de vérité des relations entre
        // locataires, propriétés et unités.
        const [tenantsRes, propertiesRes, leaseRows] = await Promise.all([
          fetch("/api/tenants"),
          fetch("/api/properties"),
          fetchAllScopedLeases(),
        ]);

        const tenantMap = new Map<string, Tenant>();
        const propertyMap = new Map<string, Property>();

        if (tenantsRes.ok) {
          const tenantsData = await tenantsRes.json();
          (Array.isArray(tenantsData?.data) ? tenantsData.data : []).forEach(
            (tenant: any) => tenantMap.set(referenceId(tenant), {
              id: referenceId(tenant),
              name: `${tenant.firstName} ${tenant.lastName}`,
              email: tenant.email,
            }),
          );
        }

        if (propertiesRes.ok) {
          const propertiesData = await propertiesRes.json();
          (Array.isArray(propertiesData?.data) ? propertiesData.data : []).forEach(
            (property: any) => propertyMap.set(referenceId(property), {
              id: referenceId(property),
              name: property.name,
              address: propertyAddress(property),
              isMultiUnit: property.isMultiUnit,
              units: property.units?.map((unit: any) => ({
                _id: unit._id,
                unitNumber: unit.unitNumber,
                type: unit.type,
                rentAmount: unit.rentAmount,
                status: unit.status,
              })) || [],
            }),
          );
        }

        const mappedLeases = leaseRows
          .map((lease: any) => {
            const tenantId = referenceId(lease?.tenantId);
            const propertyId = referenceId(lease?.propertyId);
            if (!tenantId || !propertyId) return null;

            if (!tenantMap.has(tenantId) && lease?.tenantId) {
              tenantMap.set(tenantId, {
                id: tenantId,
                name:
                  `${lease.tenantId?.firstName || ""} ${lease.tenantId?.lastName || ""}`.trim() ||
                  "Locataire",
                email: lease.tenantId?.email || "",
              });
            }

            if (!propertyMap.has(propertyId) && lease?.propertyId) {
              propertyMap.set(propertyId, {
                id: propertyId,
                name: lease.propertyId?.name || "Propriété",
                address: propertyAddress(lease.propertyId),
                isMultiUnit: lease.propertyId?.isMultiUnit,
                units: Array.isArray(lease.propertyId?.units)
                  ? lease.propertyId.units.map((unit: any) => ({
                      _id: referenceId(unit),
                      unitNumber: unit.unitNumber,
                      type: unit.type,
                      rentAmount: unit.rentAmount,
                      status: unit.status,
                    }))
                  : [],
              });
            }

            return {
              id: referenceId(lease),
              tenantId,
              propertyId,
              unitId: referenceId(lease?.unitId) || undefined,
              propertyName: lease.propertyId?.name || "Propriété",
              tenantName:
                `${lease.tenantId?.firstName || ""} ${lease.tenantId?.lastName || ""}`.trim() ||
                "Locataire",
              startDate: lease.startDate,
              endDate: lease.endDate,
              status: lease.status,
            } satisfies Lease;
          })
          .filter((lease): lease is Lease => Boolean(lease?.id));

        const linkedTenantIds = new Set(mappedLeases.map((lease) => lease.tenantId));
        const linkedPropertyIds = new Set(mappedLeases.map((lease) => lease.propertyId));
        setTenants(
          Array.from(tenantMap.values()).filter((tenant) => linkedTenantIds.has(tenant.id)),
        );
        setProperties(
          Array.from(propertyMap.values()).filter((property) =>
            linkedPropertyIds.has(property.id),
          ),
        );
        setLeases(mappedLeases);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("payments.new.toasts.dataLoadFailed")
        );
      } finally {
        setIsDataLoading(false);
      }
    };

    if (session) {
      fetchData();
    }
  }, [session, t]);

  const handleSubmit = async (data: any) => {
    try {
      setIsLoading(true);

      // Convert string date to Date object
      const paymentData = {
        ...data,
        dueDate: new Date(data.dueDate),
      };

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(t("payments.new.toasts.createSuccess"));
        router.push("/dashboard/payments");
      } else {
        throw new Error(result.error || t("payments.new.toasts.createFailed"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("payments.new.toasts.createFailed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleStripePaymentSuccess = async (paymentIntentId: string, data: Record<string, unknown>) => {
    try {
      setIsLoading(true);

      // Create the payment record with the Stripe payment intent ID
      const paymentData = {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate as string) : new Date(),
        stripePaymentIntentId: paymentIntentId,
        status: "paid",
        paidAt: new Date(),
      };

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Paiement traité et enregistré avec succès.");
        router.push("/dashboard/payments");
      } else {
        throw new Error(result.error || "Impossible d’enregistrer le paiement.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Le paiement a été traité, mais son enregistrement a échoué. Contactez l’assistance."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push("/dashboard/payments");
  };

  if (isDataLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>

        {/* Form Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl flex items-center gap-2">
            <CreditCard className="h-8 w-8" />
            {t("payments.new.header.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("payments.new.header.subtitle")}
          </p>
        </div>
         <div className="w-full sm:w-auto">
            <Link href="/dashboard/payments" className="block w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full whitespace-nowrap sm:w-auto">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("payments.new.header.backButton")}
              </Button>
            </Link>
          </div>
      </div>

      {/* Payment Form */}
      <PaymentForm
        onSubmit={handleSubmit}
        onStripePaymentSuccess={handleStripePaymentSuccess}
        onCancel={handleCancel}
        isLoading={isLoading}
        tenants={tenants}
        properties={properties}
        leases={leases}
        requireLease
      />
    </div>
  );
}
