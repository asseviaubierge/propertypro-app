"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Upload,
  Link,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";

interface GoogleCalendarSyncProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncComplete: () => void;
}

interface SyncStatus {
  connected: boolean;
  lastSync: Date | null;
  syncEnabled: boolean;
  calendars: GoogleCalendar[];
  selectedCalendarId: string | null;
  syncDirection: "import" | "export" | "bidirectional";
}

interface GoogleCalendar {
  id: string;
  name: string;
  description?: string;
  primary: boolean;
  accessRole: string;
}

export function GoogleCalendarSync({
  open,
  onOpenChange,
  onSyncComplete,
}: GoogleCalendarSyncProps) {
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    connected: false,
    lastSync: null,
    syncEnabled: false,
    calendars: [],
    selectedCalendarId: null,
    syncDirection: "bidirectional",
  });

  // Load sync status on component mount
  useEffect(() => {
    if (open) {
      loadSyncStatus();
    }
  }, [open]);

  const loadSyncStatus = async () => {
    try {
      const response = await fetch("/api/calendar/google/status");
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      }
    } catch (error) {
      console.error("Failed to load sync status:", error);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      // Redirect to Google OAuth
      const response = await fetch("/api/calendar/google/auth", {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok && data?.success && data?.data?.authUrl) {
        window.location.href = data.data.authUrl;
      } else {
        // Handle specific error cases
        if (response.status === 503) {
          toast.error(
            "Google Agenda integration is not configured. Please contact your administrator.",
          );
        } else {
          toast.error(
            data?.message || "Failed to initiate Google authentication",
          );
        }
        throw new Error(
          data?.message || "Failed to initiate Google authentication",
        );
      }
    } catch (error) {
      console.error("Failed to connect to Google Agenda:", error);
      const errorMessage = error instanceof Error ? error.message : "";
      if (
        !errorMessage.includes("Google Agenda integration is not configured")
      ) {
        toast.error("Failed to connect to Google Agenda");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDéconnecter = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/calendar/google/disconnect", {
        method: "POST",
      });

      if (response.ok) {
        setSyncStatus({
          connected: false,
          lastSync: null,
          syncEnabled: false,
          calendars: [],
          selectedCalendarId: null,
          syncDirection: "bidirectional",
        });
        toast.success("Déconnectered from Google Agenda");
      } else {
        throw new Error("Failed to disconnect");
      }
    } catch (error) {
      console.error("Failed to disconnect:", error);
      toast.error("Failed to disconnect from Google Agenda");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (
    direction: "import" | "export" | "bidirectional",
  ) => {
    if (!syncStatus.selectedCalendarId) {
      toast.error("Please select a calendar first");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/calendar/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId: syncStatus.selectedCalendarId,
          direction,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(
          `Sync completed: ${result?.imported ?? 0} imported, ${
            result?.exported ?? 0
          } exported`,
        );
        setSyncStatus((prev) => ({ ...prev, lastSync: new Date() }));
        onSyncComplete();
      } else {
        throw new Error("Sync failed");
      }
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("Failed to sync with Google Agenda");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoSync = async (enabled: boolean) => {
    try {
      const response = await fetch("/api/calendar/google/auto-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setSyncStatus((prev) => ({ ...prev, syncEnabled: enabled }));
        toast.success(`Auto-sync ${enabled ? "enabled" : "disabled"}`);
      } else {
        throw new Error("Failed to update auto-sync setting");
      }
    } catch (error) {
      console.error("Failed to toggle auto-sync:", error);
      toast.error("Failed to update auto-sync setting");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Agenda Integration
          </DialogTitle>
          <DialogDescription>
            Sync your Gestion E-Immo events with Google Agenda for seamless
            scheduling.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Connection Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link className="h-4 w-4" />
                Connection Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {syncStatus.connected ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium">
                        Connecté to Google Agenda
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-500" />
                      <span className="font-medium">Non connecté</span>
                    </>
                  )}
                </div>

                {syncStatus.connected ? (
                  <Button
                    variant="outline"
                    onClick={handleDéconnecter}
                    disabled={loading}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Déconnecter
                  </Button>
                ) : (
                  <Button onClick={handleConnect} disabled={loading}>
                    <Link className="h-4 w-4 mr-2" />
                    Connect to Google
                  </Button>
                )}
              </div>

              {syncStatus.lastSync && (
                <p className="text-sm text-muted-foreground mt-2">
                  Dernière synchronisation: {syncStatus.lastSync.toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Sélection du calendrier */}
          {syncStatus.connected && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sélection du calendrier</CardTitle>
                <CardDescription>
                  Choose which Google Agenda to sync with Gestion E-Immo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="calendar-select">Sélectionner un calendrier</Label>
                  <Select
                    value={syncStatus.selectedCalendarId ?? ""}
                    onValueChange={(value) =>
                      setSyncStatus((prev) => ({
                        ...prev,
                        selectedCalendarId: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un calendrier" />
                    </SelectTrigger>
                    <SelectContent>
                      {syncStatus.calendars.map((calendar) => (
                        <SelectItem key={calendar.id} value={calendar.id}>
                          <div className="flex items-center gap-2">
                            {calendar.name}
                            {calendar.primary && (
                              <Badge variant="secondary" className="text-xs">
                                Primary
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sync-direction">Sens de synchronisation</Label>
                  <Select
                    value={syncStatus.syncDirection}
                    onValueChange={(value: any) =>
                      setSyncStatus((prev) => ({
                        ...prev,
                        syncDirection: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="import">
                        Importer depuis Google Agenda only
                      </SelectItem>
                      <SelectItem value="export">
                        Exporter vers Google Agenda only
                      </SelectItem>
                      <SelectItem value="bidirectional">
                        Two-way sync (recommended)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Commandes de synchronisation */}
          {syncStatus.connected && syncStatus.selectedCalendarId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Commandes de synchronisation</CardTitle>
                <CardDescription>
                  Manage synchronization between Gestion E-Immo and Google
                  Calendar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-sync">Synchronisation automatique</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically sync changes every 15 minutes
                    </p>
                  </div>
                  <Switch
                    id="auto-sync"
                    checked={syncStatus.syncEnabled}
                    onCheckedChange={handleToggleAutoSync}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Synchronisation manuelle</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleSync("import")}
                      disabled={loading}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Importer depuis Google
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSync("export")}
                      disabled={loading}
                      className="flex-1"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Exporter vers Google
                    </Button>
                    <Button
                      onClick={() => handleSync("bidirectional")}
                      disabled={loading}
                      className="flex-1"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Full Sync
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sync Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-4 w-4" />
                Important Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                • Events will be synced based on their creation and modification
                dates
              </p>
              <p>
                • Deleted events in one calendar will be marked as cancelled in
                the other
              </p>
              <p>• Recurring events are supported but may have limitations</p>
              <p>• Private events will respect privacy settings</p>
              <p>
                • Sync conflicts will be resolved by keeping the most recent
                changes
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
