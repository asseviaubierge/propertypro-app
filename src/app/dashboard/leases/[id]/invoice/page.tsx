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

  const fetchLease = async () => {
    try {
      setLoading(true);
      setError(null);
      const leaseData = await leaseService.getLeaseById(leaseId);
      setLease(leaseData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch lease";
      setError(errorMessage);
      showSimpleError("Load Error", errorMessage);
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
            Back
          </Button>
        </div>

        <ErrorAlert
          title="Failed to Load Lease"
          message={error || "Lease not found"}
          onRetry={fetchLease}
          className="max-w-md mx-auto"
        />
      </div>
    );
  }

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
            Back to Lease
          </Button>

          <div className="text-right">
            <h1 className="text-2xl font-bold text-gray-900">Lease Invoice</h1>
            <p className="text-muted-foreground">
              Generate and manage lease documentation
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Invoice Component */}
      <EnhancedLeaseInvoice
        lease={lease}
        companyInfo={{
          name: "PropertyPro Management",
          address: "123 Business Avenue, Suite 100, Business City, BC 12345",
          phone: "+1 (555) 123-4567",
          email: "info@PropertyPro.com",
          website: "www.PropertyPro.com",
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
        className="mb-8"
      />
    </div>
  );
}
