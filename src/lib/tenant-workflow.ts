/**
 * PropertyPro - Tenant Workflow Service
 * Comprehensive tenant lifecycle management utilities
 */

export interface TenantWorkflowConfig {
  autoApprovalThresholds?: {
    creditScore?: number;
    screeningScore?: number;
    incomeMultiplier?: number; // e.g., 3x rent
  };
  requiredDocuments?: string[];
  backgroundCheckProviders?: string[];
  notificationSettings?: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    inAppNotifications: boolean;
  };
}

export interface TenantStatusTransition {
  from: string;
  to: string;
  requiredPermissions: string[];
  requiredFields?: string[];
  validationRules?: ((tenant: any) => { valid: boolean; message?: string })[];
  autoActions?: ((tenant: any) => Promise<void>)[];
}

export class TenantWorkflowService {
  private static instance: TenantWorkflowService;
  private config: TenantWorkflowConfig;

  private constructor(config: TenantWorkflowConfig = {}) {
    this.config = {
      autoApprovalThresholds: {
        creditScore: 650,
        screeningScore: 70,
        incomeMultiplier: 3,
      },
      requiredDocuments: [
        "government_id",
        "proof_of_income",
        "bank_statements",
        "references",
      ],
      backgroundCheckProviders: ["default"],
      notificationSettings: {
        emailNotifications: true,
        smsNotifications: false,
        inAppNotifications: true,
      },
      ...config,
    };
  }

  public static getInstance(
    config?: TenantWorkflowConfig
  ): TenantWorkflowService {
    if (!TenantWorkflowService.instance) {
      TenantWorkflowService.instance = new TenantWorkflowService(config);
    }
    return TenantWorkflowService.instance;
  }

  /**
   * Get all possible status transitions with their requirements
   */
  public getStatusTransitions(): TenantStatusTransition[] {
    return [
      {
        from: "application_submitted",
        to: "under_review",
        requiredPermissions: [
          "property_manager",
          "leasing_agent",
          "super_admin",
        ],
        requiredFields: [],
        validationRules: [
          (tenant) => ({
            valid: !!tenant.firstName && !!tenant.lastName && !!tenant.email,
            message: "Basic tenant information is required",
          }),
        ],
      },
      {
        from: "under_review",
        to: "approved",
        requiredPermissions: ["property_manager", "super_admin"],
        requiredFields: ["backgroundCheckStatus"],
        validationRules: [
          (tenant) => ({
            valid: tenant.backgroundCheckStatus === "approved",
            message: "Background check must be approved",
          }),
          (tenant) => ({
            valid: this.hasRequiredDocuments(tenant),
            message: "All required documents must be uploaded",
          }),
        ],
      },
      {
        from: "approved",
        to: "active",
        requiredPermissions: [
          "property_manager",
          "leasing_agent",
          "super_admin",
        ],
        requiredFields: ["moveInDate"],
        validationRules: [
          (tenant) => ({
            valid: !!tenant.moveInDate,
            message: "Move-in date is required",
          }),
        ],
        autoActions: [
          async (tenant) => {
            // Auto-create lease if not exists
            await this.createLeaseIfNeeded(tenant);
          },
        ],
      },
      {
        from: "active",
        to: "inactive",
        requiredPermissions: ["property_manager", "super_admin"],
        requiredFields: [],
        validationRules: [],
      },
      {
        from: "inactive",
        to: "active",
        requiredPermissions: ["property_manager", "super_admin"],
        requiredFields: [],
        validationRules: [],
      },
      {
        from: "active",
        to: "moved_out",
        requiredPermissions: [
          "property_manager",
          "leasing_agent",
          "super_admin",
        ],
        requiredFields: ["moveOutDate"],
        validationRules: [
          (tenant) => ({
            valid: !!tenant.moveOutDate,
            message: "Move-out date is required",
          }),
          (tenant) => ({
            valid: new Date(tenant.moveOutDate) >= new Date(tenant.moveInDate),
            message: "Move-out date cannot be before move-in date",
          }),
        ],
        autoActions: [
          async (tenant) => {
            // Auto-complete lease
            await this.completeLeaseIfNeeded(tenant);
          },
        ],
      },
      {
        from: "moved_out",
        to: "terminated",
        requiredPermissions: ["property_manager", "super_admin"],
        requiredFields: [],
        validationRules: [],
      },
      // Emergency termination from any status
      {
        from: "*",
        to: "terminated",
        requiredPermissions: ["property_manager", "super_admin"],
        requiredFields: [],
        validationRules: [],
        autoActions: [
          async (tenant) => {
            // Auto-terminate lease
            await this.terminateLeaseIfNeeded(tenant);
          },
        ],
      },
    ];
  }

