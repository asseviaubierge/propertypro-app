"use client";

import Link from "next/link";
import { toast } from "sonner";
import { InvoiceType } from "@/types";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useMemo } from "react";
import {
  SearchableSelect,
  type SearchableSelectGroup,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

// Grouped categories for the dropdown
const INVOICE_CATEGORY_GROUPS: SearchableSelectGroup[] = [
  {
    label: "Tenant Charges & Fees",
    options: [
      { value: InvoiceType.RENT, label: "Rent" },
      { value: InvoiceType.SECURITY_DEPOSIT, label: "Security Deposit" },
      { value: InvoiceType.LATE_FEE, label: "Late Fee" },
      { value: InvoiceType.APPLICATION_FEE, label: "Application Fee" },
      { value: InvoiceType.MOVE_IN_FEE, label: "Move-in Fee" },
      { value: InvoiceType.MOVE_OUT_FEE, label: "Move-out Fee" },
      { value: InvoiceType.PET_DEPOSIT, label: "Pet Deposit" },
      { value: InvoiceType.PET_RENT, label: "Pet Rent" },
      { value: InvoiceType.PARKING_FEE, label: "Parking Fee" },
      { value: InvoiceType.STORAGE_FEE, label: "Storage Fee" },
      { value: InvoiceType.LEASE_BREAK_FEE, label: "Lease Break Fee" },
      { value: InvoiceType.NSF_FEE, label: "NSF Fee" },
    ],
  },
  {
    label: "Utilities",
    options: [
      { value: InvoiceType.ELECTRICITY, label: "Electricity" },
      { value: InvoiceType.WATER_SEWER, label: "Water / Sewer" },
      { value: InvoiceType.GAS, label: "Gas" },
      { value: InvoiceType.TRASH, label: "Trash" },
      { value: InvoiceType.INTERNET, label: "Internet" },
      { value: InvoiceType.CABLE, label: "Cable" },
      { value: InvoiceType.UTILITY, label: "Utility (General)" },
    ],
  },
  {
    label: "Maintenance & Repairs",
    options: [
      { value: InvoiceType.MAINTENANCE, label: "Maintenance" },
      { value: InvoiceType.REPAIR, label: "Repair" },
      { value: InvoiceType.CLEANING, label: "Cleaning" },
      { value: InvoiceType.LANDSCAPING, label: "Landscaping" },
    ],
  },
  {
    label: "Other",
    options: [
      { value: InvoiceType.MANAGEMENT_FEE, label: "Management Fee" },
      { value: InvoiceType.LEGAL_FEE, label: "Legal Fee" },
      { value: InvoiceType.INSURANCE, label: "Insurance" },
      { value: InvoiceType.OTHER, label: "Other" },
    ],
  },
];

function getInitials(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
}

function formatLeaseDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString();
}

interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
}

interface Property {
  id: string;
  name: string;
}

interface LeaseOption {
  id: string;
  tenantId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  propertyName?: string;
}

interface LineItem {
  description: string;
  amount: number;
}

const EMPTY_LINE_ITEM: LineItem = {
  description: "",
  amount: 0,
};

