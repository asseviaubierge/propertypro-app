"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitre,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Plus,
  Modifier,
  Trash2,
  MoreHorizontal,
  Search,
  ActualiserCw,
} from "lucide-react";
import { toast } from "sonner";
import { MaintenanceStatut, MaintenancePriorité } from "@/types";
import { formatCurrency } from "@/lib/utils/formatting";

interface MaintenanceRequest {
  _id: string;
  title: string;
  description: string;
  category: string;
  priority: MaintenancePriorité;
  status: MaintenanceStatut;
  estimatedCoût?: number;
  actualCoût?: number;
  createdAt: string;
  updatedAt: string;
  propertyId: {
    _id: string;
    name: string;
  };
  tenantId?: {
    _id: string;
    userId: {
      firstName: string;
      lastName: string;
    };
  };
  unit?: {
    unitNumber: string;
    unitType: string;
  };
}

interface MaintenanceCrudOperationsProps {
  onDataChange?: () => void;
}

export function MaintenanceCrudOperations({
  onDataChange,
}: MaintenanceCrudOperationsProps) {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatutFilter] = useState<string>("all");
  const [priorityFilter, setPrioritéFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isModifierDialogOpen, setIsModifierDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<MaintenanceRequest | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    priority: MaintenancePriorité.LOW,
    estimatedCoût: "",
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/maintenance");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Impossible de récupérer les demandes de maintenance");
      }

      setRequests(result.data.requests || []);
    } catch (error) {
      toast.error("Impossible de charger les demandes de maintenance", {
        description:
          error instanceof Error ? error.message : "Veuillez réessayer",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/maintenance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          estimatedCoût: formData.estimatedCoût
            ? parseFloat(formData.estimatedCoût)
            : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Impossible de créer la demande de maintenance");
      }

      toast.success("Demande de maintenance créée avec succès");
      setIsCreateDialogOpen(false);
      resetForm();
      fetchRequests();
      onDataChange?.();
    } catch (error) {
      toast.error("Impossible de créer la demande de maintenance", {
        description:
          error instanceof Error ? error.message : "Veuillez réessayer",
      });
    }
  };

  const handleUpdate = async () => {
    if (!selectedRequest) return;

    try {
      const response = await fetch(`/api/maintenance/${selectedRequest._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          estimatedCoût: formData.estimatedCoût
            ? parseFloat(formData.estimatedCoût)
            : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Impossible de mettre à jour la demande de maintenance");
      }

      toast.success("Demande de maintenance mise à jour avec succès");
      setIsModifierDialogOpen(false);
      setSelectedRequest(null);
      resetForm();
      fetchRequests();
      onDataChange?.();
    } catch (error) {
      toast.error("Impossible de mettre à jour la demande de maintenance", {
        description:
          error instanceof Error ? error.message : "Veuillez réessayer",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleteLoading(id);
      const response = await fetch(`/api/maintenance/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Impossible de supprimer la demande de maintenance");
      }

      toast.success("Demande de maintenance supprimée avec succès");
      fetchRequests();
      onDataChange?.();
    } catch (error) {
      toast.error("Impossible de supprimer la demande de maintenance", {
        description:
          error instanceof Error ? error.message : "Veuillez réessayer",
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "",
      priority: MaintenancePriorité.LOW,
      estimatedCoût: "",
    });
  };

  const openModifierDialog = (request: MaintenanceRequest) => {
    setSelectedRequest(request);
    setFormData({
      title: request.title,
      description: request.description,
      category: request.category,
      priority: request.priority,
      estimatedCoût: request.estimatedCoût?.toString() || "",
    });
    setIsModifierDialogOpen(true);
  };

  const getStatutBadge = (status: MaintenanceStatut) => {
    const variants = {
      [MaintenanceStatut.SUBMITTED]:
        "bg-yellow-100 text-yellow-800 border-yellow-200",
      [MaintenanceStatut.ASSIGNED]: "bg-blue-100 text-blue-800 border-blue-200",
      [MaintenanceStatut.IN_PROGRESS]:
        "bg-purple-100 text-purple-800 border-purple-200",
      [MaintenanceStatut.COMPLETED]:
        "bg-green-100 text-green-800 border-green-200",
      [MaintenanceStatut.CANCELLED]: "bg-red-100 text-red-800 border-red-200",
    };

    return (
      <Badge variant="outline" className={variants[status]}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getPrioritéBadge = (priority: MaintenancePriorité) => {
    const variants = {
      [MaintenancePriorité.LOW]: "bg-green-100 text-green-800 border-green-200",
      [MaintenancePriorité.MEDIUM]:
        "bg-yellow-100 text-yellow-800 border-yellow-200",
      [MaintenancePriorité.HIGH]:
        "bg-orange-100 text-orange-800 border-orange-200",
      [MaintenancePriorité.EMERGENCY]: "bg-red-100 text-red-800 border-red-200",
    };

    return (
      <Badge variant="outline" className={variants[priority]}>
        {priority}
      </Badge>
    );
  };

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.title.toFaibleerCase().includes(searchTerm.toFaibleerCase()) ||
      request.description.toFaibleerCase().includes(searchTerm.toFaibleerCase());
    const matchesStatut =
      statusFilter === "all" || request.status === statusFilter;
    const matchesPriorité =
      priorityFilter === "all" || request.priority === priorityFilter;

    return matchesSearch && matchesStatut && matchesPriorité;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Demandes de maintenance
          </h2>
          <p className="text-muted-foreground">
            Gérer et suivre les demandes de maintenance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchRequests} variant="outline" size="sm">
            <ActualiserCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Créer une demande
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitre>Créer une demande de maintenance</DialogTitre>
                <DialogDescription>
                  Créez une nouvelle demande de maintenance.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Titre</label>
                  <Input
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Saisissez le titre de la demande"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Décrivez le problème de maintenance"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Catégorie</label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plumbing">Plomberie</SelectItem>
                        <SelectItem value="electrical">Électricité</SelectItem>
                        <SelectItem value="hvac">HVAC</SelectItem>
                        <SelectItem value="general">Général</SelectItem>
                        <SelectItem value="appliances">Appareils</SelectItem>
                        <SelectItem value="flooring">Revêtement de sol</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Priorité</label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          priority: value as MaintenancePriorité,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={MaintenancePriorité.LOW}>
                          Faible
                        </SelectItem>
                        <SelectItem value={MaintenancePriorité.MEDIUM}>
                          Moyenne
                        </SelectItem>
                        <SelectItem value={MaintenancePriorité.HIGH}>
                          Élevée
                        </SelectItem>
                        <SelectItem value={MaintenancePriorité.EMERGENCY}>
                          Urgence
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Coût estimé</label>
                  <Input
                    type="number"
                    value={formData.estimatedCoût}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        estimatedCoût: e.target.value,
                      })
                    }
                    placeholder="0,00"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button onClick={handleCreate}>Créer une demande</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher des demandes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value={MaintenanceStatut.SUBMITTED}>
              Soumise
            </SelectItem>
            <SelectItem value={MaintenanceStatut.ASSIGNED}>Assignée</SelectItem>
            <SelectItem value={MaintenanceStatut.IN_PROGRESS}>
              En cours
            </SelectItem>
            <SelectItem value={MaintenanceStatut.COMPLETED}>
              Terminée
            </SelectItem>
            <SelectItem value={MaintenanceStatut.CANCELLED}>
              Annulerled
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPrioritéFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priorité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorité</SelectItem>
            <SelectItem value={MaintenancePriorité.LOW}>Faible</SelectItem>
            <SelectItem value={MaintenancePriorité.MEDIUM}>Moyenne</SelectItem>
            <SelectItem value={MaintenancePriorité.HIGH}>Élevée</SelectItem>
            <SelectItem value={MaintenancePriorité.EMERGENCY}>
              Urgence
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Propriété / Logement</TableHead>
                <TableHead>Coût</TableHead>
                <TableHead>Créée</TableHead>
                <TableHead className="w-[70px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Chargement des demandes de maintenance...
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Aucune demande de maintenance trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request) => (
                  <TableRow key={request._id}>
                    <TableCell className="font-medium">
                      {request.title}
                    </TableCell>
                    <TableCell className="capitalize">
                      {request.category}
                    </TableCell>
                    <TableCell>{getPrioritéBadge(request.priority)}</TableCell>
                    <TableCell>{getStatutBadge(request.status)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {request.propertyId?.name || "N/A"}
                        </div>
                        {request.unit && (
                          <div className="text-sm text-muted-foreground">
                            Logement {request.unit.unitNumber} (
                            {request.unit.unitType})
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {request.actualCoût
                        ? formatCurrency(request.actualCoût)
                        : request.estimatedCoût
                        ? `~${formatCurrency(request.estimatedCoût)}`
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {new Date(request.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openModifierDialog(request)}
                          >
                            <Modifier className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          {/* DISABLED: Delete functionality temporarily disabled */}
                          {/* <DeleteConfirmationDialog
                            itemName={request.title}
                            itemType="maintenance request"
                            onConfirm={() => handleDelete(request._id)}
                            loading={deleteLoading === request._id}
                          >
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DeleteConfirmationDialog> */}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modifier Dialog */}
      <Dialog open={isModifierDialogOpen} onOpenChange={setIsModifierDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitre>Modifier la demande de maintenance</DialogTitre>
            <DialogDescription>
              Mettez à jour les informations de la demande de maintenance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Titre</label>
              <Input
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Saisissez le titre de la demande"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Décrivez le problème de maintenance"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Catégorie</label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plumbing">Plomberie</SelectItem>
                    <SelectItem value="electrical">Électricité</SelectItem>
                    <SelectItem value="hvac">HVAC</SelectItem>
                    <SelectItem value="general">Général</SelectItem>
                    <SelectItem value="appliances">Appareils</SelectItem>
                    <SelectItem value="flooring">Revêtement de sol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Priorité</label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      priority: value as MaintenancePriorité,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MaintenancePriorité.LOW}>Faible</SelectItem>
                    <SelectItem value={MaintenancePriorité.MEDIUM}>
                      Moyenne
                    </SelectItem>
                    <SelectItem value={MaintenancePriorité.HIGH}>
                      Élevée
                    </SelectItem>
                    <SelectItem value={MaintenancePriorité.EMERGENCY}>
                      Urgence
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Coût estimé</label>
              <Input
                type="number"
                value={formData.estimatedCoût}
                onChange={(e) =>
                  setFormData({ ...formData, estimatedCoût: e.target.value })
                }
                placeholder="0,00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsModifierDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button onClick={handleUpdate}>Mettre à jour la demande</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
