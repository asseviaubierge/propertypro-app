/**
 * PropertyPro - User Feedback Service
 * Comprehensive feedback collection and analysis for property managers and tenants
 */

import { isManagerRole, isTenantRole } from "@/lib/permissions-manager";

export interface FeedbackEntry {
  id: string;
  userId: string;
  userRole: "property_manager" | "tenant" | "admin";
  category:
    | "usability"
    | "performance"
    | "feature_request"
    | "bug_report"
    | "general";
  rating: number; // 1-5 scale
  title: string;
  description: string;
  feature?: string; // Specific feature being reviewed
  priority: "low" | "medium" | "high" | "critical";
  status: "new" | "reviewing" | "in_progress" | "resolved" | "closed";
  tags: string[];
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  adminResponse?: string;
}

export interface FeedbackSummary {
  totalFeedback: number;
  averageRating: number;
  categoryBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  userRoleBreakdown: Record<string, number>;
  trendAnalysis: {
    period: string;
    ratingTrend: "improving" | "declining" | "stable";
    volumeTrend: "increasing" | "decreasing" | "stable";
    commonIssues: string[];
    topRequests: string[];
  };
}

export interface FeedbackAnalytics {
  satisfactionScore: number;
  npsScore: number; // Net Promoter Score
  featureUsageCorrelation: Record<string, number>;
  userSegmentAnalysis: {
    segment: string;
    averageRating: number;
    commonFeedback: string[];
    satisfactionLevel: "high" | "medium" | "low";
  }[];
  actionableInsights: {
    insight: string;
    impact: "high" | "medium" | "low";
    recommendation: string;
    estimatedEffort: "low" | "medium" | "high";
  }[];
}

class UserFeedbackService {
  private feedbackStore: Map<string, FeedbackEntry> = new Map();
  private feedbackHistory: FeedbackEntry[] = [];

  constructor() {
    this.initializeSampleFeedback();
  }

