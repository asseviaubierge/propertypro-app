"use client";

import React, { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Activity,
  Users,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Clock,
  User,
  Database,
  FileText,
} from "lucide-react";

interface AuditLog {
  _id: string;
  category: string;
  action: string;
  severity: string;
  description: string;
  userId?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  resourceType?: string;
  resourceName?: string;
  timestamp: string;
  ipAddress?: string;
  tags: string[];
}

interface AuditStats {
  summary: {
    totalLogs: number;
    securityEvents: number;
    dateRange: {
      startDate: string;
      endDate: string;
    };
  };
  breakdown: {
    categories: Array<{ _id: string; count: number }>;
    actions: Array<{ _id: string; count: number }>;
    severity: Array<{ _id: string; count: number }>;
  };
  trends: {
    daily: Array<{ _id: string; count: number }>;
  };
  topUsers: Array<{
    _id: string;
    count: number;
    name: string;
    email: string;
  }>;
}

const SEVERITY_COLORS = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const CATEGORY_ICONS = {
  authentication: User,
  user_management: Users,
  property_management: Database,
  document_management: FileText,
  security: Shield,
  system_configuration: Settings,
};

export default function AuditDashboard() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: "",
    action: "",
    severity: "",
    search: "",
    startDate: "",
    endDate: "",
    page: 1,
    limit: 50,
  });

  useEffect(() => {
    fetchAuditLogs();
    fetchAuditStats();
  }, [filters]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString());
      });

      const response = await fetch(`/api/audit?${params}`);
      if (!response.ok) throw new Error("Failed to fetch audit logs");

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch audit logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const response = await fetch(`/api/audit/stats?${params}`);
      if (!response.ok) throw new Error("Failed to fetch audit stats");

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch audit stats:", error);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === "all" ? "" : value,
      page: 1, // Reset to first page when filtering
    }));
  };

  const exportAuditLogs = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== "page" && key !== "limit") {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: "audit_logs",
          format: "csv",
          filters: Object.fromEntries(params),
        }),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Complete",
        description: "Audit logs exported successfully",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export audit logs",
        variant: "destructive",
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSeverityBadge = (severity: string) => {
    const colorClass =
      SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] ||
      "bg-gray-100 text-gray-800";
    return <Badge className={colorClass}>{severity.toUpperCase()}</Badge>;
  };

  const getCategoryIcon = (category: string) => {
    const IconComponent =
      CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] || Activity;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor system activity and security events
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAuditLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportAuditLogs}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Events
                  </p>
                  <p className="text-2xl font-bold">
                    {stats?.summary?.totalLogs?.toLocaleString() ?? 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Security Events
                  </p>
                  <p className="text-2xl font-bold">
                    {stats?.summary?.securityEvents ?? 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Users
                  </p>
                  <p className="text-2xl font-bold">
                    {stats?.topUsers?.length ?? 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Daily Average
                  </p>
                  <p className="text-2xl font-bold">
                    {Math.round(
                      (stats?.summary?.totalLogs ?? 0) /
                        Math.max(stats?.trends?.daily?.length ?? 1, 1)
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="security">Security Events</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      value={filters.search}
                      onChange={(e) =>
                        handleFilterChange("search", e.target.value)
                      }
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={filters.category || "all"}
                    onValueChange={(value) =>
                      handleFilterChange("category", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      <SelectItem value="authentication">
                        Authentication
                      </SelectItem>
                      <SelectItem value="user_management">
                        User Management
                      </SelectItem>
                      <SelectItem value="property_management">
                        Property Management
                      </SelectItem>
                      <SelectItem value="document_management">
                        Document Management
                      </SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select
                    value={filters.severity || "all"}
                    onValueChange={(value) =>
                      handleFilterChange("severity", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All severities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All severities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) =>
                      handleFilterChange("startDate", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) =>
                      handleFilterChange("endDate", e.target.value)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setFilters({
                        category: "",
                        action: "",
                        severity: "",
                        search: "",
                        startDate: "",
                        endDate: "",
                        page: 1,
                        limit: 50,
                      })
                    }
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Logs</CardTitle>
              <CardDescription>
                Recent system activity and user actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading audit logs...</span>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No audit logs found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div
                      key={log._id}
                      className="flex items-start gap-4 p-4 border rounded-lg"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getCategoryIcon(log.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">
                            {log.description}
                          </p>
                          {getSeverityBadge(log.severity)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {log.userId
                              ? `${log.userId.firstName} ${log.userId.lastName}`
                              : "System"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(log.timestamp)}
                          </span>
                          {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                        </div>
                        {log.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {log.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Activity by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.breakdown.categories.map((category) => (
                      <div
                        key={category._id}
                        className="flex items-center justify-between"
                      >
                        <span className="capitalize">
                          {category._id.replace("_", " ")}
                        </span>
                        <Badge variant="secondary">{category.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Active Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.topUsers.slice(0, 5).map((user) => (
                      <div
                        key={user._id}
                        className="flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                        <Badge variant="secondary">{user.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-600" />
                Security Events
              </CardTitle>
              <CardDescription>
                Monitor security-related activities and potential threats
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Security events monitoring will be displayed here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
