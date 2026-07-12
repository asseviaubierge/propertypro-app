"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bell,
  Mail,
  Calendar,
  Clock,
  Send,
  Settings,
  CheckCircle,
  AlertTriangle,
  Receipt,
  Download,
  Eye,
  Loader2,
  Plus,
  Edit,
  Trash2,
} from "lucide-react";
import { PaymentStatus, PaymentType } from "@/types";

// ============================================================================
// INTERFACES
// ============================================================================

interface NotificationSettings {
  _id?: string;
  tenantId: string;
  emailNotifications: {
    paymentReminders: boolean;
    paymentConfirmations: boolean;
    overdueNotices: boolean;
    receiptDelivery: boolean;
  };
  reminderSchedule: {
    daysBeforeDue: number[];
    overdueReminders: boolean;
    overdueFrequency: "daily" | "weekly";
  };
  preferences: {
    emailAddress: string;
    phoneNumber?: string;
    smsNotifications: boolean;
    timezone: string;
  };
}

interface PaymentNotification {
  _id: string;
  tenantId: string;
  paymentId: string;
  type: "reminder" | "overdue" | "confirmation" | "receipt";
  status: "pending" | "sent" | "failed";
  scheduledDate: string;
  sentDate?: string;
  emailAddress: string;
  subject: string;
  message: string;
  createdAt: string;
  updatedAt: string;
}

