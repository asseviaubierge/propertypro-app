/**
 * PropertyPro - Performance Analytics Service
 * Comprehensive analytics for system performance, user behavior, and business metrics
 */

export interface PerformanceMetrics {
  systemPerformance: {
    averageResponseTime: number;
    throughput: number;
    errorRate: number;
    uptime: number;
    peakConcurrentUsers: number;
  };
  paymentMetrics: {
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    averagePaymentAmount: number;
    paymentMethodDistribution: Record<string, number>;
    processingTimeAverage: number;
  };
  userEngagement: {
    activeUsers: number;
    sessionDuration: number;
    pageViews: number;
    bounceRate: number;
    featureUsage: Record<string, number>;
  };
  businessMetrics: {
    collectionRate: number;
    averageDaysToPayment: number;
    lateFeeRevenue: number;
    autoPayAdoption: number;
    tenantSatisfactionScore: number;
  };
}

export interface AnalyticsReport {
  period: {
    start: Date;
    end: Date;
    duration: string;
  };
  metrics: PerformanceMetrics;
  trends: {
    metric: string;
    direction: "up" | "down" | "stable";
    change: number;
    significance: "high" | "medium" | "low";
  }[];
  insights: {
    category: string;
    insight: string;
    impact: "positive" | "negative" | "neutral";
    recommendation: string;
  }[];
  benchmarks: {
    metric: string;
    current: number;
    target: number;
    industry: number;
    status: "above" | "at" | "below";
  }[];
}

class PerformanceAnalyticsService {
  private metricsHistory: Map<string, any[]> = new Map();
  private benchmarks: Map<string, number> = new Map();

  constructor() {
    this.initializeBenchmarks();
  }

  /**
   * Initialize industry benchmarks
   */
  private initializeBenchmarks() {
    // System performance benchmarks
    this.benchmarks.set("averageResponseTime", 500); // 500ms
    this.benchmarks.set("throughput", 100); // 100 RPS
    this.benchmarks.set("errorRate", 0.01); // 1%
    this.benchmarks.set("uptime", 0.999); // 99.9%

    // Payment processing benchmarks
    this.benchmarks.set("paymentSuccessRate", 0.95); // 95%
    this.benchmarks.set("processingTime", 3000); // 3 seconds
    this.benchmarks.set("collectionRate", 0.95); // 95%

    // User engagement benchmarks
    this.benchmarks.set("sessionDuration", 300); // 5 minutes
    this.benchmarks.set("bounceRate", 0.4); // 40%
    this.benchmarks.set("autoPayAdoption", 0.7); // 70%
  }

  /**
   * Collect current performance metrics
   */
  async collectCurrentMetrics(): Promise<PerformanceMetrics> {
    const systemMetrics = await this.getSystemMetrics();
    const paymentMetrics = await this.getPaymentMetrics();
    const userMetrics = await this.getUserEngagementMetrics();
    const businessMetrics = await this.getBusinessMetrics();

    return {
      systemPerformance: systemMetrics,
      paymentMetrics: paymentMetrics,
      userEngagement: userMetrics,
      businessMetrics: businessMetrics,
    };
  }

  /**
   * Get system performance metrics
   */
  private async getSystemMetrics() {
    try {
      const { monitoringService } = await import("./monitoring.service");
      const systemStatus = await monitoringService.getSystemStatus();
      const metrics = systemStatus.metrics;

      return {
        averageResponseTime: metrics.averageResponseTime,
        throughput: metrics.requestsPerMinute / 60, // Convert to RPS
        errorRate: metrics.errorRate,
        uptime: metrics.uptime / (24 * 60 * 60), // Convert to days
        peakConcurrentUsers: metrics.activeConnections,
      };
    } catch (error) {
      console.error("Error collecting system metrics:", error);
      return {
        averageResponseTime: 0,
        throughput: 0,
        errorRate: 0,
        uptime: 0,
        peakConcurrentUsers: 0,
      };
    }
  }

  /**
   * Get payment processing metrics
   */
  private async getPaymentMetrics() {
    try {
      // In a real implementation, this would query the database
      // For now, we'll simulate realistic metrics
      const totalPayments = 1250;
      const successfulPayments = 1188;
      const failedPayments = 62;

      return {
        totalPayments,
        successfulPayments,
        failedPayments,
        averagePaymentAmount: 1285.5,
        paymentMethodDistribution: {
          credit_card: 0.65,
          bank_transfer: 0.25,
          debit_card: 0.08,
          other: 0.02,
        },
        processingTimeAverage: 2150, // milliseconds
      };
    } catch (error) {
      console.error("Error collecting payment metrics:", error);
      return {
        totalPayments: 0,
        successfulPayments: 0,
        failedPayments: 0,
        averagePaymentAmount: 0,
        paymentMethodDistribution: {},
        processingTimeAverage: 0,
      };
    }
  }

