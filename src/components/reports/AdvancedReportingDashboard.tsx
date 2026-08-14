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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  Clock,
  Filter,
  Share,
  Mail,
  Printer,
  Eye,
  Plus,
} from "lucide-react";

interface ReportData {
  id: string;
  name: string;
  type: "financial" | "occupancy" | "maintenance" | "tenant" | "payment";
  description: string;
  lastGenerated: Date;
  frequency:
    | "daily"
    | "weekly"
    | "monthly"
    | "quarterly"
    | "yearly"
    | "on-demand";
  status: "active" | "inactive" | "generating" | "error";
  recipients: string[];
  format: "pdf" | "excel" | "csv" | "dashboard";
}

interface FinancialMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  occupancyRate: number;
  averageRent: number;
  collectionRate: number;
  monthlyTrend: Array<{
    month: string;
    revenue: number;
    expenses: number;
    netIncome: number;
  }>;
}
import { formatCurrency } from "@/lib/utils/formatting";

export default function AdvancedReportingDashboard() {
  const [reports, setReports] = useState<ReportData[]>([
    {
      id: "rpt_1",
      name: "Monthly Financial Summary",
      type: "financial",
      description:
        "Comprehensive financial overview including revenue, expenses, and net income",
      lastGenerated: new Date("2024-01-31T23:59:00"),
      frequency: "monthly",
      status: "active",
      recipients: ["owner@property.com", "accountant@firm.com"],
      format: "pdf",
    },
    {
      id: "rpt_2",
      name: "Analyse de l’occupation",
      type: "occupancy",
      description:
        "Detailed occupancy rates, vacancy analysis, and turnover metrics",
      lastGenerated: new Date("2024-02-01T08:00:00"),
      frequency: "weekly",
      status: "active",
      recipients: ["manager@property.com"],
      format: "excel",
    },
    {
      id: "rpt_3",
      name: "Payment Collection Report",
      type: "payment",
      description: "Payment status, aging report, and collection performance",
      lastGenerated: new Date("2024-02-01T09:00:00"),
      frequency: "daily",
      status: "active",
      recipients: ["finance@property.com"],
      format: "dashboard",
    },
  ]);

  const [financialMetrics, setFinancialMetrics] = useState<FinancialMetrics>({
    totalRevenue: 125000,
    totalExpenses: 45000,
    netIncome: 80000,
    occupancyRate: 0.94,
    averageRent: 1650,
    collectionRate: 0.96,
    monthlyTrend: [
      { month: "Aug", revenue: 118000, expenses: 42000, netIncome: 76000 },
      { month: "Sep", revenue: 120000, expenses: 43000, netIncome: 77000 },
      { month: "Oct", revenue: 122000, expenses: 44000, netIncome: 78000 },
      { month: "Nov", revenue: 123000, expenses: 44500, netIncome: 78500 },
      { month: "Dec", revenue: 124000, expenses: 45000, netIncome: 79000 },
      { month: "Jan", revenue: 125000, expenses: 45000, netIncome: 80000 },
    ],
  });

  const [selectedDateRange, setSelectedDateRange] = useState("last_30_days");
  const [selectedReportType, setSelectedReportType] = useState("all");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat('en-US', {
  //     style: 'currency',
  //     currency: 'USD',
  //   }).format(amount);
  // };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getStatusBadge = (status: ReportData["status"]) => {
    const statusConfig = {
      active: { label: "Actif", variant: "default" },
      inactive: { label: "Inactif", variant: "secondary" },
      generating: { label: "Generating", variant: "default" },
      error: { label: "Error", variant: "destructive" },
    };

    const config = statusConfig[status];
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const getTypeIcon = (type: ReportData["type"]) => {
    switch (type) {
      case "financial":
        return <DollarSign className="h-4 w-4" />;
      case "occupancy":
        return <Building2 className="h-4 w-4" />;
      case "tenant":
        return <Users className="h-4 w-4" />;
      case "payment":
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const handleGenerateReport = async (reportId: string) => {
    setIsGeneratingReport(true);
    // Simulate report generation
    setTimeout(() => {
      setIsGeneratingReport(false);
      // Update report status
      setReports(
        reports.map((report) =>
          report.id === reportId
            ? { ...report, lastGenerated: new Date(), status: "active" }
            : report
        )
      );
    }, 3000);
  };

  const handleExportReport = (format: string) => {};

  const handleScheduleReport = () => {};

  const filteredReports = reports.filter(
    (report) =>
      selectedReportType === "all" || report.type === selectedReportType
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Advanced Reporting
          </h2>
          <p className="text-muted-foreground">
            Generate comprehensive reports and analytics for your property
            portfolio
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Créer le rapport
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Créer un rapport personnalisé</DialogTitle>
                <DialogDescription>
                  Configure a new report with custom parameters and scheduling
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="report-name">Nom du rapport</Label>
                    <Input id="report-name" placeholder="Saisir le nom du rapport" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="report-type">Type de rapport</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="financial">Financier</SelectItem>
                        <SelectItem value="occupancy">Occupation</SelectItem>
                        <SelectItem value="payment">Paiement</SelectItem>
                        <SelectItem value="tenant">Locataire</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" placeholder="Report description" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="frequency">Fréquence</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner la fréquence" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Quotidienne</SelectItem>
                        <SelectItem value="weekly">Hebdomadaire</SelectItem>
                        <SelectItem value="monthly">Mensuelle</SelectItem>
                        <SelectItem value="quarterly">Trimestrielle</SelectItem>
                        <SelectItem value="yearly">Annuelle</SelectItem>
                        <SelectItem value="on-demand">À la demande</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="format">Format</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="excel">Excel</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="dashboard">Tableau de bord</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipients">Destinataires par e-mail</Label>
                  <Input
                    id="recipients"
                    placeholder="email1@example.com, email2@example.com"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline">Enregistrer le brouillon</Button>
                  <Button>Créer le rapport</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d’ensemble</TabsTrigger>
          <TabsTrigger value="financial">Financier</TabsTrigger>
          <TabsTrigger value="occupancy">Occupation</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger value="scheduled">Rapports planifiés</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Revenu total
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(financialMetrics.totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  +2.5% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Net Income
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(financialMetrics.netIncome)}
                </div>
                <p className="text-xs text-muted-foreground">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  +1.8% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Taux d’occupation
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPercentage(financialMetrics.occupancyRate)}
                </div>
                <p className="text-xs text-muted-foreground">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  +0.5% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Taux d’encaissement
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPercentage(financialMetrics.collectionRate)}
                </div>
                <p className="text-xs text-muted-foreground">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  +1.2% from last month
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Financial Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Évolution du rendement financier</CardTitle>
              <CardDescription>
                Monthly revenue, expenses, and net income over the last 6 months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={financialMetrics.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number)}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stackId="1"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stackId="2"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="netIncome"
                    stackId="3"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions rapides de rapport</CardTitle>
              <CardDescription>
                Generate commonly used reports instantly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <DollarSign className="h-6 w-6" />
                  <span>Résultat mensuel</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <Building2 className="h-6 w-6" />
                  <span>Rapport d’occupation</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <FileText className="h-6 w-6" />
                  <span>État locatif</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <Users className="h-6 w-6" />
                  <span>Rapport des locataires</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Rapports financiers</CardTitle>
                  <CardDescription>
                    Comprehensive financial analysis and reporting
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={selectedDateRange}
                    onValueChange={setSelectedDateRange}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_30_days">30 derniers jours</SelectItem>
                      <SelectItem value="last_quarter">Trimestre précédent</SelectItem>
                      <SelectItem value="last_year">Année précédente</SelectItem>
                      <SelectItem value="ytd">Depuis le début de l’année</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => handleExportReport("pdf")}>
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Revenue Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Répartition des revenus</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Revenus locatifs</span>
                        <span className="font-medium">
                          {formatCurrency(115000)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Frais de retard</span>
                        <span className="font-medium">
                          {formatCurrency(3500)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Frais pour animaux</span>
                        <span className="font-medium">
                          {formatCurrency(2800)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Frais de stationnement</span>
                        <span className="font-medium">
                          {formatCurrency(2200)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Autres revenus</span>
                        <span className="font-medium">
                          {formatCurrency(1500)}
                        </span>
                      </div>
                      <hr />
                      <div className="flex justify-between font-bold">
                        <span>Revenu total</span>
                        <span>{formatCurrency(125000)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Expense Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Répartition des dépenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Maintenance</span>
                        <span className="font-medium">
                          {formatCurrency(18000)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Services publics</span>
                        <span className="font-medium">
                          {formatCurrency(12000)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Assurance</span>
                        <span className="font-medium">
                          {formatCurrency(8000)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Taxe foncière</span>
                        <span className="font-medium">
                          {formatCurrency(5000)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Frais de gestion</span>
                        <span className="font-medium">
                          {formatCurrency(2000)}
                        </span>
                      </div>
                      <hr />
                      <div className="flex justify-between font-bold">
                        <span>Total des dépenses</span>
                        <span>{formatCurrency(45000)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Profit & Loss Chart */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Évolution des résultats</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={financialMetrics.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => formatCurrency(value as number)}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#22c55e"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="expenses"
                        stroke="#ef4444"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="netIncome"
                        stroke="#3b82f6"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="occupancy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analyse de l’occupation</CardTitle>
              <CardDescription>
                Detailed occupancy metrics and vacancy analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Occupation actuelle</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">94%</div>
                    <p className="text-xs text-muted-foreground">
                      47 of 50 units
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Average Vacancy Days
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">12</div>
                    <p className="text-xs text-muted-foreground">
                      Industry avg: 18
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Taux de rotation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">15%</div>
                    <p className="text-xs text-muted-foreground">Taux annuel</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Renouvellements de baux</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">85%</div>
                    <p className="text-xs text-muted-foreground">
                      Renewal rate
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rapports d’encaissement</CardTitle>
              <CardDescription>
                Detailed payment analysis and collection performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Taux d’encaissement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">96%</div>
                    <p className="text-xs text-muted-foreground">Ce mois-ci</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Average Days to Pay
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">3.2</div>
                    <p className="text-xs text-muted-foreground">
                      Days after due
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Taux de retard</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">8%</div>
                    <p className="text-xs text-muted-foreground">
                      Of all payments
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Adoption du paiement automatique</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">72%</div>
                    <p className="text-xs text-muted-foreground">Des locataires</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4 items-center">
                <Select
                  value={selectedReportType}
                  onValueChange={setSelectedReportType}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Tous les types de rapports" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types de rapports</SelectItem>
                    <SelectItem value="financial">Financier</SelectItem>
                    <SelectItem value="occupancy">Occupation</SelectItem>
                    <SelectItem value="payment">Paiement</SelectItem>
                    <SelectItem value="tenant">Locataire</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  More Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scheduled Reports List */}
          <Card>
            <CardHeader>
              <CardTitle>Rapports planifiés</CardTitle>
              <CardDescription>
                Manage automated report generation and distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(report.type)}
                        <div>
                          <div className="font-medium">{report.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {report.description}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Last generated:{" "}
                            {report.lastGenerated.toLocaleDateString()} •
                            Recipients: {report.recipients.length}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {getStatusBadge(report.status)}
                        <Badge variant="outline">{report.frequency}</Badge>
                        <Badge variant="outline">
                          {report.format.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateReport(report.id)}
                        disabled={isGeneratingReport}
                      >
                        {isGeneratingReport ? (
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4 mr-2" />
                        )}
                        {isGeneratingReport ? "Generating..." : "Generate"}
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
