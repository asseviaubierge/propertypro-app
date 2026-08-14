"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  DollarSign,
  FileText,
  Settings,
  RefreshCw,
  Download,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { PaymentManagementSystem } from "@/components/payments/PaymentManagementSystem";
import { PaymentStatusDashboard } from "@/components/payments/PaymentStatusDashboard";
import { EnhancedLeaseInvoice } from "@/components/invoices/EnhancedLeaseInvoice";
import { ILease, IPayment } from "@/types";
import { showSimpleError, showSimpleSuccess } from "@/lib/toast-notifications";

export default function LeasePaymentManagementPage() {
  const params = useParams();
  const leaseId = params.id as string;

  const [lease, setLease] = useState<ILease | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    if (leaseId) {
      fetchLeaseData();
    }
  }, [leaseId]);

  const fetchLeaseData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/leases/${leaseId}`);
      const data = await response.json();

      if (data.success && data.data) {
        setLease(data.data);
      } else {
        showSimpleError("Erreur de chargement", "Failed to load lease data");
      }
    } catch (error) {
      showSimpleError("Erreur de chargement", "Failed to load lease data");
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshData = async () => {
    try {
      setRefreshing(true);
      await fetchLeaseData();
      showSimpleSuccess("Refreshed", "Data refreshed successfully");
    } catch (error) {
      showSimpleError("Refresh Failed", "Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  const handlePaymentUpdate = (payment: IPayment) => {
    // Refresh lease data when payment is updated
    fetchLeaseData();
    showSimpleSuccess("Payment Updated", "Payment updated successfully");
  };

  const handleInvoiceGenerated = (invoiceId: string) => {
    showSimpleSuccess("Invoice Generated", "Invoice generated successfully");
  };

  const handleSetupPaymentSystem = async () => {
    try {
      const response = await fetch(`/api/leases/${leaseId}/payment-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          autoGenerateInvoices: true,
          autoEmailInvoices: true,
          updateLeaseStatus: true,
          notifyTenant: true,
          createRecurringPayments: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const paymentsCreated = data?.data?.details?.paymentsCreated ?? 0;
        showSimpleSuccess(
          "Setup Complete",
          `Payment system setup completed! ${paymentsCreated} payments created.`
        );
        fetchLeaseData();
      } else {
        showSimpleError("Setup Failed", "Failed to setup payment system");
      }
    } catch (error) {
      showSimpleError("Setup Failed", "Failed to setup payment system");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!lease) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>
            Lease not found or you don't have permission to view it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/leases">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Leases
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Gestion des paiements</h1>
            <p className="text-muted-foreground">
              {lease.propertyId?.name} - {lease.tenantId?.firstName}{" "}
              {lease.tenantId?.lastName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefreshData}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Actualiser
          </Button>

          <Button onClick={handleSetupPaymentSystem}>
            <Plus className="h-4 w-4 mr-2" />
            Setup Payment System
          </Button>
        </div>
      </div>

      {/* Lease Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Lease Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Bien</p>
              <p className="font-medium">{lease.propertyId?.name}</p>
              <p className="text-sm text-muted-foreground">
                {lease.propertyId?.address}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Locataire</p>
              <p className="font-medium">
                {lease.tenantId?.firstName} {lease.tenantId?.lastName}
              </p>
              <p className="text-sm text-muted-foreground">
                {lease.tenantId?.email}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Période du bail</p>
              <p className="font-medium">
                {new Date(lease.startDate).toLocaleDateString()} -{" "}
                {new Date(lease.endDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Loyer mensuel</p>
              <p className="font-medium text-lg">
                ${lease.terms?.rentAmount?.toLocaleString() || "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Management Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Tableau de bord
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Process Payments
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Paramètres
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <PaymentStatusDashboard
            leaseId={leaseId}
            lease={lease}
            onPaymentUpdate={handlePaymentUpdate}
            onInvoiceGenerated={handleInvoiceGenerated}
          />
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <PaymentManagementSystem
            leaseId={leaseId}
            lease={lease}
            onPaymentUpdate={handlePaymentUpdate}
          />
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestion des factures</CardTitle>
              <CardDescription>
                Generate, view, and manage invoices for this lease
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedLeaseInvoice
                lease={lease}
                companyInfo={{
                  name: "GESTION E-IMMO",
                  address:
                    "123 Business Avenue, Suite 100, Business City, BC 12345",
                  phone: "+1 (555) 123-4567",
                  email: "contact@e-immo.bj",
                  website: "www.e-immo.bj",
                }}
                onInvoiceGenerated={(fileName) => {
                  showSimpleSuccess("Invoice Generated", `Invoice generated: ${fileName}`);
                }}
                onInvoiceEmailed={(email) => {
                  showSimpleSuccess("Invoice Emailed", `Invoice emailed to: ${email}`);
                }}
                onInvoiceSaved={(documentId) => {
                  showSimpleSuccess("Invoice Saved", `Invoice saved with ID: ${documentId}`);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres des paiements</CardTitle>
              <CardDescription>
                Configure payment automation and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Settings className="h-4 w-4" />
                  <AlertDescription>
                    Payment automation settings are configured during lease
                    creation. Contact support to modify these settings.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Créer automatiquement les paiements</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Automatically generate recurring rent payments
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Actif</span>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Générer automatiquement les factures</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Automatically create invoices when payments are due
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Actif</span>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Envoyer automatiquement les factures par e-mail</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Automatically email invoices to tenants
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Actif</span>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Synchronisation des statuts</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Sync payment status with lease status
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Actif</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Modes de paiement acceptés</h4>
                  <div className="flex flex-wrap gap-2">
                    {lease.terms?.paymentConfig?.acceptedPaymentMethods?.map(
                      (method) => (
                        <span
                          key={method}
                          className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                        >
                          {method.replace("_", " ")}
                        </span>
                      )
                    ) || (
                      <span className="text-sm text-muted-foreground">
                        No payment methods configured
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