  /**
   * Get user engagement metrics
   */
  private async getUserEngagementMetrics() {
    try {
      // Simulate user engagement metrics
      return {
        activeUsers: 342,
        sessionDuration: 420, // seconds
        pageViews: 2850,
        bounceRate: 0.32,
        featureUsage: {
          dashboard: 0.95,
          payment_processing: 0.78,
          tenant_portal: 0.65,
          reports: 0.45,
          auto_pay: 0.58,
          communication: 0.72,
        },
      };
    } catch (error) {
      console.error("Error collecting user engagement metrics:", error);
      return {
        activeUsers: 0,
        sessionDuration: 0,
        pageViews: 0,
        bounceRate: 0,
        featureUsage: {},
      };
    }
  }

  /**
   * Get business performance metrics
   */
  private async getBusinessMetrics() {
    try {
      // Simulate business metrics
      return {
        collectionRate: 0.94,
        averageDaysToPayment: 2.3,
        lateFeeRevenue: 3250.0,
        autoPayAdoption: 0.68,
        tenantSatisfactionScore: 4.2, // out of 5
      };
    } catch (error) {
      console.error("Error collecting business metrics:", error);
      return {
        collectionRate: 0,
        averageDaysToPayment: 0,
        lateFeeRevenue: 0,
        autoPayAdoption: 0,
        tenantSatisfactionScore: 0,
      };
    }
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateAnalyticsReport(
    startDate: Date,
    endDate: Date
  ): Promise<AnalyticsReport> {
    const currentMetrics = await this.collectCurrentMetrics();
    const trends = this.analyzeTrends(currentMetrics);
    const insights = this.generateInsights(currentMetrics, trends);
    const benchmarks = this.compareToBenchmarks(currentMetrics);

    const duration = this.formatDuration(startDate, endDate);

    return {
      period: {
        start: startDate,
        end: endDate,
        duration,
      },
      metrics: currentMetrics,
      trends,
      insights,
      benchmarks,
    };
  }

  /**
   * Analyze trends in metrics
   */
  private analyzeTrends(currentMetrics: PerformanceMetrics) {
    const trends = [];

    // System performance trends
    trends.push({
      metric: "Response Time",
      direction:
        currentMetrics.systemPerformance.averageResponseTime < 400
          ? "down"
          : ("up" as "up" | "down" | "stable"),
      change: -12.5, // Simulated improvement
      significance: "medium" as "high" | "medium" | "low",
    });

    trends.push({
      metric: "Payment Success Rate",
      direction: "up" as "up" | "down" | "stable",
      change: 2.3,
      significance: "high" as "high" | "medium" | "low",
    });

    trends.push({
      metric: "Auto-pay Adoption",
      direction: "up" as "up" | "down" | "stable",
      change: 8.7,
      significance: "high" as "high" | "medium" | "low",
    });

    trends.push({
      metric: "Collection Rate",
      direction: "stable" as "up" | "down" | "stable",
      change: 0.5,
      significance: "low" as "high" | "medium" | "low",
    });

    return trends;
  }

  /**
   * Generate actionable insights
   */
  private generateInsights(metrics: PerformanceMetrics, trends: any[]) {
    const insights = [];

    // System performance insights
    if (metrics.systemPerformance.averageResponseTime > 500) {
      insights.push({
        category: "Performance",
        insight: "Average response time exceeds target threshold",
        impact: "negative" as "positive" | "negative" | "neutral",
        recommendation:
          "Consider database query optimization and caching implementation",
      });
    }

    // Payment processing insights
    const paymentSuccessRate =
      metrics.paymentMetrics.successfulPayments /
      metrics.paymentMetrics.totalPayments;
    if (paymentSuccessRate < 0.95) {
      insights.push({
        category: "Payments",
        insight: "Payment success rate below industry benchmark",
        impact: "negative" as "positive" | "negative" | "neutral",
        recommendation:
          "Review payment failure reasons and improve error handling",
      });
    }

    // User engagement insights
    if (metrics.userEngagement.bounceRate > 0.4) {
      insights.push({
        category: "User Experience",
        insight: "High bounce rate indicates potential UX issues",
        impact: "negative" as "positive" | "negative" | "neutral",
        recommendation:
          "Conduct user experience audit and improve onboarding flow",
      });
    }

    // Business metrics insights
    if (metrics.businessMetrics.autoPayAdoption < 0.7) {
      insights.push({
        category: "Business",
        insight:
          "Auto-pay adoption below target affects cash flow predictability",
        impact: "negative" as "positive" | "negative" | "neutral",
        recommendation:
          "Implement auto-pay incentives and improve enrollment process",
      });
    }

    // Positive insights
    if (metrics.businessMetrics.collectionRate > 0.93) {
      insights.push({
        category: "Business",
        insight:
          "Excellent collection rate demonstrates effective payment system",
        impact: "positive" as "positive" | "negative" | "neutral",
        recommendation:
          "Maintain current processes and consider sharing best practices",
      });
    }

    return insights;
  }

  /**
   * Compare metrics to industry benchmarks
   */
  private compareToBenchmarks(metrics: PerformanceMetrics) {
    const benchmarks = [];

    // System performance benchmarks
    benchmarks.push({
      metric: "Average Response Time",
      current: metrics.systemPerformance.averageResponseTime,
      target: this.benchmarks.get("averageResponseTime") || 500,
      industry: 450,
      status:
        metrics.systemPerformance.averageResponseTime <= 500
          ? "at"
          : ("below" as "above" | "at" | "below"),
    });

    // Payment processing benchmarks
    const paymentSuccessRate =
      metrics.paymentMetrics.successfulPayments /
      metrics.paymentMetrics.totalPayments;
    benchmarks.push({
      metric: "Payment Success Rate",
      current: paymentSuccessRate * 100,
      target: 95,
      industry: 93,
      status:
        paymentSuccessRate >= 0.95
          ? "above"
          : ("below" as "above" | "at" | "below"),
    });

    // Business metrics benchmarks
    benchmarks.push({
      metric: "Collection Rate",
      current: metrics.businessMetrics.collectionRate * 100,
      target: 95,
      industry: 92,
      status:
        metrics.businessMetrics.collectionRate >= 0.95
          ? "above"
          : metrics.businessMetrics.collectionRate >= 0.92
          ? "at"
          : ("below" as "above" | "at" | "below"),
    });

    benchmarks.push({
      metric: "Auto-pay Adoption",
      current: metrics.businessMetrics.autoPayAdoption * 100,
      target: 70,
      industry: 65,
      status:
        metrics.businessMetrics.autoPayAdoption >= 0.7
          ? "above"
          : metrics.businessMetrics.autoPayAdoption >= 0.65
          ? "at"
          : ("below" as "above" | "at" | "below"),
    });

    return benchmarks;
  }

  /**
   * Format duration between dates
   */
  private formatDuration(startDate: Date, endDate: Date): string {
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "1 day";
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
    return `${Math.floor(diffDays / 365)} years`;
  }

  /**
   * Store metrics for historical analysis
   */
  storeMetrics(timestamp: Date, metrics: PerformanceMetrics) {
    const key = timestamp.toISOString().split("T")[0]; // Daily storage

    if (!this.metricsHistory.has(key)) {
      this.metricsHistory.set(key, []);
    }

    this.metricsHistory.get(key)?.push({
      timestamp,
      metrics,
    });
  }

  /**
   * Get historical metrics for comparison
   */
  getHistoricalMetrics(days: number = 30): Map<string, any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const filteredHistory = new Map();

    for (const [date, metrics] of this.metricsHistory) {
      if (new Date(date) >= cutoffDate) {
        filteredHistory.set(date, metrics);
      }
    }

    return filteredHistory;
  }

