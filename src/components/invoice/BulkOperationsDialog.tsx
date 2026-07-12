"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  CreditCard,
  Mail,
  Download,
  Trash2,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

const bulkOperationSchema = z.object({
  operation: z.enum([
    "mark_paid",
    "send_reminders",
    "update_status",
    "generate_pdfs",
    "delete",
    "add_late_fees",
  ]),
  paymentMethod: z.string().optional(),
  status: z.string().optional(),
  lateFeeAmount: z.number().optional(),
  reminderType: z.string().optional(),
  notes: z.string().optional(),
});

type BulkOperationForm = z.infer<typeof bulkOperationSchema>;

interface BulkOperationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedInvoices: string[];
  onOperationComplete: () => void;
}

interface OperationResult {
  successful: Array<{
    invoiceId: string;
    invoiceNumber?: string;
    [key: string]: any;
  }>;
  failed: Array<{
    invoiceId: string;
    error: string;
  }>;
  totalProcessed: number;
}

export default function BulkOperationsDialog({
  open,
  onOpenChange,
  selectedInvoices,
  onOperationComplete,
}: BulkOperationsDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OperationResult | null>(null);

  const form = useForm<BulkOperationForm>({
    resolver: zodResolver(bulkOperationSchema),
    defaultValues: {
      operation: "mark_paid",
      paymentMethod: "manual",
      status: "issued",
      lateFeeAmount: 50,
      reminderType: "reminder",
      notes: "",
    },
  });

  const selectedOperation = form.watch("operation");

  const onSubmit = async (data: BulkOperationForm) => {
    try {
      setSubmitting(true);
      setResult(null);

      const requestData: any = {
        operation: data.operation,
        invoiceIds: selectedInvoices,
        data: {},
      };

      // Add operation-specific data
      switch (data.operation) {
        case "mark_paid":
          requestData.data.paymentMethod = data.paymentMethod;
          break;
        case "update_status":
          requestData.data.status = data.status;
          break;
        case "add_late_fees":
          requestData.data.amount = data.lateFeeAmount;
          requestData.data.reason = data.notes || "Late payment fee";
          break;
        case "send_reminders":
          requestData.data.type = data.reminderType;
          requestData.data.method = "email";
          break;
      }

      const response = await fetch("/api/invoices/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      const responseData = await response.json();
      if (responseData.success) {
        setResult(responseData.data);
        toast.success(`Bulk operation completed successfully`);
        onOperationComplete();
      } else {
        toast.error(responseData.error || "Failed to perform bulk operation");
      }
    } catch (error) {
      console.error("Error performing bulk operation:", error);
      toast.error("Failed to perform bulk operation");
    } finally {
      setSubmitting(false);
    }
  };

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case "mark_paid":
        return <CreditCard className="h-4 w-4" />;
      case "send_reminders":
        return <Mail className="h-4 w-4" />;
      case "generate_pdfs":
        return <Download className="h-4 w-4" />;
      case "delete":
        return <Trash2 className="h-4 w-4" />;
      case "add_late_fees":
        return <DollarSign className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getOperationDescription = (operation: string) => {
    switch (operation) {
      case "mark_paid":
        return "Mark selected invoices as paid with manual payment entries";
      case "send_reminders":
        return "Send payment reminders to tenants for selected invoices";
      case "update_status":
        return "Update the status of selected invoices";
      case "generate_pdfs":
        return "Generate PDF documents for selected invoices";
      case "delete":
        return "Soft delete selected invoices (can be restored)";
      case "add_late_fees":
        return "Add late fees to selected overdue invoices";
      default:
        return "Perform bulk operation on selected invoices";
    }
  };

  const handleClose = () => {
    setResult(null);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Operations</DialogTitle>
          <DialogDescription>
            Perform operations on {selectedInvoices.length} selected invoice(s)
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="operation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operation</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select operation" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="mark_paid">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Mark as Paid
                          </div>
                        </SelectItem>
                        <SelectItem value="send_reminders">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Send Reminders
                          </div>
                        </SelectItem>
                        <SelectItem value="update_status">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            Update Status
                          </div>
                        </SelectItem>
                        <SelectItem value="generate_pdfs">
                          <div className="flex items-center gap-2">
                            <Download className="h-4 w-4" />
                            Generate PDFs
                          </div>
                        </SelectItem>
                        <SelectItem value="add_late_fees">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Add Late Fees
                          </div>
                        </SelectItem>
                        {/* DISABLED: Delete functionality temporarily disabled */}
                        {/* <SelectItem value="delete">
                          <div className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4" />
                            Delete Invoices
                          </div>
                        </SelectItem> */}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  {getOperationIcon(selectedOperation)}
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      {selectedOperation.replace("_", " ").toUpperCase()}
                    </p>
                    <p className="text-xs text-blue-700">
                      {getOperationDescription(selectedOperation)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Operation-specific fields */}
              {selectedOperation === "mark_paid" && (
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="check">Check</SelectItem>
                          <SelectItem value="bank_transfer">
                            Bank Transfer
                          </SelectItem>
                          <SelectItem value="credit_card">
                            Credit Card
                          </SelectItem>
                          <SelectItem value="manual">Manual Entry</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {selectedOperation === "update_status" && (
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="issued">Issued</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {selectedOperation === "add_late_fees" && (
                <>
                  <FormField
                    control={form.control}
                    name="lateFeeAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Late Fee Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="50.00"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason</FormLabel>
                        <FormControl>
                          <Input placeholder="Late payment fee" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {selectedOperation === "send_reminders" && (
                <FormField
                  control={form.control}
                  name="reminderType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reminder Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select reminder type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="reminder">
                            Payment Reminder
                          </SelectItem>
                          <SelectItem value="overdue">
                            Overdue Notice
                          </SelectItem>
                          <SelectItem value="final_notice">
                            Final Notice
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {selectedOperation === "delete" && (
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-900">
                        Warning
                      </p>
                      <p className="text-xs text-red-700">
                        This will soft delete the selected invoices. Invoices
                        with payments cannot be deleted unless forced.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Processing..." : "Execute Operation"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          // Results display
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Operation Complete</h3>
              <p className="text-sm text-gray-600">
                Processed {result.totalProcessed} invoice(s)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">
                    Successful
                  </span>
                </div>
                <p className="text-lg font-bold text-green-600">
                  {result.successful.length}
                </p>
              </div>

              <div className="bg-red-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-900">
                    Failed
                  </span>
                </div>
                <p className="text-lg font-bold text-red-600">
                  {result.failed.length}
                </p>
              </div>
            </div>

            {result.failed.length > 0 && (
              <div>
                <h4 className="font-medium text-red-900 mb-2">
                  Failed Operations:
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {result.failed.map((failure, index) => (
                    <div key={index} className="text-xs bg-red-50 p-2 rounded">
                      <span className="font-mono">{failure.invoiceId}</span>:{" "}
                      {failure.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
