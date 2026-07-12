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

// Validation schemas
const signatureSchema = z.object({
  signatureData: z.string().min(1, "Signature is required"),
  ipAddress: z.string().optional(),
});

const terminationSchema = z.object({
  terminationDate: z.string().min(1, "Termination date is required"),
  reason: z.string().min(1, "Reason is required"),
  notice: z.string().optional(),
  moveOutInspection: z.boolean(),
});

const renewalSchema = z.object({
  newStartDate: z.string().min(1, "New start date is required"),
  newEndDate: z.string().min(1, "New end date is required"),
  newRentAmount: z.number().min(0, "Rent amount must be positive").optional(),
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
      toast.success("Lease signed successfully!");
      setIsSigningOpen(false);
      signatureForm.reset();
      onUpdate();
    } catch (error) {
      console.error("Error signing lease:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to sign lease"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTerminateLease = async (data: TerminationFormData) => {
    try {
      setIsLoading(true);
      await leaseService.terminateLease(lease._id, data);
      toast.success("Lease terminated successfully!");
      setIsTerminationOpen(false);
      terminationForm.reset();
      onUpdate();
    } catch (error) {
      console.error("Error terminating lease:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to terminate lease"
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
      toast.success("Lease renewed successfully!");
      setIsRenewalOpen(false);
      renewalForm.reset();
      onUpdate();
    } catch (error) {
      console.error("Error renewing lease:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to renew lease"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const canSign = lease.status === LeaseStatus.DRAFT && !lease.signedDate;
  const canTerminate = lease.status === LeaseStatus.ACTIVE;
  const canRenew =
    lease.status === LeaseStatus.ACTIVE || lease.status === LeaseStatus.EXPIRED;

  const propertyName = lease.propertyId?.name ?? "this property";

  return (
    <div className="flex items-center gap-2">
      {/* Sign Lease */}
      {canSign && (
        <Dialog open={isSigningOpen} onOpenChange={setIsSigningOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="cursor-pointer">
              <FileSignature className="mr-2 h-4 w-4" />
              Sign Lease
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Sign Lease Agreement</DialogTitle>
              <DialogDescription>
                Complete the lease signing process for {propertyName}.
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
                      <FormLabel>Digital Signature</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter your full name as digital signature"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Type your full name to serve as your digital signature
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
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Signing..." : "Sign Lease"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Renew Lease */}
      {canRenew && (
        <Dialog open={isRenewalOpen} onOpenChange={setIsRenewalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="cursor-pointer">
              <RotateCcw className="mr-2 h-4 w-4" />
              Renew Lease
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Renew Lease Agreement</DialogTitle>
              <DialogDescription>
                Create a renewal for the lease at {propertyName}.
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
                        <FormLabel>New Start Date</FormLabel>
                        <FormControl>
                          <FormDatePicker
                            value={
                              field.value ? new Date(field.value) : undefined
                            }
                            onChange={(date) => {
                              if (date) {
                                // Format date as YYYY-MM-DD without timezone conversion
                                const year = date.getFullYear();
                                const month = String(
                                  date.getMonth() + 1
                                ).padStart(2, "0");
                                const day = String(date.getDate()).padStart(
                                  2,
                                  "0"
                                );
                                field.onChange(`${year}-${month}-${day}`);
                              } else {
                                field.onChange("");
                              }
                            }}
                            placeholder="Select new start date"
                            disabled={(date) =>
                              date <
                              new Date(
                                new Date().setDate(new Date().getDate() - 1)
                              )
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
                        <FormLabel>New End Date</FormLabel>
                        <FormControl>
                          <FormDatePicker
                            value={
                              field.value ? new Date(field.value) : undefined
                            }
                            onChange={(date) => {
                              if (date) {
                                // Format date as YYYY-MM-DD without timezone conversion
                                const year = date.getFullYear();
                                const month = String(
                                  date.getMonth() + 1
                                ).padStart(2, "0");
                                const day = String(date.getDate()).padStart(
                                  2,
                                  "0"
                                );
                                field.onChange(`${year}-${month}-${day}`);
                              } else {
                                field.onChange("");
                              }
                            }}
                            placeholder="Select new end date"
                            disabled={(date) => {
                              const startDate =
                                renewalForm.watch("newStartDate");
                              return startDate
                                ? date <= new Date(startDate)
                                : date < new Date();
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
                      <FormLabel>New Monthly Rent (Optional)</FormLabel>
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
                        Leave empty to keep current rent of $
                        {lease.terms.rentAmount}
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
                      <FormLabel>Renewal Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add any notes about the renewal..."
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
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Renewing..." : "Renew Lease"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Terminate Lease */}
      {/* DISABLED: Delete functionality temporarily disabled */}
      {/* {canTerminate && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="text-orange-600 hover:text-orange-700 cursor-pointer"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Terminate Lease
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Terminate Lease Agreement
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will terminate the lease for {propertyName}. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Form {...terminationForm}>
              <form
                onSubmit={terminationForm.handleSubmit(handleTerminateLease) as React.FormEventHandler<HTMLFormElement>}
                className="space-y-4"
              >
                <FormField<TerminationFormData>
                  control={terminationForm.control}
                  name="terminationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Termination Date</FormLabel>
                      <FormControl>
                        <FormDatePicker
                          value={
                            field.value && typeof field.value === 'string' ? new Date(field.value) : undefined
                          }
                          onChange={(date) => {
                            if (date) {
                              // Format date as YYYY-MM-DD without timezone conversion
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              field.onChange(`${year}-${month}-${day}`);
                            } else {
                              field.onChange("");
                            }
                          }}
                          placeholder="Select termination date"
                          disabled={(date) =>
                            date <
                            new Date(
                              new Date().setDate(new Date().getDate() - 1)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField<TerminationFormData>
                  control={terminationForm.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason for Termination</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Explain the reason for lease termination..."
                          {...field}
                          value={typeof field.value === 'string' ? field.value : ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField<TerminationFormData>
                  control={terminationForm.control}
                  name="notice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notice</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any additional notices or instructions..."
                          {...field}
                          value={typeof field.value === 'string' ? field.value : ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    type="submit"
                    disabled={isLoading}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {isLoading ? "Terminating..." : "Terminate Lease"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </form>
            </Form>
          </AlertDialogContent>
        </AlertDialog>
      )} */}
    </div>
  );
}