  /**
   * Validate if a status transition is allowed
   */
  public validateTransition(
    currentStatus: string,
    newStatus: string,
    tenant: any,
    userRole: string
  ): { valid: boolean; message?: string; warnings?: string[] } {
    const transitions = this.getStatusTransitions();
    const validTransition = transitions.find(
      (t) => (t.from === currentStatus || t.from === "*") && t.to === newStatus
    );

    if (!validTransition) {
      return {
        valid: false,
        message: `Invalid transition from ${currentStatus} to ${newStatus}`,
      };
    }

    // Check permissions
    if (!validTransition.requiredPermissions.includes(userRole)) {
      return {
        valid: false,
        message: `Insufficient permissions. Required: ${validTransition.requiredPermissions.join(
          ", "
        )}`,
      };
    }

    // Check required fields
    const missingFields =
      validTransition.requiredFields?.filter((field) => !tenant[field]) || [];
    if (missingFields.length > 0) {
      return {
        valid: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      };
    }

    // Run validation rules
    const warnings: string[] = [];
    for (const rule of validTransition.validationRules || []) {
      const result = rule(tenant);
      if (!result.valid) {
        return { valid: false, message: result.message };
      }
    }

    // Check for auto-approval eligibility
    if (newStatus === "approved" && this.isEligibleForAutoApproval(tenant)) {
      warnings.push("Tenant meets auto-approval criteria");
    }

    return { valid: true, warnings };
  }

  /**
   * Check if tenant is eligible for auto-approval
   */
  public isEligibleForAutoApproval(tenant: any): boolean {
    const thresholds = this.config.autoApprovalThresholds!;

    return (
      (tenant.creditScore || 0) >= thresholds.creditScore! &&
      (tenant.screeningScore || 0) >= thresholds.screeningScore! &&
      this.hasRequiredDocuments(tenant) &&
      tenant.backgroundCheckStatus === "approved"
    );
  }

  /**
   * Check if tenant has all required documents
   */
  public hasRequiredDocuments(tenant: any): boolean {
    const requiredDocs = this.config.requiredDocuments || [];
    const tenantDocs = tenant.documents || [];

    return requiredDocs.every((doc) =>
      tenantDocs.some((tenantDoc: string) => tenantDoc.includes(doc))
    );
  }

  /**
   * Get next recommended actions for a tenant
   */
  public getRecommendedActions(tenant: any): Array<{
    action: string;
    description: string;
    priority: "high" | "medium" | "low";
    automated?: boolean;
  }> {
    const actions = [];
    const currentStatus = tenant.tenantStatus || "application_submitted";

    switch (currentStatus) {
      case "application_submitted":
        actions.push({
          action: "start_review",
          description: "Begin application review process",
          priority: "high" as const,
        });
        break;

      case "under_review":
        if (
          !tenant.backgroundCheckStatus ||
          tenant.backgroundCheckStatus === "pending"
        ) {
          actions.push({
            action: "complete_background_check",
            description: "Complete background check",
            priority: "high" as const,
          });
        }
        if (!this.hasRequiredDocuments(tenant)) {
          actions.push({
            action: "collect_documents",
            description: "Collect missing required documents",
            priority: "high" as const,
          });
        }
        if (this.isEligibleForAutoApproval(tenant)) {
          actions.push({
            action: "auto_approve",
            description: "Auto-approve based on criteria",
            priority: "medium" as const,
            automated: true,
          });
        }
        break;

      case "approved":
        actions.push({
          action: "schedule_move_in",
          description: "Schedule move-in date and create lease",
          priority: "high" as const,
        });
        break;

      case "active":
        if (!tenant.currentLeaseId) {
          actions.push({
            action: "create_lease",
            description: "Create lease agreement",
            priority: "high" as const,
          });
        }
        break;
    }

    return actions;
  }

  /**
   * Auto-actions for status transitions
   */
  private async createLeaseIfNeeded(tenant: any): Promise<void> {
    // Implementation would create a lease record

  }

  private async completeLeaseIfNeeded(tenant: any): Promise<void> {
    // Implementation would complete the current lease

  }

  private async terminateLeaseIfNeeded(tenant: any): Promise<void> {
    // Implementation would terminate the current lease

  }

  /**
   * Generate workflow report for a tenant
   */
  public generateWorkflowReport(tenant: any): {
    currentStage: string;
    completionPercentage: number;
    nextSteps: string[];
    blockers: string[];
    estimatedCompletion?: string;
  } {
    const currentStatus = tenant.tenantStatus || "application_submitted";
    const stages = [
      "application_submitted",
      "under_review",
      "approved",
      "active",
    ];

    const currentStageIndex = stages.indexOf(currentStatus);
    const completionPercentage =
      currentStageIndex >= 0
        ? ((currentStageIndex + 1) / stages.length) * 100
        : 0;

    const recommendedActions = this.getRecommendedActions(tenant);
    const nextSteps = recommendedActions
      .filter((a) => a.priority === "high")
      .map((a) => a.description);

    const blockers = recommendedActions
      .filter((a) => a.priority === "high" && !a.automated)
      .map((a) => a.description);

    return {
      currentStage: currentStatus,
      completionPercentage,
      nextSteps,
      blockers,
      estimatedCompletion: this.estimateCompletion(tenant),
    };
  }

  private estimateCompletion(tenant: any): string | undefined {
    // Simple estimation logic - could be more sophisticated
    const currentStatus = tenant.tenantStatus || "application_submitted";
    const daysToComplete = {
      application_submitted: 7,
      under_review: 5,
      approved: 14,
      active: 0,
    };

    const days = daysToComplete[currentStatus];
    if (days === undefined) return undefined;

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + days);
    return estimatedDate.toISOString().split("T")[0];
  }
}
