"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  DeleteConfirmationDialog,
  CancelConfirmationDialog,
} from "@/components/ui/confirmation-dialog";
import {
  MoreHorizontal,
  Edit,
  Eye,
  Trash2,
  UserPlus,
  Play,
  CheckCircle,
  X,
  DollarSign,
} from "lucide-react";
import { MaintenanceStatus, MaintenancePriority } from "@/types";
import { useAuthorization } from "@/hooks/useAuthorization";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { toast } from "sonner";

interface MaintenanceRequest {
  _id: string;
  title: string;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  assignedTo?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
}

interface Technician {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface MaintenanceActionsProps {
  request: MaintenanceRequest;
  technicians?: Technician[];
  onUpdate: () => void;
  onDelete: () => void;
  onView: () => void;
  onEdit: () => void;
}

export function MaintenanceActions({
  request,
  technicians = [],
  onUpdate,
  onDelete,
  onView,
  onEdit,
}: MaintenanceActionsProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [actualCost, setActualCost] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const { isCompanyStaff, accessProfile } = useAuthorization();
  const { hasAnyPermission } = useRolePermissions();

  const hasMaintenanceAccess = accessProfile?.isSystemRole
    ? isCompanyStaff
    : hasAnyPermission([
        "maintenance_management",
        "maintenance_assign",
        "work_orders",
      ]);

  const canEdit = hasMaintenanceAccess;
  const canDelete = hasMaintenanceAccess;
  const canAssign = hasMaintenanceAccess;
  const canStartWork = hasMaintenanceAccess;
  const canComplete = hasMaintenanceAccess;
  const canCancel = hasMaintenanceAccess;

  const handleAction = async (action: string, data?: any) => {
    try {
      setActionLoading(action);

      const response = await fetch(`/api/maintenance/${request._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          data,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || `Échec de ${action} maintenance request`,
        );
      }

      toast.success(`Demande de maintenance ${action} effectuée avec succès !`);
      onUpdate();
    } catch (error: any) {
      toast.error(error?.message || `Échec de ${action} maintenance request`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssign = async () => {
    if (!selectedTechnician) {
      toast.error("Veuillez sélectionner un technicien");
      return;
    }

    await handleAction("assign", { assignedTo: selectedTechnician });
    setAssignDialogOpen(false);
    setSelectedTechnician("");
  };

  const handleComplete = async () => {
    const data: any = {};
    if (actualCost) data.actualCost = parseFloat(actualCost);
    if (completionNotes) data.notes = completionNotes;

    await handleAction("complete", data);
    setCompleteDialogOpen(false);
    setActualCost("");
    setCompletionNotes("");
  };

  const handleStartWork = async () => {
    await handleAction("startWork");
  };

  const handleCancel = async () => {
    await handleAction("cancel");
  };

  const handleDelete = async () => {
    try {
      setActionLoading("delete");

      const response = await fetch(`/api/maintenance/${request._id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Échec de delete maintenance request");
      }

      toast.success("Demande de maintenance deleted effectuée avec succès !");
      onDelete();
    } catch (error: any) {
      toast.error(error?.message || "Échec de delete maintenance request");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={onView}>
            <Eye className="mr-2 h-4 w-4" />
            Voir les détails
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier la demande
            </DropdownMenuItem>
          )}

          {/* Status-based actions */}
          {request.status === MaintenanceStatus.SUBMITTED && canAssign && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setAssignDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Assigner un technicien
              </DropdownMenuItem>
            </>
          )}

          {request.status === MaintenanceStatus.ASSIGNED && canStartWork && (
            <DropdownMenuItem
              onClick={handleStartWork}
              disabled={actionLoading === "startWork"}
              className="text-blue-600"
            >
              <Play className="mr-2 h-4 w-4" />
              Commencer les travaux
            </DropdownMenuItem>
          )}

          {request.status === MaintenanceStatus.IN_PROGRESS && canComplete && (
            <DropdownMenuItem
              onClick={() => setCompleteDialogOpen(true)}
              className="text-green-600"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Marquer comme terminée
            </DropdownMenuItem>
          )}

          {/* Destructive actions */}
          {canCancel &&
            request.status !== MaintenanceStatus.COMPLETED &&
            request.status !== MaintenanceStatus.CANCELLED && (
              <>
                <DropdownMenuSeparator />
                <CancelConfirmationDialog
                  itemName={request.title}
                  itemType="demande de maintenance"
                  onConfirm={handleCancel}
                  loading={actionLoading === "cancel"}
                >
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-orange-600"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Annuler la demande
                  </DropdownMenuItem>
                </CancelConfirmationDialog>
              </>
            )}

          {canDelete && request.status !== MaintenanceStatus.COMPLETED && (
            <>
              <DropdownMenuSeparator />
              <DeleteConfirmationDialog
                itemName={request.title}
                itemType="demande de maintenance"
                onConfirm={handleDelete}
                loading={actionLoading === "delete"}
              >
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer la demande
                </DropdownMenuItem>
              </DeleteConfirmationDialog>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Assigner un technicien Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner un technicien</DialogTitle>
            <DialogDescription>
              Sélectionnez un technicien à affecter à "{request.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="technician">Technicien</Label>
              <Select
                value={selectedTechnician}
                onValueChange={setSelectedTechnician}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un technicien" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech._id} value={tech._id}>
                      {tech.firstName} {tech.lastName} - {tech.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button onClick={handleAssign} disabled={!selectedTechnician}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Work Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clôturer la demande de maintenance</DialogTitle>
            <DialogDescription>
              Marquer « {request.title} » comme terminée et fournir les détails finaux
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="actualCost">Coût réel (facultatif)</Label>
              <Input
                id="actualCost"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={actualCost}
                onChange={(e) => setActualCost(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="completionNotes">
                Notes de clôture (facultatif)
              </Label>
              <Textarea
                id="completionNotes"
                placeholder="Ajoutez des notes concernant les travaux effectués..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCompleteDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button onClick={handleComplete}>Marquer comme terminée</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
