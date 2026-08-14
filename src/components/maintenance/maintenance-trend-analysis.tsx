"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { useState } from "react";

interface TrendData {
  monthly: Array<{
    month: string;
    requests: number;
    cost: number;
    avgTime: number;
  }>;
  categories: Array<{
    category: string;
    count: number;
    cost: number;
    avgTime: number;
  }>;
}

interface MaintenanceTrendAnalysisProps {
  data?: TrendData;
}

// Mock data for comprehensive trend analysis
const mockYearlyTrends = [
  {
    month: "Jan",
    requests: 45,
    cost: 12500,
    avgTime: 3.2,
    completed: 42,
    pending: 3,
  },
  {
    month: "Feb",
    requests: 38,
    cost: 9800,
    avgTime: 2.8,
    completed: 36,
    pending: 2,
  },
  {
    month: "Mar",
    requests: 52,
    cost: 15200,
    avgTime: 3.5,
    completed: 48,
    pending: 4,
  },
  {
    month: "Apr",
    requests: 41,
    cost: 11600,
    avgTime: 2.9,
    completed: 39,
    pending: 2,
  },
  {
    month: "May",
    requests: 47,
    cost: 13800,
    avgTime: 3.1,
    completed: 44,
    pending: 3,
  },
  {
    month: "Jun",
    requests: 39,
    cost: 10900,
    avgTime: 2.7,
    completed: 37,
    pending: 2,
  },
  {
    month: "Jul",
    requests: 43,
    cost: 12200,
    avgTime: 3.0,
    completed: 40,
    pending: 3,
  },
  {
    month: "Aug",
    requests: 48,
    cost: 14100,
    avgTime: 3.3,
    completed: 45,
    pending: 3,
  },
  {
    month: "Sep",
    requests: 35,
    cost: 8900,
    avgTime: 2.5,
    completed: 33,
    pending: 2,
  },
  {
    month: "Oct",
    requests: 42,
    cost: 11800,
    avgTime: 2.8,
    completed: 40,
    pending: 2,
  },
  {
    month: "Nov",
    requests: 46,
    cost: 13200,
    avgTime: 3.1,
    completed: 43,
    pending: 3,
  },
  {
    month: "Dec",
    requests: 40,
    cost: 10500,
    avgTime: 2.6,
    completed: 38,
    pending: 2,
  },
];

const mockSeasonalTrends = [
  { season: "Printemps", requests: 140, cost: 39000, avgTime: 3.2, trend: "+12%" },
  { season: "Été", requests: 130, cost: 37200, avgTime: 3.0, trend: "-7%" },
  { season: "Automne", requests: 123, cost: 34000, avgTime: 2.8, trend: "-5%" },
  { season: "Hiver", requests: 118, cost: 32800, avgTime: 2.9, trend: "-4%" },
];

const mockCategoryTrends = [
  {
    category: "Plomberie",
    jan: 15,
    feb: 12,
    mar: 18,
    apr: 14,
    may: 16,
    jun: 13,
  },
  { category: "HVAC", jan: 8, feb: 6, mar: 10, apr: 7, may: 9, jun: 6 },
  { category: "Électricité", jan: 6, feb: 5, mar: 8, apr: 6, may: 7, jun: 5 },
  { category: "Général", jan: 12, feb: 10, mar: 14, apr: 11, may: 13, jun: 10 },
  { category: "Appareils", jan: 4, feb: 5, mar: 2, apr: 3, may: 2, jun: 5 },
];

const mockPrévisionsData = [
  { month: "Jul", actual: 43, predicted: 45, confidence: 85 },
  { month: "Aug", actual: 48, predicted: 46, confidence: 82 },
  { month: "Sep", actual: 35, predicted: 42, confidence: 78 },
  { month: "Oct", actual: null, predicted: 44, confidence: 75 },
  { month: "Nov", actual: null, predicted: 47, confidence: 72 },
  { month: "Dec", actual: null, predicted: 41, confidence: 70 },
];

import { formatCurrency } from "@/lib/utils/formatting";

