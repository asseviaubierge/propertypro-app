"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  DollarSign,
  RefreshCw,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SecurityDepositStatus, DeductionCategory } from "@/types";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";
import { toast } from "sonner";

interface Deduction {
  _id: string;
  category: string;
  description: string;
  amount: number;
  createdAt: string;
}

interface Deposit {
  _id: string;
  amount: number;
  status: SecurityDepositStatus;
  collectedDate?: string;
  deductions: Deduction[];
  refundAmount?: number;
  refundDate?: string;
  refundMethod?: string;
  notes?: string;
}

interface LeaseDepositCardProps {
  leaseId: string;
  fallbackAmount: number;
}

export function LeaseDepositCard({
  leaseId,
  fallbackAmount,
}: LeaseDepositCardProps) {
  const { formatCurrency } = useLocalizationContext();
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showCollect, setShowCollect] = useState(false);
  const [showDeduction, setShowDeduction] = useState(false);
  const [showRefund, setShowRefund] = useState(false);

  const [createAmount, setCreateAmount] = useState(fallbackAmount.toString());
  const [deductionForm, setDeductionForm] = useState({
    category: DeductionCategory.DAMAGE as string,
    description: "",
    amount: "",
  });
  const [refundMethod, setRefundMethod] = useState("bank_transfer");
  const [refundNotes, setRefundNotes] = useState("");

  const fetchDeposit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/security-deposits?leaseId=${leaseId}`);
      const data = await res.json();
      if (data.success) {
        setDeposit(data.data.deposits?.[0] || null);
      }
    } catch {
      toast.error("Échec du chargement");
    } finally {
      setLoading(false);
    }
  }, [leaseId]);

  useEffect(() => {
    fetchDeposit();
  }, [fetchDeposit]);

  const handleCreate = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/security-deposits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaseId,
          amount: parseFloat(createAmount),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Dépôt créé");
        setShowCreate(false);
        fetchDeposit();
      } else {
        toast.error(data.error || "Échec de création");
      }
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async (action: string, body: any) => {
    if (!deposit) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/security-deposits/${deposit._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Action réussie");
        setShowCollect(false);
        setShowDeduction(false);
        setShowRefund(false);
        fetchDeposit();
      } else {
        toast.error(data.error || "Échec de l'action");
      }
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: SecurityDepositStatus) => {
    const config: Record<SecurityDepositStatus, { label: string; className: string }> = {
      [SecurityDepositStatus.PENDING]: {
        label: "En attente",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
      },
      [SecurityDepositStatus.COLLECTED]: {
        label: "En dépôt",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
      },
      [SecurityDepositStatus.PARTIALLY_REFUNDED]: {
        label: "Remb. partiel",
        className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
      },
      [SecurityDepositStatus.FULLY_REFUNDED]: {
        label: "Remboursé",
        className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
      },
      [SecurityDepositStatus.FORFEITED]: {
        label: "Perdu",
        className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
      },
    };
    const c = config[status];
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  const totalDeductions =
    deposit?.deductions?.reduce((s, d) => s + d.amount, 0) || 0;
  const refundAvailable = deposit ? deposit.amount - totalDeductions : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <ShieldCheck className="h-5 w-5 text-warning" />
            </div>
            Garantie
          </div>
          {deposit && getStatusBadge(deposit.status)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : !deposit ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Aucun dépôt enregistré pour ce bail.
            </p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Créer un dépôt
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Montant</p>
                <p className="font-semibold text-base">
                  {formatCurrency(deposit.amount)}
                </p>
              </div>
              {deposit.collectedDate && (
                <div>
                  <p className="text-muted-foreground">Collecté</p>
                  <p>{new Date(deposit.collectedDate).toLocaleDateString()}</p>
                </div>
              )}
              {totalDeductions > 0 && (
                <div>
                  <p className="text-muted-foreground">Déductions</p>
                  <p className="font-semibold text-red-600">
                    -{formatCurrency(totalDeductions)}
                  </p>
                </div>
              )}
              {deposit.refundAmount && deposit.refundAmount > 0 && (
                <div>
                  <p className="text-muted-foreground">Remboursé</p>
                  <p className="font-semibold text-green-600">
                    {formatCurrency(deposit.refundAmount)}
                  </p>
                </div>
              )}
            </div>

            {deposit.deductions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Déductions
                </p>
                {deposit.deductions.map((d) => (
                  <div
                    key={d._id}
                    className="flex justify-between items-center p-2 rounded bg-muted text-sm"
                  >
                    <div>
                      <span className="font-medium capitalize">
                        {d.category.replace("_", " ")}
                      </span>
                      <span className="text-muted-foreground ml-2">
                        {d.description}
                      </span>
                    </div>
                    <span className="text-red-600 font-medium">
                      -{formatCurrency(d.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {deposit.status === SecurityDepositStatus.PENDING && (
                <Button size="sm" onClick={() => setShowCollect(true)}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Marquer collecté
                </Button>
              )}
              {deposit.status === SecurityDepositStatus.COLLECTED && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDeductionForm({
                        category: DeductionCategory.DAMAGE,
                        description: "",
                        amount: "",
                      });
                      setShowDeduction(true);
                    }}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Ajouter déduction
                  </Button>
                  <Button size="sm" onClick={() => setShowRefund(true)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Rembourser
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un dépôt</DialogTitle>
            <DialogDescription>
              Entrez le montant du dépôt.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Montant</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={createAmount}
              onChange={(e) => setCreateAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={actionLoading || !createAmount}
            >
              {actionLoading ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collect Dialog */}
      <Dialog open={showCollect} onOpenChange={setShowCollect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer collecte</DialogTitle>
            <DialogDescription>
              Confirmer la réception de{" "}
              {deposit && formatCurrency(deposit.amount)}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCollect(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => handleAction("collect", {})}
              disabled={actionLoading}
            >
              {actionLoading ? "Traitement..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deduction Dialog */}
      <Dialog open={showDeduction} onOpenChange={setShowDeduction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter déduction</DialogTitle>
            <DialogDescription>
              Enregistrer une retenue sur le dépôt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Catégorie</Label>
              <Select
                value={deductionForm.category}
                onValueChange={(v) =>
                  setDeductionForm({ ...deductionForm, category: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="damage">Dégradations</SelectItem>
                  <SelectItem value="unpaid_rent">Loyer impayé</SelectItem>
                  <SelectItem value="cleaning">Ménage</SelectItem>
                  <SelectItem value="key_replacement">Clés perdues</SelectItem>
                  <SelectItem value="lease_break">Frais rupture</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={deductionForm.description}
                onChange={(e) =>
                  setDeductionForm({
                    ...deductionForm,
                    description: e.target.value,
                  })
                }
                placeholder="Détails de la retenue..."
              />
            </div>
            <div>
              <Label>Montant</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={deductionForm.amount}
                onChange={(e) =>
                  setDeductionForm({
                    ...deductionForm,
                    amount: e.target.value,
                  })
                }
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeduction(false)}>
              Annuler
            </Button>
            <Button
              onClick={() =>
                handleAction("add-deduction", {
                  category: deductionForm.category,
                  description: deductionForm.description,
                  amount: parseFloat(deductionForm.amount),
                })
              }
              disabled={
                actionLoading ||
                !deductionForm.description ||
                !deductionForm.amount
              }
            >
              {actionLoading ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={showRefund} onOpenChange={setShowRefund}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Effectuer remboursement</DialogTitle>
            <DialogDescription>
              Rembourser le dépôt restant.
            </DialogDescription>
          </DialogHeader>
          {deposit && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between">
                  <span>Dépôt initial</span>
                  <span className="font-medium">
                    {formatCurrency(deposit.amount)}
                  </span>
                </div>
                {deposit.deductions.map((d) => (
                  <div
                    key={d._id}
                    className="flex justify-between text-sm text-red-600"
                  >
                    <span>
                      {d.category.replace("_", " ")} — {d.description}
                    </span>
                    <span>-{formatCurrency(d.amount)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>À rembourser</span>
                  <span className="text-green-600">
                    {formatCurrency(refundAvailable)}
                  </span>
                </div>
              </div>
              <div>
                <Label>Méthode</Label>
                <Select value={refundMethod} onValueChange={setRefundMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Virement</SelectItem>
                    <SelectItem value="check">Chèque</SelectItem>
                    <SelectItem value="original_method">
                      Moyen original
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes (optionnel)</Label>
                <Textarea
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  placeholder="Notes sur le remboursement..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefund(false)}>
              Annuler
            </Button>
            <Button
              onClick={() =>
                handleAction("refund", { refundMethod, refundNotes })
              }
              disabled={actionLoading}
            >
              {actionLoading ? "Traitement..." : "Rembourser"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
