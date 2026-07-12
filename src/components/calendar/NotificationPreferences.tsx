"use client";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bell, Mail, Smartphone, Clock, Settings } from "lucide-react";
import { toast } from "sonner";

interface NotificationSettings {
  email: {
    enabled: boolean;
    invitations: boolean;
    reminders: boolean;
    updates: boolean;
    cancellations: boolean;
    dailyDigest: boolean;
    weeklyDigest: boolean;
  };
  sms: {
    enabled: boolean;
    reminders: boolean;
    urgentUpdates: boolean;
  };
  push: {
    enabled: boolean;
    reminders: boolean;
    updates: boolean;
    invitations: boolean;
  };
  reminderTiming: {
    default: number[];
    highPriority: number[];
    lowPriority: number[];
  };
  digestTiming: {
    dailyTime: string;
    weeklyDay: number;
    weeklyTime: string;
  };
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
}

interface NotificationPreferencesProps {
  userId?: string;
  onSettingsChange?: (settings: NotificationSettings) => void;
}

const defaultSettings: NotificationSettings = {
  email: {
    enabled: true,
    invitations: true,
    reminders: true,
    updates: true,
    cancellations: true,
    dailyDigest: false,
    weeklyDigest: true,
  },
  sms: {
    enabled: false,
    reminders: false,
    urgentUpdates: false,
  },
  push: {
    enabled: true,
    reminders: true,
    updates: true,
    invitations: true,
  },
  reminderTiming: {
    default: [15, 60], // 15 minutes and 1 hour before
    highPriority: [15, 60, 1440], // 15 min, 1 hour, 1 day before
    lowPriority: [60], // 1 hour before
  },
  digestTiming: {
    dailyTime: "08:00",
    weeklyDay: 1, // Monday
    weeklyTime: "09:00",
  },
  quietHours: {
    enabled: true,
    startTime: "22:00",
    endTime: "08:00",
    timezone: "local",
  },
};

const reminderOptions = [
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 1440, label: "1 day" },
  { value: 2880, label: "2 days" },
  { value: 10080, label: "1 week" },
];

