"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Receipt } from "lucide-react";
import { LeaseFacture } from "./LeaseFacture";
import { LeaseResponse } from "@/lib/services/lease.service";
import { getCompanyInfo, CompanyInfo } from "@/lib/utils/company-info";

export interface LeaseFactureModalProps {
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

export function LeaseFactureModal({
  lease,
  trigger,
  companyInfo: propCompanyInfo,
  invoiceNumber,
  issueDate,
  dueDate,
}: LeaseFactureModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(
    propCompanyInfo || null
  );
  const [isLoadingCompanyInfo, setIsLoadingCompanyInfo] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Charger les informations de l’entreprise uniquement à la première ouverture
  const fetchCompanyInfo = useCallback(async () => {
    if (propCompanyInfo || hasFetched) return;

    setIsLoadingCompanyInfo(true);
    try {
      const info = await getCompanyInfo();
      if (info) {
        setCompanyInfo(info);
      }
    } catch (error) {
      console.error("Échec du chargement des informations de l’entreprise :", error);
    } finally {
      setIsLoadingCompanyInfo(false);
      setHasFetched(true);
    }
  }, [propCompanyInfo, hasFetched]);

  // Charger les informations à l’ouverture de la fenêtre
  useEffect(() => {
    if (isOpen && !propCompanyInfo && !hasFetched) {
      fetchCompanyInfo();
    }
  }, [isOpen, propCompanyInfo, hasFetched, fetchCompanyInfo]);

  const defaultTrigger = (
    <Button
      variant="outline"
      size="sm"
      className="flex items-center gap-2 border-none! shadow-none! text-gray-600!"
    >
      <Receipt className="h-4 w-4" />
      Aperçu de la facture
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="w-full min-w-4/5! max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Facture de location
          </DialogTitle>
          <DialogDescription>
            Facture professionnelle relative au contrat et aux conditions de location
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoadingCompanyInfo ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <LeaseFacture
              lease={lease}
              companyInfo={companyInfo || undefined}
              invoiceNumber={invoiceNumber}
              issueDate={issueDate}
              dueDate={dueDate}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Composant d’action rapide pour les cartes/listes de locations
export interface QuickFactureButtonProps {
  lease: LeaseResponse;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function QuickFactureButton({
  lease,
  variant = "outline",
  size = "sm",
  className,
}: QuickFactureButtonProps) {
  return (
    <LeaseFactureModal
      lease={lease}
      trigger={
        <Button variant={variant} size={size} className={className}>
          <Receipt className="h-4 w-4" />
          {size !== "sm" && <span className="ml-2">Facture</span>}
        </Button>
      }
    />
  );
}
