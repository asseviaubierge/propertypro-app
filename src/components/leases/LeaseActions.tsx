"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { FileSignature, XCircle, RotateCcw, AlertTriangle } from "lucide-react";
import {
  leaseService,
  LeaseResponse,
  LeaseRenewalData,
} from "@/lib/services/lease.service";
import { LeaseStatus } from "@/types";
import { FormDatePicker } from "@/components/ui/date-picker";

// Schémas de validation
const signatureSchema = z.object({
  signatureData: z.string().min(1, "La signature est requise"),
  ipAddress: z.string().optional(),
});

const terminationSchema = z.object({
  terminationDate: z.string().min(1, "La date de résiliation est requise"),
  reason: z.string().min(1, "Le motif est requis"),
  notice: z.string().optional(),
  moveOutInspection: z.boolean(),
});

const renewalSchema = z.object({
  newStartDate: z.string().min(1, "La nouvelle date de début est requise"),
  newEndDate: z.string().min(1, "La nouvelle date de fin est requise"),
  newRentAmount: z.number().min(0, "Le montant du loyer doit être positif").optional(),
  renewalType: z.enum(["automatic", "manual"]),
  notes: z.string().optional(),
});

type SignatureFormData = z.infer<typeof signatureSchema>;
type TerminationFormData = z.infer<typeof terminationSchema>;
type RenewalFormData = z.infer<typeof renewalSchema>;

interface LeaseActionsProps {
  lease: LeaseResponse;
  onUpdate: () => void;
}

