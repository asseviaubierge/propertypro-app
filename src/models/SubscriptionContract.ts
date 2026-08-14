import mongoose, { Schema, Model } from "mongoose";

export type SubscriptionContractType =
  | "scale"
  | "negotiated"
  | "management"
  | "guaranteed_management";

export type SubscriptionPricingMode = "fixed" | "percentage" | "hybrid";
export type SubscriptionBillingPeriod = "monthly" | "yearly";
export type SubscriptionContractStatus =
  | "draft"
  | "active"
  | "suspended"
  | "expired"
  | "cancelled";

const PortfolioSnapshotSchema = new Schema(
  {
    propertyCount: { type: Number, default: 0, min: 0 },
    unitCount: { type: Number, default: 0, min: 0 },
    occupiedUnitCount: { type: Number, default: 0, min: 0 },
    vacantUnitCount: { type: Number, default: 0, min: 0 },
    activeTenantCount: { type: Number, default: 0, min: 0 },
    activeLeaseCount: { type: Number, default: 0, min: 0 },
    terminatedLeaseCount: { type: Number, default: 0, min: 0 },
    expiredLeaseCount: { type: Number, default: 0, min: 0 },
    lastSyncAt: { type: Date, default: null },
  },
  { _id: false }
);

const MandateRulesSchema = new Schema(
  {
    ownerPayoutDay: { type: Number, min: 1, max: 31, default: 15 },
    payoutRule: {
      type: String,
      enum: ["collected", "guaranteed", "custom"],
      default: "collected",
    },
    payoutNotes: { type: String, trim: true, default: "" },

    manageLeases: { type: Boolean, default: false },
    manageCollections: { type: Boolean, default: false },
    manageMaintenance: { type: Boolean, default: false },
    manageInspections: { type: Boolean, default: false },

    tenantReplacementAuthority: {
      type: String,
      enum: ["automatic", "owner_approval", "not_authorized"],
      default: "owner_approval",
    },
    expenseApprovalThreshold: { type: Number, min: 0, default: 0 },

    ownerFullTransparency: { type: Boolean, default: true },
    ownerCanViewOccupantContacts: { type: Boolean, default: true },

    advanceManagementEnabled: { type: Boolean, default: true },
    advancePolicy: { type: String, trim: true, default: "" },
    depositPolicy: { type: String, trim: true, default: "" },

    vacancyManagementEnabled: { type: Boolean, default: true },
    vacancyCoverageEnabled: { type: Boolean, default: false },
    vacancyCoverageDays: { type: Number, min: 0, default: 0 },
    vacancyCoverageCap: { type: Number, min: 0, default: 0 },

    guaranteedIncomeEnabled: { type: Boolean, default: false },
    guaranteedIncomeAmount: { type: Number, min: 0, default: 0 },
    guaranteedIncomeRate: { type: Number, min: 0, max: 100, default: 0 },
    guaranteeMaxUnpaidMonths: { type: Number, min: 0, max: 36, default: 0 },
    guaranteeAnnualCap: { type: Number, min: 0, default: 0 },

    leaseSyncEnabled: { type: Boolean, default: true },
    notifyOnLeaseActivation: { type: Boolean, default: true },
    notifyOnLeaseTermination: { type: Boolean, default: true },
    notifyOnLeaseExpiration: { type: Boolean, default: true },
  },
  { _id: false }
);


