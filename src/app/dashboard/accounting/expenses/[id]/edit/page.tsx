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
import { ExpenseCategory, ExpenseStatus, PaymentMethod } from "@/types";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface Property {
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
  const [properties, setProperties] = useState<Property[]>([]);

  // Form state
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [status, setStatus] = useState<ExpenseStatus>(ExpenseStatus.PAID);
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
                name: p?.name || "Unknown Property",
              }),
            ),
          );
        }

        if (expenseRes.ok) {
          const data = await expenseRes.json();
          const exp = data?.data;
          if (exp) {
            setExpenseNumber(exp.expenseNumber || "");
            setCategory(exp.category || "");
            setDescription(exp.description || "");
            setAmount(String(exp.amount || ""));
            const parsedDate = exp?.date ? new Date(exp.date) : null;
            setDate(
              parsedDate && !Number.isNaN(parsedDate.getTime())
                ? parsedDate.toISOString().split("T")[0]
                : "",
            );
            setPropertyId(exp.propertyId?._id || "none");
            setPaymentMethod(exp.paymentMethod || "");
            setStatus(exp.status || ExpenseStatus.PAID);
            setReferenceNumber(exp.referenceNumber || "");
            setNotes(exp.notes || "");
            setTaxDeductible(exp.taxDeductible || false);
          } else {
            toast.error("Expense not found");
            router.push("/dashboard/accounting/expenses");
          }
        } else {
          toast.error("Failed to load expense");
          router.push("/dashboard/accounting/expenses");
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error("Failed to load expense data");
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
      toast.error("Please fill in all required fields");
      return;
    }

    if (parseFloat(amount) <= 0) {
      toast.error("Amount must be greater than 0");
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
            defaultValue: "Expense updated successfully",
          })
        );
        router.push(`/dashboard/accounting/expenses/${expenseId}`);
      } else {
        throw new Error(result.error || "Failed to update expense");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update expense"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryLabel = (cat?: string | null) => {
    const normalizedCategory = (cat ?? "unknown").toLowerCase();
    return t(`expenses.categories.${normalizedCategory}`, {
      defaultValue: normalizedCategory.replace(/_/g, " "),
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
            {t("expenses.edit.title", { defaultValue: "Edit Expense" })}
          </h1>
          <p className="text-muted-foreground text-sm">
            {expenseNumber && (
              <span className="font-mono">{expenseNumber} — </span>
            )}
            {t("expenses.edit.subtitle", {
              defaultValue: "Update expense details",
            })}
          </p>
        </div>
        <Link href={`/dashboard/accounting/expenses/${expenseId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("common.back", { defaultValue: "Back" })}
          </Button>
        </Link>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>
              {t("expenses.edit.details", { defaultValue: "Expense Details" })}
            </CardTitle>
            <CardDescription>
              {t("expenses.edit.detailsDescription", {
                defaultValue:
                  "Update the expense information. Fields marked with * are required.",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Row 1: Category + Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">
                  {t("expenses.form.category", { defaultValue: "Category" })} *
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue
                      placeholder={t("expenses.form.selectCategory", {
                        defaultValue: "Select category",
                      })}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ExpenseCategory).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        <span className="capitalize">
                          {getCategoryLabel(cat)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">
                  {t("expenses.form.status", { defaultValue: "Status" })}
                </Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus(val as ExpenseStatus)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ExpenseStatus).map((s) => (
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
                  defaultValue: "e.g., Plumbing repair for Unit 3B",
                })}
                maxLength={500}
              />
            </div>

            {/* Row 3: Amount + Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">
                  {t("expenses.form.amount", { defaultValue: "Amount" })} *
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
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

            {/* Row 4: Property + Payment Method */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="property">
                  {t("expenses.form.property", { defaultValue: "Property" })}
                </Label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger id="property">
                    <SelectValue
                      placeholder={t("expenses.form.selectProperty", {
                        defaultValue: "Select property (optional)",
                      })}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("expenses.form.noProperty", {
                        defaultValue: "No specific property",
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
                    defaultValue: "Payment Method",
                  })}
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="paymentMethod">
                    <SelectValue
                      placeholder={t("expenses.form.selectPaymentMethod", {
                        defaultValue: "Select method (optional)",
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

            {/* Row 5: Reference Number */}
            <div className="space-y-2">
              <Label htmlFor="referenceNumber">
                {t("expenses.form.referenceNumber", {
                  defaultValue: "Reference Number",
                })}
              </Label>
              <Input
                id="referenceNumber"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder={t("expenses.form.referenceNumberPlaceholder", {
                  defaultValue: "e.g., Check #1234, Invoice #5678",
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
                  defaultValue: "Additional notes about this expense...",
                })}
                rows={3}
                maxLength={2000}
              />
            </div>

            {/* Row 7: Tax Deductible */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="taxDeductible" className="text-base">
                  {t("expenses.form.taxDeductible", {
                    defaultValue: "Tax Deductible",
                  })}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("expenses.form.taxDeductibleDescription", {
                    defaultValue:
                      "Mark this expense as tax deductible for reporting",
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
                {t("expenses.form.update", { defaultValue: "Update Expense" })}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  router.push(`/dashboard/accounting/expenses/${expenseId}`)
                }
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
