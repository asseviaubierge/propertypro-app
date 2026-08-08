"use client";
import { toast as sonnerToast } from "sonner";
interface ToastOptions { title?: string; description?: string; variant?: "default" | "destructive"; }
export function useToast() {
  return { toast({ title, description, variant = "default" }: ToastOptions) {
    const message = title || description || "Notification";
    const detail = title && description ? { description } : undefined;
    if (variant === "destructive") sonnerToast.error(message, detail);
    else sonnerToast.success(message, detail);
  }};
}