interface PaymentReceipt {
  _id: string;
  paymentId: string;
  receiptNumber: string;
  generatedDate: string;
  emailSent: boolean;
  downloadUrl: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface PaymentNotificationsProps {
  onSettingsUpdate?: () => void;
}

export function PaymentNotifications({
  onSettingsUpdate,
}: PaymentNotificationsProps) {
  const { data: session } = useSession();

  // State management
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [notifications, setNotifications] = useState<PaymentNotification[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  // Form state for settings
  const [formSettings, setFormSettings] = useState<
    Partial<NotificationSettings>
  >({});

  // Fetch notification data
  useEffect(() => {
    if (session?.user) {
      fetchNotificationData();
    }
  }, [session]);

  const fetchNotificationData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch notification settings
      const settingsResponse = await fetch("/api/tenant/notification-settings");
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setSettings(settingsData.data);
        setFormSettings(settingsData.data || getDefaultSettings());
      } else {
        setFormSettings(getDefaultSettings());
      }

      // Fetch recent notifications
      const notificationsResponse = await fetch(
        "/api/tenant/notifications?limit=10"
      );
      if (notificationsResponse.ok) {
        const notificationsData = await notificationsResponse.json();
        setNotifications(notificationsData.data?.notifications || []);
      }

      // Fetch recent receipts
      const receiptsResponse = await fetch("/api/tenant/receipts?limit=5");
      if (receiptsResponse.ok) {
        const receiptsData = await receiptsResponse.json();
        setReceipts(receiptsData.data?.receipts || []);
      }
    } catch (error) {
      console.error("Error fetching notification data:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load notification data";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultSettings = (): Partial<NotificationSettings> => ({
    emailNotifications: {
      paymentReminders: true,
      paymentConfirmations: true,
      overdueNotices: true,
      receiptDelivery: true,
    },
    reminderSchedule: {
      daysBeforeDue: [7, 3, 1],
      overdueReminders: true,
      overdueFrequency: "weekly",
    },
    preferences: {
      emailAddress: session?.user?.email || "",
      smsNotifications: false,
      timezone: "America/New_York",
    },
  });

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch("/api/tenant/notification-settings", {
        method: settings ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formSettings),
      });

      if (response.ok) {
        const result = await response.json();
        setSettings(result.data);
        setShowSettingsDialog(false);
        toast.success("Notification settings saved successfully");
        onSettingsUpdate?.();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save settings";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      setIsTestingEmail(true);

      const response = await fetch("/api/tenant/notifications/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailAddress: formSettings.preferences?.emailAddress,
        }),
      });

      if (response.ok) {
        toast.success("Test email sent successfully");
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to send test email");
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error("Failed to send test email");
    } finally {
      setIsTestingEmail(false);
    }
  };

  const downloadReceipt = async (receiptId: string) => {
    try {
      const response = await fetch(
        `/api/tenant/receipts/${receiptId}/download`
      );
      if (!response.ok) {
        throw new Error("Failed to download receipt");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${receiptId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Receipt downloaded successfully");
    } catch (error) {
      console.error("Error downloading receipt:", error);
      toast.error("Failed to download receipt");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "reminder":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "overdue":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "confirmation":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "receipt":
        return <Receipt className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge variant="default" className="bg-green-500">
            Sent
          </Badge>
        );
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-muted-foreground">
              Loading notification settings...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Payment Notifications
          </h2>
          <p className="text-muted-foreground">
            Manage your payment reminders and notification preferences
          </p>
        </div>
        <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
          <DialogTrigger asChild>
            <Button>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Notification Settings</DialogTitle>
              <DialogDescription>
                Configure your payment notification preferences
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Email Notifications */}
              <div className="space-y-4">
                <h4 className="font-semibold">Email Notifications</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="payment-reminders">Payment Reminders</Label>
                    <Switch
                      id="payment-reminders"
                      checked={
                        formSettings.emailNotifications?.paymentReminders ||
                        false
                      }
                      onCheckedChange={(checked) =>
                        setFormSettings((prev) => ({
                          ...prev,
                          emailNotifications: {
                            ...prev.emailNotifications!,
                            paymentReminders: checked,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="payment-confirmations">
                      Payment Confirmations
                    </Label>
                    <Switch
                      id="payment-confirmations"
                      checked={
                        formSettings.emailNotifications?.paymentConfirmations ||
                        false
                      }
                      onCheckedChange={(checked) =>
                        setFormSettings((prev) => ({
                          ...prev,
                          emailNotifications: {
                            ...prev.emailNotifications!,
                            paymentConfirmations: checked,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="overdue-notices">Overdue Notices</Label>
                    <Switch
                      id="overdue-notices"
                      checked={
                        formSettings.emailNotifications?.overdueNotices || false
                      }
                      onCheckedChange={(checked) =>
                        setFormSettings((prev) => ({
                          ...prev,
                          emailNotifications: {
                            ...prev.emailNotifications!,
                            overdueNotices: checked,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="receipt-delivery">Receipt Delivery</Label>
                    <Switch
                      id="receipt-delivery"
                      checked={
                        formSettings.emailNotifications?.receiptDelivery ||
                        false
                      }
                      onCheckedChange={(checked) =>
                        setFormSettings((prev) => ({
                          ...prev,
                          emailNotifications: {
                            ...prev.emailNotifications!,
                            receiptDelivery: checked,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Reminder Schedule */}
              <div className="space-y-4">
                <h4 className="font-semibold">Reminder Schedule</h4>
                <div className="space-y-3">
                  <div>
                    <Label>Days Before Due Date</Label>
                    <div className="flex gap-2 mt-2">
                      {[7, 5, 3, 1].map((day) => (
                        <Button
                          key={day}
                          variant={
                            formSettings.reminderSchedule?.daysBeforeDue?.includes(
                              day
                            )
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => {
                            const currentDays =
                              formSettings.reminderSchedule?.daysBeforeDue ||
                              [];
                            const newDays = currentDays.includes(day)
                              ? currentDays.filter((d) => d !== day)
                              : [...currentDays, day].sort((a, b) => b - a);

                            setFormSettings((prev) => ({
                              ...prev,
                              reminderSchedule: {
                                ...prev.reminderSchedule!,
                                daysBeforeDue: newDays,
                              },
                            }));
                          }}
                        >
                          {day} day{day !== 1 ? "s" : ""}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="overdue-reminders">
                      Send Overdue Reminders
                    </Label>
                    <Switch
                      id="overdue-reminders"
                      checked={
                        formSettings.reminderSchedule?.overdueReminders || false
                      }
                      onCheckedChange={(checked) =>
                        setFormSettings((prev) => ({
                          ...prev,
                          reminderSchedule: {
                            ...prev.reminderSchedule!,
                            overdueReminders: checked,
                          },
                        }))
                      }
                    />
                  </div>
                  {formSettings.reminderSchedule?.overdueReminders && (
                    <div>
                      <Label>Overdue Reminder Frequency</Label>
                      <Select
                        value={
                          formSettings.reminderSchedule?.overdueFrequency ||
                          "weekly"
                        }
                        onValueChange={(value: "daily" | "weekly") =>
                          setFormSettings((prev) => ({
                            ...prev,
                            reminderSchedule: {
                              ...prev.reminderSchedule!,
                              overdueFrequency: value,
                            },
                          }))
                        }
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Preferences */}
              <div className="space-y-4">
                <h4 className="font-semibold">Contact Preferences</h4>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="email-address">Email Address</Label>
                    <Input
                      id="email-address"
                      type="email"
                      value={formSettings.preferences?.emailAddress || ""}
                      onChange={(e) =>
                        setFormSettings((prev) => ({
                          ...prev,
                          preferences: {
                            ...prev.preferences!,
                            emailAddress: e.target.value,
                          },
                        }))
                      }
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone-number">
                      Phone Number (Optional)
                    </Label>
                    <Input
                      id="phone-number"
                      type="tel"
                      value={formSettings.preferences?.phoneNumber || ""}
                      onChange={(e) =>
                        setFormSettings((prev) => ({
                          ...prev,
                          preferences: {
                            ...prev.preferences!,
                            phoneNumber: e.target.value,
                          },
                        }))
                      }
                      className="mt-2"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button onClick={handleSaveSettings} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Save Settings
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestEmail}
                  disabled={
                    isTestingEmail || !formSettings.preferences?.emailAddress
                  }
                >
                  {isTestingEmail ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Test Email
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSettingsDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Settings Overview */}
      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Current Settings
            </CardTitle>
            <CardDescription>
              Your active notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-semibold mb-2">Email Notifications</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Payment Reminders:</span>
                    <Badge
                      variant={
                        settings.emailNotifications.paymentReminders
                          ? "default"
                          : "secondary"
                      }
                    >
                      {settings.emailNotifications.paymentReminders
                        ? "Enabled"
                        : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Confirmations:</span>
                    <Badge
                      variant={
                        settings.emailNotifications.paymentConfirmations
                          ? "default"
                          : "secondary"
                      }
                    >
                      {settings.emailNotifications.paymentConfirmations
                        ? "Enabled"
                        : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Overdue Notices:</span>
                    <Badge
                      variant={
                        settings.emailNotifications.overdueNotices
                          ? "default"
                          : "secondary"
                      }
                    >
                      {settings.emailNotifications.overdueNotices
                        ? "Enabled"
                        : "Disabled"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Reminder Schedule</h4>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Days before due:</span>
                    <div className="flex gap-1 mt-1">
                      {settings.reminderSchedule.daysBeforeDue.map((day) => (
                        <Badge key={day} variant="outline" className="text-xs">
                          {day}d
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Overdue Reminders:</span>
                    <Badge
                      variant={
                        settings.reminderSchedule.overdueReminders
                          ? "default"
                          : "secondary"
                      }
                    >
                      {settings.reminderSchedule.overdueReminders
                        ? "Enabled"
                        : "Disabled"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Recent Notifications
          </CardTitle>
          <CardDescription>
            Your latest payment notifications and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification._id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getNotificationIcon(notification.type)}
                    <div>
                      <p className="font-medium">{notification.subject}</p>
                      <p className="text-sm text-muted-foreground">
                        {notification.type.charAt(0).toUpperCase() +
                          notification.type.slice(1)}{" "}
                        • {formatDate(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(notification.status)}
                    {notification.sentDate && (
                      <span className="text-xs text-muted-foreground">
                        Sent {formatDate(notification.sentDate)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No notifications yet</p>
              <p className="text-sm text-muted-foreground">
                Notifications will appear here when they are sent
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Receipts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Recent Receipts
          </CardTitle>
          <CardDescription>Download your payment receipts</CardDescription>
        </CardHeader>
        <CardContent>
          {receipts.length > 0 ? (
            <div className="space-y-3">
              {receipts.map((receipt) => (
                <div
                  key={receipt._id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Receipt className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="font-medium">
                        Receipt #{receipt.receiptNumber}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Generated {formatDate(receipt.generatedDate)}
                        {receipt.emailSent && " • Email sent"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadReceipt(receipt._id)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No receipts available</p>
              <p className="text-sm text-muted-foreground">
                Receipts will appear here after successful payments
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
