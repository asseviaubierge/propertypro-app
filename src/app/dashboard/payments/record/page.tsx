"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, CreditCard } from "lucide-react";
import PaymentRecordingForm from "@/components/payments/PaymentRecordingForm";
import { toast } from "sonner";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Lease {
  _id: string;
  tenantId: string;
  propertyId: {
    name: string;
    address: string;
  };
  startDate: string;
  endDate: string;
  status: string;
}

export default function RecordPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocalizationContext();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    searchParams.get("tenantId") || ""
  );
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>(
    searchParams.get("leaseId") || ""
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      fetchLeasesForTenant(selectedTenantId);
    } else {
      setLeases([]);
      setSelectedLeaseId("");
    }
  }, [selectedTenantId]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/users?role=tenant&limit=100");
      const data = await response.json();

      if (data.success) {
        setTenants(data.data?.users || []);
      } else {
        toast.error(t("payments.record.toasts.tenantsLoadFailed"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("payments.record.toasts.tenantsLoadFailed")
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchLeasesForTenant = async (tenantId: string) => {
    try {
      const response = await fetch(
        `/api/leases?tenantId=${tenantId}&status=active`
      );
      const data = await response.json();

      if (data.success && data.data) {
        const leases = data.data.leases || [];
        setLeases(leases);

        // Auto-select lease if only one exists
        if (leases.length === 1) {
          setSelectedLeaseId(leases[0]._id);
        }
      } else {
        toast.error(t("payments.record.toasts.leasesLoadFailed"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("payments.record.toasts.leasesLoadFailed")
      );
    }
  };

  const handlePaymentRecorded = (result: any) => {
    toast.success(t("payments.record.toasts.recordSuccess"));

    // Show additional success information
    if (result.invoiceApplications?.length > 0) {
      const appliedCount = result.invoiceApplications.length;
      toast.success(
        t("payments.record.toasts.appliedToInvoices", {
          values: { count: appliedCount },
        })
      );
    }

    if (result.receipt?.emailSent) {
      toast.success(t("payments.record.toasts.receiptEmailed"));
    }

    // Optionally redirect or reset form
    // router.push("/dashboard/payments");
  };

  const getSelectedTenant = () => {
    return tenants.find((t) => t._id === selectedTenantId);
  };

  const getSelectedLease = () => {
    return leases.find((l) => l._id === selectedLeaseId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("payments.record.header.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("payments.record.header.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("payments.record.header.backButton")}
        </Button>
      </div>

      {/* Tenant & Lease Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t("payments.record.selection.title")}
          </CardTitle>
          <CardDescription>
            {t("payments.record.selection.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("payments.record.selection.tenantLabel")}
              </label>
              <Select
                value={selectedTenantId}
                onValueChange={setSelectedTenantId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t(
                      "payments.record.selection.tenantPlaceholder"
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant._id} value={tenant._id}>
                      {tenant.firstName} {tenant.lastName} - {tenant.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("payments.record.selection.leaseLabel")}
              </label>
              <Select
                value={selectedLeaseId}
                onValueChange={setSelectedLeaseId}
                disabled={!selectedTenantId || leases.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t(
                      "payments.record.selection.leasePlaceholder"
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {leases.map((lease) => (
                    <SelectItem key={lease._id} value={lease._id}>
                      {lease.propertyId.name} - {lease.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selected Details */}
          {selectedTenantId && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">
                {t("payments.record.selection.selectedDetails")}
              </h4>
              <div className="space-y-1 text-sm">
                <div>
                  <strong>{t("payments.record.selection.tenant")}</strong>{" "}
                  {getSelectedTenant()?.firstName}{" "}
                  {getSelectedTenant()?.lastName}
                </div>
                {selectedLeaseId && getSelectedLease() && (
                  <div>
                    <strong>{t("payments.record.selection.property")}</strong>{" "}
                    {getSelectedLease()?.propertyId.name}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Form */}
      {selectedTenantId && (
        <PaymentRecordingForm
          tenantId={selectedTenantId}
          leaseId={selectedLeaseId || undefined}
          onPaymentRecorded={handlePaymentRecorded}
          onCancel={() => router.back()}
        />
      )}

      {/* Instructions */}
      {!selectedTenantId && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">
                {t("payments.record.empty.title")}
              </h3>
              <p>{t("payments.record.empty.subtitle")}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