export function MaintenanceTrendAnalysis({
  data,
}: MaintenanceTrendAnalysisProps) {
  const [selectedView, setSelectedView] = useState("yearly");
  const [selectedMetric, setSelectedMetric] = useState("requests");

  // const formatCurrency = (value: number) => {
  //   return new Intl.NumberFormat("en-US", {
  //     style: "currency",
  //     currency: "USD",
  //     minimumFractionDigits: 0,
  //     maximumFractionDigits: 0,
  //   }).format(value);
  // };

  const formatHours = (value: number) => {
    return `${value.toFixed(1)}h`;
  };

  const getTrendIndicator = (trend: string) => {
    const isPositive = trend.startsWith("+");
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const colorClass = isPositive ? "text-red-600" : "text-green-600"; // For maintenance, less is better

    return (
      <div className={`flex items-center ${colorClass}`}>
        <Icon className="h-4 w-4 mr-1" />
        <span className="text-sm font-medium">{trend}</span>
      </div>
    );
  };

  const getMetricColor = (metric: string) => {
    const colors = {
      requests: "#8884d8",
      cost: "#82ca9d",
      avgTime: "#ffc658",
      completed: "#00C49F",
      pending: "#FF8042",
    };
    return colors[metric as keyof typeof colors] || "#8884d8";
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedView} onValueChange={setSelectedView}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yearly">Vue annuelle</SelectItem>
              <SelectItem value="seasonal">Vue saisonnière</SelectItem>
              <SelectItem value="category">Par catégorie</SelectItem>
              <SelectItem value="predictive">Prévisions</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="requests">Demandes</SelectItem>
              <SelectItem value="cost">Coût</SelectItem>
              <SelectItem value="avgTime">Temps moyen</SelectItem>
              <SelectItem value="completed">Terminées</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Yearly Trends */}
      {selectedView === "yearly" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Tendances annuelles de maintenance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={mockYearlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === "cost")
                        return formatCurrency(value as number);
                      if (name === "avgTime")
                        return formatHours(value as number);
                      return value;
                    }}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="requests"
                    fill="#8884d8"
                    fillOpacity={0.3}
                    stroke="#8884d8"
                    name="Total Demandes"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="completed"
                    fill="#00C49F"
                    name="Terminées"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgTime"
                    stroke="#ffc658"
                    strokeWidth={2}
                    name="Temps moyen (hours)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Analyse mensuelle des coûts</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mockYearlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => formatCurrency(value as number)}
                    />
                    <Bar dataKey="cost" fill="#82ca9d" name="Monthly Coût" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tendances du taux de résolution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mockYearlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#00C49F"
                      strokeWidth={2}
                      name="Terminées Demandes"
                    />
                    <Line
                      type="monotone"
                      dataKey="pending"
                      stroke="#FF8042"
                      strokeWidth={2}
                      name="Pending Demandes"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Seasonal Analysis */}
      {selectedView === "seasonal" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Tendances saisonnières de maintenance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {mockSeasonalTrends.map((season, index) => (
                  <Card key={index} className="border-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{season.season}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Demandes:
                          </span>
                          <span className="font-semibold">
                            {season.requests}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Coût:
                          </span>
                          <span className="font-semibold">
                            {formatCurrency(season.cost)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Temps moyen:
                          </span>
                          <span className="font-semibold">
                            {formatHours(season.avgTime)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Tendance :
                          </span>
                          {getTrendIndicator(season.trend)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Trends */}
      {selectedView === "category" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Évolution par catégorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={mockCategoryTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="jan"
                  stroke="#8884d8"
                  name="Jan"
                />
                <Line
                  type="monotone"
                  dataKey="feb"
                  stroke="#82ca9d"
                  name="Feb"
                />
                <Line
                  type="monotone"
                  dataKey="mar"
                  stroke="#ffc658"
                  name="Mar"
                />
                <Line
                  type="monotone"
                  dataKey="apr"
                  stroke="#ff7300"
                  name="Apr"
                />
                <Line
                  type="monotone"
                  dataKey="may"
                  stroke="#00C49F"
                  name="May"
                />
                <Line
                  type="monotone"
                  dataKey="jun"
                  stroke="#FF8042"
                  name="Jun"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Prévisions Analysis */}
      {selectedView === "predictive" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Prévisions Maintenance Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={mockPrévisionsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="actual" fill="#8884d8" name="Actual Demandes" />
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    stroke="#ff7300"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Predicted Demandes"
                  />
                  <Area
                    type="monotone"
                    dataKey="confidence"
                    fill="#82ca9d"
                    fillOpacity={0.2}
                    stroke="none"
                    name="Confiance %"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Prévision du mois prochain
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">44</div>
                <p className="text-xs text-muted-foreground">
                  Demandes prévues (75 % de confiance)
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Coût Projection
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">$12,800</div>
                <p className="text-xs text-muted-foreground">
                  Coût mensuel estimé
                </p>
              </CardContent>
            </Card>

            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Planification des ressources
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">3</div>
                <p className="text-xs text-muted-foreground">
                  Techniciens supplémentaires nécessaires
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
