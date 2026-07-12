"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  propertyName: string;
  tenantName: string;
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

        // Fetch tenants, properties, and leases in parallel
        const [tenantsRes, propertiesRes, leasesRes] = await Promise.all([
          fetch("/api/tenants"),
          fetch("/api/properties"),
          fetch("/api/leases"),
        ]);

        if (tenantsRes.ok) {
          const tenantsData = await tenantsRes.json();
          setTenants(
            tenantsData.data?.map((tenant: any) => ({
              id: tenant._id,
              name: `${tenant.firstName} ${tenant.lastName}`,
              email: tenant.email,
            })) || []
          );
        }

        if (propertiesRes.ok) {
          const propertiesData = await propertiesRes.json();
          setProperties(
            propertiesData.data?.map((property: any) => ({
              id: property._id,
              name: property.name,
              address: `${property.address?.street || ""}, ${property.address?.city || ""}, ${property.address?.state || ""}`,
              isMultiUnit: property.isMultiUnit,
              units: property.units?.map((unit: any) => ({
                _id: unit._id,
                unitNumber: unit.unitNumber,
                type: unit.type,
                rentAmount: unit.rentAmount,
                status: unit.status,
              })) || [],
            })) || []
          );
        }

        if (leasesRes.ok) {
          const leasesData = await leasesRes.json();
          setLeases(
            leasesData.data?.map((lease: any) => ({
              id: lease._id,
              propertyName: lease.propertyId?.name || "Unknown Property",
              tenantName: lease.tenantId?.firstName
                ? `${lease.tenantId.firstName} ${lease.tenantId.lastName}`
                : "Unknown Tenant",
            })) || []
          );
        }
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
        toast.success("Payment processed and recorded successfully!");
        router.push("/dashboard/payments");
      } else {
        throw new Error(result.error || "Failed to record payment");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Payment was processed but failed to save record. Please contact support."
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
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-8 w-8" />
            {t("payments.new.header.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("payments.new.header.subtitle")}
          </p>
        </div>
         <div className="flex items-center gap-2">
            <Link href="/dashboard/payments">
              <Button variant="outline" size="sm">
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
      />
    </div>
  );
}
