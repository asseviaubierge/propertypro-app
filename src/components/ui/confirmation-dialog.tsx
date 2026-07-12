/**
 * PropertyPro - Confirmation Dialog Component
 * Reusable confirmation dialog for destructive actions
 */

"use client";

import React from "react";
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
import { Loader2 } from "lucide-react";

interface ConfirmationDialogProps {
  children: React.ReactNode;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

export function ConfirmationDialog({
  children,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  loading = false,
  disabled = false,
}: ConfirmationDialogProps) {
  const [open, setOpen] = React.useState(false);

  const handleConfirm = async () => {
    try {
      await onConfirm();
      setOpen(false);
    } catch (error) {
      // Error handling is done in the parent component
      console.error("Confirmation action failed:", error);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild disabled={disabled}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={
              variant === "destructive"
                ? "bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
                : ""
            }
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Specific confirmation dialogs for common actions
interface DeleteConfirmationDialogProps {
  children: React.ReactNode;
  itemName: string;
  itemType?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

export function DeleteConfirmationDialog({
  children,
  itemName,
  itemType = "item",
  onConfirm,
  loading = false,
  disabled = false,
}: DeleteConfirmationDialogProps) {
  return (
    <ConfirmationDialog
      title={`Delete ${itemType}`}
      description={`Are you sure you want to delete "${itemName}"? This action cannot be undone.`}
      confirmText="Delete"
      variant="destructive"
      onConfirm={onConfirm}
      loading={loading}
      disabled={disabled}
    >
      {children}
    </ConfirmationDialog>
  );
}

interface CancelConfirmationDialogProps {
  children: React.ReactNode;
  itemName: string;
  itemType?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

export function CancelConfirmationDialog({
  children,
  itemName,
  itemType = "request",
  onConfirm,
  loading = false,
  disabled = false,
}: CancelConfirmationDialogProps) {
  return (
    <ConfirmationDialog
      title={`Cancel ${itemType}`}
      description={`Are you sure you want to cancel "${itemName}"? This action may affect ongoing work.`}
      confirmText="Cancel Request"
      variant="destructive"
      onConfirm={onConfirm}
      loading={loading}
      disabled={disabled}
    >
      {children}
    </ConfirmationDialog>
  );
}

interface CompleteConfirmationDialogProps {
  children: React.ReactNode;
  itemName: string;
  itemType?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

export function CompleteConfirmationDialog({
  children,
  itemName,
  itemType = "request",
  onConfirm,
  loading = false,
  disabled = false,
}: CompleteConfirmationDialogProps) {
  return (
    <ConfirmationDialog
      title={`Complete ${itemType}`}
      description={`Are you sure you want to mark "${itemName}" as completed? This will finalize the work.`}
      confirmText="Mark Complete"
      onConfirm={onConfirm}
      loading={loading}
      disabled={disabled}
    >
      {children}
    </ConfirmationDialog>
  );
}

interface AssignConfirmationDialogProps {
  children: React.ReactNode;
  itemName: string;
  technicianName: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

export function AssignConfirmationDialog({
  children,
  itemName,
  technicianName,
  onConfirm,
  loading = false,
  disabled = false,
}: AssignConfirmationDialogProps) {
  return (
    <ConfirmationDialog
      title="Assign Technician"
      description={`Are you sure you want to assign "${itemName}" to ${technicianName}?`}
      confirmText="Assign"
      onConfirm={onConfirm}
      loading={loading}
      disabled={disabled}
    >
      {children}
    </ConfirmationDialog>
  );
}
