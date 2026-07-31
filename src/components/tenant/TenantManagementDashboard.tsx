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
import { Progress } from "@/components/ui/progress";
import {
  Users,
  UserPlus,
  Mail,
  Téléphone,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Search,
  Filter,
  Edit,
  Eye,
  FileText,
  CreditCard,
  Home,
  MessageSquare,
  Bell,
} from "lucide-react";

interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  unit: {
    id: string;
    number: string;
    propertyName: string;
    address: string;
  };
  lease: {
    id: string;
    startDate: Date;
    endDate: Date;
    monthlyRent: number;
    deposit: number;
    status: "active" | "expiring" | "expired" | "terminated";
  };
  paymentHistory: {
    totalPaid: number;
    onTimePayments: number;
    latePayments: number;
    lastPaymentDate: Date;
    outstandingBalance: number;
  };
  status: "active" | "notice_given" | "moving_out" | "inactive";
  moveInDate: Date;
  documents: Array<{
    id: string;
    name: string;
    type: "lease" | "application" | "id" | "income" | "other";
    uploadDate: Date;
  }>;
  notes: string;
}
import { formatCurrency } from "@/lib/utils/formatting";

interface TenantMetrics {
  totalTenants: number;
  activeTenants: number;
  leasesExpiring: number;
  averageRent: number;
  occupancyRate: number;
  onTimePaymentRate: number;
  averageTenancy: number;
  renewalRate: number;
}

