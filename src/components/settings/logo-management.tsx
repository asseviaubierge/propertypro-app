"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Eye,
  Download,
  AlertCircle,
  CheckCircle,
  Palette,
  Sun,
  Moon,
  Star,
  Plus,
} from "lucide-react";
import { logClientError } from "@/utils/logger";

interface LogoSetting {
  _id: string;
  key: string;
  value: string;
  description: string;
  metadata?: {
    group?: string;
    tags?: string[];
  };
}

interface LogoManagementProps {
  settings: LogoSetting[];
  onUpdate: (key: string, value: string) => Promise<void>;
  onCreate?: (settingData: any) => Promise<any>;
  onDelete?: (settingId: string) => Promise<void>;
  onAlert: (type: "success" | "error" | "info", message: string) => void;
}

export function LogoManagement({
  settings,
  onUpdate,
  onCreate,
  onDelete,
  onAlert,
}: LogoManagementProps) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSetting, setNewSetting] = useState({
    key: "",
    value: "",
    dataType: "string",
    description: "",
  });
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const logoSettings = settings.filter(
    (setting) =>
      setting.metadata?.group === "logos" ||
      setting.key.includes("logo") ||
      setting.key === "favicon",
  );

  const colorSettings = settings.filter(
    (setting) => setting.metadata?.group === "colors",
  );

  // Default branding settings if none exist
  const defaultBrandingSettings = [
    {
      _id: "temp-logo-light",
      key: "logo_light",
      value: "/images/logo-light.png",
      dataType: "file",
      description: "Light theme logo",
      category: "branding",
      isPublic: true,
      isEditable: true,
      metadata: { group: "logos", order: 1 },
    },
    {
      _id: "temp-logo-dark",
      key: "logo_dark",
      value: "/images/logo-dark.png",
      dataType: "file",
      description: "Dark theme logo",
      category: "branding",
      isPublic: true,
      isEditable: true,
      metadata: { group: "logos", order: 2 },
    },
    {
      _id: "temp-favicon",
      key: "favicon",
      value: "/favicon.ico",
      dataType: "file",
      description: "Website favicon",
      category: "branding",
      isPublic: true,
      isEditable: true,
      metadata: { group: "logos", order: 3 },
    },
    {
      _id: "temp-primary-color",
      key: "primary_color",
      value: "#3B82F6",
      dataType: "color",
      description: "Primary brand color",
      category: "branding",
      isPublic: true,
      isEditable: true,
      metadata: { group: "colors", order: 1 },
    },
    {
      _id: "temp-secondary-color",
      key: "secondary_color",
      value: "#64748B",
      dataType: "color",
      description: "Secondary brand color",
      category: "branding",
      isPublic: true,
      isEditable: true,
      metadata: { group: "colors", order: 2 },
    },
  ];

  // Use existing settings or defaults
  const effectiveLogoSettings =
    logoSettings.length > 0
      ? logoSettings
      : defaultBrandingSettings.filter((s) => s.metadata?.group === "logos");

  const effectiveColorSettings =
    colorSettings.length > 0
      ? colorSettings
      : defaultBrandingSettings.filter((s) => s.metadata?.group === "colors");

  const handleFileUpload = async (key: string, file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/svg+xml",
      "image/x-icon",
    ];
    if (!allowedTypes.includes(file.type)) {
      onAlert(
        "error",
        "Please upload a valid image file (PNG, JPEG, SVG, or ICO)",
      );
      return;
    }

    // Validate file size (5MB max for logos)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      onAlert("error", "File size must be less than 5MB");
      return;
    }

    setUploading(key);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Determine upload type based on key
      let uploadType = "logo";
      if (key === "favicon") {
        uploadType = "favicon";
      } else if (key.includes("avatar")) {
        uploadType = "avatar";
      }

      formData.append("type", uploadType);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || "Upload failed");
      }

      const result = await response.json();
      const uploadedUrl = result?.url ?? result?.data?.url;
      if (!uploadedUrl) {
        throw new Error("Upload failed: missing file URL");
      }

      await handleSettingUpdate(key, uploadedUrl);

      // Update preview
      setPreviews((prev) => ({ ...prev, [key]: uploadedUrl }));

      onAlert("success", "Logo uploaded successfully");
    } catch (error) {
      logClientError("Logo management upload error:", error);
      onAlert(
        "error",
        error instanceof Error ? error.message : "Failed to upload logo",
      );
    } finally {
      setUploading(null);
    }
  };

  const handleSettingUpdate = async (key: string, value: string) => {
    try {
      // Update the unified settings collection with branding data
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "system",
          category: "branding",
          field: key,
          value: value,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || "Failed to update setting");
      }

      onAlert("success", "Setting updated successfully");
    } catch (error) {
      logClientError("Logo management update error:", error);
      onAlert(
        "error",
        error instanceof Error ? error.message : "Failed to update setting",
      );
    }
  };

  const handleFileSelect = (key: string) => {
    const input = fileInputRefs.current[key];
    if (input) {
      input.click();
    }
  };

  const handleColorChange = async (key: string, color: string) => {
    try {
      await handleSettingUpdate(key, color);
    } catch (error) {
      // Error already handled in handleSettingUpdate
    }
  };

  const handleAddCustomSetting = async () => {
    if (!newSetting.key || !newSetting.value) {
      onAlert("error", "Please fill in all required fields");
      return;
    }

    try {
      await handleSettingUpdate(newSetting.key, newSetting.value);

      // Reset form
      setNewSetting({
        key: "",
        value: "",
        dataType: "string",
        description: "",
      });
      setShowAddForm(false);

      // Refresh the page to show the new setting
      window.location.reload();
    } catch (error) {
      logClientError("Logo management create error:", error);
      onAlert("error", "Impossible de créer le paramètre personnalisé");
    }
  };

  const getLogoIcon = (key: string) => {
    if (key.includes("light")) return Sun;
    if (key.includes("dark")) return Moon;
    if (key === "favicon") return Star;
    return ImageIcon;
  };

  const getLogoTitle = (key: string) => {
    if (key === "logo_light") return "Light Theme Logo";
    if (key === "logo_dark") return "Dark Theme Logo";
    if (key === "favicon") return "Favicon";
    return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* Logo Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Logo Management
          </CardTitle>
          <CardDescription>
            Upload and manage your organization's logos and branding assets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {effectiveLogoSettings.map((setting) => {
              const Icon = getLogoIcon(setting.key);
              const currentValue = previews[setting.key] || setting.value;

              return (
                <div key={setting.key} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <Label className="font-medium">
                      {getLogoTitle(setting.key)}
                    </Label>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {setting.description}
                  </p>

                  {/* Current Logo Preview */}
                  {currentValue && (
                    <div className="relative border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-center justify-center h-20">
                        <img
                          src={currentValue}
                          alt={getLogoTitle(setting.key)}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(currentValue, "_blank")}
                          className="h-6 w-6 p-0"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = currentValue;
                            link.download = `${setting.key}.png`;
                            link.click();
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        {onDelete && !setting._id.startsWith("temp-") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              if (
                                confirm(
                                  `Are you sure you want to delete ${getLogoTitle(
                                    setting.key,
                                  )}?`,
                                )
                              ) {
                                try {
                                  await onDelete(setting._id);
                                } catch (error) {
                                  logClientError(
                                    "Logo management delete error:",
                                    error,
                                  );
                                }
                              }
                            }}
                            className="h-6 w-6 p-0 hover:bg-red-50 hover:border-red-200"
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Upload Controls */}
                  <div className="space-y-2">
                    <input
                      ref={(el) => {
                        fileInputRefs.current[setting.key] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(setting.key, file);
                        }
                      }}
                    />

                    <Button
                      onClick={() => handleFileSelect(setting.key)}
                      disabled={uploading === setting.key}
                      className="w-full"
                      variant="outline"
                    >
                      {uploading === setting.key ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload {getLogoTitle(setting.key)}
                        </>
                      )}
                    </Button>

                    {/* URL Input as Alternative */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ou saisir l’adresse de l’image"
                        defaultValue={setting.value}
                        onBlur={(e) => {
                          if (e.target.value !== setting.value) {
                            handleColorChange(setting.key, e.target.value);
                          }
                        }}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Color Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Brand Colors
          </CardTitle>
          <CardDescription>
            Customize your brand colors and theme
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {effectiveColorSettings.map((setting) => (
              <div key={setting.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">
                    {setting.key
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Label>
                  {onDelete && !setting._id.startsWith("temp-") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (
                          confirm(
                            `Are you sure you want to delete ${setting.key.replace(
                              /_/g,
                              " ",
                            )}?`,
                          )
                        ) {
                          try {
                            await onDelete(setting._id);
                          } catch (error) {
                            logClientError(
                              "Logo management delete error:",
                              error,
                            );
                          }
                        }
                      }}
                      className="h-6 w-6 p-0 hover:bg-red-50 hover:border-red-200"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {setting.description}
                </p>

                <div className="flex gap-3 items-center">
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-gray-200 dark:border-gray-700"
                    style={{ backgroundColor: setting.value }}
                  />
                  <div className="flex-1">
                    <Input
                      type="color"
                      value={setting.value}
                      onChange={(e) =>
                        handleColorChange(setting.key, e.target.value)
                      }
                      className="w-full h-10"
                    />
                  </div>
                  <div className="text-sm font-mono text-muted-foreground">
                    {setting.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Custom Setting */}
      {onCreate && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add Custom Branding Setting
                </CardTitle>
                <CardDescription>
                  Create custom branding settings for your organization
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                {showAddForm ? "Annuler" : "Add Setting"}
              </Button>
            </div>
          </CardHeader>
          {showAddForm && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="setting-key">Setting Key *</Label>
                  <Input
                    id="setting-key"
                    value={newSetting.key}
                    onChange={(e) =>
                      setNewSetting((prev) => ({
                        ...prev,
                        key: e.target.value,
                      }))
                    }
                    placeholder="Ex. : nom_entreprise, slogan_marque"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setting-type">Type de donnée</Label>
                  <Select
                    value={newSetting.dataType}
                    onValueChange={(value) =>
                      setNewSetting((prev) => ({
                        ...prev,
                        dataType: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">Texte</SelectItem>
                      <SelectItem value="color">Couleur</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                      <SelectItem value="file">Fichier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="setting-value">Value *</Label>
                <Input
                  id="setting-value"
                  type={newSetting.dataType === "color" ? "color" : "text"}
                  value={newSetting.value}
                  onChange={(e) =>
                    setNewSetting((prev) => ({
                      ...prev,
                      value: e.target.value,
                    }))
                  }
                  placeholder="Saisir la valeur du paramètre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setting-description">Description</Label>
                <Input
                  id="setting-description"
                  value={newSetting.description}
                  onChange={(e) =>
                    setNewSetting((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Décrire l’utilité de ce paramètre"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddCustomSetting}>Créer le paramètre</Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Annuler
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Upload Guidelines */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Consignes de téléversement :</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• Logos: PNG, JPEG, or SVG format, max 2MB</li>
            <li>
              • Favicon: ICO or PNG format, 16x16 or 32x32 pixels recommended
            </li>
            <li>• Use transparent backgrounds for logos when possible</li>
            <li>• Ensure logos are readable at different sizes</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
