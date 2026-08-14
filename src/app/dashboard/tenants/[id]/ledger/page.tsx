"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, DollarSign, FileText } from "lucide-react";
import TenantLedger from "@/components/tenant/TenantLedger";
import { toast } from "sonner";
import { LeaseStatus } from "@/types";

interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface Lease {
  _id: string;
  propertyId: {
    name: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
  startDate: string;
  endDate: string;
  status: string;
  terms: {
    rentAmount: number;
  };
}

import { formatCurrency } from "@/lib/utils/formatting";

interface TenantLedgerPageProps {
  params: {
    id: string;
  };
}

export default function TenantLedgerPage({ params }: TenantLedgerPageProps) {
  const router = useRouter();
  const { id: tenantId } = params;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>("");
  const [currentBalance, setCurrentBalance] = useState<{
    currentBalance: number;
    totalOutstanding: number;
    overdueAmount: number;
    lastPaymentDate?: string;
    lastPaymentAmount?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const formatAddress = (address: any) => {
    if (!address) return "Address not available";
    if (typeof address === "string") return address;
    if (typeof address === "object") {
      const { street, city, state, zipCode } = address;
      return `${street || ""}, ${city || ""}, ${state || ""} ${zipCode || ""}`
        .replace(/,\s*,/g, ",")
        .replace(/^\s*,\s*|\s*,\s*$/g, "");
    }
    return "Address not available";
  };

  useEffect(() => {
    fetchTenantData();
    fetchTenantLeases();
    fetchCurrentBalance();
  }, [tenantId]);

  const fetchTenantData = async () => {
    try {
      const response = await fetch(`/api/users/${tenantId}`);
      const data = await response.json();

      if (data.success && data.data) {
        setTenant(data.data);
      } else {
        toast.error("Failed to load tenant information");
      }
    } catch (error) {
      toast.error("Failed to load tenant information");
    }
  };

  const fetchTenantLeases = async () => {
    try {
      const response = await fetch(`/api/leases?tenantId=${tenantId}`);
      const data = await response.json();

      if (data.success && data.data) {
        const tenantLeases = data.data.leases || [];
        setLeases(tenantLeases);

        // Auto-select active lease if exists
        const activeLease = tenantLeases.find(
          (lease: Lease) => lease.status === LeaseStatus.ACTIVE
        );
        if (activeLease) {
          setSelectedLeaseId(activeLease._id);
        }
      } else {
        toast.error("Failed to load tenant leases");
      }
    } catch (error) {
      toast.error("Failed to load tenant leases");
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentBalance = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedLeaseId) params.append("leaseId", selectedLeaseId);

      const response = await fetch(
        `/api/tenants/${tenantId}/ledger?${params}`,
        {
          method: "PATCH",
        }
      );
      const data = await response.json();

      if (data.success && data.data) {
        setCurrentBalance(data.data);
      }
    } catch (error) {
      toast.error("Failed to load current balance");
    }
  };

  useEffect(() => {
    if (selectedLeaseId) {
      fetchCurrentBalance();
    }
  }, [selectedLeaseId]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      [LeaseStatus.ACTIVE]: { variant: "default" as const, label: "Actif" },
      [LeaseStatus.EXPIRED]: { variant: "secondary" as const, label: "Expired" },
      [LeaseStatus.TERMINATED]: {
        variant: "destructive" as const,
        label: "Terminated",
      },
      [LeaseStatus.PENDING]: { variant: "outline" as const, label: "En attente" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      variant: "outline" as const,
      label: status,
    };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat("en-US", {
  //     style: "currency",
  //     currency: "USD",
  //   }).format(amount);
  // };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl">Compte du locataire</h1>
            <p className="text-muted-foreground">
              Loading tenant information...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl">
              Tenant Not Found
            </h1>
            <p className="text-muted-foreground">
              The requested tenant could not be found.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl">Compte du locataire</h1>
          <p className="text-muted-foreground">
            Financial history for {tenant.firstName} {tenant.lastName}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Tenant Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Tenant Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="font-medium text-lg">
                {tenant.firstName} {tenant.lastName}
              </h3>
              <p className="text-muted-foreground">{tenant.email}</p>
              {tenant.phone && (
                <p className="text-muted-foreground">{tenant.phone}</p>
              )}
            </div>

            {currentBalance && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Solde actuel :</span>
                  <span
                    className={`font-medium ${
                      currentBalance.currentBalance > 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {formatCurrency(Math.abs(currentBalance.currentBalance))}
                    {currentBalance.currentBalance > 0 ? " Owed" : " Credit"}
                  </span>
                </div>

                {currentBalance.overdueAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Montant en retard :</span>
                    <span className="font-medium text-red-600">
                      {formatCurrency(currentBalance.overdueAmount)}
                    </span>
                  </div>
                )}

                {currentBalance.lastPaymentDate && (
                  <div className="flex justify-between">
                    <span>Dernier paiement :</span>
                    <span>
                      {formatCurrency(currentBalance.lastPaymentAmount || 0)} on{" "}
                      {new Date(
                        currentBalance.lastPaymentDate
                      ).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lease Selection */}
      {leases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Leases
            </CardTitle>
            <CardDescription>
              Select a lease to view specific financial history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {leases.map((lease) => (
                <div
                  key={lease._id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedLeaseId === lease._id
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedLeaseId(lease._id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{lease.propertyId.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatAddress(lease.propertyId.address)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(lease.startDate).toLocaleDateString()} -{" "}
                        {new Date(lease.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(lease.status)}
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatCurrency(lease.terms.rentAmount)}/month
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tenant Ledger Component */}
      <TenantLedger
        tenantId={tenantId}
        leaseId={selectedLeaseId || undefined}
      />
    </div>
  );
}
