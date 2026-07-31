"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { ExpenseCatégorie, ExpenseStatut, PaymentMethod } from "@/types";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface Bien {
  id: string;
  name: string;
}

export default function EditExpensePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLocalizationContext();
  const expenseId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [properties, setProperties] = useState<Bien[]>([]);

  // Form state
  const [category, setCatégorie] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setMontant] = useState("");
  const [date, setDate] = useState("");
  const [propertyId, setBienId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [status, setStatut] = useState<ExpenseStatut>(ExpenseStatut.PAID);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [taxDeductible, setTaxDeductible] = useState(false);
  const [expenseNumber, setExpenseNumber] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [expenseRes, propertiesRes] = await Promise.all([
          fetch(`/api/accounting/expenses/${expenseId}`),
          fetch("/api/properties"),
        ]);

        if (propertiesRes.ok) {
          const propData = await propertiesRes.json();
          setProperties(
            (Array.isArray(propData?.data) ? propData.data : []).map(
              (p: any) => ({
                id: p?._id || "",
                name: p?.name || "Bien inconnu",
              }),
            ),
          );
        }

        if (expenseRes.ok) {
          const data = await expenseRes.json();
          const exp = data?.data;
          if (exp) {
            setExpenseNumber(exp.expenseNumber || "");
            setCatégorie(exp.category || "");
            setDescription(exp.description || "");
            setMontant(String(exp.amount || ""));
            const parsedDate = exp?.date ? new Date(exp.date) : null;
            setDate(
              parsedDate && !Number.isNaN(parsedDate.getTime())
                ? parsedDate.toISOString().split("T")[0]
                : "",
            );
            setBienId(exp.propertyId?._id || "none");
            setPaymentMethod(exp.paymentMethod || "");
            setStatut(exp.status || ExpenseStatut.PAID);
            setReferenceNumber(exp.referenceNumber || "");
            setNotes(exp.notes || "");
            setTaxDeductible(exp.taxDeductible || false);
          } else {
            toast.error("Dépense introuvable");
            router.push("/dashboard/accounting/expenses");
          }
        } else {
          toast.error("Échec du chargement de la dépense");
          router.push("/dashboard/accounting/expenses");
        }
      } catch (error) {
        console.error("Échec du chargement des données :", error);
        toast.error("Échec du chargement de la dépense data");
        router.push("/dashboard/accounting/expenses");
      } finally {
        setIsLoading(false);
      }
    };

    if (expenseId) {
      fetchData();
    }
  }, [expenseId, router]);

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
      const res = await fetch(`/api/accounting/expenses/${expenseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description,
          amount: parseFloat(amount),
          date: new Date(date),
          propertyId: propertyId && propertyId !== "none" ? propertyId : undefined,
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
          t("expenses.toasts.updateSuccess", {
            defaultValue: "Dépense mise à jour avec succès",
          })
        );
        router.push(`/dashboard/accounting/expenses/${expenseId}`);
      } else {
        throw new Error(result.error || "Échec de la mise à jour de la dépense");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Échec de la mise à jour de la dépense"
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

  if (isLoading) {
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-7 w-7" />
            {t("expenses.edit.title", { defaultValue: "Modifier la dépense" })}
          </h1>
          <p className="text-muted-foreground text-sm">
            {expenseNumber && (
              <span className="font-mono">{expenseNumber} — </span>
            )}
            {t("expenses.edit.subtitle", {
              defaultValue: "Mettre à jour les détails de la dépense",
            })}
          </p>
        </div>
        <Link href={`/dashboard/accounting/expenses/${expenseId}`}>
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
              {t("expenses.edit.details", { defaultValue: "Détails de la dépense" })}
            </CardTitle>
            <CardDescription>
              {t("expenses.edit.detailsDescription", {
                defaultValue:
                  "Mettez à jour les informations de la dépense. Les champs marqués d'un * sont obligatoires.",
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
                    {Object.values(ExpenseCatégorie).map((cat) => (
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
                  onValueChange={(val) => setStatut(val as ExpenseStatut)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ExpenseStatut).map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="capitalize">
                          {s.replace(/_/g, " ")}
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
                <Select value={propertyId} onValueChange={setBienId}>
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
                        {prop.name}
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
                {t("expenses.form.update", { defaultValue: "Mettre à jour la dépense" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  router.push(`/dashboard/accounting/expenses/${expenseId}`)
                }
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
