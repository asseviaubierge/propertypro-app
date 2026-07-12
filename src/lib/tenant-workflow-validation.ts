/**
 * PropertyPro - Tenant Workflow Validation
 * Validation utilities for tenant status management
 */

import { TenantWorkflowService } from "./tenant-workflow";
import { UserRole } from "@/types";

const TENANT_STATUS = {
  APPLICATION_SUBMITTED: "application_submitted",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  ACTIVE: "active",
  INACTIVE: "inactive",
  MOVED_OUT: "moved_out",
  TERMINATED: "terminated",
} as const;

const BACKGROUND_CHECK_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

const DEFAULT_TENANT_STATUS = TENANT_STATUS.APPLICATION_SUBMITTED;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class TenantWorkflowValidator {
  private workflowService: TenantWorkflowService;

  constructor() {
    this.workflowService = TenantWorkflowService.getInstance();
  }

  /**
   * Validate tenant data for status transitions
   */
  validateTenantData(tenant: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic required fields
    if (!tenant.firstName || !tenant.lastName) {
      errors.push("First name and last name are required");
    }

    if (!tenant.email) {
      errors.push("Email address is required");
    }

    if (!tenant.phone) {
      errors.push("Phone number is required");
    }

    // Tenant-specific validations
    if (tenant.role === UserRole.TENANT) {
      // Emergency contact validation
      if (!tenant.emergencyContacts || tenant.emergencyContacts.length === 0) {
        warnings.push("No emergency contacts provided");
      } else {
        tenant.emergencyContacts.forEach((contact: any, index: number) => {
          if (!contact.name || !contact.phone) {
            errors.push(
              `Emergency contact ${index + 1} is missing required information`
            );
          }
        });
      }

      // Employment information validation
      if (tenant.employmentInfo) {
        if (
          !tenant.employmentInfo.employer ||
          !tenant.employmentInfo.position
        ) {
          warnings.push("Employment information is incomplete");
        }
        if (tenant.employmentInfo.income && tenant.employmentInfo.income < 0) {
          errors.push("Income cannot be negative");
        }
      }

      // Credit score validation
      if (tenant.creditScore !== undefined) {
        if (tenant.creditScore < 300 || tenant.creditScore > 850) {
          errors.push("Credit score must be between 300 and 850");
        }
      }

      // Screening score validation
      if (tenant.screeningScore !== undefined) {
        if (tenant.screeningScore < 0 || tenant.screeningScore > 100) {
          errors.push("Screening score must be between 0 and 100");
        }
      }

      // Date validations
      if (tenant.moveInDate && tenant.moveOutDate) {
        const moveIn = new Date(tenant.moveInDate);
        const moveOut = new Date(tenant.moveOutDate);
        if (moveOut <= moveIn) {
          errors.push("Move-out date must be after move-in date");
        }
      }

      // Status-specific validations
      const currentStatus = tenant.tenantStatus || DEFAULT_TENANT_STATUS;
      switch (currentStatus) {
        case TENANT_STATUS.APPROVED:
          if (
            !tenant.backgroundCheckStatus ||
            tenant.backgroundCheckStatus !== BACKGROUND_CHECK_STATUS.APPROVED
          ) {
            warnings.push(
              "Tenant is approved but background check is not approved"
            );
          }
          break;

        case TENANT_STATUS.ACTIVE:
          if (!tenant.moveInDate) {
            errors.push("Active tenants must have a move-in date");
          }
          if (!tenant.currentLeaseId) {
            warnings.push("Active tenant should have an associated lease");
          }
          break;

        case TENANT_STATUS.MOVED_OUT:
          if (!tenant.moveOutDate) {
            errors.push("Moved out tenants must have a move-out date");
          }
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate status transition
   */
  validateStatusTransition(
    currentStatus: string,
    newStatus: string,
    tenant: any,
    userRole: string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Use workflow service to validate transition
    const transitionResult = this.workflowService.validateTransition(
      currentStatus,
      newStatus,
      tenant,
      userRole
    );

    if (!transitionResult.valid) {
      errors.push(transitionResult.message || "Invalid status transition");
    }

    if (transitionResult.warnings) {
      warnings.push(...transitionResult.warnings);
    }

    // Additional business logic validations
    if (newStatus === TENANT_STATUS.APPROVED) {
      if (
        !tenant.backgroundCheckStatus ||
        tenant.backgroundCheckStatus === BACKGROUND_CHECK_STATUS.PENDING
      ) {
        warnings.push("Approving tenant with pending background check");
      }
      if (!this.workflowService.hasRequiredDocuments(tenant)) {
        warnings.push("Approving tenant without all required documents");
      }
    }

    if (newStatus === TENANT_STATUS.ACTIVE) {
      if (!tenant.moveInDate) {
        errors.push("Cannot activate tenant without move-in date");
      }
    }

    if (newStatus === TENANT_STATUS.MOVED_OUT) {
      if (!tenant.moveOutDate) {
        errors.push("Cannot mark tenant as moved out without move-out date");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate bulk operations
   */
  validateBulkOperation(
    operation: string,
    tenants: any[],
    data: any,
    userRole: string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!tenants || tenants.length === 0) {
      errors.push("No tenants selected for bulk operation");
      return { isValid: false, errors, warnings };
    }

    // Validate each tenant for the operation
    tenants.forEach((tenant, index) => {
      const tenantValidation = this.validateTenantData(tenant);
      if (!tenantValidation.isValid) {
        errors.push(
          `Tenant ${index + 1} (${tenant.firstName} ${
            tenant.lastName
          }): ${tenantValidation.errors.join(", ")}`
        );
      }

      // Operation-specific validations
      switch (operation) {
        case "approveApplications":
          if (
            tenant.tenantStatus !== TENANT_STATUS.UNDER_REVIEW &&
            tenant.tenantStatus !== TENANT_STATUS.APPLICATION_SUBMITTED
          ) {
            warnings.push(
              `Tenant ${index + 1} is not in a state that can be approved`
            );
          }
          break;

        case "changeStatus":
          if (!data.newStatus) {
            errors.push("New status is required for status change operation");
            return;
          }
          const statusValidation = this.validateStatusTransition(
            tenant.tenantStatus || DEFAULT_TENANT_STATUS,
            data.newStatus,
            tenant,
            userRole
          );
          if (!statusValidation.isValid) {
            errors.push(
              `Tenant ${index + 1}: ${statusValidation.errors.join(", ")}`
            );
          }
          break;

        case "updateCreditScores":
          if (
            !data.creditScore ||
            data.creditScore < 300 ||
            data.creditScore > 850
          ) {
            errors.push(
              "Valid credit score (300-850) is required for credit score update"
            );
            return;
          }
          break;
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate validation report
   */
  generateValidationReport(tenant: any): {
    overall: ValidationResult;
    sections: Record<string, ValidationResult>;
    recommendations: string[];
  } {
    const sections = {
      basicInfo: this.validateBasicInfo(tenant),
      contactInfo: this.validateContactInfo(tenant),
      employmentInfo: this.validateEmploymentInfo(tenant),
      emergencyContacts: this.validateEmergencyContacts(tenant),
      statusWorkflow: this.validateStatusWorkflow(tenant),
    };

    const allErrors = Object.values(sections).flatMap((s) => s.errors);
    const allWarnings = Object.values(sections).flatMap((s) => s.warnings);

    const overall: ValidationResult = {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };

    const recommendations = this.generateRecommendations(tenant, sections);

    return {
      overall,
      sections,
      recommendations,
    };
  }

  private validateBasicInfo(tenant: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!tenant.firstName) errors.push("First name is required");
    if (!tenant.lastName) errors.push("Last name is required");
    if (!tenant.email) errors.push("Email is required");
    if (!tenant.dateOfBirth) warnings.push("Date of birth not provided");

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateContactInfo(tenant: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!tenant.phone) errors.push("Phone number is required");
    if (!tenant.preferredContactMethod)
      warnings.push("Preferred contact method not specified");

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateEmploymentInfo(tenant: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!tenant.employmentInfo) {
      warnings.push("Employment information not provided");
    } else {
      if (!tenant.employmentInfo.employer)
        warnings.push("Employer not specified");
      if (!tenant.employmentInfo.position)
        warnings.push("Position not specified");
      if (!tenant.employmentInfo.income) warnings.push("Income not specified");
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateEmergencyContacts(tenant: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!tenant.emergencyContacts || tenant.emergencyContacts.length === 0) {
      warnings.push("No emergency contacts provided");
    } else {
      tenant.emergencyContacts.forEach((contact: any, index: number) => {
        if (!contact.name)
          errors.push(`Emergency contact ${index + 1} name is required`);
        if (!contact.phone)
          errors.push(`Emergency contact ${index + 1} phone is required`);
        if (!contact.relationship)
          warnings.push(
            `Emergency contact ${index + 1} relationship not specified`
          );
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateStatusWorkflow(tenant: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const currentStatus = tenant.tenantStatus || DEFAULT_TENANT_STATUS;
    const recommendedActions =
      this.workflowService.getRecommendedActions(tenant);

    if (recommendedActions.some((action) => action.priority === "high")) {
      warnings.push("There are high-priority actions pending for this tenant");
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private generateRecommendations(
    tenant: any,
    sections: Record<string, ValidationResult>
  ): string[] {
    const recommendations: string[] = [];

    if (sections.basicInfo.warnings.length > 0) {
      recommendations.push(
        "Complete basic information to improve tenant profile"
      );
    }

    if (sections.employmentInfo.warnings.length > 0) {
      recommendations.push(
        "Collect employment information for better screening"
      );
    }

    if (sections.emergencyContacts.warnings.length > 0) {
      recommendations.push("Add emergency contacts for safety and compliance");
    }

    const currentStatus = tenant.tenantStatus || DEFAULT_TENANT_STATUS;
    const recommendedActions =
      this.workflowService.getRecommendedActions(tenant);

    recommendedActions.forEach((action) => {
      if (action.priority === "high") {
        recommendations.push(`High Priority: ${action.description}`);
      }
    });

    return recommendations;
  }
}
