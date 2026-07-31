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

// Groupes de catégories pour le menu déroulant
const INVOICE_CATEGORY_GROUPS: SearchableSelectGroup[] = [
  {
    label: "Frais et charges locataire",
    options: [
      { value: InvoiceType.RENT, label: "Loyer" },
      { value: InvoiceType.SECURITY_DEPOSIT, label: "Dépôt de garantie" },
      { value: InvoiceType.LATE_FEE, label: "Frais de retard" },
      { value: InvoiceType.APPLICATION_FEE, label: "Frais de dossier" },
      { value: InvoiceType.MOVE_IN_FEE, label: "Frais d'emménagement" },
      { value: InvoiceType.MOVE_OUT_FEE, label: "Frais de déménagement" },
      { value: InvoiceType.PET_DEPOSIT, label: "Caution animal de compagnie" },
      { value: InvoiceType.PET_RENT, label: "Loyer animal de compagnie" },
      { value: InvoiceType.PARKING_FEE, label: "Frais de parking" },
      { value: InvoiceType.STORAGE_FEE, label: "Frais de stockage" },
      { value: InvoiceType.LEASE_BREAK_FEE, label: "Frais de rupture de bail" },
      { value: InvoiceType.NSF_FEE, label: "Frais de rejet de paiement" },
    ],
  },
  {
    label: "Services publics (Utilitaires)",
    options: [
      { value: InvoiceType.ELECTRICITY, label: "Électricité" },
      { value: InvoiceType.WATER_SEWER, label: "Eau / Assainissement" },
      { value: InvoiceType.GAS, label: "Gaz" },
      { value: InvoiceType.TRASH, label: "Ordures ménagères" },
      { value: InvoiceType.INTERNET, label: "Internet" },
      { value: InvoiceType.CABLE, label: "Câble" },
      { value: InvoiceType.UTILITY, label: "Services (Général)" },
    ],
  },
  {
    label: "Maintenance et réparations",
    options: [
      { value: InvoiceType.MAINTENANCE, label: "Maintenance" },
      { value: InvoiceType.REPAIR, label: "Réparation" },
      { value: InvoiceType.CLEANING, label: "Nettoyage" },
      { value: InvoiceType.LANDSCAPING, label: "Aménagement paysager" },
    ],
  },
  {
    label: "Autre",
    options: [
      { value: InvoiceType.MANAGEMENT_FEE, label: "Frais de gestion" },
      { value: InvoiceType.LEGAL_FEE, label: "Frais juridiques" },
      { value: InvoiceType.INSURANCE, label: "Assurance" },
      { value: InvoiceType.OTHER, label: "Autre" },
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
              name: p?.name || "Propriété inconnue",
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
              propertyName: l.propertyId?.name || "Bail",
            })),
          );
        }
      } catch (error) {
        console.error("Échec de la récupération des données :", error);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, []);

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
        label: l.propertyName || "Bail",
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
          defaultValue: "Veuillez sélectionner une catégorie",
        }),
      );
      return;
    }

    if (!selectedTenantId) {
      toast.error(
        t("invoices.form.selectTenantError", {
          defaultValue: "Veuillez sélectionner un locataire",
        }),
      );
      return;
    }

    if (!selectedPropertyId) {
      toast.error(
        t("invoices.form.selectPropertyError", {
          defaultValue: "Veuillez sélectionner une propriété",
        }),
      );
      return;
    }

    if (!dueDate) {
      toast.error(
        t("invoices.form.dueDateError", {
          defaultValue: "Veuillez définir une date d'échéance",
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
            "Ajoutez au moins un article avec une description et un montant",
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
            defaultValue: "Facture créée avec succès",
          }),
        );
        router.push("/dashboard/accounting/invoices");
      } else {
        throw new Error(result.error || "Échec de la création de la facture");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Échec de la création de la facture",
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
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("invoices.new.title", { defaultValue: "Créer une facture" })}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("invoices.new.subtitle", {
              defaultValue: "Créer une nouvelle facture pour un locataire",
            })}
          </p>
        </div>
        <Link href="/dashboard/accounting/invoices">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("invoices.new.backToInvoices", {
              defaultValue: "Retour aux factures",
            })}
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="bg-card border rounded-xl p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Catégorie */}
            <div className="space-y-2">
              <Label className="font-semibold">
                {t("invoices.form.category", {
                  defaultValue: "Catégorie et sous-catégorie",
                })}{" "}
                *
              </Label>
              <SearchableSelect
                value={category}
                onValueChange={setCategory}
                groups={INVOICE_CATEGORY_GROUPS}
                placeholder={t("invoices.form.chooseCategory", {
                  defaultValue: "Sélectionner une catégorie...",
                })}
                searchPlaceholder={t("invoices.form.searchCategory", {
                  defaultValue: "Rechercher des catégories...",
                })}
                emptyMessage={t("invoices.form.noCategoryFound", {
                  defaultValue: "Aucune catégorie trouvée.",
                })}
              />
            </div>

            {/* Locataire */}
            <div className="space-y-2">
              <Label className="font-semibold">
                {t("invoices.form.tenant", { defaultValue: "Locataire" })} *
              </Label>
              <SearchableSelect
                value={selectedTenantId}
                onValueChange={setSelectedTenantId}
                options={tenantOptions}
                placeholder={t("invoices.form.chooseTenant", {
                  defaultValue: "Sélectionner un locataire...",
                })}
                searchPlaceholder={t("invoices.form.searchTenant", {
                  defaultValue: "Rechercher par nom...",
                })}
                emptyMessage={t("invoices.form.noTenantFound", {
                  defaultValue: "Aucun locataire trouvé.",
                })}
              />
            </div>

            {/* Propriété */}
            <div className="space-y-2">
              <Label className="font-semibold">
                {t("invoices.form.property", { defaultValue: "Propriété" })} *
              </Label>
              <SearchableSelect
                value={selectedPropertyId}
                onValueChange={setSelectedPropertyId}
                options={propertyOptions}
                placeholder={t("invoices.form.chooseProperty", {
                  defaultValue: selectedTenantId
                    ? "Sélectionner une propriété..."
                    : "Sélectionnez d'abord un locataire...",
                })}
                searchPlaceholder={t("invoices.form.searchProperty", {
                  defaultValue: "Rechercher des propriétés...",
                })}
                emptyMessage={t("invoices.form.noPropertyFound", {
                  defaultValue: selectedTenantId
                    ? "Aucune propriété trouvée pour ce locataire."
                    : "Sélectionnez un locataire pour voir les propriétés valides.",
                })}
              />
            </div>

            {/* Bail (optionnel) */}
            <div className="space-y-2">
              <Label className="font-semibold">
                {t("invoices.form.lease", { defaultValue: "Bail (optionnel)" })}
              </Label>
              <SearchableSelect
                value={selectedLeaseId}
                onValueChange={setSelectedLeaseId}
                options={leaseOptions}
                placeholder={t("invoices.form.chooseLease", {
                  defaultValue: selectedPropertyId
                    ? "Sélectionner un bail..."
                    : "Sélectionnez d'abord une propriété...",
                })}
                searchPlaceholder={t("invoices.form.searchLease", {
                  defaultValue: "Rechercher des baux...",
                })}
                emptyMessage={t("invoices.form.noLeaseFound", {
                  defaultValue:
                    selectedTenantId || selectedPropertyId
                      ? "Aucun bail trouvé pour le locataire/la propriété sélectionnés."
                      : "Sélectionnez un locataire et une propriété pour voir les baux correspondants.",
                })}
              />
            </div>
          </div>

          {/* Dates de création et d'échéance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="issueDate" className="font-semibold">
                {t("invoices.form.dateCreated", {
                  defaultValue: "Date de création",
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
                {t("invoices.form.dueDate", { defaultValue: "Date d'échéance" })}
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Détails des articles */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              {t("invoices.form.itemsDetails", {
                defaultValue: "Détails des articles",
              })}
            </Label>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold text-primary">
                      {t("invoices.form.itemDescription", {
                        defaultValue: "Description de l'article",
                      })}
                    </TableHead>
                    <TableHead className="font-semibold text-primary w-40 text-right">
                      {t("invoices.form.amount", {
                        defaultValue: "Montant",
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
                                "ex: Loyer mensuel, Frais de retard, Service public",
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
              {t("invoices.form.addItem", { defaultValue: "Ajouter un article" })}
            </Button>
          </div>

          {/* Résumé */}
          <div className="bg-muted/30 border rounded-lg p-6">
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("invoices.summary.subTotal", {
                      defaultValue: "Sous-total :",
                    })}
                  </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("invoices.summary.tax", { defaultValue: "Taxe :" })}
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
                      defaultValue: "Remise :",
                    })}
                  </span>
                  <Input
                    type="number"
                    step="0.00"
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
                      defaultValue: "Total général :",
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
                defaultValue: "Notes (optionnel)",
              })}
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("invoices.form.notesPlaceholder", {
                defaultValue: "Ajoutez des notes pour cette facture...",
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
            {t("common.cancel", { defaultValue: "Annuler" })}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("invoices.form.submit", {
              defaultValue: "Créer la facture",
            })}
          </Button>
        </div>
      </form>
    </div>
  );
}
