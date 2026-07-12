/**
 * PropertyPro - Lease Table Component
 * Comprehensive table for displaying and managing tenant leases
 */

"use client";

import React, { useState } from "react";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalPagination } from "@/components/ui/global-pagination";
import {
  Building2,
  Calendar,
  DollarSign,
  Download,
  Eye,
  MoreHorizontal,
  MessageSquare,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Home,
} from "lucide-react";

interface Lease {
  _id: string;
  propertyId: {
    _id: string;
    name: string;
    address:
      | string
      | {
          street?: string;
          city?: string;
          state?: string;
          zipCode?: string;
          country?: string;
        };
    type: string;
  };
  startDate: string;
  endDate: string;
  status: string;
  terms: {
    rentAmount: number;
    securityDeposit?: number;
    lateFee?: number;
  };
  daysUntilExpiration: number;
  daysUntilStart: number;
  isActive: boolean;
  isUpcoming: boolean;
  isExpired: boolean;
  documents?: string[];
  signedDate?: string;
  renewalOptions?: {
    available: boolean;
    terms?: string;
  };
}
import { formatCurrency } from "@/lib/utils/formatting";

interface LeaseTableProps {
  leases: Lease[];
  onLeaseAction?: (action: string, lease: Lease) => void;
  className?: string;
}

const ITEMS_PER_PAGE = 12;