const SafeguardsSchema = new Schema(
  {
    manualPaymentRegister: { type: Boolean, default: true },
    manualOwnerPayoutRegister: { type: Boolean, default: true },
    independentEvidenceArchive: { type: Boolean, default: true },
    independentBackups: { type: Boolean, default: true },
    backupFrequency: { type: String, trim: true, default: "Quotidienne + sauvegardes périodiques" },
    outageReconciliation: { type: Boolean, default: true },
    immutableAuditTrail: { type: Boolean, default: true },
    incidentNotification: { type: Boolean, default: true },
    financialInstructionVerification: { type: Boolean, default: true },
    employeeFraudControls: { type: Boolean, default: true },
    professionalLiabilityInsurance: { type: Boolean, default: false },
    propertyInsuranceRequired: { type: Boolean, default: true },
    tenantLiabilityInsuranceRecommended: { type: Boolean, default: true },
    cyberInsurance: { type: Boolean, default: false },
    thirdPartyFundsProtection: { type: Boolean, default: false },
    guaranteeReserveRequired: { type: Boolean, default: true },
    guaranteeReserveAmount: { type: Number, min: 0, default: 0 },
    forceMajeureNotes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const OnboardingChecklistSchema = new Schema(
  {
    ownerIdentityVerified: { type: Boolean, default: false },
    ownershipDocumentsVerified: { type: Boolean, default: false },
    existingOccupantsDeclared: { type: Boolean, default: false },
    existingLeasesCollected: { type: Boolean, default: false },
    priorArrearsDeclared: { type: Boolean, default: false },
    depositsAdvancesDeclared: { type: Boolean, default: false },
    propertyConditionRecorded: { type: Boolean, default: false },
    knownDisputesDeclared: { type: Boolean, default: false },
    payoutCoordinatesVerified: { type: Boolean, default: false },
  },
  { _id: false }
);

const OffboardingChecklistSchema = new Schema(
  {
    closureStatementRequired: { type: Boolean, default: true },
    finalFinancialStatement: { type: Boolean, default: true },
    depositsTransferred: { type: Boolean, default: true },
    documentsDelivered: { type: Boolean, default: true },
    activeLeasesTransferred: { type: Boolean, default: true },
    openDisputesRecorded: { type: Boolean, default: true },
  },
  { _id: false }
);

const ComplianceRulesSchema = new Schema(
  {
    identityVerification: { type: Boolean, default: true },
    dataUseNoticeAccepted: { type: Boolean, default: true },
    occupantContactUseRestricted: { type: Boolean, default: true },
    accountSecurityAcknowledged: { type: Boolean, default: true },
    collectionAuthorization: { type: Boolean, default: true },
    legalProceedingsNeedApproval: { type: Boolean, default: true },
    taxResponsibilityAcknowledged: { type: Boolean, default: true },
    deathSuccessionProcedure: { type: Boolean, default: true },
    propertySaleProcedure: { type: Boolean, default: true },
  },
  { _id: false }
);

const SubscriptionContractSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    contractNumber: { type: String, required: true, unique: true, index: true },
    contractType: {
      type: String,
      enum: ["scale", "negotiated", "management", "guaranteed_management"],
      required: true,
      default: "scale",
    },
    pricingMode: {
      type: String,
      enum: ["fixed", "percentage", "hybrid"],
      required: true,
      default: "fixed",
    },

    // Limites autorisées par le contrat
    maxProperties: { type: Number, default: 1, min: 0 },
    maxUnits: { type: Number, default: 3, min: 0 },
    maxActiveTenants: { type: Number, default: 3, min: 0 },
    tierLabel: { type: String, trim: true, default: "1–3 ménages" },

    // Compatibilité avec les contrats déjà enregistrés
    propertyCount: { type: Number, default: 0, min: 0 },
    householdCount: { type: Number, default: 0, min: 0 },
    activeTenantCount: { type: Number, default: 0, min: 0 },

    // Utilisation réelle synchronisée automatiquement
    portfolioSnapshot: { type: PortfolioSnapshotSchema, default: () => ({}) },

    fixedAmount: { type: Number, default: 0, min: 0 },
    percentageRate: { type: Number, default: 0, min: 0, max: 100 },
    minimumAmount: { type: Number, default: 0, min: 0 },
    billingPeriod: { type: String, enum: ["monthly", "yearly"], default: "monthly" },

    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    renewalMode: { type: String, enum: ["manual", "automatic"], default: "manual" },
    status: {
      type: String,
      enum: ["draft", "pending_signature", "signed", "active", "suspended", "expired", "cancelled"],
      default: "draft",
      index: true,
    },

    // Cycle de lecture et signature du document par le contractant.
    signatureStatus: {
      type: String,
      enum: ["not_sent", "pending_signature", "signed", "rejected"],
      default: "not_sent",
      index: true,
    },
    sentAt: { type: Date, default: null },
    lastDeliveryChannel: {
      type: String,
      enum: ["email", "whatsapp", "manual", null],
      default: null,
    },
    viewedAt: { type: Date, default: null },
    signedAt: { type: Date, default: null },
    signatoryName: { type: String, trim: true, default: "" },
    signatoryAcknowledgement: { type: Boolean, default: false },

    title: { type: String, trim: true, default: "Contrat E-IMMO" },
    contractBody: { type: String, trim: true, default: "" },
    conditions: { type: String, trim: true, default: "" },
    specialClauses: { type: String, trim: true, default: "" },
    mandateRules: { type: MandateRulesSchema, default: () => ({}) },
    safeguards: { type: SafeguardsSchema, default: () => ({}) },
    onboardingChecklist: { type: OnboardingChecklistSchema, default: () => ({}) },
    offboardingChecklist: { type: OffboardingChecklistSchema, default: () => ({}) },
    complianceRules: { type: ComplianceRulesSchema, default: () => ({}) },

    platformName: { type: String, default: "E-IMMO" },
    platformRepresentative: { type: String, trim: true, default: "GESTION E-IMMO" },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

SubscriptionContractSchema.index({ accountId: 1, status: 1 });

const SubscriptionContract: Model<any> =
  mongoose.models.SubscriptionContract ||
  mongoose.model("SubscriptionContract", SubscriptionContractSchema);

export default SubscriptionContract;
