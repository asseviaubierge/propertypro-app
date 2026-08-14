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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Activity,
  Settings,
  Play,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { logClientError } from "@/utils/logger";

interface SyncHealthReport {
  timestamp: string;
  totalLeases: number;
  totalPayments: number;
  syncIssues: SyncIssue[];
  performanceMetrics: PerformanceMetrics;
  recommendations: string[];
}

interface SyncIssue {
  id: string;
  type:
    | "data_inconsistency"
    | "sync_failure"
    | "performance_issue"
    | "orphaned_data";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  affectedEntities: {
    leaseIds?: string[];
    paymentIds?: string[];
  };
  detectedAt: string;
  autoFixable: boolean;
}

interface PerformanceMetrics {
  avgSyncTime: number;
  failureRate: number;
  pendingSyncCount: number;
  lastSyncTime: string;
}

interface MigrationStatus {
  migrationNeeded: boolean;
  status: {
    totalPayments: number;
    paymentsWithSyncFields: number;
    paymentsWithoutSyncFields: number;
  };
}

export function PaymentSyncDashboard() {
  const [healthReport, setHealthReport] = useState<SyncHealthReport | null>(
    null,
  );
  const [migrationStatus, setMigrationStatus] =
    useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [healthResponse, migrationResponse] = await Promise.all([
        fetch("/api/admin/payment-sync-health"),
        fetch("/api/admin/migrate/payment-sync"),
      ]);

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setHealthReport(healthData?.data?.healthReport ?? null);
      } else {
        setHealthReport(null);
      }

      if (migrationResponse.ok) {
        const migrationData = await migrationResponse.json();
        setMigrationStatus(migrationData?.data ?? null);
      } else {
        setMigrationStatus(null);
      }
    } catch (error) {
      logClientError("Error loading dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
    toast.success("Données du tableau de bord actualisées");
  };

  const runMigration = async () => {
    try {
      const response = await fetch("/api/admin/migrate/payment-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "up", confirm: true }),
      });

      const data = await response.json();

      if (data?.success) {
        toast.success("Migration completed successfully");
        await loadDashboardData();
      } else {
        toast.error(`Migration failed: ${data?.message ?? "Unknown error"}`);
      }
    } catch (error) {
      logClientError("Migration error:", error);
      toast.error("Failed to run migration");
    }
  };

  const toggleMonitoring = async (start: boolean) => {
    try {
      const response = await fetch("/api/admin/payment-sync-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: start ? "start_monitoring" : "stop_monitoring",
        }),
      });

      if (response.ok) {
        setMonitoringActive(start);
        toast.success(`Monitoring ${start ? "started" : "stopped"}`);
      }
    } catch (error) {
      logClientError("Error toggling monitoring:", error);
      toast.error("Failed to toggle monitoring");
    }
  };

  const fixIssues = async (issueIds: string[]) => {
    try {
      const response = await fetch("/api/admin/payment-sync-health", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueIds, autoFix: true }),
      });

      const data = await response.json();

      if (data?.success) {
        const results = data?.data?.results ?? [];
        const fixedCount = results.filter((r: any) => r.success).length;
        toast.success(`Fixed ${fixedCount} issues`);
        await refreshData();
      } else {
        toast.error("Failed to fix issues");
      }
    } catch (error) {
      logClientError("Error fixing issues:", error);
      toast.error("Failed to fix issues");
    }
  };

  const severityLookup: Record<
    SyncIssue["severity"],
    {
      variant: "destructive" | "secondary" | "outline";
      Icon: typeof CheckCircle;
    }
  > = {
    critical: { variant: "destructive", Icon: AlertTriangle },
    high: { variant: "destructive", Icon: AlertTriangle },
    medium: { variant: "secondary", Icon: Clock },
    low: { variant: "outline", Icon: CheckCircle },
  };

  const getSeverityMeta = (severity: SyncIssue["severity"]) =>
    severityLookup[severity] ?? severityLookup.low;
  const recommendations = healthReport?.recommendations ?? [];
  const syncIssues = healthReport?.syncIssues ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Chargement du tableau de bord…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Tableau de bord de synchronisation des paiements
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage payment-lease data synchronization
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshData} disabled={refreshing}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Actualiser
          </Button>
          <Button
            variant={monitoringActive ? "destructive" : "default"}
            onClick={() => toggleMonitoring(!monitoringActive)}
          >
            {monitoringActive ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Stop Monitoring
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Monitoring
              </>
            )}
          </Button>
        </div>
      </div>

      {migrationStatus?.migrationNeeded && (
        <Alert>
          <Database className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Migration required:{" "}
              {migrationStatus.status.paymentsWithoutSyncFields} payments need
              sync fields
            </span>
            <Button size="sm" onClick={runMigration}>
              Run Migration
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="overview">Vue d’ensemble</TabsTrigger>
          <TabsTrigger value="issues">Anomalies</TabsTrigger>
          <TabsTrigger value="performance">Rendement</TabsTrigger>
          <TabsTrigger value="settings">Paramètres</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Leases
                </CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {healthReport?.totalLeases ?? 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Payments
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {healthReport?.totalPayments ?? 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Sync Issues
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {healthReport?.syncIssues?.length ?? 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending Syncs
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {healthReport?.performanceMetrics?.pendingSyncCount ?? 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommandations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {recommendations.map((rec, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          {syncIssues.length > 0 ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  Synchronization Issues
                </h3>
                <Button
                  onClick={() =>
                    fixIssues(
                      syncIssues
                        .filter((issue) => issue.autoFixable)
                        .map((issue) => issue.id),
                    )
                  }
                  disabled={!syncIssues.some((issue) => issue.autoFixable)}
                >
                  Fix Auto-Fixable Issues
                </Button>
              </div>

              {syncIssues.map((issue) => {
                const { variant, Icon } = getSeverityMeta(issue.severity);

                return (
                  <Card key={issue.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={variant}>
                            <Icon className="mr-1 h-4 w-4" />
                            {issue.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline">
                            {issue.type.replace("_", " ")}
                          </Badge>
                        </div>
                        {issue.autoFixable && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fixIssues([issue.id])}
                          >
                            Fix Issue
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{issue.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Detected: {new Date(issue.detectedAt).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">Aucune anomalie détectée</h3>
                <p className="text-muted-foreground">
                  Tous les systèmes de synchronisation des paiements fonctionnent normalement
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Indicateurs de rendement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Synchronisations en attente :</span>
                  <span className="font-semibold">
                    {healthReport?.performanceMetrics?.pendingSyncCount ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Taux d’échec :</span>
                  <span className="font-semibold">
                    {(
                      (healthReport?.performanceMetrics?.failureRate ?? 0) * 100
                    ).toFixed(2)}
                    %
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Dernière synchronisation :</span>
                  <span className="font-semibold">
                    {healthReport?.performanceMetrics?.lastSyncTime
                      ? new Date(
                          healthReport.performanceMetrics.lastSyncTime,
                        ).toLocaleString()
                      : "Never"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>État du système</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Surveillance :</span>
                  <Badge variant={monitoringActive ? "default" : "secondary"}>
                    {monitoringActive ? "Actif" : "Inactif"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Migration :</span>
                  <Badge
                    variant={
                      migrationStatus?.migrationNeeded
                        ? "destructive"
                        : "default"
                    }
                  >
                    {migrationStatus?.migrationNeeded
                      ? "Required"
                      : "Up to Date"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Commandes de surveillance</CardTitle>
              <CardDescription>
                Manage payment synchronization monitoring and maintenance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Surveillance continue</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatically detect and alert on synchronization issues
                  </p>
                </div>
                <Button
                  variant={monitoringActive ? "destructive" : "default"}
                  onClick={() => toggleMonitoring(!monitoringActive)}
                >
                  {monitoringActive ? "Stop" : "Start"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