  /**
   * Initialize with sample feedback for demonstration
   */
  private initializeSampleFeedback() {
    const sampleFeedback: Partial<FeedbackEntry>[] = [
      {
        userRole: "property_manager",
        category: "usability",
        rating: 4,
        title: "Dashboard is very intuitive",
        description:
          "The new payment dashboard makes it easy to see all payment statuses at a glance. Love the visual indicators.",
        feature: "payment_dashboard",
        priority: "low",
        status: "resolved",
        tags: ["dashboard", "ui", "positive"],
      },
      {
        userRole: "tenant",
        category: "performance",
        rating: 3,
        title: "Payment processing sometimes slow",
        description:
          "Occasionally the payment takes longer than expected to process. Usually works fine though.",
        feature: "payment_processing",
        priority: "medium",
        status: "in_progress",
        tags: ["performance", "payment", "speed"],
      },
      {
        userRole: "property_manager",
        category: "feature_request",
        rating: 5,
        title: "Bulk payment processing needed",
        description:
          "Would love to be able to process multiple payments at once for efficiency.",
        feature: "payment_processing",
        priority: "high",
        status: "new",
        tags: ["bulk", "efficiency", "feature_request"],
      },
      {
        userRole: "tenant",
        category: "usability",
        rating: 5,
        title: "Auto-pay setup is fantastic",
        description:
          "Setting up auto-pay was super easy and I never have to worry about missing payments now.",
        feature: "auto_pay",
        priority: "low",
        status: "resolved",
        tags: ["auto_pay", "positive", "convenience"],
      },
      {
        userRole: "property_manager",
        category: "bug_report",
        rating: 2,
        title: "Late fee calculation incorrect",
        description:
          "The late fee calculation seems off for prorated rent payments. Needs investigation.",
        feature: "late_fees",
        priority: "high",
        status: "reviewing",
        tags: ["bug", "late_fees", "calculation"],
      },
    ];

    sampleFeedback.forEach((feedback, index) => {
      const entry: FeedbackEntry = {
        id: `feedback-${index + 1}`,
        userId: `user-${index + 1}`,
        userRole: feedback.userRole!,
        category: feedback.category!,
        rating: feedback.rating!,
        title: feedback.title!,
        description: feedback.description!,
        feature: feedback.feature,
        priority: feedback.priority!,
        status: feedback.status!,
        tags: feedback.tags!,
        createdAt: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
        ),
        updatedAt: new Date(),
      };

      this.feedbackStore.set(entry.id, entry);
      this.feedbackHistory.push(entry);
    });
  }

  /**
   * Submit new feedback
   */
  async submitFeedback(
    feedback: Omit<FeedbackEntry, "id" | "createdAt" | "updatedAt" | "status">
  ): Promise<FeedbackEntry> {
    const entry: FeedbackEntry = {
      ...feedback,
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.feedbackStore.set(entry.id, entry);
    this.feedbackHistory.push(entry);

    // Auto-prioritize based on rating and category
    if (entry.rating <= 2 || entry.category === "bug_report") {
      entry.priority = "high";
    } else if (entry.rating === 3 || entry.category === "performance") {
      entry.priority = "medium";
    }


    return entry;
  }

  /**
   * Get feedback by filters
   */
  getFeedback(filters?: {
    userRole?: string;
    category?: string;
    priority?: string;
    status?: string;
    feature?: string;
    rating?: { min?: number; max?: number };
    dateRange?: { start: Date; end: Date };
  }): FeedbackEntry[] {
    let feedback = Array.from(this.feedbackStore.values());

    if (filters) {
      if (filters.userRole) {
        feedback = feedback.filter((f) => f.userRole === filters.userRole);
      }
      if (filters.category) {
        feedback = feedback.filter((f) => f.category === filters.category);
      }
      if (filters.priority) {
        feedback = feedback.filter((f) => f.priority === filters.priority);
      }
      if (filters.status) {
        feedback = feedback.filter((f) => f.status === filters.status);
      }
      if (filters.feature) {
        feedback = feedback.filter((f) => f.feature === filters.feature);
      }
      if (filters.rating) {
        feedback = feedback.filter((f) => {
          const min = filters.rating!.min || 1;
          const max = filters.rating!.max || 5;
          return f.rating >= min && f.rating <= max;
        });
      }
      if (filters.dateRange) {
        feedback = feedback.filter(
          (f) =>
            f.createdAt >= filters.dateRange!.start &&
            f.createdAt <= filters.dateRange!.end
        );
      }
    }

    return feedback.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Update feedback status
   */
  async updateFeedbackStatus(
    feedbackId: string,
    status: FeedbackEntry["status"],
    adminResponse?: string
  ): Promise<FeedbackEntry | null> {
    const feedback = this.feedbackStore.get(feedbackId);
    if (!feedback) return null;

    feedback.status = status;
    feedback.updatedAt = new Date();

    if (adminResponse) {
      feedback.adminResponse = adminResponse;
    }

    if (status === "resolved" || status === "closed") {
      feedback.resolvedAt = new Date();
    }

    this.feedbackStore.set(feedbackId, feedback);


    return feedback;
  }

  /**
   * Generate feedback summary
   */
  generateFeedbackSummary(
    period: "week" | "month" | "quarter" = "month"
  ): FeedbackSummary {
    const periodMs = {
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      quarter: 90 * 24 * 60 * 60 * 1000,
    };

    const cutoffDate = new Date(Date.now() - periodMs[period]);
    const recentFeedback = this.feedbackHistory.filter(
      (f) => f.createdAt >= cutoffDate
    );

    const totalFeedback = recentFeedback.length;
    const averageRating =
      totalFeedback > 0
        ? recentFeedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedback
        : 0;

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    recentFeedback.forEach((f) => {
      categoryBreakdown[f.category] = (categoryBreakdown[f.category] || 0) + 1;
    });

    // Priority breakdown
    const priorityBreakdown: Record<string, number> = {};
    recentFeedback.forEach((f) => {
      priorityBreakdown[f.priority] = (priorityBreakdown[f.priority] || 0) + 1;
    });

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    recentFeedback.forEach((f) => {
      statusBreakdown[f.status] = (statusBreakdown[f.status] || 0) + 1;
    });

    // User role breakdown
    const userRoleBreakdown: Record<string, number> = {};
    recentFeedback.forEach((f) => {
      userRoleBreakdown[f.userRole] = (userRoleBreakdown[f.userRole] || 0) + 1;
    });

    // Trend analysis
    const previousPeriodStart = new Date(
      cutoffDate.getTime() - periodMs[period]
    );
    const previousFeedback = this.feedbackHistory.filter(
      (f) => f.createdAt >= previousPeriodStart && f.createdAt < cutoffDate
    );

    const previousAverageRating =
      previousFeedback.length > 0
        ? previousFeedback.reduce((sum, f) => sum + f.rating, 0) /
          previousFeedback.length
        : 0;

    const ratingTrend =
      averageRating > previousAverageRating + 0.2
        ? "improving"
        : averageRating < previousAverageRating - 0.2
        ? "declining"
        : "stable";

    const volumeTrend =
      totalFeedback > previousFeedback.length * 1.2
        ? "increasing"
        : totalFeedback < previousFeedback.length * 0.8
        ? "decreasing"
        : "stable";

    // Common issues and requests
    const commonIssues = this.extractCommonThemes(
      recentFeedback.filter((f) => f.category === "bug_report" || f.rating <= 2)
    );

    const topRequests = this.extractCommonThemes(
      recentFeedback.filter((f) => f.category === "feature_request")
    );

    return {
      totalFeedback,
      averageRating: Math.round(averageRating * 10) / 10,
      categoryBreakdown,
      priorityBreakdown,
      statusBreakdown,
      userRoleBreakdown,
      trendAnalysis: {
        period,
        ratingTrend,
        volumeTrend,
        commonIssues,
        topRequests,
      },
    };
  }

  /**
   * Generate detailed feedback analytics
   */
  generateFeedbackAnalytics(): FeedbackAnalytics {
    const allFeedback = Array.from(this.feedbackStore.values());

    // Calculate satisfaction score (percentage of 4-5 star ratings)
    const satisfiedUsers = allFeedback.filter((f) => f.rating >= 4).length;
    const satisfactionScore =
      allFeedback.length > 0
        ? Math.round((satisfiedUsers / allFeedback.length) * 100)
        : 0;

    // Calculate NPS (Net Promoter Score)
    const promoters = allFeedback.filter((f) => f.rating >= 4).length;
    const detractors = allFeedback.filter((f) => f.rating <= 2).length;
    const npsScore =
      allFeedback.length > 0
        ? Math.round(((promoters - detractors) / allFeedback.length) * 100)
        : 0;

    // Feature usage correlation
    const featureUsageCorrelation: Record<string, number> = {};
    allFeedback.forEach((f) => {
      if (f.feature) {
        if (!featureUsageCorrelation[f.feature]) {
          featureUsageCorrelation[f.feature] = 0;
        }
        featureUsageCorrelation[f.feature] += f.rating;
      }
    });

    // Convert to averages
    Object.keys(featureUsageCorrelation).forEach((feature) => {
      const count = allFeedback.filter((f) => f.feature === feature).length;
      featureUsageCorrelation[feature] =
        Math.round((featureUsageCorrelation[feature] / count) * 10) / 10;
    });

    const managerFeedback = allFeedback.filter((f) => isManagerRole(f.userRole));
    const tenantFeedback = allFeedback.filter((f) => isTenantRole(f.userRole));

    // User segment analysis
    const userSegmentAnalysis = [
      {
        segment: "Property Managers",
        averageRating: this.calculateAverageRating(managerFeedback),
        commonFeedback: this.extractCommonThemes(managerFeedback),
        satisfactionLevel: "high" as "high" | "medium" | "low",
      },
      {
        segment: "Tenants",
        averageRating: this.calculateAverageRating(tenantFeedback),
        commonFeedback: this.extractCommonThemes(tenantFeedback),
        satisfactionLevel: "high" as "high" | "medium" | "low",
      },
    ];

    // Set satisfaction levels based on ratings
    userSegmentAnalysis.forEach((segment) => {
      if (segment.averageRating >= 4) segment.satisfactionLevel = "high";
      else if (segment.averageRating >= 3) segment.satisfactionLevel = "medium";
      else segment.satisfactionLevel = "low";
    });

    // Generate actionable insights
    const actionableInsights = this.generateActionableInsights(allFeedback);

    return {
      satisfactionScore,
      npsScore,
      featureUsageCorrelation,
      userSegmentAnalysis,
      actionableInsights,
    };
  }

  /**
   * Extract common themes from feedback
   */
  private extractCommonThemes(feedback: FeedbackEntry[]): string[] {
    const themes: Record<string, number> = {};

    feedback.forEach((f) => {
      // Extract themes from tags
      f.tags.forEach((tag) => {
        themes[tag] = (themes[tag] || 0) + 1;
      });

      // Extract themes from titles and descriptions
      const words = (f.title + " " + f.description)
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 3);

      words.forEach((word) => {
        if (
          ![
            "the",
            "and",
            "for",
            "with",
            "this",
            "that",
            "have",
            "from",
          ].includes(word)
        ) {
          themes[word] = (themes[word] || 0) + 1;
        }
      });
    });

    return Object.entries(themes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([theme]) => theme);
  }

  /**
   * Calculate average rating for feedback array
   */
  private calculateAverageRating(feedback: FeedbackEntry[]): number {
    if (feedback.length === 0) return 0;
    const sum = feedback.reduce((total, f) => total + f.rating, 0);
    return Math.round((sum / feedback.length) * 10) / 10;
  }

  /**
   * Generate actionable insights from feedback
   */
  private generateActionableInsights(
    feedback: FeedbackEntry[]
  ): FeedbackAnalytics["actionableInsights"] {
    const insights = [];

    // High priority bugs
    const criticalBugs = feedback.filter(
      (f) =>
        f.category === "bug_report" &&
        f.priority === "high" &&
        f.status !== "resolved"
    );

    if (criticalBugs.length > 0) {
      insights.push({
        insight: `${criticalBugs.length} high-priority bugs reported`,
        impact: "high" as "high" | "medium" | "low",
        recommendation: "Prioritize bug fixes to improve user satisfaction",
        estimatedEffort: "medium" as "low" | "medium" | "high",
      });
    }

    // Low satisfaction areas
    const lowRatingFeedback = feedback.filter((f) => f.rating <= 2);
    if (lowRatingFeedback.length > feedback.length * 0.2) {
      insights.push({
        insight: "High percentage of low satisfaction ratings",
        impact: "high" as "high" | "medium" | "low",
        recommendation: "Conduct user experience audit and address pain points",
        estimatedEffort: "high" as "low" | "medium" | "high",
      });
    }

    // Popular feature requests
    const featureRequests = feedback.filter(
      (f) => f.category === "feature_request"
    );
    if (featureRequests.length > 0) {
      insights.push({
        insight: `${featureRequests.length} feature requests submitted`,
        impact: "medium" as "high" | "medium" | "low",
        recommendation: "Evaluate and prioritize most requested features",
        estimatedEffort: "medium" as "low" | "medium" | "high",
      });
    }

    // Performance concerns
    const performanceIssues = feedback.filter(
      (f) => f.category === "performance" || f.tags.includes("performance")
    );

    if (performanceIssues.length > 0) {
      insights.push({
        insight: "Performance concerns reported by users",
        impact: "medium" as "high" | "medium" | "low",
        recommendation: "Optimize system performance and response times",
        estimatedEffort: "medium" as "low" | "medium" | "high",
      });
    }

    return insights;
  }

  /**
   * Get feedback statistics
   */
  getFeedbackStatistics(): {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    averageRating: number;
    responseRate: number;
  } {
    const allFeedback = Array.from(this.feedbackStore.values());

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    allFeedback.forEach((f) => {
      byStatus[f.status] = (byStatus[f.status] || 0) + 1;
      byPriority[f.priority] = (byPriority[f.priority] || 0) + 1;
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    });

    const averageRating = this.calculateAverageRating(allFeedback);
    const respondedFeedback = allFeedback.filter(
      (f) => f.adminResponse || f.status === "resolved"
    );
    const responseRate =
      allFeedback.length > 0
        ? Math.round((respondedFeedback.length / allFeedback.length) * 100)
        : 0;

    return {
      total: allFeedback.length,
      byStatus,
      byPriority,
      byCategory,
      averageRating,
      responseRate,
    };
  }
}

export const userFeedbackService = new UserFeedbackService();
