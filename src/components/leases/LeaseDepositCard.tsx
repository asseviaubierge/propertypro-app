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
      toast.error("Failed to load deposit");
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
        toast.success("Deposit record created");
        setShowCreate(false);
        fetchDeposit();
      } else {
        toast.error(data.error || "Failed to create deposit");
      }
    } catch {
      toast.error("An error occurred");
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
        toast.success(data.message || "Action completed");
        setShowCollect(false);
        setShowDeduction(false);
        setShowRefund(false);
        fetchDeposit();
      } else {
        toast.error(data.error || "Action failed");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: SecurityDepositStatus) => {
    const config: Record<SecurityDepositStatus, { label: string; className: string }> = {
      [SecurityDepositStatus.PENDING]: {
        label: "Pending",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
      },
      [SecurityDepositStatus.COLLECTED]: {
        label: "Held",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
      },
      [SecurityDepositStatus.PARTIALLY_REFUNDED]: {
        label: "Partial Refund",
        className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
      },
      [SecurityDepositStatus.FULLY_REFUNDED]: {
        label: "Refunded",
        className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
      },
      [SecurityDepositStatus.FORFEITED]: {
        label: "Forfeited",
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
            Security Deposit
          </div>
          {deposit && getStatusBadge(deposit.status)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading deposit…</p>
        ) : !deposit ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No deposit record has been created for this lease yet.
            </p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Deposit Record
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="font-semibold text-base">
                  {formatCurrency(deposit.amount)}
                </p>
              </div>
              {deposit.collectedDate && (
                <div>
                  <p className="text-muted-foreground">Collected</p>
                  <p>{new Date(deposit.collectedDate).toLocaleDateString()}</p>
                </div>
              )}
              {totalDeductions > 0 && (
                <div>
                  <p className="text-muted-foreground">Total Deductions</p>
                  <p className="font-semibold text-red-600">
                    -{formatCurrency(totalDeductions)}
                  </p>
                </div>
              )}
              {deposit.refundAmount && deposit.refundAmount > 0 && (
                <div>
                  <p className="text-muted-foreground">Refunded</p>
                  <p className="font-semibold text-green-600">
                    {formatCurrency(deposit.refundAmount)}
                  </p>
                </div>
              )}
            </div>

            {deposit.deductions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Deductions
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
                  Mark Collected
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
                    Add Deduction
                  </Button>
                  <Button size="sm" onClick={() => setShowRefund(true)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Process Refund
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
            <DialogTitle>Create Security Deposit Record</DialogTitle>
            <DialogDescription>
              Enter the deposit amount to start tracking.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Amount</Label>
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
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={actionLoading || !createAmount}
            >
              {actionLoading ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Collect Dialog */}
      <Dialog open={showCollect} onOpenChange={setShowCollect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Deposit as Collected</DialogTitle>
            <DialogDescription>
              Confirm that the deposit of{" "}
              {deposit && formatCurrency(deposit.amount)} has been received.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCollect(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleAction("collect", {})}
              disabled={actionLoading}
            >
              {actionLoading ? "Processing…" : "Confirm Collection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deduction Dialog */}
      <Dialog open={showDeduction} onOpenChange={setShowDeduction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Deduction</DialogTitle>
            <DialogDescription>
              Record a deduction against the security deposit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category</Label>
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
                  <SelectItem value="damage">Property Damage</SelectItem>
                  <SelectItem value="unpaid_rent">Unpaid Rent</SelectItem>
                  <SelectItem value="cleaning">Cleaning</SelectItem>
                  <SelectItem value="key_replacement">Key Replacement</SelectItem>
                  <SelectItem value="lease_break">Lease Break Fee</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
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
                placeholder="Describe the deduction…"
              />
            </div>
            <div>
              <Label>Amount</Label>
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
              Cancel
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
              {actionLoading ? "Adding…" : "Add Deduction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={showRefund} onOpenChange={setShowRefund}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Process the security deposit refund.
            </DialogDescription>
          </DialogHeader>
          {deposit && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between">
                  <span>Original Deposit</span>
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
                  <span>Refund Amount</span>
                  <span className="text-green-600">
                    {formatCurrency(refundAvailable)}
                  </span>
                </div>
              </div>
              <div>
                <Label>Refund Method</Label>
                <Select value={refundMethod} onValueChange={setRefundMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="original_method">
                      Original Payment Method
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  placeholder="Any notes about the refund…"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefund(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                handleAction("refund", { refundMethod, refundNotes })
              }
              disabled={actionLoading}
            >
              {actionLoading ? "Processing…" : "Process Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
