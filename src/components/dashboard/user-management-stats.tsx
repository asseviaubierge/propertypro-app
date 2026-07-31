"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Shield,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
} from "lucide-react";
import { UserRole } from "@/types";
import { RoleBadge } from "@/components/ui/role-badge";
import {
  AnalyticsCard,
  AnalyticsCardGrid,
} from "@/components/analytics/AnalyticsCard";
import { useAuthorization } from "@/hooks/useAuthorization";

interface UserStats {
  total: number;
  active: number;
  inactifs: number;
  newThisMonth: number;
  newThisWeek: number;
  byRole: Record<UserRole, number>;
  recentActivity: {
    logins: number;
    registrations: number;
    deactivations: number;
  };
  trends: {
    totalChange: number;
    activeChange: number;
    newUsersChange: number;
  };
}

interface UserManagementStatsProps {
  className?: string;
}

export function UserManagementStats({ className }: UserManagementStatsProps) {
  const { data: session } = useSession();
  const { isAdmin } = useAuthorization();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canViewStats = Boolean(session?.user && isAdmin);

  useEffect(() => {
    if (canViewStats) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewStats]);

  const fetchStats = async () => {
    try {
      setIsLoading(true);

      // In a real app, this would be an API call
      // For now, we'll simulate the data
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const mockStats: UserStats = {
        total: 156,
        active: 142,
        inactifs: 14,
        newThisMonth: 23,
        newThisWeek: 7,
        byRole: {
          [UserRole.ADMIN]: 2,
          [UserRole.MANAGER]: 40,
          [UserRole.TENANT]: 114,
        },
        recentActivity: {
          logins: 89,
          registrations: 7,
          deactivations: 2,
        },
        trends: {
          totalChange: 12.5,
          activeChange: 8.3,
          newUsersChange: 15.2,
        },
      };

      setStats(mockStats);
    } catch {
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (!canViewStats) {
    return null;
  }

  if (isLoading || !stats) {
    return (
      <div className={`${className}`}>
        <AnalyticsCardGrid>
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="h-4 w-4 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded animate-pulse mb-2" />
                <div className="h-3 w-32 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </AnalyticsCardGrid>
      </div>
    );
  }

  const activePercentage = (stats.active / stats.total) * 100;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Stats Cards */}
      <AnalyticsCardGrid>
        <AnalyticsCard
          title="Utilisateurs au total"
          value={stats.total}
          icon={Users}
          iconColor="primary"
          trend={{
            value: `${Math.abs(stats.trends.totalChange)}% par rapport au mois dernier`,
            isPositive: stats.trends.totalChange > 0,
            icon: stats.trends.totalChange > 0 ? TrendingUp : TrendingDown,
          }}
        />

        <AnalyticsCard
          title="Utilisateurs actifs"
          value={stats.active}
          description={`${activePercentage.toFixed(1)}% du total`}
          icon={UserCheck}
          iconColor="success"
        >
          <Badge variant="outline" className="text-xs mt-2">
            {stats.inactifs} inactifs
          </Badge>
        </AnalyticsCard>

        <AnalyticsCard
          title="Nouveaux ce mois-ci"
          value={stats.newThisMonth}
          icon={UserPlus}
          iconColor="info"
          trend={{
            value: `${Math.abs(stats.trends.newUsersChange)}% par rapport au mois dernier`,
            isPositive: stats.trends.newUsersChange > 0,
            icon: stats.trends.newUsersChange > 0 ? TrendingUp : TrendingDown,
          }}
        />

        <AnalyticsCard
          title="Activité récente"
          value={stats.recentActivity.logins}
          description="Connexions des dernières 24 h"
          icon={Activity}
          iconColor="warning"
        />
      </AnalyticsCardGrid>

      {/* Role Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              Utilisateurs par rôle
            </CardTitle>
            <CardDescription>
              Répartition des utilisateurs par rôle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(stats.byRole)
              .sort(([, a], [, b]) => b - a)
              .map(([role, count]) => {
                const percentage = (count / stats.total) * 100;
                return (
                  <div key={role} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RoleBadge role={role as UserRole} size="sm" />
                        <span className="text-sm font-medium">
                          {count} utilisateurs
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Résumé de l’activité récente
            </CardTitle>
            <CardDescription>Activité des utilisateurs au cours des 7 derniers jours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Connexions utilisateurs</span>
              </div>
              <span className="text-lg font-bold">
                {stats.recentActivity.logins}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Nouvelles inscriptions</span>
              </div>
              <span className="text-lg font-bold">
                {stats.recentActivity.registrations}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Désactivations</span>
              </div>
              <span className="text-lg font-bold">
                {stats.recentActivity.deactivations}
              </span>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  New utilisateurs this week
                </span>
                <Badge variant="outline">{stats.newThisWeek}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
