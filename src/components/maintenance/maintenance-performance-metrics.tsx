"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  Home,
  Users,
  Star,
  Clock,
  CheckCircle,
  TrendingUp,
  Award,
  Target,
} from "lucide-react";

interface PerformanceData {
  byProperty: Array<{
    propertyName: string;
    totalRequests: number;
    terminéesRequests: number;
    totalCost: number;
    avgResponseTime: number;
  }>;
  byTechnician: Array<{
    technicianName: string;
    assignéesRequests: number;
    terminéesRequests: number;
    avgRésolutionTime: number;
    rating: number;
  }>;
}

interface MaintenancePerformanceMetricsProps {
  data?: PerformanceData;
}

// Mock data for demonstration
const mockPropertyData = [
  {
    propertyName: "Sunset Apartments",
    totalRequests: 45,
    terminéesRequests: 42,
    totalCost: 15600,
    avgResponseTime: 2.3,
    completionRate: 93.3,
  },
  {
    propertyName: "Downtown Lofts",
    totalRequests: 38,
    terminéesRequests: 35,
    totalCost: 12800,
    avgResponseTime: 3.1,
    completionRate: 92.1,
  },
  {
    propertyName: "Garden View Complex",
    totalRequests: 52,
    terminéesRequests: 48,
    totalCost: 18900,
    avgResponseTime: 2.8,
    completionRate: 92.3,
  },
  {
    propertyName: "Riverside Towers",
    totalRequests: 29,
    terminéesRequests: 27,
    totalCost: 9400,
    avgResponseTime: 2.1,
    completionRate: 93.1,
  },
  {
    propertyName: "Metro Heights",
    totalRequests: 41,
    terminéesRequests: 38,
    totalCost: 14200,
    avgResponseTime: 2.6,
    completionRate: 92.7,
  },
];

const mockTechnicianData = [
  {
    technicianName: "John Smith",
    assignéesRequests: 28,
    terminéesRequests: 26,
    avgRésolutionTime: 2.1,
    rating: 4.8,
    completionRate: 92.9,
    efficiency: 95,
  },
  {
    technicianName: "Sarah Johnson",
    assignéesRequests: 32,
    terminéesRequests: 30,
    avgRésolutionTime: 2.3,
    rating: 4.6,
    completionRate: 93.8,
    efficiency: 92,
  },
  {
    technicianName: "Mike Davis",
    assignéesRequests: 25,
    terminéesRequests: 23,
    avgRésolutionTime: 2.8,
    rating: 4.4,
    completionRate: 92.0,
    efficiency: 88,
  },
  {
    technicianName: "Lisa Wilson",
    assignéesRequests: 35,
    terminéesRequests: 33,
    avgRésolutionTime: 2.0,
    rating: 4.9,
    completionRate: 94.3,
    efficiency: 97,
  },
  {
    technicianName: "David Brown",
    assignéesRequests: 22,
    terminéesRequests: 20,
    avgRésolutionTime: 2.5,
    rating: 4.5,
    completionRate: 90.9,
    efficiency: 89,
  },
];

import { formatCurrency } from "@/lib/utils/formatting";

export function MaintenancePerformanceMetrics({
  data,
}: MaintenancePerformanceMetricsProps) {
  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat("en-US", {
  //     style: "currency",
  //     currency: "USD",
  //     minimumFractionDigits: 0,
  //     maximumFractionDigits: 0,
  //   }).format(amount);
  // };

  const formatHours = (hours: number) => {
    return `${hours.toFixed(1)}h`;
  };

  const getPerformanceColor = (rate: number) => {
    if (rate >= 95) return "text-green-600";
    if (rate >= 90) return "text-blue-600";
    if (rate >= 85) return "text-yellow-600";
    return "text-red-600";
  };

  const getPerformanceBadge = (rate: number) => {
    if (rate >= 95)
      return {
        label: "Excellent",
        variant: "bg-green-100 text-green-800 border-green-200",
      };
    if (rate >= 90)
      return {
        label: "Bon",
        variant: "bg-blue-100 text-blue-800 border-blue-200",
      };
    if (rate >= 85)
      return {
        label: "Moyen",
        variant: "bg-yellow-100 text-yellow-800 border-yellow-200",
      };
    return {
      label: "À améliorer",
      variant: "bg-red-100 text-red-800 border-red-200",
    };
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating)
            ? "text-yellow-400 fill-current"
            : "text-gray-300"
        }`}
      />
    ));
  };

  return (
    <div className="space-y-6">
      {/* Property Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Analyse des performances des propriétés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockPropertyData.map((property, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <h4 className="font-semibold">{property.propertyName}</h4>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span>{property.totalRequests} demandes au total</span>
                    <span>{property.terminéesRequests} terminées</span>
                    <span>
                      Réponse moyenne : {formatHours(property.avgResponseTime)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold">
                      {formatCurrency(property.totalCost)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Coût total
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-semibold ${getPerformanceColor(
                        property.completionRate
                      )}`}
                    >
                      {property.completionRate.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Taux de résolution
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      getPerformanceBadge(property.completionRate).variant
                    }
                  >
                    {getPerformanceBadge(property.completionRate).label}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Property Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Taux de résolution par propriété</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockPropertyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="propertyName" />
              <YAxis />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar
                dataKey="completionRate"
                fill="#8884d8"
                name="Taux de résolution %"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Technician Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Analyse des performances des techniciens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockTechnicianData.map((technician, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <h4 className="font-semibold">{technician.technicianName}</h4>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span>{technician.assignéesRequests} assignées</span>
                    <span>{technician.terminéesRequests} terminées</span>
                    <span>
                      Temps moyen : {formatHours(technician.avgRésolutionTime)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="flex items-center gap-1 mb-1">
                      {getRatingStars(technician.rating)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {technician.rating}/5
                    </div>
                  </div>
                  <div className="text-center">
                    <div
                      className={`font-semibold ${getPerformanceColor(
                        technician.completionRate
                      )}`}
                    >
                      {technician.completionRate.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Résolution
                    </div>
                  </div>
                  <div className="text-center">
                    <div
                      className={`font-semibold ${getPerformanceColor(
                        technician.efficiency
                      )}`}
                    >
                      {technician.efficiency}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Efficacité
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      getPerformanceBadge(technician.efficiency).variant
                    }
                  >
                    {getPerformanceBadge(technician.efficiency).label}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meilleur technicien</CardTitle>
            <Award className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              Lisa Wilson
            </div>
            <p className="text-xs text-muted-foreground">
              97% taux d'efficacité
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meilleure propriété</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              Sunset Apartments
            </div>
            <p className="text-xs text-muted-foreground">
              93.3% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Réponse la plus rapide
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">2.0h</div>
            <p className="text-xs text-muted-foreground">
              Moyen response time
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
