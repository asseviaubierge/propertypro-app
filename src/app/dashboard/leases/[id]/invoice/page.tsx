"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { showSimpleError, showSimpleSuccess } from "@/lib/toast-notifications";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { EnhancedLeaseInvoice } from "@/components/invoices/EnhancedLeaseInvoice";
import { leaseService, LeaseResponse } from "@/lib/services/lease.service";

export default function LeaseInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [lease, setLease] = useState<LeaseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const leaseId = params.id as string;

  useEffect(() => {
    if (leaseId) {
      fetchLease();
    }
  }, [leaseId]);

  useEffect(() => {
    if (!leaseId || !session?.user) return;

    const findStoredInvoice = async () => {
      try {
        const role = String((session.user as any).role || "").toLowerCase();
        const isTenant = role === "tenant" || role === "locataire";
        const endpoint = isTenant
          ? `/api/tenant/invoices?leaseId=${encodeURIComponent(leaseId)}&limit=1`
          : `/api/invoices?leaseId=${encodeURIComponent(leaseId)}&limit=1&includeSettled=true`;
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        const rows = isTenant
          ? payload?.data?.invoices
          : payload?.data?.invoices || payload?.data;
        const invoice = Array.isArray(rows) ? rows[0] : null;
        if (invoice?._id) {
          router.replace(`/dashboard/accounting/invoices/${invoice._id}`);
        }
      } catch {
        // If no stored invoice can be resolved, keep the lease invoice preview.
      }
    };

    void findStoredInvoice();
  }, [leaseId, router, session?.user]);

  const fetchLease = async () => {
    try {
      setLoading(true);
      setError(null);
      const leaseData = await leaseService.getLeaseById(leaseId);
      setLease(leaseData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Échec du chargement du bail";
      setError(errorMessage);
      showSimpleError("Erreur de chargement", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="h-10 bg-muted rounded animate-pulse w-24" />
            <div className="h-8 bg-muted rounded animate-pulse w-32" />
          </div>

          {/* Invoice Card Skeleton */}
          <Card>
            <CardHeader>
              <div className="h-6 bg-muted rounded animate-pulse w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 bg-muted rounded animate-pulse w-32" />
                    <div className="h-4 bg-muted rounded animate-pulse w-24" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !lease) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={handleGoBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        </div>

        <ErrorAlert
          title="Échec du chargement du bail"
          message={error || "Bail introuvable"}
          onRetry={fetchLease}
          className="max-w-md mx-auto"
        />
      </div>
    );
  }

  const propertyAccount: any =
    (lease.propertyId as any)?.managerId ||
    (lease.propertyId as any)?.ownerId ||
    null;
  const accountFullName = propertyAccount
    ? `${propertyAccount.firstName || ""} ${propertyAccount.lastName || ""}`.trim()
    : "";
  const invoiceCompanyInfo = {
    name:
      accountFullName ||
      propertyAccount?.businessName ||
      "GESTION E-IMMO",
    address:
      [propertyAccount?.address, propertyAccount?.city].filter(Boolean).join(", ") ||
      "Carré 58, Rue 9232, Ménotin, Cotonou, Bénin",
    phone: propertyAccount?.phone || "+229 01 91 86 86 86",
    email: propertyAccount?.email || "contact@e-immo.bj",
    website: propertyAccount?.website || "gestion.e-immo.bj",
    logo: propertyAccount?.businessLogo,
    platformName: "E-IMMO",
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleGoBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au bail
          </Button>

          <div className="text-right">
            <h1 className="text-2xl font-bold text-gray-900">Facture du bail</h1>
            <p className="text-muted-foreground">
              Consulter et gérer la facture liée au bail
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Invoice Component */}
      <EnhancedLeaseInvoice
        lease={lease}
        companyInfo={invoiceCompanyInfo as any}
        onInvoiceGenerated={(fileName) => {
          showSimpleSuccess("Facture générée", `Facture générée : ${fileName}`);
        }}
        onInvoiceEmailed={(email) => {
          showSimpleSuccess("Facture envoyée", `Facture envoyée à : ${email}`);
        }}
        onInvoiceSaved={(documentId) => {
          showSimpleSuccess("Facture enregistrée", `Facture enregistrée : ${documentId}`);
        }}
        className="mb-8"
      />
    </div>
  );
}
