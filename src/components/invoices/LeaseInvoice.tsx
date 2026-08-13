"use client";

import React, { useMemo } from "react";
import type { LeaseResponse } from "@/lib/services/lease.service";
import { buildPrintableInvoiceFromLease } from "@/lib/invoice/invoice-builders";
import { UnifiedInvoiceDocument } from "./UnifiedInvoiceDocument";
import { cn } from "@/lib/utils";

export interface LeaseInvoiceProps {
  lease: LeaseResponse;
  companyInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
    logo?: string;
    platformName?: string;
  };
  invoiceNumber?: string;
  issueDate?: Date;
  dueDate?: Date;
  className?: string;
}

/**
 * Affichage unique des factures provenant d'un bail.
 * Le même objet normalisé est ensuite utilisé par l'impression et le PDF.
 */
export function LeaseInvoice({
  lease,
  companyInfo,
  invoiceNumber,
  issueDate,
  dueDate,
  className,
}: LeaseInvoiceProps) {
  const normalized = useMemo(
    () =>
      buildPrintableInvoiceFromLease(lease, {
        companyInfo,
        invoiceNumber,
        issueDate,
        dueDate,
      }),
    [lease, companyInfo, invoiceNumber, issueDate, dueDate],
  );

  return (
    <div className={cn("mx-auto w-full max-w-5xl bg-white px-4 py-6 sm:px-8 sm:py-10", className)}>
      <UnifiedInvoiceDocument invoice={normalized} title="FACTURE DE LOCATION" />
    </div>
  );
}
