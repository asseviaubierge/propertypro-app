"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Settings, Clock, Eye, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { useLocalizationContext } from "@/components/providers/LocalizationProvider";

interface CalendarSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: {
    weekends: boolean;
    businessHours: {
      startTime: string;
      endTime: string;
    };
    defaultEventDuration: string;
    slotDuration: string;
    snapDuration: string;
    timezone: string;
    firstDay: number;
  };
  onSettingsChange: (settings: any) => void;
}

export function CalendarSettings({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: CalendarSettingsProps) {
  const { t } = useLocalizationContext();
  const [emailTesting, setEmailTesting] = React.useState(false);

  const timezones = React.useMemo(
    () => [
      { value: "local", label: t("calendar.settingsModal.display.tzLocal") },
      { value: "UTC", label: t("calendar.settingsModal.display.tzUTC") },
      {
        value: "America/New_York",
        label: t("calendar.settingsModal.display.tzEastern"),
      },
      {
        value: "America/Chicago",
        label: t("calendar.settingsModal.display.tzCentral"),
      },
      {
        value: "America/Denver",
        label: t("calendar.settingsModal.display.tzMountain"),
      },
      {
        value: "America/Los_Angeles",
        label: t("calendar.settingsModal.display.tzPacific"),
      },
      {
        value: "Europe/London",
        label: t("calendar.settingsModal.display.tzLondon"),
      },
      {
        value: "Europe/Paris",
        label: t("calendar.settingsModal.display.tzParis"),
      },
      {
        value: "Asia/Tokyo",
        label: t("calendar.settingsModal.display.tzTokyo"),
      },
      {
        value: "Asia/Shanghai",
        label: t("calendar.settingsModal.display.tzShanghai"),
      },
      {
        value: "Australia/Sydney",
        label: t("calendar.settingsModal.display.tzSydney"),
      },
    ],
    [t],
  );

  const daysOfWeek = React.useMemo(
    () => [
      { value: 0, label: t("calendar.settingsModal.display.sunday") },
      { value: 1, label: t("calendar.settingsModal.display.monday") },
      { value: 2, label: t("calendar.settingsModal.display.tuesday") },
      { value: 3, label: t("calendar.settingsModal.display.wednesday") },
      { value: 4, label: t("calendar.settingsModal.display.thursday") },
      { value: 5, label: t("calendar.settingsModal.display.friday") },
      { value: 6, label: t("calendar.settingsModal.display.saturday") },
    ],
    [t],
  );

  const timeSlots = React.useMemo(
    () => [
      { value: "00:15", label: t("calendar.settingsModal.time.15min") },
      { value: "00:30", label: t("calendar.settingsModal.time.30min") },
      { value: "01:00", label: t("calendar.settingsModal.time.1hour") },
      { value: "02:00", label: t("calendar.settingsModal.time.2hours") },
    ],
    [t],
  );

  const updateSetting = (key: string, value: any) => {
    if (key.includes(".")) {
      const [parent, child] = key.split(".");
      const parentValue = settings[parent as keyof typeof settings];
      const parentObject =
        typeof parentValue === "object" && parentValue !== null
          ? (parentValue as Record<string, unknown>)
          : {};
      onSettingsChange({
        ...settings,
        [parent]: {
          ...parentObject,
          [child]: value,
        },
      });
    } else {
      onSettingsChange({
        ...settings,
        [key]: value,
      });
    }
  };

  const handleTestEmail = async () => {
    setEmailTesting(true);
    try {
      const response = await fetch("/api/test/email", {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok && data?.success) {
        toast.success(t("calendar.settingsModal.email.success"));
      } else {
        toast.error(data?.message || t("calendar.settingsModal.email.failed"));
      }
    } catch (error) {
      console.error("Erreur du test d’e-mail :", error);
      toast.error(t("calendar.settingsModal.email.failed"));
    } finally {
      setEmailTesting(false);
    }
  };

  const handleSave = () => {
    // Save settings to localStorage or API
    localStorage.setItem("calendarSettings", JSON.stringify(settings));
    onOpenChange(false);
  };

  const handleReset = () => {
    const defaultSettings = {
      weekends: true,
      businessHours: {
        startTime: "09:00",
        endTime: "17:00",
      },
      defaultEventDuration: "01:00",
      slotDuration: "00:30",
      snapDuration: "00:15",
      timezone: "local",
      firstDay: 0,
    };
    onSettingsChange(defaultSettings);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="calendar-settings-dialog max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none gap-3 overflow-y-auto p-3 sm:max-h-[90vh] sm:w-full sm:max-w-2xl sm:gap-4 sm:p-6">
        <DialogHeader className="min-w-0 pr-7 text-left">
          <DialogTitle className="flex min-w-0 items-center gap-2 text-base sm:text-lg">
            <Settings className="h-5 w-5" />
            {t("calendar.settingsModal.title")}
          </DialogTitle>
          <DialogDescription>
            {t("calendar.settingsModal.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3 sm:space-y-6">
          {/* Display Settings */}
          <Card className="min-w-0 gap-3">
            <CardHeader className="min-w-0 px-3 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-4 w-4" />
                {t("calendar.settingsModal.display.title")}
              </CardTitle>
              <CardDescription>
                {t("calendar.settingsModal.display.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 px-3 sm:px-6">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <Label htmlFor="weekends">
                    {t("calendar.settingsModal.display.showWeekends")}
                  </Label>
                  <p className="text-xs leading-4 text-muted-foreground sm:text-sm">
                    {t("calendar.settingsModal.display.showWeekendsDesc")}
                  </p>
                </div>
                <Switch
                  id="weekends"
                  checked={settings.weekends}
                  onCheckedChange={(checked) =>
                    updateSetting("weekends", checked)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstDay">
                  {t("calendar.settingsModal.display.weekStartsOn")}
                </Label>
                <Select
                  value={settings.firstDay.toString()}
                  onValueChange={(value) =>
                    updateSetting("firstDay", parseInt(value))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {daysOfWeek.map((day) => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">
                  {t("calendar.settingsModal.display.timezone")}
                </Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => updateSetting("timezone", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Time Settings */}
          <Card className="min-w-0 gap-3">
            <CardHeader className="min-w-0 px-3 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-4 w-4" />
                {t("calendar.settingsModal.time.title")}
              </CardTitle>
              <CardDescription>
                {t("calendar.settingsModal.time.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 px-3 sm:px-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">
                    {t("calendar.settingsModal.time.businessHoursStart")}
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={settings.businessHours.startTime}
                    onChange={(e) =>
                      updateSetting("businessHours.startTime", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">
                    {t("calendar.settingsModal.time.businessHoursEnd")}
                  </Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={settings.businessHours.endTime}
                    onChange={(e) =>
                      updateSetting("businessHours.endTime", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slotDuration">
                  {t("calendar.settingsModal.time.slotDuration")}
                </Label>
                <Select
                  value={settings.slotDuration}
                  onValueChange={(value) =>
                    updateSetting("slotDuration", value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="snapDuration">
                  {t("calendar.settingsModal.time.snapDuration")}
                </Label>
                <Select
                  value={settings.snapDuration}
                  onValueChange={(value) =>
                    updateSetting("snapDuration", value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultDuration">
                  {t("calendar.settingsModal.time.defaultEventDuration")}
                </Label>
                <Select
                  value={settings.defaultEventDuration}
                  onValueChange={(value) =>
                    updateSetting("defaultEventDuration", value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Email Service Test */}
          <Card className="min-w-0 gap-3">
            <CardHeader className="min-w-0 px-3 sm:px-6">
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {t("calendar.settingsModal.email.title")}
              </CardTitle>
              <CardDescription>
                {t("calendar.settingsModal.email.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4 px-3 sm:px-6">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t("calendar.settingsModal.email.status")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("calendar.settingsModal.email.statusDesc")}
                  </p>
                </div>
                <Button
                  onClick={handleTestEmail}
                  disabled={emailTesting}
                  variant="outline"
                  size="sm"
                  className="w-full whitespace-nowrap sm:w-auto"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {emailTesting
                    ? t("calendar.settingsModal.email.sending")
                    : t("calendar.settingsModal.email.sendTest")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:justify-end">
            <Button className="w-full whitespace-nowrap px-1 text-[11px] sm:w-auto sm:px-3 sm:text-sm" variant="outline" onClick={handleReset}>
              {t("calendar.settingsModal.resetToDefaults")}
            </Button>
            <Button className="w-full whitespace-nowrap px-1 text-[11px] sm:w-auto sm:px-3 sm:text-sm" variant="outline" onClick={() => onOpenChange(false)}>
              {t("calendar.settingsModal.cancel")}
            </Button>
            <Button className="w-full whitespace-nowrap px-1 text-[11px] sm:w-auto sm:px-3 sm:text-sm" onClick={handleSave}>
              {t("calendar.settingsModal.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
