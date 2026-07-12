"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Mail,
  Server,
  Send,
  Loader2,
  Eye,
  EyeOff,
  Database,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthorization } from "@/hooks/useAuthorization";

type Encryption = "none" | "tls" | "ssl";

interface EmailForm {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  adminEmail: string;
  encryption: Encryption;
}

interface ActiveInfo {
  source: "database" | "environment";
  configured: boolean;
  host?: string;
  port?: number;
  fromEmail?: string;
  fromName?: string;
}

const DEFAULT_FORM: EmailForm = {
  enabled: false,
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  fromEmail: "",
  fromName: "",
  adminEmail: "",
  encryption: "tls",
};

export default function EmailSettingsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isAdmin } = useAuthorization();

  const [form, setForm] = useState<EmailForm>(DEFAULT_FORM);
  const [hasPassword, setHasPassword] = useState(false);
  const [active, setActive] = useState<ActiveInfo | null>(null);
  const [envConfigured, setEnvConfigured] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");

  // Admin-only guard.
  useEffect(() => {
    if (status === "authenticated" && !isAdmin) {
      router.replace("/dashboard/settings/profile");
    }
  }, [status, isAdmin, router]);

  const setField = <K extends keyof EmailForm>(key: K, value: EmailForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/email", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load email settings");
      }
      const data = json.data ?? json;
      const s = data.settings;
      setForm({
        enabled: !!s.enabled,
        smtpHost: s.smtpHost || "",
        smtpPort: s.smtpPort ?? 587,
        smtpUser: s.smtpUser || "",
        smtpPassword: "",
        fromEmail: s.fromEmail || "",
        fromName: s.fromName || "",
        adminEmail: s.adminEmail || "",
        encryption: (s.encryption as Encryption) || "tls",
      });
      setHasPassword(!!s.hasPassword);
      setActive(data.active || null);
      setEnvConfigured(!!data.env?.configured);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load email settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && isAdmin) {
      loadSettings();
      if (session?.user?.email) setTestRecipient(session.user.email);
    }
  }, [status, isAdmin, session?.user?.email, loadSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/settings/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save settings");
      }
      const data = json.data ?? json;
      toast.success(data?.message || "Email settings saved");
      // Refresh from the server so masked state / active source stay accurate.
      await loadSettings();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testRecipient) {
      toast.error("Enter a recipient email address");
      return;
    }
    try {
      setTesting(true);
      const res = await fetch("/api/settings/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, to: testRecipient }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to send test email");
      }
      const data = json.data ?? json;
      toast.success(data?.message || "Test email sent");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send test email");
    } finally {
      setTesting(false);
    }
  };

  if (status === "loading" || (status === "authenticated" && !isAdmin)) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Mail className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Email Configuration
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure the SMTP server used to send all outgoing emails.
          </p>
        </div>
      </div>

      {/* Active source banner */}
      {active && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {active.source === "database" ? (
                <Database className="h-4 w-4 text-primary" />
              ) : (
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Active source:</span>
              <Badge
                variant={active.source === "database" ? "default" : "secondary"}
              >
                {active.source === "database"
                  ? "Database (this page)"
                  : "Environment (.env)"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {active.configured ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Ready to send
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="h-4 w-4" /> Not configured
                </span>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Database settings take priority when enabled. Otherwise the app
            falls back to environment variables
            {envConfigured ? " (currently configured)." : " (not detected)."}
          </p>
        </div>
      )}

      {/* SMTP configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" /> SMTP Server
          </CardTitle>
          <CardDescription>
            Credentials for your email provider (e.g. Gmail, SendGrid, Mailgun,
            Amazon SES).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable toggle */}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Use database SMTP settings</Label>
              <p className="text-sm text-muted-foreground">
                When on, these settings override the environment variables.
              </p>
            </div>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setField("enabled", v)}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    id="smtpHost"
                    placeholder="smtp.gmail.com"
                    value={form.smtpHost}
                    onChange={(e) => setField("smtpHost", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">Port</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    placeholder="587"
                    value={form.smtpPort}
                    onChange={(e) =>
                      setField("smtpPort", Number(e.target.value))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="encryption">Encryption</Label>
                <Select
                  value={form.encryption}
                  onValueChange={(v) => setField("encryption", v as Encryption)}
                >
                  <SelectTrigger id="encryption">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tls">STARTTLS (587)</SelectItem>
                    <SelectItem value="ssl">SSL/TLS (465)</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="smtpUser">SMTP Username</Label>
                  <Input
                    id="smtpUser"
                    autoComplete="off"
                    placeholder="you@example.com"
                    value={form.smtpUser}
                    onChange={(e) => setField("smtpUser", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPassword">SMTP Password</Label>
                  <div className="relative">
                    <Input
                      id="smtpPassword"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder={
                        hasPassword ? "•••••••• (unchanged)" : "App password"
                      }
                      value={form.smtpPassword}
                      onChange={(e) => setField("smtpPassword", e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {hasPassword && (
                    <p className="text-xs text-muted-foreground">
                      Leave blank to keep the saved password.
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fromName">From Name</Label>
                  <Input
                    id="fromName"
                    placeholder="PropertyPro"
                    value={form.fromName}
                    onChange={(e) => setField("fromName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fromEmail">From Email</Label>
                  <Input
                    id="fromEmail"
                    type="email"
                    placeholder="noreply@example.com"
                    value={form.fromEmail}
                    onChange={(e) => setField("fromEmail", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminEmail">Admin / Reply-To Email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  placeholder="admin@example.com"
                  value={form.adminEmail}
                  onChange={(e) => setField("adminEmail", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used as the Reply-To address on outgoing emails.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save Settings"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Test email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" /> Send Test Email
          </CardTitle>
          <CardDescription>
            Sends a test message using the settings currently entered above
            (you don&apos;t need to save first).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="testRecipient">Recipient</Label>
              <Input
                id="testRecipient"
                type="email"
                placeholder="recipient@example.com"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
              className="sm:w-auto"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" /> Send Test
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
