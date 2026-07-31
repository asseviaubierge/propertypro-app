/**
 * PropertyPro - Grand livre du locataire Component
 * Component for displaying comprehensive tenant financial ledger
 */

"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Filter,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface LedgerEntry {
  id: string;
  date: string;
  type: "debit" | "credit";
  category: string;
  description: string;
  reference: string;
  debitAmount: number;
  creditAmount: number;
  runningSolde: number;
  status: string;
}
import { formatCurrency } from "@/lib/utils/formatting";

interface LedgerSummary {
  tenantName: string;
  propertyName: string;
  periodStart: string;
  periodEnd: string;
  totalDebits: number;
  totalCredits: number;
  currentSolde: number;
  breakdown: Record<string, { debits: number; credits: number }>;
  statusCounts: {
    paidInvoices: number;
    unpaidInvoices: number;
    overdueInvoices: number;
    totalPaiements: number;
  };
}

interface TenantLedgerProps {
  tenantId: string;
  leaseId?: string;
  className?: string;
}

export default function TenantLedger({
  tenantId,
  leaseId,
  className,
}: TenantLedgerProps) {
  const [ledgerData, setLedgerData] = useState<{
    summary: LedgerSummary;
    entrées: LedgerEntry[];
    pagination: any;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    page: 1,
    limit: 50,
  });

  useEffect(() => {
    fetchLedgerData();
  }, [tenantId, leaseId, filters.startDate, filters.endDate, filters.page]);

  const fetchLedgerData = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        page: filters.page.toString(),
        limit: filters.limit.toString(),
      });

      if (leaseId) params.append("leaseId", leaseId);

      const response = await fetch(`/api/tenants/${tenantId}/ledger?${params}`);
      const data = await response.json();

      if (data.success && data.data) {
        setLedgerData(data.data);
      } else {
        toast.error("Impossible de charger le grand livre");
      }
    } catch (error) {
      console.error("Error fetching ledger:", error);
      toast.error("Impossible de charger le grand livre");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        format: "csv",
      });

      if (leaseId) params.append("leaseId", leaseId);

      const response = await fetch(`/api/tenants/${tenantId}/ledger?${params}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tenant_ledger_${tenantId}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Grand livre exporté avec succès");
      } else {
        toast.error("Impossible d'exporter le grand livre");
      }
    } catch (error) {
      console.error("Error exporting ledger:", error);
      toast.error("Impossible d'exporter le grand livre");
    }
  };

  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat("en-US", {
  //     style: "currency",
  //     currency: "USD",
  //   }).format(amount);
  // };

  const getEntryTypeIcon = (type: string) => {
    return type === "debit" ? (
      <TrendingUp className="h-4 w-4 text-red-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-green-500" />
    );
  };

  const getStatutBadge = (status: string) => {
    const statusConfig = {
      paid: { variant: "default" as const, label: "Payé" },
      issued: { variant: "secondary" as const, label: "Émis" },
      overdue: { variant: "destructive" as const, label: "En retard" },
      partial: { variant: "outline" as const, label: "Partiel" },
      completed: { variant: "default" as const, label: "Terminé" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      variant: "outline" as const,
      label: status,
    };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading && !ledgerData) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement du grand livre...
        </CardContent>
      </Card>
    );
  }

  if (!ledgerData) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <Alert>
            <AlertDescription>
              Aucune donnée de grand livre disponible pour ce locataire.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Solde actuel
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                ledgerData.summary.currentSolde > 0
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {formatCurrency(Math.abs(ledgerData.summary.currentSolde))}
            </div>
            <p className="text-xs text-muted-foreground">
              {ledgerData.summary.currentSolde > 0
                ? "Montant dû"
                : "Solde créditeur"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total des charges</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(ledgerData.summary.totalDebits)}
            </div>
            <p className="text-xs text-muted-foreground">Total de la période</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total des paiements
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(ledgerData.summary.totalCredits)}
            </div>
            <p className="text-xs text-muted-foreground">
              {ledgerData.summary.statusCounts.totalPaiements} paiements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En retard Items</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {ledgerData.summary.statusCounts.overdueInvoices}
            </div>
            <p className="text-xs text-muted-foreground">Factures en retard</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Grand livre du locataire
          </CardTitle>
          <CardDescription>
            Historique financier de {ledgerData.summary.tenantName} at{" "}
            {ledgerData.summary.propertyName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Label htmlFor="startDate">Du :</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, startDate: e.target.value }))
                }
                className="w-auto"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="endDate">Au :</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className="w-auto"
              />
            </div>

            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="ml-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Exporter en CSV
            </Button>
          </div>

          {/* Ledger Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="text-right">Débits</TableHead>
                  <TableHead className="text-right">Paiements</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerData.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {new Date(entry.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEntryTypeIcon(entry.type)}
                        <span className="capitalize">{entry.category}</span>
                      </div>
                    </TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>
                      <code className="text-sm">{entry.reference}</code>
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.debitAmount > 0
                        ? formatCurrency(entry.debitAmount)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.creditAmount > 0
                        ? formatCurrency(entry.creditAmount)
                        : "-"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        entry.runningSolde > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {formatCurrency(Math.abs(entry.runningSolde))}
                    </TableCell>
                    <TableCell>{getStatutBadge(entry.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {ledgerData.pagination?.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Affichage{" "}
                {(ledgerData.pagination.page - 1) *
                  ledgerData.pagination.limit +
                  1}{" "}
                to{" "}
                {Math.min(
                  ledgerData.pagination.page * ledgerData.pagination.limit,
                  ledgerData.pagination.total
                )}{" "}
                of {ledgerData.pagination.total} entrées
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                  disabled={ledgerData.pagination.page <= 1}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                  disabled={
                    ledgerData.pagination.page >= ledgerData.pagination.pages
                  }
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
