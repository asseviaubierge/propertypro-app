"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  Mail,
  CreditCard,
  Wrench,
  Shield,
  Plus,
  Edit,
  Trash2,
  Save,
  AlertTriangle,
  Info,
  Palette,
  Eye,
  Globe,
  Bell,
  Plug,
  Search,
  Filter,
  Upload,
  Download,
  FileText,
  History,
} from "lucide-react";
import { logClientError } from "@/utils/logger";

interface SystemSetting {
  _id: string;
  category: string;
  key: string;
  value: any;
  dataType: string;
  description?: string;
  isPublic: boolean;
  isEditable: boolean;
  lastModifiedBy: any;
  metadata?: {
    group?: string;
    tags?: string[];
    helpText?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface SystemSettingsProps {
  onAlert: (type: "success" | "error" | "info", message: string) => void;
}

export function SystemSettings({ onAlert }: SystemSettingsProps) {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("general");
  const [editingSettings, setEditingSettings] = useState<Record<string, any>>(
    {},
  );
  const [newSetting, setNewSetting] = useState({
    category: "general",
    key: "",
    value: "",
    dataType: "string",
    description: "",
    isPublic: false,
    isEditable: true,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const categories = [
    { value: "general", label: "General", icon: Settings },
    { value: "appearance", label: "Appearance", icon: Eye },
    { value: "email", label: "Email", icon: Mail },
    { value: "payment", label: "Payment", icon: CreditCard },
    { value: "maintenance", label: "Maintenance", icon: Wrench },
    { value: "security", label: "Security", icon: Shield },
    { value: "localization", label: "Localization", icon: Globe },
    { value: "notifications", label: "Notifications", icon: Bell },
    { value: "integrations", label: "Integrations", icon: Plug },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/settings/system");

      if (!response.ok) {
        throw new Error("Failed to fetch system settings");
      }

      const data = await response.json();
      setSettings(data?.settings ?? []);
    } catch (error) {
      logClientError("Error fetching system settings:", error);
      onAlert("error", "Failed to load system settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingUpdate = async (settingId: string, newValue: any) => {
    try {
      const setting = settings.find((s) => s._id === settingId);
      if (!setting) return;

      const response = await fetch(
        `/api/settings/system/${setting.category}/${setting.key}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ value: newValue }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || "Failed to update setting");
      }

      const result = await response.json();

      // Update local state
      setSettings((prev) =>
        prev.map((s) => (s._id === settingId ? (result?.setting ?? s) : s)),
      );

      // Clear editing state
      setEditingSettings((prev) => {
        const newState = { ...prev };
        delete newState[settingId];
        return newState;
      });

      onAlert("success", "Setting updated successfully");
    } catch (error) {
      logClientError("Setting update error:", error);
      onAlert(
        "error",
        error instanceof Error ? error.message : "Failed to update setting",
      );
    }
  };

  const handleSettingDelete = async (settingId: string) => {
    try {
      const setting = settings.find((s) => s._id === settingId);
      if (!setting) return;

      const response = await fetch(
        `/api/settings/system/${setting.category}/${setting.key}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || "Failed to delete setting");
      }

      // Update local state
      setSettings((prev) => prev.filter((s) => s._id !== settingId));
      onAlert("success", "Setting deleted successfully");
    } catch (error) {
      logClientError("Setting delete error:", error);
      onAlert(
        "error",
        error instanceof Error ? error.message : "Failed to delete setting",
      );
    }
  };

  const handleAddSetting = async () => {
    try {
      // Convert value based on data type
      let convertedValue: any = newSetting.value;
      switch (newSetting.dataType) {
        case "number":
          convertedValue = parseFloat(newSetting.value);
          break;
        case "boolean":
          convertedValue = newSetting.value === "true";
          break;
        case "object":
        case "array":
          try {
            convertedValue = JSON.parse(newSetting.value);
          } catch {
            throw new Error("Invalid JSON format for object/array value");
          }
          break;
      }

      const response = await fetch("/api/settings/system", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newSetting,
          value: convertedValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || "Failed to create setting");
      }

      const result = await response.json();

      // Update local state
      setSettings((prev) => [...prev, result?.setting].filter(Boolean));

      // Reset form
      setNewSetting({
        category: "general",
        key: "",
        value: "",
        dataType: "string",
        description: "",
        isPublic: false,
        isEditable: true,
      });
      setShowAddForm(false);

      onAlert("success", "Setting created successfully");
    } catch (error) {
      logClientError("Setting create error:", error);
      onAlert(
        "error",
        error instanceof Error ? error.message : "Failed to create setting",
      );
    }
  };

  const renderSettingValue = (setting: SystemSetting) => {
    const isEditing = editingSettings[setting._id] !== undefined;
    const currentValue = isEditing
      ? editingSettings[setting._id]
      : setting.value;

    if (!setting.isEditable) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm">{String(setting.value)}</span>
          <Badge variant="secondary" className="text-xs">
            Read Only
          </Badge>
        </div>
      );
    }

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          {setting.dataType === "boolean" ? (
            <Switch
              checked={currentValue}
              onCheckedChange={(checked) =>
                setEditingSettings((prev) => ({
                  ...prev,
                  [setting._id]: checked,
                }))
              }
            />
          ) : (
            <Input
              value={String(currentValue)}
              onChange={(e) =>
                setEditingSettings((prev) => ({
                  ...prev,
                  [setting._id]: e.target.value,
                }))
              }
              className="w-48"
            />
          )}
          <Button
            size="sm"
            onClick={() => handleSettingUpdate(setting._id, currentValue)}
          >
            <Save className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const newState = { ...editingSettings };
              delete newState[setting._id];
              setEditingSettings(newState);
            }}
          >
            Cancel
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">{String(setting.value)}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setEditingSettings((prev) => ({
              ...prev,
              [setting._id]: setting.value,
            }))
          }
        >
          <Edit className="h-3 w-3" />
        </Button>
        {setting.isEditable && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleSettingDelete(setting._id)}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  const filteredSettings = settings.filter((setting) => {
    const matchesCategory = setting.category === activeCategory;
    const matchesSearch =
      searchTerm === "" ||
      setting.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      setting.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      setting.metadata?.tags?.some((tag: string) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    const matchesGroup =
      filterGroup === "" || setting.metadata?.group === filterGroup;

    return matchesCategory && matchesSearch && matchesGroup;
  });

  const availableGroups = Array.from(
    new Set(
      settings
        .filter((s) => s.category === activeCategory)
        .map((s) => s.metadata?.group)
        .filter((group): group is string => Boolean(group)),
    ),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Warning:</strong> System settings control core functionality.
          Changes may affect all users and system behavior. Proceed with
          caution.
        </AlertDescription>
      </Alert>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Button
                key={category.value}
                variant={
                  activeCategory === category.value ? "default" : "outline"
                }
                size="sm"
                onClick={() => setActiveCategory(category.value)}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                {category.label}
              </Button>
            );
          })}
          <div className="ml-auto flex gap-2" />
        </div>

        {categories.map((category) => (
          <TabsContent key={category.value} value={category.value}>
            <Card>
              <CardHeader>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <category.icon className="h-5 w-5" />
                        {category.label} Settings
                      </CardTitle>
                      <CardDescription>
                        Manage {category.label.toLowerCase()} configuration
                        settings
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                      </Button>
                      <Button
                        onClick={() => {
                          setNewSetting((prev) => ({
                            ...prev,
                            category: category.value,
                          }));
                          setShowAddForm(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Setting
                      </Button>
                    </div>
                  </div>

                  {/* Search and Filter Controls */}
                  <div className="flex gap-4 items-center">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search settings..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {showFilters && availableGroups.length > 0 && (
                      <Select
                        value={filterGroup}
                        onValueChange={setFilterGroup}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Filter by group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All Groups</SelectItem>
                          {availableGroups.map((group) => (
                            <SelectItem key={group} value={group}>
                              {group.charAt(0).toUpperCase() + group.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {showAddForm && newSetting.category === category.value && (
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="text-lg">Add New Setting</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="new-key">Key</Label>
                          <Input
                            id="new-key"
                            value={newSetting.key}
                            onChange={(e) =>
                              setNewSetting((prev) => ({
                                ...prev,
                                key: e.target.value,
                              }))
                            }
                            placeholder="setting_key"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-data-type">Data Type</Label>
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
                              <SelectItem value="string">String</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="boolean">Boolean</SelectItem>
                              <SelectItem value="object">Object</SelectItem>
                              <SelectItem value="array">Array</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="new-value">Value</Label>
                        <Input
                          id="new-value"
                          value={newSetting.value}
                          onChange={(e) =>
                            setNewSetting((prev) => ({
                              ...prev,
                              value: e.target.value,
                            }))
                          }
                          placeholder={
                            newSetting.dataType === "boolean"
                              ? "true or false"
                              : newSetting.dataType === "number"
                                ? "123"
                                : newSetting.dataType === "object"
                                  ? '{"key": "value"}'
                                  : newSetting.dataType === "array"
                                    ? '["item1", "item2"]'
                                    : "setting value"
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="new-description">Description</Label>
                        <Input
                          id="new-description"
                          value={newSetting.description}
                          onChange={(e) =>
                            setNewSetting((prev) => ({
                              ...prev,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Setting description"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={newSetting.isPublic}
                            onCheckedChange={(checked) =>
                              setNewSetting((prev) => ({
                                ...prev,
                                isPublic: checked,
                              }))
                            }
                          />
                          <Label>Public</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={newSetting.isEditable}
                            onCheckedChange={(checked) =>
                              setNewSetting((prev) => ({
                                ...prev,
                                isEditable: checked,
                              }))
                            }
                          />
                          <Label>Editable</Label>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleAddSetting}>
                          Create Setting
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowAddForm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-4">
                  {filteredSettings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No settings found for this category
                    </div>
                  ) : (
                    filteredSettings.map((setting) => (
                      <div key={setting._id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{setting.key}</h4>
                              <Badge variant="outline" className="text-xs">
                                {setting.dataType}
                              </Badge>
                              {setting.isPublic && (
                                <Badge variant="secondary" className="text-xs">
                                  Public
                                </Badge>
                              )}
                              {setting.metadata?.group && (
                                <Badge variant="outline" className="text-xs">
                                  {setting.metadata.group}
                                </Badge>
                              )}
                            </div>
                            {setting.description && (
                              <p className="text-sm text-muted-foreground">
                                {setting.description}
                              </p>
                            )}
                            {setting.metadata?.helpText && (
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                💡 {setting.metadata.helpText}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Last modified:{" "}
                              {new Date(setting.updatedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="ml-4">
                            {renderSettingValue(setting)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
