"use client";

import React, { useMemo } from "react";
import type { LeaseResponse } from "@/lib/services/lease.service";
import { buildPrintableInvoiceFromLease } from "@/lib/invoice/invoice-builders";
import { UnifiedInvoiceDocument } from "./UnifiedInvoiceDocument";

export interface CleanLeaseInvoiceProps {
  lease: LeaseResponse;
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

/** Variante historique conservée pour compatibilité, désormais rendue avec le modèle unique. */
export function CleanLeaseInvoice(props: CleanLeaseInvoiceProps) {
  const invoice = useMemo(
    () =>
      buildPrintableInvoiceFromLease(props.lease, {
        companyInfo: props.companyInfo,
        invoiceNumber: props.invoiceNumber,
        issueDate: props.issueDate,
        dueDate: props.dueDate,
      }),
    [props.lease, props.companyInfo, props.invoiceNumber, props.issueDate, props.dueDate],
  );

  return <UnifiedInvoiceDocument invoice={invoice} title="FACTURE DE LOCATION" />;
}
