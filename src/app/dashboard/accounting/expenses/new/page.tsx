"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Wallet, Loader2 } from "lucide-react";
import { ExpenseCategory, ExpenseStatus, PaymentMethod } from "@/types";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface Bien {
  id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

export default function NewExpensePage() {
  const router = useRouter();
  const { t } = useLocalizationContext();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [properties, setProperties] = useState<Bien[]>([]);

  // Form state
  const [category, setCatégorie] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setMontant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [propertyId, setBienId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [status, setStatut] = useState(ExpenseStatus.PAID);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [taxDeductible, setTaxDeductible] = useState(false);

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const res = await fetch("/api/properties");
        if (res.ok) {
          const data = await res.json();
          setProperties(
            (Array.isArray(data?.data) ? data.data : []).map((p: any) => ({
              id: p?._id || "",
              name: p?.name || "Bien inconnu",
              address: p?.address,
            })),
          );
        }
      } catch (error) {
        console.error("Échec du chargement des biens :", error);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchProperties();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !description || !amount || !date) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (parseFloat(amount) <= 0) {
      toast.error("Le montant doit être supérieur à 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/accounting/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description,
          amount: parseFloat(amount),
          date: new Date(date),
          propertyId: propertyId || undefined,
          paymentMethod: paymentMethod || undefined,
          status,
          referenceNumber: referenceNumber || undefined,
          notes: notes || undefined,
          taxDeductible,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success(
          t("expenses.toasts.createSuccess", {
            defaultValue: "Dépense créée avec succès",
          }),
        );
        router.push("/dashboard/accounting/expenses");
      } else {
        throw new Error(result.error || "Échec de la création de la dépense");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Échec de la création de la dépense",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCatégorieLabel = (cat?: string | null) => {
    const normalizedCatégorie = (cat ?? "unknown").toLowerCase();
    return t(`expenses.categories.${normalizedCatégorie}`, {
      defaultValue: normalizedCatégorie.replace(/_/g, " "),
    });
  };

  const getBienOptionLabel = (property: Bien) => {
    const address = property.address;
    if (!address) return property.name;

    const addressText = [address.street, address.city, address.state]
      .filter(Boolean)
      .join(", ");

    return addressText ? `${property.name} - ${addressText}` : property.name;
  };

  if (isLoadingData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-xl leading-tight font-bold tracking-tight break-normal sm:text-3xl flex items-center gap-2">
            <Wallet className="h-7 w-7" />
            {t("expenses.new.title", { defaultValue: "Ajouter une dépense" })}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("expenses.new.subtitle", {
              defaultValue: "Enregistrer une nouvelle dépense immobilière",
            })}
          </p>
        </div>
        <Link href="/dashboard/accounting/expenses">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("common.back", { defaultValue: "Retour" })}
          </Button>
        </Link>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>
              {t("expenses.new.details", { defaultValue: "Détails de la dépense" })}
            </CardTitle>
            <CardDescription>
              {t("expenses.new.detailsDescription", {
                defaultValue:
                  "Remplissez les informations de la dépense. Les champs marqués d'un * sont obligatoires.",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Row 1: Catégorie + Statut */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">
                  {t("expenses.form.category", { defaultValue: "Catégorie" })} *
                </Label>
                <Select value={category} onValueChange={setCatégorie}>
                  <SelectTrigger id="category">
                    <SelectValue
                      placeholder={t("expenses.form.selectCatégorie", {
                        defaultValue: "Sélectionner une catégorie",
                      })}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ExpenseCategory).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        <span className="capitalize">
                          {getCatégorieLabel(cat)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">
                  {t("expenses.form.status", { defaultValue: "Statut" })}
                </Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatut(val as ExpenseStatus)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ExpenseStatus).map((s) => (
  <SelectItem key={s} value={s}>
    <span className="capitalize">
      {t(`expenses.status.${s.toLowerCase()}`, {
        defaultValue:
          s === ExpenseStatus.PAID
            ? "Payé"
            : s === ExpenseStatus.PENDING
            ? "En attente"
            : s === ExpenseStatus.APPROVED
            ? "Approuvé"
            : s === ExpenseStatus.CANCELLED
            ? "Annulé"
            : s.replace(/_/g, " "),
      })}
    </span>
  </SelectItem>
))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                {t("expenses.form.description", {
                  defaultValue: "Description",
                })}{" "}
                *
              </Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("expenses.form.descriptionPlaceholder", {
                  defaultValue: "Ex. : Réparation de plomberie pour l'unité 3B",
                })}
                maxLength={500}
              />
            </div>

            {/* Row 3: Montant + Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">
                  {t("expenses.form.amount", { defaultValue: "Montant" })} *
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">
                  {t("expenses.form.date", { defaultValue: "Date" })} *
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            {/* Row 4: Bien + Mode de paiement */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="property">
                  {t("expenses.form.property", { defaultValue: "Bien" })}
                </Label>
                <Select
                  value={propertyId || "none"}
                  onValueChange={(value) =>
                    setBienId(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger id="property">
                    <SelectValue
                      placeholder={t("expenses.form.selectBien", {
                        defaultValue: "Sélectionner un bien (facultatif)",
                      })}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("expenses.form.noBien", {
                        defaultValue: "Aucun bien spécifique",
                      })}
                    </SelectItem>
                    {properties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id}>
                        {getBienOptionLabel(prop)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">
                  {t("expenses.form.paymentMethod", {
                    defaultValue: "Mode de paiement",
                  })}
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="paymentMethod">
                    <SelectValue
                      placeholder={t("expenses.form.selectPaymentMethod", {
                        defaultValue: "Sélectionner un mode (facultatif)",
                      })}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(PaymentMethod).map((method) => (
                      <SelectItem key={method} value={method}>
                        <span className="capitalize">
                          {method.replace(/_/g, " ")}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 5: Numéro de référence */}
            <div className="space-y-2">
              <Label htmlFor="referenceNumber">
                {t("expenses.form.referenceNumber", {
                  defaultValue: "Numéro de référence",
                })}
              </Label>
              <Input
                id="referenceNumber"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder={t("expenses.form.referenceNumberPlaceholder", {
                  defaultValue: "Ex. : Chèque n°1234, Facture n°5678",
                })}
              />
            </div>

            {/* Row 6: Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                {t("expenses.form.notes", { defaultValue: "Notes" })}
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("expenses.form.notesPlaceholder", {
                  defaultValue: "Notes supplémentaires concernant cette dépense...",
                })}
                rows={3}
                maxLength={2000}
              />
            </div>

            {/* Row 7: Déductible des impôts */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="taxDeductible" className="text-base">
                  {t("expenses.form.taxDeductible", {
                    defaultValue: "Déductible des impôts",
                  })}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("expenses.form.taxDeductibleDescription", {
                    defaultValue:
                      "Marquer cette dépense comme déductible des impôts pour les rapports",
                  })}
                </p>
              </div>
              <Switch
                id="taxDeductible"
                checked={taxDeductible}
                onCheckedChange={setTaxDeductible}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {t("expenses.form.submit", { defaultValue: "Créer la dépense" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/accounting/expenses")}
              >
                {t("common.cancel", { defaultValue: "Annuler" })}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
