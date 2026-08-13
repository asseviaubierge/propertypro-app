"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Receipt } from "lucide-react";
import { resolveCanonicalInvoiceUrl } from "@/lib/invoice/navigation";
import { showSimpleError } from "@/lib/toast-notifications";
import { LeaseResponse } from "@/lib/services/lease.service";

export interface LeaseInvoiceModalProps {
  lease: LeaseResponse;
  trigger?: React.ReactNode;
  companyInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
    logo?: string;
  };
  invoiceNumber?: string;
  issueDate?: Date;
  dueDate?: Date;
}

/**
 * Point d'entrée unique vers les factures liées à un bail.
 *
 * Tous les boutons liés à un bail résolvent directement l'identifiant de la
 * facture enregistrée, puis ouvrent l'unique page canonique :
 * /dashboard/accounting/invoices/[invoiceId].
 * Aucun écran /dashboard/leases/[id]/invoice n'est affiché entre les deux.
 */
export function LeaseInvoiceModal({
  lease,
  trigger,
}: LeaseInvoiceModalProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const openCanonicalInvoice = async () => {
    try {
      const role = String((session?.user as any)?.role || "").toLowerCase();
      const url = await resolveCanonicalInvoiceUrl(String(lease._id), {
        tenant: role === "tenant" || role === "locataire",
      });
      router.push(url);
    } catch (error) {
      showSimpleError(
        "Facture introuvable",
        error instanceof Error ? error.message : "Impossible d’ouvrir la facture liée à ce bail",
      );
    }
  };

  if (trigger && React.isValidElement(trigger)) {
    const element = trigger as React.ReactElement<any>;
    return React.cloneElement(element, {
      onClick: (event: React.MouseEvent) => {
        element.props?.onClick?.(event);
        if (!event.defaultPrevented) {
          void openCanonicalInvoice();
        }
      },
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="flex items-center gap-2 border-none! shadow-none! text-gray-600!"
      onClick={() => void openCanonicalInvoice()}
    >
      <Receipt className="h-4 w-4" />
      Aperçu de la facture
    </Button>
  );
}

export interface QuickInvoiceButtonProps {
  lease: LeaseResponse;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function QuickInvoiceButton({
  lease,
  variant = "outline",
  size = "sm",
  className,
}: QuickInvoiceButtonProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const openInvoice = async () => {
    try {
      const role = String((session?.user as any)?.role || "").toLowerCase();
      const url = await resolveCanonicalInvoiceUrl(String(lease._id), {
        tenant: role === "tenant" || role === "locataire",
      });
      router.push(url);
    } catch (error) {
      showSimpleError(
        "Facture introuvable",
        error instanceof Error ? error.message : "Impossible d’ouvrir la facture liée à ce bail",
      );
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => void openInvoice()}
    >
      <Receipt className="h-4 w-4" />
      {size !== "sm" && <span className="ml-2">Facture</span>}
    </Button>
  );
}