export default function TenantManagementDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([
    {
      id: "tenant_1",
      firstName: "John",
      lastName: "Smith",
      email: "john.smith@email.com",
      phone: "+1 (555) 123-4567",
      emergencyContact: {
        name: "Jane Smith",
        phone: "+1 (555) 987-6543",
        relationship: "Spouse",
      },
      unit: {
        id: "unit_1",
        number: "101",
        propertyName: "Sunset Apartments",
        address: "123 Main Street",
      },
      lease: {
        id: "lease_1",
        startDate: new Date("2023-06-01"),
        endDate: new Date("2024-05-31"),
        monthlyRent: 1500,
        deposit: 1500,
        status: "expiring",
      },
      paymentHistory: {
        totalPaid: 13500,
        onTimePayments: 8,
        latePayments: 1,
        lastPaymentDate: new Date("2024-01-01"),
        outstandingBalance: 0,
      },
      status: "active",
      moveInDate: new Date("2023-06-01"),
      documents: [
        {
          id: "doc_1",
          name: "Lease Agreement",
          type: "lease",
          uploadDate: new Date("2023-05-15"),
        },
        {
          id: "doc_2",
          name: "Driver License",
          type: "id",
          uploadDate: new Date("2023-05-15"),
        },
      ],
      notes: "Excellent tenant, always pays on time.",
    },
    {
      id: "tenant_2",
      firstName: "Sarah",
      lastName: "Johnson",
      email: "sarah.johnson@email.com",
      phone: "+1 (555) 234-5678",
      emergencyContact: {
        name: "Mike Johnson",
        phone: "+1 (555) 876-5432",
        relationship: "Brother",
      },
      unit: {
        id: "unit_2",
        number: "205",
        propertyName: "Oak Hill Residences",
        address: "456 Oak Avenue",
      },
      lease: {
        id: "lease_2",
        startDate: new Date("2023-09-01"),
        endDate: new Date("2024-08-31"),
        monthlyRent: 1800,
        deposit: 1800,
        status: "active",
      },
      paymentHistory: {
        totalPaid: 7200,
        onTimePayments: 3,
        latePayments: 1,
        lastPaymentDate: new Date("2024-01-05"),
        outstandingBalance: 50,
      },
      status: "active",
      moveInDate: new Date("2023-09-01"),
      documents: [
        {
          id: "doc_3",
          name: "Lease Agreement",
          type: "lease",
          uploadDate: new Date("2023-08-15"),
        },
        {
          id: "doc_4",
          name: "Pay Stub",
          type: "income",
          uploadDate: new Date("2023-08-15"),
        },
      ],
      notes: "Occasionally late with payments but communicates well.",
    },
  ]);

  const [metrics, setMetrics] = useState<TenantMetrics>({
    totalTenants: 45,
    activeTenants: 42,
    leasesExpiring: 8,
    averageRent: 1650,
    occupancyRate: 0.94,
    onTimePaymentRate: 0.89,
    averageTenancy: 18,
    renewalRate: 0.78,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [filterPropriété, setFilterPropriété] = useState<string>("all");

  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat("en-US", {
  //     style: "currency",
  //     currency: "USD",
  //   }).format(amount);
  // };

  const getStatutBadge = (status: Tenant["status"]) => {
    const statusConfig = {
      active: { label: "Active", variant: "default" },
      notice_given: { label: "Notice Given", variant: "secondary" },
      moving_out: { label: "Moving Out", variant: "secondary" },
      inactive: { label: "Inactive", variant: "outline" },
    };

    const config = statusConfig[status];
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const getLeaseStatutBadge = (status: Tenant["lease"]["status"]) => {
    const statusConfig = {
      active: { label: "Active", variant: "default" },
      expiring: { label: "Expiring Soon", variant: "secondary" },
      expired: { label: "Expired", variant: "destructive" },
      terminated: { label: "Terminated", variant: "outline" },
    };

    const config = statusConfig[status];
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const getPaymentScore = (tenant: Tenant) => {
    const total =
      tenant.paymentHistory.onTimePayments + tenant.paymentHistory.latePayments;
    if (total === 0) return 0;
    return (tenant.paymentHistory.onTimePayments / total) * 100;
  };

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      searchQuery === "" ||
      `${tenant?.firstName ?? ""} ${tenant?.lastName ?? ""}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      tenant?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant?.unit?.number?.includes(searchQuery);

    const matchesStatut =
      filterStatut === "all" || tenant?.status === filterStatut;
    const matchesPropriété =
      filterPropriété === "all" || tenant?.unit?.propertyName === filterPropriété;

    return matchesSearch && matchesStatut && matchesPropriété;
  });

  const handleSendMessage = (tenantId: string) => {};

  const handleRenewLease = (tenantId: string) => {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Gestion des locataires
          </h2>
          <p className="text-muted-foreground">
            Gérez les informations, les baux et les communications des locataires
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Ajouter un locataire
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Ajouter un nouveau locataire</DialogTitle>
                <DialogDescription>
                  Ajoutez un nouveau locataire à votre portefeuille immobilier
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">Prénom</Label>
                    <Input id="first-name" placeholder="Saisissez le prénom" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last-name">Nom</Label>
                    <Input id="last-name" placeholder="Saisissez le nom" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="tenant@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input id="phone" placeholder="+1 (555) 123-4567" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit">Attribution du logement</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un logement" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unit_1">
                        Sunset Apartments - Unit 101
                      </SelectItem>
                      <SelectItem value="unit_2">
                        Oak Hill Residences - Unit 205
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lease-start">Date de début du bail</Label>
                    <Input id="lease-start" type="date" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lease-end">Date de fin du bail</Label>
                    <Input id="lease-end" type="date" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="monthly-rent">Loyer mensuel</Label>
                    <Input id="monthly-rent" type="number" placeholder="1500" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deposit">Dépôt de garantie</Label>
                    <Input id="deposit" type="number" placeholder="1500" />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline">Annuler</Button>
                  <Button>Ajouter un locataire</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total des locataires</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalTenants}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.activeTenants} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loyer moyen</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.averageRent)}
            </div>
            <p className="text-xs text-muted-foreground">Par logement et par mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taux de paiement à temps
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics.onTimePaymentRate * 100).toFixed(1)}%
            </div>
            <Progress
              value={metrics.onTimePaymentRate * 100}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Baux arrivant à échéance
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.leasesExpiring}</div>
            <p className="text-xs text-muted-foreground">90 prochains jours</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants">Tous les locataires</TabsTrigger>
          <TabsTrigger value="leases">Gestion des baux</TabsTrigger>
          <TabsTrigger value="applications">Demandes</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un locataire..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <Select value={filterStatut} onValueChange={setFilterStatut}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statut</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="notice_given">Notice Given</SelectItem>
                    <SelectItem value="moving_out">Moving Out</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filterPropriété}
                  onValueChange={setFilterPropriété}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Propriété" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les propriétés</SelectItem>
                    <SelectItem value="Sunset Apartments">
                      Sunset Apartments
                    </SelectItem>
                    <SelectItem value="Oak Hill Residences">
                      Oak Hill Residences
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tenants List */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTenants.map((tenant) => (
              <Card
                key={tenant.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {tenant?.firstName ?? ""} {tenant?.lastName ?? ""}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Home className="h-3 w-3" />
                        {tenant?.unit?.propertyName ?? ""} - Unit{" "}
                        {tenant?.unit?.number ?? ""}
                      </CardDescription>
                    </div>
                    {getStatutBadge(tenant?.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Contact Info */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span>{tenant?.email ?? ""}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Téléphone className="h-3 w-3 text-muted-foreground" />
                        <span>{tenant?.phone ?? ""}</span>
                      </div>
                    </div>

                    {/* Lease Info */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Lease Statut
                        </span>
                        {getLeaseStatutBadge(tenant?.lease?.status)}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Loyer mensuel:</span>
                        <span className="font-medium">
                          {formatCurrency(tenant?.lease?.monthlyRent ?? 0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Fin du bail :</span>
                        <span>
                          {tenant?.lease?.endDate?.toLocaleDateString() ?? ""}
                        </span>
                      </div>
                    </div>

                    {/* Score de paiement */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Score de paiement</span>
                        <span>{getPaymentScore(tenant).toFixed(0)}%</span>
                      </div>
                      <Progress value={getPaymentScore(tenant)} />
                    </div>

                    {/* Outstanding Balance Alert */}
                    {tenant.paymentHistory.outstandingBalance > 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Solde impayé :{" "}
                          {formatCurrency(
                            tenant.paymentHistory.outstandingBalance
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1">
                        <Eye className="h-4 w-4 mr-2" />
                        Voir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendMessage(tenant.id)}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="leases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestion des baux</CardTitle>
              <CardDescription>
                Suivez les renouvellements, expirations et conditions des baux
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Expiring Leases Alert */}
                <Alert>
                  <Calendar className="h-4 w-4" />
                  <AlertDescription>
                    {metrics.leasesExpiring} leases are expiring in the next 90
                    days. Consider reaching out for renewals.
                  </AlertDescription>
                </Alert>

                {/* Lease Actions */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Button variant="outline" className="h-20 flex-col space-y-2">
                    <FileText className="h-6 w-6" />
                    <span>Générer un bail</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col space-y-2">
                    <Calendar className="h-6 w-6" />
                    <span>Avis de renouvellement</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col space-y-2">
                    <Bell className="h-6 w-6" />
                    <span>Alertes d'expiration</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col space-y-2">
                    <CreditCard className="h-6 w-6" />
                    <span>Augmentations de loyer</span>
                  </Button>
                </div>

                {/* Lease Summary */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Baux actifs</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">42</div>
                      <p className="text-xs text-muted-foreground">
                        Actuellement actifs
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Taux de renouvellement</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {(metrics.renewalRate * 100).toFixed(0)}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        12 derniers mois
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Durée moyenne de location</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {metrics.averageTenancy}
                      </div>
                      <p className="text-xs text-muted-foreground">Mois</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tenant Demandes</CardTitle>
              <CardDescription>
                Examinez et traitez les nouvelles demandes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No Pending Demandes
                </h3>
                <p className="text-muted-foreground mb-4">
                  All applications have been processed. New applications will
                  appear here.
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une demande
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Communications des locataires</CardTitle>
              <CardDescription>
                Gérez les communications avec les locataires
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <Mail className="h-6 w-6" />
                  <span>Envoyer un e-mail</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <MessageSquare className="h-6 w-6" />
                  <span>Envoyer un SMS</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <Bell className="h-6 w-6" />
                  <span>Annonces</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col space-y-2">
                  <FileText className="h-6 w-6" />
                  <span>Avis</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