export default function NewInvoicePage() {
  const router = useRouter();
  const { t, formatCurrency } = useLocalizationContext();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<LeaseOption[]>([]);

  // Form state
  const [category, setCategory] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedLeaseId, setSelectedLeaseId] = useState("");
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [dueDate, setDueDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [taxAmount, setTaxAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { ...EMPTY_LINE_ITEM },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tenantsRes, propertiesRes, leasesRes] = await Promise.all([
          fetch("/api/tenants"),
          fetch("/api/properties"),
          fetch("/api/leases"),
        ]);

        if (tenantsRes.ok) {
          const data = await tenantsRes.json();
          setTenants(
            (Array.isArray(data?.data) ? data.data : []).map((t: any) => ({
              id: t?._id || "",
              firstName: t?.firstName || "",
              lastName: t?.lastName || "",
            })),
          );
        }

        if (propertiesRes.ok) {
          const data = await propertiesRes.json();
          setProperties(
            (Array.isArray(data?.data) ? data.data : []).map((p: any) => ({
              id: p?._id || "",
              name: p?.name || "Unknown Property",
            })),
          );
        }

        if (leasesRes.ok) {
          const data = await leasesRes.json();
          setLeases(
            (Array.isArray(data?.data) ? data.data : []).map((l: any) => ({
              id: l?._id || "",
              tenantId: l.tenantId?._id || l.tenantId,
              propertyId: l.propertyId?._id || l.propertyId,
              startDate: l.startDate,
              endDate: l.endDate,
              propertyName: l.propertyId?.name || "Lease",
            })),
          );
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, []);

  // Build searchable options with avatars / subtitles
  const tenantOptions: SearchableSelectOption[] = useMemo(
    () =>
      tenants.map((t) => ({
        value: t.id,
        label: `${t.firstName} ${t.lastName}`,
        icon: (
          <Avatar className="h-7 w-7 text-xs">
            <AvatarFallback>
              {getInitials(t.firstName, t.lastName)}
            </AvatarFallback>
          </Avatar>
        ),
      })),
    [tenants],
  );

  const filteredProperties = useMemo(() => {
    if (!selectedTenantId) return properties;

    const allowedPropertyIds = new Set(
      leases
        .filter((lease) => lease.tenantId === selectedTenantId)
        .map((lease) => lease.propertyId),
    );

    return properties.filter((property) => allowedPropertyIds.has(property.id));
  }, [leases, properties, selectedTenantId]);

  const propertyOptions: SearchableSelectOption[] = useMemo(
    () =>
      filteredProperties.map((p) => ({
        value: p.id,
        label: p.name,
      })),
    [filteredProperties],
  );

  const filteredLeases = leases.filter((l) => {
    if (selectedTenantId && l.tenantId !== selectedTenantId) return false;
    if (selectedPropertyId && l.propertyId !== selectedPropertyId) return false;
    return true;
  });

  const leaseOptions: SearchableSelectOption[] = useMemo(
    () =>
      filteredLeases.map((l) => ({
        value: l.id,
        label: l.propertyName || "Lease",
        subtitle: `${formatLeaseDate(l?.startDate)} - ${formatLeaseDate(l?.endDate)}`,
      })),
    [filteredLeases],
  );

  useEffect(() => {
    if (
      selectedPropertyId &&
      !filteredProperties.some((property) => property.id === selectedPropertyId)
    ) {
      setSelectedPropertyId("");
    }
  }, [filteredProperties, selectedPropertyId]);

  useEffect(() => {
    if (
      selectedLeaseId &&
      !filteredLeases.some((lease) => lease.id === selectedLeaseId)
    ) {
      setSelectedLeaseId("");
    }
  }, [filteredLeases, selectedLeaseId]);

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems((prev) => [...prev, { ...EMPTY_LINE_ITEM }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const tax = parseFloat(taxAmount) || 0;
  const discount = parseFloat(discountAmount) || 0;
  const total = Math.max(0, subtotal + tax - discount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category) {
      toast.error(
        t("invoices.form.selectCategoryError", {
          defaultValue: "Please select a category",
        }),
      );
      return;
    }

    if (!selectedTenantId) {
      toast.error(
        t("invoices.form.selectTenantError", {
          defaultValue: "Please select a tenant",
        }),
      );
      return;
    }

    if (!selectedPropertyId) {
      toast.error(
        t("invoices.form.selectPropertyError", {
          defaultValue: "Please select a property",
        }),
      );
      return;
    }

    if (!dueDate) {
      toast.error(
        t("invoices.form.dueDateError", {
          defaultValue: "Please set a due date",
        }),
      );
      return;
    }

    const validItems = lineItems.filter(
      (item) => item.description && item.amount > 0,
    );
    if (validItems.length === 0) {
      toast.error(
        t("invoices.form.lineItemsError", {
          defaultValue:
            "Add at least one line item with a description and amount",
        }),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          tenantId: selectedTenantId,
          propertyId: selectedPropertyId,
          leaseId: selectedLeaseId || undefined,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          taxAmount: tax,
          discountAmount: discount,
          notes: notes || undefined,
          lineItems: validItems.map((item) => ({
            description: item.description,
            amount: item.amount,
            type: category,
          })),
        }),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success(
          t("invoices.toasts.createSuccess", {
            defaultValue: "Invoice created successfully",
          }),
        );
        router.push("/dashboard/accounting/invoices");
      } else {
        throw new Error(result.error || "Failed to create invoice");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create invoice",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="bg-card border rounded-xl p-6 space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("invoices.new.title", { defaultValue: "Create Invoice" })}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("invoices.new.subtitle", {
              defaultValue: "Create a new invoice for a tenant",
            })}
          </p>
        </div>
        <Link href="/dashboard/accounting/invoices">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("invoices.new.backToInvoices", {
              defaultValue: "Back to Invoices",
            })}
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-card border rounded-xl p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category & Subcategory */}
            <div className="space-y-2">
              <Label className="font-semibold">
                {t("invoices.form.category", {
                  defaultValue: "Category & Subcategory",
                })}{" "}
                *
              </Label>
              <SearchableSelect
                value={category}
                onValueChange={setCategory}
                groups={INVOICE_CATEGORY_GROUPS}
                placeholder={t("invoices.form.chooseCategory", {
                  defaultValue: "Select a category...",
                })}
                searchPlaceholder={t("invoices.form.searchCategory", {
                  defaultValue: "Search categories...",
                })}
                emptyMessage={t("invoices.form.noCategoryFound", {
                  defaultValue: "No category found.",
                })}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">
                {t("invoices.form.tenant", { defaultValue: "Tenant" })} *
              </Label>
              <SearchableSelect
                value={selectedTenantId}
                onValueChange={setSelectedTenantId}
                options={tenantOptions}
                placeholder={t("invoices.form.chooseTenant", {
                  defaultValue: "Select a tenant...",
                })}
                searchPlaceholder={t("invoices.form.searchTenant", {
                  defaultValue: "Search by name...",
                })}
                emptyMessage={t("invoices.form.noTenantFound", {
                  defaultValue: "No tenant found.",
                })}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">
                {t("invoices.form.property", { defaultValue: "Property" })} *
              </Label>
              <SearchableSelect
                value={selectedPropertyId}
                onValueChange={setSelectedPropertyId}
                options={propertyOptions}
                placeholder={t("invoices.form.chooseProperty", {
                  defaultValue: selectedTenantId
                    ? "Select a property..."
                    : "Select a tenant first...",
                })}
                searchPlaceholder={t("invoices.form.searchProperty", {
                  defaultValue: "Search properties...",
                })}
                emptyMessage={t("invoices.form.noPropertyFound", {
                  defaultValue: selectedTenantId
                    ? "No property found for this tenant."
                    : "Select a tenant to see valid properties.",
                })}
              />
            </div>

            {/* Lease (optional) */}
            <div className="space-y-2">
              <Label className="font-semibold">
                {t("invoices.form.lease", { defaultValue: "Lease (optional)" })}
              </Label>
              <SearchableSelect
                value={selectedLeaseId}
                onValueChange={setSelectedLeaseId}
                options={leaseOptions}
                placeholder={t("invoices.form.chooseLease", {
                  defaultValue: selectedPropertyId
                    ? "Select a lease..."
                    : "Select a property first...",
                })}
                searchPlaceholder={t("invoices.form.searchLease", {
                  defaultValue: "Search leases...",
                })}
                emptyMessage={t("invoices.form.noLeaseFound", {
                  defaultValue:
                    selectedTenantId || selectedPropertyId
                      ? "No lease found for the selected tenant/property."
                      : "Select a tenant and property to see matching leases.",
                })}
              />
            </div>
          </div>

          {/* Date Created & Due Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="issueDate" className="font-semibold">
                {t("invoices.form.dateCreated", {
                  defaultValue: "Date Created",
                })}
              </Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate" className="font-semibold">
                {t("invoices.form.dueDate", { defaultValue: "Due Date" })}
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Items Details */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              {t("invoices.form.itemsDetails", {
                defaultValue: "Items Details",
              })}
            </Label>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold text-primary">
                      {t("invoices.form.itemDescription", {
                        defaultValue: "Item Description",
                      })}
                    </TableHead>
                    <TableHead className="font-semibold text-primary w-40 text-right">
                      {t("invoices.form.amount", {
                        defaultValue: "Amount",
                      })}
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) =>
                            updateLineItem(index, "description", e.target.value)
                          }
                          placeholder={t(
                            "invoices.form.itemDescriptionPlaceholder",
                            {
                              defaultValue:
                                "e.g., Monthly Rent, Late Fee, Utility",
                            },
                          )}
                          maxLength={200}
                          className="border-0 shadow-none px-0 focus-visible:ring-0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.amount || ""}
                          onChange={(e) => {
                            const amount = parseFloat(e.target.value) || 0;
                            updateLineItem(index, "amount", amount);
                          }}
                          placeholder="0.00"
                          className="border-0 shadow-none px-0 focus-visible:ring-0 text-right"
                        />
                      </TableCell>
                      <TableCell className="px-1">
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(index)}
                            className="p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLineItem}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t("invoices.form.addItem", { defaultValue: "Add Item" })}
            </Button>
          </div>

          {/* Summary */}
          <div className="bg-muted/30 border rounded-lg p-6">
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("invoices.summary.subTotal", {
                      defaultValue: "Sub Total:",
                    })}
                  </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("invoices.summary.tax", { defaultValue: "Tax:" })}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    placeholder="0"
                    className="h-8 w-24 text-sm text-right"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("invoices.summary.discount", {
                      defaultValue: "Discount:",
                    })}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    placeholder="0"
                    className="h-8 w-24 text-sm text-right"
                  />
                </div>

                <div className="border-t pt-3 flex items-center justify-between">
                  <span className="font-bold">
                    {t("invoices.summary.grandTotal", {
                      defaultValue: "Grand Total:",
                    })}
                  </span>
                  <span className="font-bold text-lg">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="font-semibold">
              {t("invoices.form.notesOptional", {
                defaultValue: "Notes (optional)",
              })}
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("invoices.form.notesPlaceholder", {
                defaultValue: "Add any notes for this invoice...",
              })}
              rows={4}
              maxLength={1000}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/accounting/invoices")}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("invoices.form.submit", {
              defaultValue: "Create Invoice",
            })}
          </Button>
        </div>
      </form>
    </div>
  );
}