export function LeaseActions({ lease, onUpdate }: LeaseActionsProps) {
  const [isSigningOpen, setIsSigningOpen] = useState(false);
  const [isTerminationOpen, setIsTerminationOpen] = useState(false);
  const [isRenewalOpen, setIsRenewalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const signatureForm = useForm<SignatureFormData>({
    resolver: zodResolver(signatureSchema),
    defaultValues: {
      signatureData: "",
      ipAddress: "",
    },
  });

  const terminationForm = useForm<TerminationFormData>({
    resolver: zodResolver(terminationSchema),
    defaultValues: {
      terminationDate: "",
      reason: "",
      notice: "",
      moveOutInspection: false,
    },
  });

  const renewalForm = useForm<RenewalFormData>({
    resolver: zodResolver(renewalSchema),
    defaultValues: {
      newStartDate: "",
      newEndDate: "",
      newRentAmount: lease.terms.rentAmount,
      renewalType: "manual",
      notes: "",
    },
  });

  const handleSignLease = async (data: SignatureFormData) => {
    try {
      setIsLoading(true);
      await leaseService.signLease(lease._id, data);
      toast.success("Bail signé avec succès !");
      setIsSigningOpen(false);
      signatureForm.reset();
      onUpdate();
    } catch (error) {
      console.error("Erreur lors de la signature:", error);
      toast.error(
        error instanceof Error ? error.message : "Échec de la signature du bail"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTerminateLease = async (data: TerminationFormData) => {
    try {
      setIsLoading(true);
      await leaseService.terminateLease(lease._id, data);
      toast.success("Bail résilié avec succès !");
      setIsTerminationOpen(false);
      terminationForm.reset();
      onUpdate();
    } catch (error) {
      console.error("Erreur lors de la résiliation:", error);
      toast.error(
        error instanceof Error ? error.message : "Échec de la résiliation du bail"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenewLease = async (data: RenewalFormData) => {
    try {
      setIsLoading(true);
      const renewalData: LeaseRenewalData = {
        newStartDate: data.newStartDate,
        newEndDate: data.newEndDate,
        renewalType: data.renewalType,
        notes: data.notes,
      };

      if (data.newRentAmount && data.newRentAmount !== lease.terms.rentAmount) {
        renewalData.newTerms = {
          rentAmount: data.newRentAmount,
        };
      }

      await leaseService.renewLease(lease._id, renewalData);
      toast.success("Bail renouvelé avec succès !");
      setIsRenewalOpen(false);
      renewalForm.reset();
      onUpdate();
    } catch (error) {
      console.error("Erreur lors du renouvellement:", error);
      toast.error(
        error instanceof Error ? error.message : "Échec du renouvellement du bail"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const canSign = lease.status === LeaseStatus.DRAFT && !lease.signedDate;
  const canRenew =
    lease.status === LeaseStatus.ACTIVE || lease.status === LeaseStatus.EXPIRED;

  const propertyName = lease.propertyId?.name ?? "cette propriété";

  return (
    <div className="flex items-center gap-2">
      {/* Signer le bail */}
      {canSign && (
        <Dialog open={isSigningOpen} onOpenChange={setIsSigningOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="cursor-pointer">
              <FileSignature className="mr-2 h-4 w-4" />
              Signer le bail
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Signer le contrat de bail</DialogTitle>
              <DialogDescription>
                Complétez le processus de signature pour {propertyName}.
              </DialogDescription>
            </DialogHeader>
            <Form {...signatureForm}>
              <form
                onSubmit={signatureForm.handleSubmit(handleSignLease)}
                className="space-y-4"
              >
                <FormField
                  control={signatureForm.control}
                  name="signatureData"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signature numérique</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Entrez votre nom complet en guise de signature"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Tapez votre nom complet pour valider votre signature numérique.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsSigningOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Signature..." : "Signer le bail"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Renouveler le bail */}
      {canRenew && (
        <Dialog open={isRenewalOpen} onOpenChange={setIsRenewalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="cursor-pointer">
              <RotateCcw className="mr-2 h-4 w-4" />
              Renouveler le bail
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Renouveler le contrat de bail</DialogTitle>
              <DialogDescription>
                Créez un renouvellement pour le bail de {propertyName}.
              </DialogDescription>
            </DialogHeader>
            <Form {...renewalForm}>
              <form
                onSubmit={
                  renewalForm.handleSubmit(
                    handleRenewLease
                  ) as React.FormEventHandler<HTMLFormElement>
                }
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField<RenewalFormData>
                    control={renewalForm.control}
                    name="newStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nouvelle date de début</FormLabel>
                        <FormControl>
                          <FormDatePicker
                            value={
                              field.value ? new Date(field.value) : undefined
                            }
                            onChange={(date) => {
                              if (date) {
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, "0");
                                const day = String(date.getDate()).padStart(2, "0");
                                field.onChange(`${year}-${month}-${day}`);
                              } else {
                                field.onChange("");
                              }
                            }}
                            placeholder="Choisir date début"
                            disabled={(date) =>
                              date < new Date(new Date().setDate(new Date().getDate() - 1))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField<RenewalFormData>
                    control={renewalForm.control}
                    name="newEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nouvelle date de fin</FormLabel>
                        <FormControl>
                          <FormDatePicker
                            value={
                              field.value ? new Date(field.value) : undefined
                            }
                            onChange={(date) => {
                              if (date) {
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, "0");
                                const day = String(date.getDate()).padStart(2, "0");
                                field.onChange(`${year}-${month}-${day}`);
                              } else {
                                field.onChange("");
                              }
                            }}
                            placeholder="Choisir date fin"
                            disabled={(date) => {
                              const startDate = renewalForm.watch("newStartDate");
                              return startDate ? date <= new Date(startDate) : date < new Date();
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField<RenewalFormData>
                  control={renewalForm.control}
                  name="newRentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nouveau loyer mensuel (Optionnel)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={lease.terms.rentAmount.toString()}
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              parseFloat(e.target.value) || undefined
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Laissez vide pour conserver le loyer actuel de {lease.terms.rentAmount} €
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField<RenewalFormData>
                  control={renewalForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes de renouvellement</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ajoutez des notes concernant le renouvellement..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsRenewalOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Renouvellement..." : "Renouveler le bail"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
