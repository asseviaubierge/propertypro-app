/**
 * PropertyPro - Invoice Table Component
 * Comprehensive table for displaying and managing tenant invoices across all leases
 */

"use client";

import React, { useState } from "react";
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
  totalAmount: number;
  balanceRemaining: number;
  daysOverdue: number;
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
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (invoice: Invoice) => {
    switch (invoice.status.toLowerCase()) {
      case "paid":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        );
      case "overdue":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Overdue
          </Badge>
        );
      case "partial":
        return (
          <Badge variant="secondary" className="bg-yellow-500">
            <Clock className="w-3 h-3 mr-1" />
            Partial
          </Badge>
        );
      case "issued":
      default:
        return (
          <Badge variant="outline">
            <FileText className="w-3 h-3 mr-1" />
            Issued
          </Badge>
        );
    }
  };

  const getOverdueDisplay = (invoice: Invoice) => {
    if (invoice.status === "paid") {
      return <span className="text-sm text-green-600">Paid</span>;
    }

    if (invoice.daysOverdue > 0) {
      return (
        <span className="text-sm text-red-600 font-medium">
          {invoice.daysOverdue} days overdue
        </span>
      );
    }

    const daysUntilDue = Math.ceil(
      (new Date(invoice.dueDate).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysUntilDue === 0) {
      return (
        <span className="text-sm text-orange-600 font-medium">Due today</span>
      );
    } else if (daysUntilDue > 0) {
      return (
        <span className="text-sm text-muted-foreground">
          Due in {daysUntilDue} days
        </span>
      );
    }

    return null;
  };

  const handleAction = (action: string, invoice: Invoice) => {
    if (action === "view-details") {
      setSelectedInvoice(invoice);
      setShowDetailsDialog(true);
    } else if (onInvoiceAction) {
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
            All Invoices ({invoices.length})
          </CardTitle>
          <CardDescription>
            View and manage invoices across all your leases
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Invoices Found</h3>
              <p className="text-muted-foreground">
                You don't have any invoices at this time.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Days Overdue</TableHead>
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
                              Issued: {formatDate(invoice.issueDate)}
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
                              {formatCurrency(invoice.totalAmount)}
                            </div>
                            {invoice.balanceRemaining > 0 &&
                              invoice.balanceRemaining <
                                invoice.totalAmount && (
                                <div className="text-xs text-muted-foreground">
                                  Balance:{" "}
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
                        <TableCell>{getStatusBadge(invoice)}</TableCell>
                        <TableCell>{getOverdueDisplay(invoice)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
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
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleAction("download-pdf", invoice)
                                }
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                              </DropdownMenuItem>
                              {invoice.status !== "paid" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleAction("make-payment", invoice)
                                  }
                                >
                                  <CreditCard className="mr-2 h-4 w-4" />
                                  Make Payment
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
              Invoice Details - {selectedInvoice?.invoiceNumber}
            </DialogTitle>
            <DialogDescription>
              Complete invoice information and line items
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Invoice Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Invoice Number
                    </label>
                    <p className="text-lg font-semibold">
                      {selectedInvoice.invoiceNumber}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Property
                    </label>
                    <p className="font-semibold">
                      {selectedInvoice.propertyId?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Issue Date
                    </label>
                    <p>{formatDate(selectedInvoice.issueDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Due Date
                    </label>
                    <p>{formatDate(selectedInvoice.dueDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Status
                    </label>
                    <div className="mt-1">
                      {getStatusBadge(selectedInvoice)}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Total Amount
                    </label>
                    <p className="text-lg font-semibold">
                      {formatCurrency(selectedInvoice.totalAmount)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Line Items</CardTitle>
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
                    <span>{formatCurrency(selectedInvoice.totalAmount)}</span>
                  </div>
                  {selectedInvoice.balanceRemaining > 0 &&
                    selectedInvoice.balanceRemaining <
                      selectedInvoice.totalAmount && (
                      <div className="flex justify-between items-center pt-2 text-orange-600">
                        <span>Balance Remaining</span>
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
                  Download PDF
                </Button>
                {selectedInvoice.status !== "paid" && (
                  <Button
                    onClick={() =>
                      handleAction("make-payment", selectedInvoice)
                    }
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Make Payment
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
