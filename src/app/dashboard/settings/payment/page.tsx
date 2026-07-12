"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  CreditCard,
  Loader2,
  Eye,
  EyeOff,
  Database,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Plug,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthorization } from "@/hooks/useAuthorization";
import {
  PAYMENT_GATEWAYS,
  type GatewayId,
} from "@/lib/payments/gateway-registry";

type GatewayFormState = {
  enabled: boolean;
  [field: string]: string | boolean;
};

interface ActiveInfo {
  source: "database" | "environment";
  configured: boolean;
}

const buildEmptyForm = (): Record<string, GatewayFormState> => {
  const out: Record<string, GatewayFormState> = {};
  for (const def of PAYMENT_GATEWAYS) {
    const g: GatewayFormState = { enabled: false };
    for (const field of def.fields) {
      // Default select fields to their first option so a required choice is set.
      g[field.key] =
        field.type === "select" ? field.options?.[0]?.value ?? "" : "";
    }
    out[def.id] = g;
  }
  return out;
};

export default function PaymentSettingsPage() {
  const router = useRouter();
  const { status } = useSession();
  const { isAdmin } = useAuthorization();

  const [form, setForm] = useState<Record<string, GatewayFormState>>(
    buildEmptyForm()
  );
  const [secretSet, setSecretSet] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [active, setActive] = useState<Record<string, ActiveInfo>>({});
  const [env, setEnv] = useState<Record<string, { configured: boolean }>>({});
  const [defaultProvider, setDefaultProvider] = useState("stripe");

  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // Admin-only guard.
  useEffect(() => {
    if (status === "authenticated" && !isAdmin) {
      router.replace("/dashboard/settings/profile");
    }
  }, [status, isAdmin, router]);

  const setGatewayField = (
    id: string,
    key: string,
    value: string | boolean
  ) =>
    setForm((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/payment", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load payment settings");
      }
      const data = json.data ?? json;

      const nextForm = buildEmptyForm();
      const nextSecretSet: Record<string, Record<string, boolean>> = {};
      for (const def of PAYMENT_GATEWAYS) {
        const g = data.gateways?.[def.id] ?? {};
        nextForm[def.id].enabled = !!g.enabled;
        for (const field of def.fields) {
          // Keep buildEmptyForm defaults (e.g. select first option) when the
          // server has no saved value; only override when one is present.
          if (field.type !== "secret" && g[field.key]) {
            nextForm[def.id][field.key] = g[field.key];
          }
        }
        nextSecretSet[def.id] = g.secretSet || {};
      }

      setForm(nextForm);
      setSecretSet(nextSecretSet);
      setActive(data.active || {});
      setEnv(data.env || {});
      setDefaultProvider(data.defaultProvider || "stripe");
    } catch (error: any) {
      toast.error(error?.message || "Failed to load payment settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && isAdmin) loadSettings();
  }, [status, isAdmin, loadSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/settings/payment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultProvider, gateways: form }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save settings");
      }
      const data = json.data ?? json;
      toast.success(data?.message || "Payment settings saved");
      await loadSettings();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id: GatewayId) => {
    try {
      setTesting(id);
      const res = await fetch("/api/settings/payment/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: id, ...form[id] }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Connection test failed");
      }
      const data = json.data ?? json;
      toast.success(data?.message || "Connection successful");
    } catch (error: any) {
      toast.error(error?.message || "Connection test failed");
    } finally {
      setTesting(null);
    }
  };

  if (status === "loading" || (status === "authenticated" && !isAdmin)) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const enabledImplemented = PAYMENT_GATEWAYS.filter(
    (g) => g.implemented && form[g.id]?.enabled
  );

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CreditCard className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Payment Gateways
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage the credentials used to process online payments. Saved
            settings override environment variables.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Default gateway */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Default Gateway</CardTitle>
              <CardDescription>
                The gateway used to charge payments. Only enabled gateways can
                be selected.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={defaultProvider}
                onValueChange={setDefaultProvider}
              >
                <SelectTrigger className="sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_GATEWAYS.filter((g) => g.implemented).map((g) => {
                    const isEnabled = !!form[g.id]?.enabled;
                    return (
                      <SelectItem
                        key={g.id}
                        value={g.id}
                        disabled={!isEnabled}
                      >
                        {g.name}
                        {!isEnabled ? " (not enabled)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {enabledImplemented.length === 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  No gateway is enabled yet — enable one below to accept
                  payments.
                </p>
              )}
            </CardContent>
          </Card>

          {/* One card per gateway */}
          {PAYMENT_GATEWAYS.map((def) => {
            const gatewayActive = active[def.id];
            const gatewayForm = form[def.id];
            return (
              <Card key={def.id} className={!def.implemented ? "opacity-90" : ""}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                      {def.name}
                      {!def.implemented && (
                        <Badge variant="secondary">Coming soon</Badge>
                      )}
                      {def.implemented && gatewayActive && (
                        <Badge
                          variant={
                            gatewayActive.source === "database"
                              ? "default"
                              : "secondary"
                          }
                          className="gap-1"
                        >
                          {gatewayActive.source === "database" ? (
                            <Database className="h-3 w-3" />
                          ) : (
                            <HardDrive className="h-3 w-3" />
                          )}
                          {gatewayActive.source === "database"
                            ? "Database"
                            : "Environment"}
                        </Badge>
                      )}
                    </CardTitle>
                    {def.implemented &&
                      (gatewayActive?.configured ? (
                        <span className="flex items-center gap-1 text-sm text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" /> Ready
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm text-amber-600">
                          <AlertTriangle className="h-4 w-4" /> Not configured
                        </span>
                      ))}
                  </div>
                  <CardDescription>{def.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Enable toggle */}
                  <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">
                        Use database credentials
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {def.implemented
                          ? "When on, these override the environment variables."
                          : "Available once this gateway is supported."}
                      </p>
                    </div>
                    <Switch
                      checked={!!gatewayForm?.enabled}
                      disabled={!def.implemented}
                      onCheckedChange={(v) =>
                        setGatewayField(def.id, "enabled", v)
                      }
                    />
                  </div>

                  {/* Credential fields */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {def.fields.map((field) => {
                      const isSecret = field.type === "secret";
                      const isSelect = field.type === "select";
                      const fieldId = `${def.id}-${field.key}`;
                      const stored = secretSet[def.id]?.[field.key];
                      return (
                        <div key={field.key} className="space-y-2">
                          <Label htmlFor={fieldId}>
                            {field.label}
                            {field.required && (
                              <span className="ml-1 text-destructive">*</span>
                            )}
                          </Label>
                          {isSelect ? (
                            <Select
                              value={
                                (gatewayForm?.[field.key] as string) ||
                                field.options?.[0]?.value ||
                                ""
                              }
                              onValueChange={(v) =>
                                setGatewayField(def.id, field.key, v)
                              }
                            >
                              <SelectTrigger id={fieldId}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options?.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="relative">
                              <Input
                                id={fieldId}
                                type={
                                  isSecret && !showSecret[fieldId]
                                    ? "password"
                                    : "text"
                                }
                                autoComplete="off"
                                placeholder={
                                  isSecret && stored
                                    ? "•••••••• (unchanged)"
                                    : field.placeholder
                                }
                                value={
                                  (gatewayForm?.[field.key] as string) || ""
                                }
                                onChange={(e) =>
                                  setGatewayField(
                                    def.id,
                                    field.key,
                                    e.target.value
                                  )
                                }
                                className={isSecret ? "pr-10" : undefined}
                              />
                              {isSecret && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowSecret((s) => ({
                                      ...s,
                                      [fieldId]: !s[fieldId],
                                    }))
                                  }
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  tabIndex={-1}
                                >
                                  {showSecret[fieldId] ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                          {field.helpText && (
                            <p className="text-xs text-muted-foreground">
                              {field.helpText}
                            </p>
                          )}
                          {isSecret && stored && (
                            <p className="text-xs text-muted-foreground">
                              Leave blank to keep the saved value.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {def.implemented && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        onClick={() => handleTest(def.id)}
                        disabled={testing === def.id}
                      >
                        {testing === def.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                            Testing…
                          </>
                        ) : (
                          <>
                            <Plug className="mr-2 h-4 w-4" /> Test Connection
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {def.implemented && env[def.id]?.configured && (
                    <p className="text-xs text-muted-foreground">
                      Environment variables for {def.name} are detected and used
                      as a fallback when database settings are disabled.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Save */}
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
    </div>
  );
}