const weekDays = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function NotificationPreferences({
  userId,
  onSettingsChange,
}: NotificationPreferencesProps) {
  const [settings, setSettings] =
    useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/calendar/notifications");
      if (response.ok) {
        const result = await response.json();
        setSettings({ ...defaultSettings, ...(result?.data ?? {}) });
      }
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = (path: string, value: any) => {
    setSettings((prev) => {
      const newSettings = { ...prev };
      const keys = path.split(".");
      let current = newSettings;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i] as keyof typeof current] as any;
      }

      current[keys[keys.length - 1] as keyof typeof current] = value;

      onSettingsChange?.(newSettings);
      return newSettings;
    });
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/calendar/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success("Notification preferences saved successfully!");
      } else {
        const result = await response.json();
        toast.error(result?.error || "Failed to save preferences");
      }
    } catch (error) {
      console.error("Failed to save notification settings:", error);
      toast.error("Failed to save notification preferences");
    } finally {
      setSaving(false);
    }
  };

  const toggleReminderTime = (
    category: keyof typeof settings.reminderTiming,
    minutes: number,
  ) => {
    const currentTimes = settings.reminderTiming[category];
    const newTimes = currentTimes.includes(minutes)
      ? currentTimes.filter((t) => t !== minutes)
      : [...currentTimes, minutes].sort((a, b) => a - b);

    updateSetting(`reminderTiming.${category}`, newTimes);
  };

  const getReminderLabel = (minutes: number) => {
    const option = reminderOptions.find((opt) => opt.value === minutes);
    return option ? option.label : `${minutes} minutes`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            Loading notification preferences...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Configure when to receive email notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Master switch for all email notifications
              </p>
            </div>
            <Switch
              checked={settings.email.enabled}
              onCheckedChange={(checked) =>
                updateSetting("email.enabled", checked)
              }
            />
          </div>

          {settings.email.enabled && (
            <div className="space-y-4 pl-6 border-l-2 border-muted">
              <div className="flex items-center justify-between">
                <Label>Event Invitations</Label>
                <Switch
                  checked={settings.email.invitations}
                  onCheckedChange={(checked) =>
                    updateSetting("email.invitations", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Event Reminders</Label>
                <Switch
                  checked={settings.email.reminders}
                  onCheckedChange={(checked) =>
                    updateSetting("email.reminders", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Event Updates</Label>
                <Switch
                  checked={settings.email.updates}
                  onCheckedChange={(checked) =>
                    updateSetting("email.updates", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Event Cancellations</Label>
                <Switch
                  checked={settings.email.cancellations}
                  onCheckedChange={(checked) =>
                    updateSetting("email.cancellations", checked)
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Daily Digest</Label>
                  <p className="text-sm text-muted-foreground">
                    Daily summary of upcoming events
                  </p>
                </div>
                <Switch
                  checked={settings.email.dailyDigest}
                  onCheckedChange={(checked) =>
                    updateSetting("email.dailyDigest", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Digest</Label>
                  <p className="text-sm text-muted-foreground">
                    Weekly summary of events and activities
                  </p>
                </div>
                <Switch
                  checked={settings.email.weeklyDigest}
                  onCheckedChange={(checked) =>
                    updateSetting("email.weeklyDigest", checked)
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SMS Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            SMS Notifications
          </CardTitle>
          <CardDescription>
            Configure SMS notifications for urgent events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable SMS Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive SMS for important calendar events
              </p>
            </div>
            <Switch
              checked={settings.sms.enabled}
              onCheckedChange={(checked) =>
                updateSetting("sms.enabled", checked)
              }
            />
          </div>

          {settings.sms.enabled && (
            <div className="space-y-4 pl-6 border-l-2 border-muted">
              <div className="flex items-center justify-between">
                <Label>Event Reminders</Label>
                <Switch
                  checked={settings.sms.reminders}
                  onCheckedChange={(checked) =>
                    updateSetting("sms.reminders", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Urgent Updates</Label>
                <Switch
                  checked={settings.sms.urgentUpdates}
                  onCheckedChange={(checked) =>
                    updateSetting("sms.urgentUpdates", checked)
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reminder Timing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Reminder Timing
          </CardTitle>
          <CardDescription>
            Configure when to receive reminders based on event priority
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(settings.reminderTiming).map(([category, times]) => (
            <div key={category} className="space-y-3">
              <Label className="text-base font-medium capitalize">
                {category.replace(/([A-Z])/g, " $1").trim()} Events
              </Label>
              <div className="flex flex-wrap gap-2">
                {reminderOptions.map(({ value, label }) => {
                  const isSelected = times.includes(value);
                  return (
                    <Badge
                      key={value}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() =>
                        toggleReminderTime(
                          category as keyof typeof settings.reminderTiming,
                          value,
                        )
                      }
                    >
                      {label}
                    </Badge>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                Selected: {times.map(getReminderLabel).join(", ") || "None"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>
            Set hours when notifications should be silenced
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Quiet Hours</Label>
              <p className="text-sm text-muted-foreground">
                Silence non-urgent notifications during specified hours
              </p>
            </div>
            <Switch
              checked={settings.quietHours.enabled}
              onCheckedChange={(checked) =>
                updateSetting("quietHours.enabled", checked)
              }
            />
          </div>

          {settings.quietHours.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-muted">
              <div className="space-y-2">
                <Label htmlFor="quietStart">Start Time</Label>
                <input
                  id="quietStart"
                  type="time"
                  value={settings.quietHours.startTime}
                  onChange={(e) =>
                    updateSetting("quietHours.startTime", e.target.value)
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quietEnd">End Time</Label>
                <input
                  id="quietEnd"
                  type="time"
                  value={settings.quietHours.endTime}
                  onChange={(e) =>
                    updateSetting("quietHours.endTime", e.target.value)
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving}>
          <Settings className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}