export default function LeaseTable({
  leases,
  onLeaseAction,
  className,
}: LeaseTableProps) {
  const { t, formatDate: formatLocalizedDate } = useLocalizationContext();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentLeases = leases.slice(startIndex, endIndex);

  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat("en-US", {
  //     style: "currency",
  //     currency: "USD",
  //   }).format(amount);
  // };

  const formatDate = (date: string) => {
    return formatLocalizedDate(new Date(date), {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatAddress = (address: Lease["propertyId"]["address"]) => {
    if (!address) {
      return t("leases.labels.addressNotAvailable");
    }

    if (typeof address === "string") {
      return address;
    }

    const { street, city, state, zipCode, country } = address;
    const cityState = [city, state].filter(Boolean).join(", ");
    return (
      [street, cityState, zipCode, country]
        .filter((segment) => segment?.toString().trim().length > 0)
        .join(", ") || t("leases.labels.addressNotAvailable")
    );
  };

  const getStatusBadge = (lease: Lease) => {
    if (lease.isActive) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          {t("leases.status.active")}
        </Badge>
      );
    } else if (lease.isUpcoming) {
      return (
        <Badge variant="outline" className="border-blue-500 text-blue-500">
          <Clock className="w-3 h-3 mr-1" />
          {t("leases.myLeases.status.upcoming")}
        </Badge>
      );
    } else if (lease.isExpired) {
      return (
        <Badge variant="secondary" className="bg-gray-500">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {t("leases.status.expired")}
        </Badge>
      );
    }
    return <Badge variant="outline">{lease.status}</Badge>;
  };

  const getDaysDisplay = (lease: Lease) => {
    if (lease.isActive) {
      if (lease.daysUntilExpiration > 0) {
        return (
          <span className="text-sm text-muted-foreground">
            {t("leases.myLeases.daysRemaining", {
              values: { days: lease.daysUntilExpiration },
            })}
          </span>
        );
      } else if (lease.daysUntilExpiration === 0) {
        return (
          <span className="text-sm text-red-600 font-medium">
            {t("leases.myLeases.expiresToday")}
          </span>
        );
      } else {
        return (
          <span className="text-sm text-red-600">
            {t("leases.myLeases.expiredDaysAgo", {
              values: { days: Math.abs(lease.daysUntilExpiration) },
            })}
          </span>
        );
      }
    } else if (lease.isUpcoming) {
      return (
        <span className="text-sm text-blue-600">
          {t("leases.myLeases.startsInDays", {
            values: { days: lease.daysUntilStart },
          })}
        </span>
      );
    } else if (lease.isExpired) {
      return (
        <span className="text-sm text-gray-600">
          {t("leases.myLeases.expiredDaysAgo", {
            values: { days: Math.abs(lease.daysUntilExpiration) },
          })}
        </span>
      );
    }
    return null;
  };

  const handleAction = (action: string, lease: Lease) => {
    if (action === "view-details") {
      setSelectedLease(lease);
      setShowDetailsDialog(true);
    } else if (onLeaseAction) {
      onLeaseAction(action, lease);
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
            <Building2 className="h-5 w-5" />
            {t("leases.myLeases.card.title", {
              values: { count: leases.length },
            })}
          </CardTitle>
          <CardDescription>
            {t("leases.myLeases.card.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leases.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {t("leases.myLeases.empty.noLeases")}
              </h3>
              <p className="text-muted-foreground">
                {t("leases.myLeases.empty.noLeasesDescription")}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {t("leases.myLeases.table.property")}
                      </TableHead>
                      <TableHead>
                        {t("leases.myLeases.table.leasePeriod")}
                      </TableHead>
                      <TableHead>
                        {t("leases.myLeases.table.monthlyRent")}
                      </TableHead>
                      <TableHead>{t("leases.table.status")}</TableHead>
                      <TableHead>
                        {t("leases.myLeases.table.daysUntil")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("leases.table.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentLeases.map((lease) => (
                      <TableRow key={lease._id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="font-medium">
                              {lease.propertyId.name}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {formatAddress(lease.propertyId.address)}
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {lease.propertyId.type}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="text-sm font-medium">
                              {formatDate(lease.startDate)} -{" "}
                              {formatDate(lease.endDate)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t("leases.myLeases.months", {
                                values: {
                                  count: Math.ceil(
                                    (new Date(lease.endDate).getTime() -
                                      new Date(lease.startDate).getTime()) /
                                      (1000 * 60 * 60 * 24 * 30)
                                  ),
                                },
                              })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="font-medium">
                              {formatCurrency(lease.terms.rentAmount)}
                            </div>
                            {lease.terms.securityDeposit && (
                              <div className="text-xs text-muted-foreground">
                                {t("leases.myLeases.deposit")}{" "}
                                {formatCurrency(lease.terms.securityDeposit)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(lease)}</TableCell>
                        <TableCell>{getDaysDisplay(lease)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">
                                  {t("leases.myLeases.actions.openMenu")}
                                </span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  handleAction("view-details", lease)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                {t("leases.myLeases.actions.viewDetails")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleAction("download-agreement", lease)
                                }
                              >
                                <Download className="mr-2 h-4 w-4" />
                                {t("leases.myLeases.actions.downloadAgreement")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleAction("view-invoices", lease)
                                }
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                {t("leases.myLeases.actions.viewInvoices")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleAction("contact-manager", lease)
                                }
                              >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                {t("leases.myLeases.actions.contactManager")}
                              </DropdownMenuItem>
                              {lease.renewalOptions?.available && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleAction("request-renewal", lease)
                                  }
                                >
                                  <Calendar className="mr-2 h-4 w-4" />
                                  {t("leases.myLeases.actions.requestRenewal")}
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
                totalPages={Math.max(1, Math.ceil(leases.length / pageSize))}
                totalItems={leases.length}
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

      {/* Lease Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t("leases.myLeases.dialog.title")} -{" "}
              {selectedLease?.propertyId.name}
            </DialogTitle>
            <DialogDescription>
              {t("leases.myLeases.dialog.description")}
            </DialogDescription>
          </DialogHeader>

          {selectedLease && (
            <div className="space-y-6">
              {/* Property Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {t("leases.myLeases.dialog.propertyInfo")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("leases.myLeases.dialog.propertyName")}
                    </label>
                    <p className="text-lg font-semibold">
                      {selectedLease.propertyId.name}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("leases.myLeases.dialog.propertyType")}
                    </label>
                    <p className="capitalize">
                      {selectedLease.propertyId.type}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("leases.myLeases.dialog.address")}
                    </label>
                    <p className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {formatAddress(selectedLease.propertyId.address)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Lease Terms */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {t("leases.myLeases.dialog.leaseTerms")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("leases.myLeases.table.leasePeriod")}
                    </label>
                    <p className="font-semibold">
                      {formatDate(selectedLease.startDate)} -{" "}
                      {formatDate(selectedLease.endDate)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("leases.table.status")}
                    </label>
                    <div className="mt-1">{getStatusBadge(selectedLease)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("leases.myLeases.table.monthlyRent")}
                    </label>
                    <p className="text-lg font-semibold">
                      {formatCurrency(selectedLease.terms.rentAmount)}
                    </p>
                  </div>
                  {selectedLease.terms.securityDeposit && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        {t("leases.myLeases.dialog.securityDeposit")}
                      </label>
                      <p className="font-semibold">
                        {formatCurrency(selectedLease.terms.securityDeposit)}
                      </p>
                    </div>
                  )}
                  {selectedLease.terms.lateFee && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        {t("leases.myLeases.dialog.lateFee")}
                      </label>
                      <p className="font-semibold">
                        {formatCurrency(selectedLease.terms.lateFee)}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("leases.myLeases.dialog.signedDate")}
                    </label>
                    <p>
                      {selectedLease.signedDate
                        ? formatDate(selectedLease.signedDate)
                        : t("leases.myLeases.dialog.notSigned")}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Renewal Options */}
              {selectedLease.renewalOptions?.available && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {t("leases.myLeases.dialog.renewalOptions")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-medium">
                        {t("leases.myLeases.dialog.renewalAvailable")}
                      </span>
                    </div>
                    {selectedLease.renewalOptions.terms && (
                      <p className="text-sm text-muted-foreground">
                        {selectedLease.renewalOptions.terms}
                      </p>
                    )}
                    <Button
                      className="mt-4"
                      onClick={() =>
                        handleAction("request-renewal", selectedLease)
                      }
                    >
                      {t("leases.myLeases.actions.requestRenewal")}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button
                  onClick={() =>
                    handleAction("download-agreement", selectedLease)
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t("leases.myLeases.actions.downloadAgreement")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAction("view-invoices", selectedLease)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {t("leases.myLeases.actions.viewInvoices")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleAction("contact-manager", selectedLease)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {t("leases.myLeases.actions.contactManager")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
