/**
 * PropriétéPro - Invoice Table Component
 * Comprehensive table for displaying and managing tenant invoices across all leases
 */

"use client";

import React, { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
} from "@/components/ui/pagination";
import { GlobalPagination } from "@/components/ui/global-pagination";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import {
  FileText,
  DollarSign,
  Download,
  Eye,
  MoreHorizontal,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  Calendar,
} from "lucide-react";

interface Invoice {
  _id: string;
  invoiceNumber: string;
  propertyId?: {
    _id: string;
    name: string;
  } | null;
  leaseId: string;
  issueDate: string;
  dueDate: string;
  status: string;
  totalMontant: number;
  balanceRemaining: number;
  joursEnRetard: number;
  lineItems: Array<{
    description: string;
    amount: number;
  }>;
}

interface InvoiceTableProps {
  invoices: Invoice[];
  onInvoiceAction?: (action: string, invoice: Invoice) => void;
  className?: string;
}

const ITEMS_PER_PAGE = 12;
import { formatCurrency } from "@/lib/utils/formatting";

export default function InvoiceTable({
  invoices,
  onInvoiceAction,
  className,
}: InvoiceTableProps) {
  const { t } = useLocalizationContext();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentInvoices = invoices.slice(startIndex, endIndex);

  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat("en-US", {
  //     style: "currency",
  //     currency: "USD",
  //   }).format(amount);
  // };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatutBadge = (invoice: Invoice) => {
    switch (invoice.status.toLowerCase()) {
      case "paid":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Payée
          </Badge>
        );
      case "overdue":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            En retard
          </Badge>
        );
      case "partial":
        return (
          <Badge variant="secondary" className="bg-yellow-500">
            <Clock className="w-3 h-3 mr-1" />
            Partielle
          </Badge>
        );
      case "issued":
      default:
        return (
          <Badge variant="outline">
            <FileText className="w-3 h-3 mr-1" />
            Émise
          </Badge>
        );
    }
  };

  const getEnRetardDisplay = (invoice: Invoice) => {
    if (invoice.status === "paid") {
      return <span className="text-sm text-green-600">Payée</span>;
    }

    if (invoice.daysEnRetard > 0) {
      return (
        <span className="text-sm text-red-600 font-medium">
          {invoice.daysEnRetard} jours de retard
        </span>
      );
    }

    const daysUntilDue = Math.ceil(
      (new Date(invoice.dueDate).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysUntilDue === 0) {
      return (
        <span className="text-sm text-orange-600 font-medium">Échéance aujourd'hui</span>
      );
    } else if (daysUntilDue > 0) {
      return (
        <span className="text-sm text-muted-foreground">
          Échéance dans {daysUntilDue} jours
        </span>
      );
    }

    return null;
  };

  const handleAction = (action: string, invoice: Invoice) => {
    if (
      action === "view-details" ||
      action === "download-pdf" ||
      action === "print"
    ) {
      router.push(`/dashboard/accounting/invoices/${invoice._id}`);
      return;
    }

    if (onInvoiceAction) {
      onInvoiceAction(action, invoice);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Toutes les factures ({invoices.length})
          </CardTitle>
          <CardDescription>
            Consultez et gérez les factures de tous vos baux
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune facture trouvée</h3>
              <p className="text-muted-foreground">
                Vous n'avez aucune facture pour le moment.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Facture</TableHead>
                      <TableHead>Propriété</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Date d'échéance</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Days En retard</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentInvoices.map((invoice) => (
                      <TableRow key={invoice._id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="font-medium">
                              {invoice.invoiceNumber}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Émise: {formatDate(invoice.issueDate)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {invoice.propertyId?.name || "N/A"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="font-medium">
                              {formatCurrency(invoice.totalMontant)}
                            </div>
                            {invoice.balanceRemaining > 0 &&
                              invoice.balanceRemaining <
                                invoice.totalMontant && (
                                <div className="text-xs text-muted-foreground">
                                  Reste :{" "}
                                  {formatCurrency(invoice.balanceRemaining)}
                                </div>
                              )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDate(invoice.dueDate)}
                          </div>
                        </TableCell>
                        <TableCell>{getStatutBadge(invoice)}</TableCell>
                        <TableCell>{getEnRetardDisplay(invoice)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Ouvrir le menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  handleAction("view-details", invoice)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                Voir les détails
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleAction("download-pdf", invoice)
                                }
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Télécharger le PDF
                              </DropdownMenuItem>
                              {invoice.status !== "paid" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleAction("make-payment", invoice)
                                  }
                                >
                                  <CreditCard className="mr-2 h-4 w-4" />
                                  Payer
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <GlobalPagination
                currentPage={currentPage}
                totalPages={Math.max(1, Math.ceil(invoices.length / pageSize))}
                totalItems={invoices.length}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                showingLabel={t("common.showing", { defaultValue: "Showing" })}
                previousLabel={t("common.previous", { defaultValue: "Previous" })}
                nextLabel={t("common.next", { defaultValue: "Next" })}
                pageLabel={t("common.page", { defaultValue: "Page" })}
                ofLabel={t("common.of", { defaultValue: "of" })}
                itemsPerPageLabel={t("common.perPage", { defaultValue: "per page" })}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Détails de la facture - {selectedInvoice?.invoiceNumber}
            </DialogTitle>
            <DialogDescription>
              Informations complètes de la facture et lignes
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informations sur la facture</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Numéro de facture
                    </label>
                    <p className="text-lg font-semibold">
                      {selectedInvoice.invoiceNumber}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Propriété
                    </label>
                    <p className="font-semibold">
                      {selectedInvoice.propertyId?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Date d'émission
                    </label>
                    <p>{formatDate(selectedInvoice.issueDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Date d'échéance
                    </label>
                    <p>{formatDate(selectedInvoice.dueDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Statut
                    </label>
                    <div className="mt-1">
                      {getStatutBadge(selectedInvoice)}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Total Montant
                    </label>
                    <p className="text-lg font-semibold">
                      {formatCurrency(selectedInvoice.totalMontant)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Éléments de la facture */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Éléments de la facture</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedInvoice.lineItems.map((item, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center py-2 border-b last:border-b-0"
                      >
                        <span>{item.description}</span>
                        <span className="font-semibold">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t font-semibold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(selectedInvoice.totalMontant)}</span>
                  </div>
                  {selectedInvoice.balanceRemaining > 0 &&
                    selectedInvoice.balanceRemaining <
                      selectedInvoice.totalMontant && (
                      <div className="flex justify-between items-center pt-2 text-orange-600">
                        <span>Solde restant</span>
                        <span className="font-semibold">
                          {formatCurrency(selectedInvoice.balanceRemaining)}
                        </span>
                      </div>
                    )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button
                  onClick={() => handleAction("download-pdf", selectedInvoice)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger le PDF
                </Button>
                {selectedInvoice.status !== "paid" && (
                  <Button
                    onClick={() =>
                      handleAction("make-payment", selectedInvoice)
                    }
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Payer
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
