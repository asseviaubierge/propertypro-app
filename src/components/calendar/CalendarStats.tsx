"use client";

import React, { useState, useEffect } from "react";
import {
  AnalyticsCard,
  AnalyticsCardGrid,
} from "@/components/analytics/AnalyticsCard";
import { CalendarDays, Clock, TrendingUp, Users } from "lucide-react";

interface CalendarStatsData {
  totalEvents: number;
  upcomingEvents: number;
  todayEvents: number;
  pendingRSVPs: number;
  eventsByType: Record<string, number>;
  eventsByStatus: Record<string, number>;
}

const defaultStats: CalendarStatsData = {
  totalEvents: 0,
  upcomingEvents: 0,
  todayEvents: 0,
  pendingRSVPs: 0,
  eventsByType: {},
  eventsByStatus: {},
};

export function CalendarStats() {
  const [stats, setStats] = useState<CalendarStatsData>(defaultStats);
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadStats();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch("/api/calendar/stats");
      if (response.ok && isMountedRef.current) {
        const result = await response.json();
        if (isMountedRef.current) {
          setStats(result?.data ?? defaultStats);
        }
      }
    } catch (error) {
      console.error("Échec du chargement des statistiques du calendrier :", error);
    }
  };

  return (
    <AnalyticsCardGrid className="md:grid-cols-2 lg:grid-cols-4">
      <AnalyticsCard
        title="Événements"
        value={stats.totalEvents}
        icon={CalendarDays}
        iconColor="primary"
      />
      <AnalyticsCard
        title="À venir"
        value={stats.upcomingEvents}
        icon={Clock}
        iconColor="success"
      />
      <AnalyticsCard
        title="Aujourd’hui"
        value={stats.todayEvents}
        icon={TrendingUp}
        iconColor="warning"
      />
      <AnalyticsCard
        title="En attente"
        value={stats.pendingRSVPs}
        icon={Users}
        iconColor="info"
      />
    </AnalyticsCardGrid>
  );
}
