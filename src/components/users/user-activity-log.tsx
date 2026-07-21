/**
 * PropertyPro - Composant de journal d'activité utilisateur
 * Affichage de l'activité utilisateur et de la piste d'audit
 */

"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale"; // Import de la locale française
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  User,
  Shield,
  LogIn,
  LogOut,
  Edit,
  Plus,
  Trash2,
  Clock,
} from "lucide-react";

interface ActivityEntry {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  action: ActivityAction;
  target?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

type ActivityAction =
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "user_activated"
  | "user_deactivated"
  | "role_changed"
  | "login"
  | "logout"
  | "password_changed"
  | "profile_updated"
  | "avatar_uploaded"
  | "bulk_operation";

interface UserActivityLogProps {
  userId?: string;
  limit?: number;
  showFilters?: boolean;
  className?: string;
}

const activityConfig: Record<
  ActivityAction,
  {
    label: string;
    icon: React.ReactNode;
    color: string;
    description: string;
  }
> = {
  user_created: {
    label: "Création utilisateur",
    icon: <Plus className="h-4 w-4" />,
    color: "bg-green-100 text-green-800 border-green-200",
    description: "Nouveau compte créé",
  },
  user_updated: {
    label: "Mise à jour utilisateur",
    icon: <Edit className="h-4 w-4" />,
    color: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Informations utilisateur mises à jour",
  },
  user_deleted: {
    label: "Suppression utilisateur",
    icon: <Trash2 className="h-4 w-4" />,
    color: "bg-red-100 text-red-800 border-red-200",
    description: "Compte utilisateur supprimé",
  },
  user_activated: {
    label: "Activation utilisateur",
    icon: <User className="h-4 w-4" />,
    color: "bg-green-100 text-green-800 border-green-200",
    description: "Compte utilisateur activé",
  },
  user_deactivated: {
    label: "Désactivation utilisateur",
    icon: <User className="h-4 w-4" />,
    color: "bg-orange-100 text-orange-800 border-orange-200",
    description: "Compte utilisateur désactivé",
  },
  role_changed: {
    label: "Changement de rôle",
    icon: <Shield className="h-4 w-4" />,
    color: "bg-purple-100 text-purple-800 border-purple-200",
    description: "Rôle utilisateur modifié",
  },
  login: {
    label: "Connexion",
    icon: <LogIn className="h-4 w-4" />,
    color: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Utilisateur connecté",
  },
  logout: {
    label: "Déconnexion",
    icon: <LogOut className="h-4 w-4" />,
    color: "bg-gray-100 text-gray-800 border-gray-200",
    description: "Utilisateur déconnecté",
  },
  password_changed: {
    label: "Mot de passe changé",
    icon: <Shield className="h-4 w-4" />,
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    description: "Mot de passe mis à jour",
  },
  profile_updated: {
    label: "Profil mis à jour",
    icon: <Edit className="h-4 w-4" />,
    color: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Informations de profil mises à jour",
  },
  avatar_uploaded: {
    label: "Avatar chargé",
    icon: <User className="h-4 w-4" />,
    color: "bg-green-100 text-green-800 border-green-200",
    description: "Photo de profil mise à jour",
  },
  bulk_operation: {
    label: "Opération groupée",
    icon: <Activity className="h-4 w-4" />,
    color: "bg-purple-100 text-purple-800 border-purple-200",
    description: "Opération groupée effectuée",
  },
};

export function UserActivityLog({
  userId,
  limit = 50,
  showFilters = true,
  className,
}: UserActivityLogProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState<ActivityAction | "all">(
    "all"
  );
  const [dateRange, setDateRange] = useState<string>("7d");

  // Logique de mapping conservée...
  const mapAuditActionToActivity = (auditAction: string): ActivityAction => {
    switch (auditAction) {
      case "login": return "login";
      case "logout": return "logout";
      case "password_changed": return "password_changed";
      case "role_assigned": return "role_changed";
      case "create": return "user_created";
      case "update":
      case "settings_changed": return "user_updated";
      case "delete": return "user_deleted";
      case "bulk_create":
      case "bulk_update":
      case "bulk_delete":
      case "bulk_export":
      case "bulk_import": return "bulk_operation";
      default: return "profile_updated";
    }
  };

  const mapSelectedToAudit = (selected: ActivityAction | "all"): string | null => {
    switch (selected) {
      case "login": return "login";
      case "logout": return "logout";
      case "password_changed": return "password_changed";
      case "role_changed": return "role_assigned";
      case "user_created": return "create";
      case "user_updated":
      case "profile_updated": return "update";
      case "user_deleted": return "delete";
      case "avatar_uploaded": return "document_upload";
      case "bulk_operation": return "bulk_update";
      default: return null;
    }
  };

  useEffect(() => {
    // ... (Logique fetch inchangée)
  }, [userId, selectedAction, dateRange, limit]);

  const formatActivityDetails = (activity: ActivityEntry) => {
    const config = activityConfig[activity.action];
    let details = config.description;

    if (activity.target) {
      details += ` pour ${activity.target}`;
    }

    if (activity.details) {
      switch (activity.action) {
        case "role_changed":
          details += ` de ${activity.details.oldRole?.replace("_", " ")} vers ${activity.details.newRole?.replace("_", " ")}`;
          break;
        case "bulk_operation":
          details += ` (${activity.details.operation} : ${activity.details.userCount} utilisateurs)`;
          break;
        case "profile_updated":
          details += ` (${activity.details.fields?.join(", ")})`;
          break;
      }
    }
    return details;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Journal d'activité
        </CardTitle>
        <CardDescription>
          {userId ? "Historique d'activité de l'utilisateur" : "Activité récente du système"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Select
              value={selectedAction}
              onValueChange={(value) => setSelectedAction(value as ActivityAction | "all")}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Filtrer par action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les actions</SelectItem>
                {Object.entries(activityConfig).map(([action, config]) => (
                  <SelectItem key={action} value={action}>
                    <div className="flex items-center gap-2">
                      {config.icon}
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Aujourd'hui</SelectItem>
                <SelectItem value="7d">7 derniers jours</SelectItem>
                <SelectItem value="30d">30 derniers jours</SelectItem>
                <SelectItem value="90d">90 derniers jours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-4">
          {isLoading ? (
            /* ... (Squelette de chargement inchangé) */
            <p>Chargement...</p>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Aucune activité trouvée</p>
            </div>
          ) : (
            activities.map((activity) => {
              const config = activityConfig[activity.action];
              return (
                <div key={activity.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{activity.userName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{activity.userName}</span>
                      <Badge className={`text-xs ${config.color}`}>
                        <span className="flex items-center gap-1">{config.icon} {config.label}</span>
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground mb-1">{formatActivityDetails(activity)}</p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(activity.timestamp, "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </span>
                      {activity.ipAddress && <span>IP : {activity.ipAddress}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
