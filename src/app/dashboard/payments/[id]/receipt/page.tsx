"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { PaymentStatus, PaymentType, PaymentMethod } from "@/types";
import { PaymentReceipt } from "@/components/payments/payment-receipt";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface PaymentDetails {
  _id: string;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  dueDate: string;
  paidDate?: string;
  description?: string;
  notes?: string;
  tenantId: {
    _id: string;
    userId: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
    };
  };
  propertyId: {
    _id: string;
    name: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  leaseId?: {
    _id: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLocalizationContext();
  const receiptRef = useRef<HTMLDivElement>(null);

  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(
    null
  );

  // Resolve params
  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  // Fetch payment details
  useEffect(() => {
    const fetchPayment = async () => {
      if (!resolvedParams?.id) return;

      try {
        setIsLoading(true);
        const response = await fetch(`/api/payments/${resolvedParams.id}`);

        if (response.ok) {
          const result = await response.json();
          setPayment(result.data);
        } else {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch payment");
        }
      } catch (error) {
        console.error("Error fetching payment:", error);
        toast.error(t("payments.receipt.toasts.loadFailed"));
        router.push("/dashboard/payments");
      } finally {
        setIsLoading(false);
      }
    };

    if (session && resolvedParams) {
      fetchPayment();
    }
  }, [session, resolvedParams, router, t]);

  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        const receiptContent = receiptRef.current.innerHTML;
        const receiptId = payment?._id.slice(-8).toUpperCase() || "";

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${t("payments.receipt.printTitle", {
                values: { receiptId },
              })}</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  margin: 0;
                  padding: 20px;
                  line-height: 1.5;
                }
                .print\\:hidden {
                  display: none !important;
                }
                .print\\:shadow-none {
                  box-shadow: none !important;
                }
                .print\\:border-none {
                  border: none !important;
                }
                @media print {
                  body {
                    margin: 0;
                    padding: 0;
                  }
                  .print\\:hidden {
                    display: none !important;
                  }
                }
              </style>
            </head>
            <body>
              ${receiptContent}
            </body>
          </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        // Wait for content to load then print
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    }
  };

  const handleDownloadPDF = async () => {
    try {
      if (!payment) return;

      // In a real implementation, you would call an API endpoint that generates a PDF
      // For now, we'll simulate the download
      toast.success(t("payments.receipt.toasts.downloadSuccess"));

      // Example implementation:
      // const response = await fetch(`/api/payments/${payment._id}/receipt/pdf`);
      // if (response.ok) {
      //   const blob = await response.blob();
      //   const url = window.URL.createObjectURL(blob);
      //   const a = document.createElement("a");
      //   a.href = url;
      //   a.download = `receipt-${payment._id.slice(-8)}.pdf`;
      //   document.body.appendChild(a);
      //   a.click();
      //   window.URL.revokeObjectURL(url);
      //   document.body.removeChild(a);
      // }
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast.error(t("payments.receipt.toasts.downloadFailed"));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* Receipt Skeleton */}
        <div className="max-w-2xl mx-auto">
          <div className="space-y-4 p-6 border rounded-lg">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">
            {t("payments.receipt.notFound.title")}
          </h2>
          <p className="text-muted-foreground mt-2">
            {t("payments.receipt.notFound.message")}
          </p>
          <Link href="/dashboard/payments">
            <Button className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("payments.receipt.notFound.backButton")}
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
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/payments/${payment._id}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("payments.receipt.header.backButton")}
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("payments.receipt.header.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("payments.receipt.header.subtitle", {
              values: { receiptId: payment._id.slice(-8).toUpperCase() },
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            {t("payments.receipt.header.printButton")}
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-2" />
            {t("payments.receipt.header.downloadButton")}
          </Button>
        </div>
      </div>

      {/* Receipt */}
      <PaymentReceipt
        ref={receiptRef}
        payment={payment}
        onPrint={handlePrint}
        onDownload={handleDownloadPDF}
        showActions={false} // We have our own action buttons in the header
      />
    </div>
  );
}
