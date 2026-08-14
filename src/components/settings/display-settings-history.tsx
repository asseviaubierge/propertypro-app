"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History,
  RotateCcw,
  Eye,
  GitCompare,
  Clock,
  User,
  Settings,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { logClientError } from "@/utils/logger";

interface HistoryEntry {
  _id: string;
  version: number;
  createdAt: string;
  changes: {
    field: string;
    previousValue: any;
    newValue: any;
    changeType: "added" | "modified" | "removed";
    fieldLabel: string;
    formattedPreviousValue: string;
    formattedNewValue: string;
  }[];
  metadata: {
    source: "user" | "admin" | "system" | "import" | "reset";
    userAgent?: string;
    ipAddress?: string;
  };
  changeReason?: string;
}

interface DisplaySettingsHistoryProps {
  onAlert: (type: "success" | "error" | "info", message: string) => void;
  onSettingsRevert?: (settings: any) => void;
}

export function DisplaySettingsHistory({
  onAlert,
  onSettingsRevert,
}: DisplaySettingsHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
    new Set(),
  );
  const [isReverting, setIsReverting] = useState(false);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/settings/display/history?limit=50");

      if (!response.ok) {
        throw new Error("Impossible de charger l’historique");
      }

      const data = await response.json();
      setHistory(data?.data?.history ?? []);
    } catch (error) {
      logClientError("Fetch history error:", error);
      onAlert("error", "Impossible de charger l’historique des paramètres");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleRevert = async (version: number) => {
    try {
      setIsReverting(true);

      const response = await fetch("/api/settings/display/history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "revert",
          version,
          reason: `Retour à la version ${version} depuis l’historique`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || "Impossible de restaurer les paramètres");
      }

      const result = await response.json();

      onAlert("success", `Paramètres restaurés à la version ${version}`);
      onSettingsRevert?.(result?.data?.settings);

      // Refresh history
      await fetchHistory();
    } catch (error) {
      logClientError("Revert error:", error);
      onAlert(
        "error",
        error instanceof Error ? error.message : "Impossible de restaurer les paramètres",
      );
    } finally {
      setIsReverting(false);
    }
  };

  const toggleExpanded = (entryId: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const getSourceBadgeVariant = (source: string) => {
    switch (source) {
      case "user":
        return "default";
      case "admin":
        return "destructive";
      case "system":
        return "secondary";
      case "import":
        return "outline";
      case "reset":
        return "secondary";
      default:
        return "default";
    }
  };

  const getChangeTypeBadgeVariant = (changeType: string) => {
    switch (changeType) {
      case "added":
        return "default";
      case "modified":
        return "secondary";
      case "removed":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des paramètres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Chargement de l’historique…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historique des paramètres
        </CardTitle>
        <CardDescription>
          Consultez les modifications des paramètres d’affichage
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucun historique de paramètres disponible</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => (
              <div key={entry._id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(entry._id)}
                      className="p-1 h-auto"
                    >
                      {expandedEntries.has(entry._id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          Version {entry.version}
                        </span>
                        <Badge
                          variant={getSourceBadgeVariant(entry.metadata.source)}
                        >
                          {entry.metadata.source}
                        </Badge>
                        <Badge variant="outline">
                          {entry.changes.length} change
                          {entry.changes.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(entry.createdAt), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>
                            Version {entry.version} Details
                          </DialogTitle>
                          <DialogDescription>
                            Changes made{" "}
                            {formatDistanceToNow(new Date(entry.createdAt), {
                              addSuffix: true,
                            })}
                          </DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-96">
                          <div className="space-y-3">
                            {entry.changes.map((change, index) => (
                              <div key={index} className="border rounded p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge
                                    variant={getChangeTypeBadgeVariant(
                                      change.changeType,
                                    )}
                                  >
                                    {change.changeType}
                                  </Badge>
                                  <span className="font-medium">
                                    {change.fieldLabel}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">
                                      Previous:
                                    </span>
                                    <div className="font-mono bg-muted p-2 rounded mt-1">
                                      {change.formattedPreviousValue}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      New:
                                    </span>
                                    <div className="font-mono bg-muted p-2 rounded mt-1">
                                      {change.formattedNewValue}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isReverting}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Revert
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Revert to Version {entry.version}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will restore your display settings to version{" "}
                            {entry.version} from{" "}
                            {formatDistanceToNow(new Date(entry.createdAt), {
                              addSuffix: true,
                            })}
                            . This action will create a new history entry.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRevert(entry.version)}
                            disabled={isReverting}
                          >
                            {isReverting ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Reverting...
                              </>
                            ) : (
                              "Restaurer"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {expandedEntries.has(entry._id) && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="space-y-2">
                      {entry.changes.map((change, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="font-medium">
                            {change.fieldLabel}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={getChangeTypeBadgeVariant(
                                change.changeType,
                              )}
                              className="text-xs"
                            >
                              {change.changeType}
                            </Badge>
                            <span className="text-muted-foreground">
                              {change.formattedPreviousValue} →{" "}
                              {change.formattedNewValue}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