  /**
   * Generate performance optimization recommendations
   */
  generateOptimizationRecommendations(report: AnalyticsReport): {
    priority: "high" | "medium" | "low";
    category: string;
    recommendation: string;
    expectedImpact: string;
    effort: "low" | "medium" | "high";
  }[] {
    const recommendations = [];

    // High priority recommendations
    const negativeInsights = report.insights.filter(
      (i) => i.impact === "negative"
    );
    negativeInsights.forEach((insight) => {
      recommendations.push({
        priority: "high" as "high" | "medium" | "low",
        category: insight.category,
        recommendation: insight.recommendation,
        expectedImpact:
          "Significant improvement in user experience and business metrics",
        effort: "medium" as "low" | "medium" | "high",
      });
    });

    // Medium priority recommendations
    const belowBenchmarks = report.benchmarks.filter(
      (b) => b.status === "below"
    );
    belowBenchmarks.forEach((benchmark) => {
      recommendations.push({
        priority: "medium" as "high" | "medium" | "low",
        category: "Performance",
        recommendation: `Improve ${benchmark.metric} to meet industry standards`,
        expectedImpact: `Bring ${
          benchmark.metric
        } from ${benchmark.current.toFixed(1)} to ${benchmark.target}`,
        effort: "medium" as "low" | "medium" | "high",
      });
    });

    // Low priority recommendations (optimization opportunities)
    recommendations.push({
      priority: "low" as "high" | "medium" | "low",
      category: "Optimization",
      recommendation:
        "Implement advanced caching strategies for frequently accessed data",
      expectedImpact: "Further reduce response times and improve scalability",
      effort: "high" as "low" | "medium" | "high",
    });

    return recommendations;
  }
}

export const performanceAnalyticsService = new PerformanceAnalyticsService();
