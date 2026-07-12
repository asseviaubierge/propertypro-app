"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PaymentForm } from "@/components/forms/payment-form";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PaymentType, PaymentMethod } from "@/types";
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
  propertyName: string;
  tenantName: string;
}

interface PaymentData {
  _id: string;
  tenantId: string;
  propertyId: string;
  unitId?: string;
  leaseId?: string;
  amount: number;
  type: PaymentType;
  paymentMethod?: PaymentMethod;
  dueDate: string;
  description?: string;
  notes?: string;
}

export default function EditPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLocalizationContext();

  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(
    null
  );

  // Resolve params
  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  // Fetch required data for form
  useEffect(() => {
    const fetchData = async () => {
      if (!resolvedParams?.id) return;

      try {
        setIsDataLoading(true);
        const paymentRes = await fetch(`/api/payments/${resolvedParams.id}`);
        if (!paymentRes.ok) {
          const err = await paymentRes.json().catch(() => null);
          throw new Error(err?.error || "Failed to fetch payment data");
        }
        const paymentData = await paymentRes.json();
        const payment = paymentData.data;
        setPayment({
          _id: payment?._id,
          tenantId: payment?.tenantId?._id ?? payment?.tenantId ?? "",
          propertyId: payment?.propertyId?._id ?? payment?.propertyId ?? "",
          unitId: payment?.unitId?._id ?? payment?.unitId ?? undefined,
          leaseId: payment?.leaseId?._id ?? payment?.leaseId ?? undefined,
          amount: payment?.amount ?? 0,
          type: payment?.type,
          paymentMethod: payment?.paymentMethod,
          dueDate: payment?.dueDate
            ? new Date(payment.dueDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          description: payment?.description ?? "",
          notes: payment?.notes ?? "",
        });

        const [tenantsRes, propertiesRes, leasesRes] = await Promise.allSettled(
          [
            fetch("/api/tenants"),
            fetch("/api/properties"),
            fetch("/api/leases"),
          ]
        );

        if (
          tenantsRes.status === "fulfilled" &&
          tenantsRes.value &&
          tenantsRes.value.ok
        ) {
          const tenantsData = await tenantsRes.value.json();
          setTenants(
            tenantsData.data?.map((tenant: any) => ({
              id: tenant?._id,
              name: `${tenant?.firstName ?? "Unknown"} ${
                tenant?.lastName ?? ""
              }`.trim(),
              email: tenant?.email ?? "",
            })) || []
          );
        }

        if (
          propertiesRes.status === "fulfilled" &&
          propertiesRes.value &&
          propertiesRes.value.ok
        ) {
          const propertiesData = await propertiesRes.value.json();
          setProperties(
            propertiesData.data?.map((property: any) => ({
              id: property?._id,
              name: property?.name ?? "Unknown Property",
              address:
                property?.address?.street ||
                property?.address?.city ||
                property?.address?.state
                  ? `${property?.address?.street ?? ""}${
                      property?.address?.city
                        ? ", " + property.address.city
                        : ""
                    }${
                      property?.address?.state
                        ? ", " + property.address.state
                        : ""
                    }`
                  : "Address not available",
              isMultiUnit: property?.isMultiUnit,
              units: property?.units?.map((unit: any) => ({
                _id: unit._id,
                unitNumber: unit.unitNumber,
                type: unit.type,
                rentAmount: unit.rentAmount,
                status: unit.status,
              })) || [],
            })) || []
          );
        }

        if (
          leasesRes.status === "fulfilled" &&
          leasesRes.value &&
          leasesRes.value.ok
        ) {
          const leasesData = await leasesRes.value.json();
          setLeases(
            leasesData.data?.map((lease: any) => ({
              id: lease?._id,
              propertyName: lease?.propertyId?.name ?? "Unknown Property",
              tenantName: `${lease?.tenantId?.firstName ?? "Unknown"} ${
                lease?.tenantId?.lastName ?? ""
              }`.trim(),
            })) || []
          );
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error(t("payments.edit.toasts.loadFailed"));
      } finally {
        setIsDataLoading(false);
      }
    };

    if (session && resolvedParams) {
      fetchData();
    }
  }, [session, resolvedParams, router, t]);

  const handleSubmit = async (data: any) => {
    if (!payment) return;

    try {
      setIsLoading(true);

      // Convert string date to Date object
      const paymentData = {
        ...data,
        dueDate: new Date(data.dueDate),
      };

      const response = await fetch(`/api/payments/${payment._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(t("payments.edit.toasts.updateSuccess"));
        router.push(`/dashboard/payments/${payment._id}`);
      } else {
        throw new Error(result.error || "Failed to update payment");
      }
    } catch (error) {
      console.error("Error updating payment:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : t("payments.edit.toasts.updateFailed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (payment) {
      router.push(`/dashboard/payments/${payment._id}`);
    } else {
      router.push("/dashboard/payments");
    }
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

  if (!payment) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">
            {t("payments.edit.notFound.title")}
          </h2>
          <p className="text-muted-foreground mt-2">
            {t("payments.edit.notFound.message")}
          </p>
          <Link href="/dashboard/payments">
            <Button className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("payments.edit.notFound.button")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-8 w-8" />
            {t("payments.edit.header.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("payments.edit.header.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/payments/${payment._id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("payments.edit.header.backButton")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Payment Form */}
      <PaymentForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isLoading}
        initialData={payment}
        tenants={tenants}
        properties={properties}
        leases={leases}
      />
    </div>
  );
}
