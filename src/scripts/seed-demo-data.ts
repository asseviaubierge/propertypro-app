/**
 * PropertyPro - exact demo data seed.
 *
 * Usage:
 *   npm run db:seed
 *
 * Reset first when needed:
 *   DEMO_RESET_CONFIRM=RESET_PROPERTYPRO_DEMO_DATABASE npm run db:reset
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import mongoose from "mongoose";
import {
  Announcement,
  Application,
  AuditLog,
  Conversation,
  Document,
  DocumentTemplate,
  Event,
  Expense,
  Inspection,
  Invoice,
  Lease,
  MaintenanceRequest,
  Message,
  MessageStatus,
  Notification,
  Payment,
  PaymentNotification,
  PaymentReceipt,
  Property,
  RecurringPayment,
  Role,
  SecurityDeposit,
  Tenant,
  Ticket,
  User,
  WorkOrder,
  ensurePaymentIndexes,
} from "@/models";
import {
  ApplicationFeeStatus,
  ApplicationStatus,
  EventPriority,
  EventStatus,
  EventType,
  ExpenseCategory,
  ExpenseStatus,
  InspectionType,
  InvoiceType,
  LeaseStatus,
  LocationType,
  MaintenancePriority,
  MaintenanceStatus,
  PaymentFrequency,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  PropertyStatus,
  PropertyType,
  SecurityDepositStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  UserRole,
  WorkOrderStatus,
} from "@/types";
import { SYSTEM_ROLE_PERMISSIONS } from "@/lib/permission-catalog";
import { migrationHelpers } from "@/lib/database/schema-updates";
import { SystemSettingsService } from "@/lib/services/settings-service";
import { AuditAction, AuditCategory, AuditSeverity } from "@/models/AuditLog";

type DemoContext = {
  users: Record<string, any>;
  tenants: Record<string, any>;
  properties: Record<string, any>;
  leases: Array<{ lease: any; property: any; tenantUser: any; unit: any }>;
  payments: any[];
  invoices: any[];
  maintenanceRequests: any[];
  messages: any[];
};

const companyInfo = {
  name: "PropertyPro Demo Management",
  address: "120 Harbor View Ave, Seattle, WA 98101",
  phone: "+12065550100",
  email: "billing@propertypro.com",
};

let invoiceSequence = 1000;
let receiptSequence = 2000;
let transactionSequence = 3000;
let ticketSequence: number | null = null;

async function nextTicketNumber(): Promise<string> {
  if (ticketSequence === null) {
    const existingTickets = await Ticket.collection
      .find(
        { ticketNumber: { $type: "string" } },
        { projection: { ticketNumber: 1 } },
      )
      .toArray();

    const maxTicketNumber = existingTickets.reduce((max, ticket) => {
      const raw = ticket?.ticketNumber;
      if (typeof raw !== "string") return max;

      const match = /^TKT-(\d+)$/.exec(raw);
      if (!match) return max;

      const parsed = Number.parseInt(match[1], 10);
      return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
    }, 0);

    ticketSequence = maxTicketNumber + 1;
  }

  const ticketNumber = `TKT-${String(ticketSequence).padStart(5, "0")}`;
  ticketSequence += 1;
  return ticketNumber;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function fullAddress(property: any): string {
  const address = property.address;
  return `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`;
}

function findUnit(property: any, unitNumber: string) {
  const unit = property.units.find((candidate: any) => {
    return candidate.unitNumber === unitNumber;
  });

  if (!unit) {
    throw new Error(`Unit ${unitNumber} not found on ${property.name}`);
  }

  return unit;
}

function rentPaymentConfig() {
  return {
    rentDueDay: 1,
    lateFeeConfig: {
      enabled: true,
      gracePeriodDays: 5,
      feeType: "fixed",
      feeAmount: 75,
      notificationDays: [3, 7, 14],
    },
    acceptedPaymentMethods: [
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.CREDIT_CARD,
      PaymentMethod.CHECK,
    ],
    autoCreatePayments: true,
    prorationEnabled: true,
    advancePaymentMonths: 0,
    autoGenerateInvoices: true,
    autoEmailInvoices: false,
    enableCommunicationAutomation: true,
    prorationMethod: "daily",
    roundingMethod: "round",
    minimumProrationCharge: 0,
  };
}

async function assertDatabaseIsReadyForSeed() {
  const coreCollections = [
    ["users", User],
    ["properties", Property],
    ["tenants", Tenant],
    ["leases", Lease],
    ["invoices", Invoice],
    ["payments", Payment],
    ["applications", Application],
  ] as const;

  const counts = await Promise.all(
    coreCollections.map(async ([name, model]) => {
      return [name, await model.countDocuments({})] as const;
    }),
  );

  const nonEmpty = counts.filter(([, count]) => count > 0);
  if (nonEmpty.length > 0) {
    const details = nonEmpty
      .map(([name, count]) => `${name}: ${count}`)
      .join(", ");
    throw new Error(
      `Database already contains core data (${details}). Reset first with DEMO_RESET_CONFIRM=RESET_PROPERTYPRO_DEMO_DATABASE npm run db:reset.`,
    );
  }
}

async function createUsers(): Promise<Record<string, any>> {
  const users = await User.create([
    {
      firstName: "Avery",
      lastName: "Stone",
      email: "admin@propertypro.com",
      password: "Admin123$",
      role: UserRole.ADMIN,
      phone: "+12065550100",
      isActive: true,
      emailVerified: new Date(),
    },
    {
      firstName: "Mara",
      lastName: "Bennett",
      email: "manager@propertypro.com",
      password: "Manager123$",
      role: UserRole.MANAGER,
      phone: "+12065550101",
      isActive: true,
      emailVerified: new Date(),
    },
    {
      firstName: "Diego",
      lastName: "Ramirez",
      email: "maintenance@propertypro.com",
      password: "Maintenance123$",
      role: UserRole.MANAGER,
      phone: "+12065550102",
      isActive: true,
      emailVerified: new Date(),
    },
    {
      firstName: "Emma",
      lastName: "Reed",
      email: "tenant@propertypro.com",
      password: "Tenant123$",
      role: UserRole.TENANT,
      phone: "+12065550110",
      isActive: true,
      emailVerified: new Date(),
      tenantStatus: "active",
      dateOfBirth: new Date("1992-05-12"),
      backgroundCheckStatus: "approved",
      creditScore: 742,
      preferredContactMethod: "email",
      employmentInfo: {
        employer: "Northstar Design",
        position: "Product Designer",
        income: 92000,
        startDate: new Date("2021-03-15"),
      },
      emergencyContacts: [
        {
          name: "Nora Reed",
          relationship: "Sister",
          phone: "+12065550111",
          email: "nora.reed@example.com",
        },
      ],
    },
    {
      firstName: "Liam",
      lastName: "Carter",
      email: "liam.carter@example.com",
      password: "Tenant123$",
      role: UserRole.TENANT,
      phone: "+12065550112",
      isActive: true,
      emailVerified: new Date(),
      tenantStatus: "active",
      dateOfBirth: new Date("1988-11-03"),
      backgroundCheckStatus: "approved",
      creditScore: 718,
      preferredContactMethod: "app",
      employmentInfo: {
        employer: "Civic Health",
        position: "Operations Manager",
        income: 105000,
        startDate: new Date("2019-08-01"),
      },
      emergencyContacts: [
        {
          name: "Grace Carter",
          relationship: "Mother",
          phone: "+12065550113",
          email: "grace.carter@example.com",
        },
      ],
    },
    {
      firstName: "Sofia",
      lastName: "Martinez",
      email: "sofia.martinez@example.com",
      password: "Tenant123$",
      role: UserRole.TENANT,
      phone: "+12065550114",
      isActive: true,
      emailVerified: new Date(),
      tenantStatus: "active",
      dateOfBirth: new Date("1995-02-21"),
      backgroundCheckStatus: "approved",
      creditScore: 781,
      preferredContactMethod: "phone",
      employmentInfo: {
        employer: "Atlas Legal Group",
        position: "Paralegal",
        income: 78000,
        startDate: new Date("2020-10-12"),
      },
      emergencyContacts: [
        {
          name: "Carlos Martinez",
          relationship: "Father",
          phone: "+12065550115",
          email: "carlos.martinez@example.com",
        },
      ],
    },
    {
      firstName: "Noah",
      lastName: "Kim",
      email: "noah.kim@example.com",
      password: "Tenant123$",
      role: UserRole.TENANT,
      phone: "+12065550116",
      isActive: true,
      emailVerified: new Date(),
      tenantStatus: "active",
      dateOfBirth: new Date("1990-07-19"),
      backgroundCheckStatus: "approved",
      creditScore: 696,
      preferredContactMethod: "text",
      employmentInfo: {
        employer: "Greenline Energy",
        position: "Field Engineer",
        income: 88000,
        startDate: new Date("2018-04-09"),
      },
      emergencyContacts: [
        {
          name: "Hana Kim",
          relationship: "Conjoint",
          phone: "+12065550117",
          email: "hana.kim@example.com",
        },
      ],
    },
    {
      firstName: "Maya",
      lastName: "Chen",
      email: "maya.chen@example.com",
      password: "Applicant123$",
      role: UserRole.TENANT,
      phone: "+12065550120",
      isActive: true,
      emailVerified: new Date(),
      tenantStatus: "under_review",
      dateOfBirth: new Date("1994-09-30"),
      backgroundCheckStatus: "pending",
      preferredContactMethod: "email",
    },
    {
      firstName: "Jordan",
      lastName: "Patel",
      email: "jordan.patel@example.com",
      password: "Applicant123$",
      role: UserRole.TENANT,
      phone: "+12065550121",
      isActive: true,
      emailVerified: new Date(),
      tenantStatus: "application_submitted",
      dateOfBirth: new Date("1986-12-05"),
      backgroundCheckStatus: "pending",
      preferredContactMethod: "email",
    },
  ]);

  return Object.fromEntries(users.map((user: any) => [user.email, user]));
}

async function createRoles(admin: any) {
  await Role.create([
    {
      name: UserRole.ADMIN,
      label: "Administrator",
      description: "Full system access for company administrators.",
      permissions: [...SYSTEM_ROLE_PERMISSIONS[UserRole.ADMIN]],
      isSystem: true,
      isActive: true,
      color: "destructive",
      createdBy: admin._id,
      updatedBy: admin._id,
    },
    {
      name: UserRole.MANAGER,
      label: "Gestionnaire du bien",
      description: "Operational access for property and tenant management.",
      permissions: [...SYSTEM_ROLE_PERMISSIONS[UserRole.MANAGER]],
      isSystem: true,
      isActive: true,
      color: "default",
      createdBy: admin._id,
      updatedBy: admin._id,
    },
    {
      name: UserRole.TENANT,
      label: "Locataire",
      description: "Tenant portal access for leases, payments, and requests.",
      permissions: [...SYSTEM_ROLE_PERMISSIONS[UserRole.TENANT]],
      isSystem: true,
      isActive: true,
      color: "secondary",
      createdBy: admin._id,
      updatedBy: admin._id,
    },
  ]);
}

async function createProperties(users: Record<string, any>) {
  const admin = users["admin@propertypro.com"];
  const manager = users["manager@propertypro.com"];

  const properties = await Property.create([
    {
      name: "Harbor Heights Apartments",
      description:
        "Waterfront apartment community with renovated kitchens, controlled access, and a shared rooftop terrace.",
      type: PropertyType.APARTMENT,
      status: PropertyStatus.AVAILABLE,
      address: {
        street: "120 Harbor View Ave",
        city: "Seattle",
        state: "WA",
        zipCode: "98101",
        country: "United States",
      },
      yearBuilt: 2018,
      images: [
        "https://picsum.photos/seed/harbor-heights-property-1/1400/900",
        "https://picsum.photos/seed/harbor-heights-property-2/1400/900",
      ],
      amenities: [
        { name: "Rooftop Terrace", category: "Recreation" },
        { name: "Secure Package Room", category: "Sécurité" },
        { name: "Bike Storage", category: "Stationnement" },
      ],
      units: [
        {
          unitNumber: "A101",
          unitType: "apartment",
          floor: 1,
          bedrooms: 1,
          bathrooms: 1,
          squareFootage: 720,
          rentAmount: 1850,
          securityDeposit: 1850,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/harbor-heights-a101/1200/800"],
          balcony: true,
          dishwasher: true,
          inUnitLaundry: true,
          centralAir: true,
          appliances: {
            refrigerator: true,
            stove: true,
            oven: true,
            microwave: true,
            dishwasher: true,
            washer: true,
            dryer: true,
          },
          parking: {
            included: true,
            spaces: 1,
            type: "covered",
            assigned: true,
          },
        },
        {
          unitNumber: "A102",
          unitType: "apartment",
          floor: 1,
          bedrooms: 2,
          bathrooms: 2,
          squareFootage: 1050,
          rentAmount: 2450,
          securityDeposit: 2450,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/harbor-heights-a102/1200/800"],
          balcony: true,
          dishwasher: true,
          inUnitLaundry: true,
          centralAir: true,
        },
        {
          unitNumber: "B201",
          unitType: "apartment",
          floor: 2,
          bedrooms: 1,
          bathrooms: 1,
          squareFootage: 760,
          rentAmount: 1950,
          securityDeposit: 1950,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/harbor-heights-b201/1200/800"],
          hardwoodFloors: true,
          dishwasher: true,
          centralAir: true,
        },
        {
          unitNumber: "B202",
          unitType: "apartment",
          floor: 2,
          bedrooms: 2,
          bathrooms: 2,
          squareFootage: 1115,
          rentAmount: 2550,
          securityDeposit: 2550,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/harbor-heights-b202/1200/800"],
          balcony: true,
          dishwasher: true,
          inUnitLaundry: true,
        },
        {
          unitNumber: "C301",
          unitType: "penthouse",
          floor: 3,
          bedrooms: 3,
          bathrooms: 2,
          squareFootage: 1460,
          rentAmount: 3150,
          securityDeposit: 3150,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/harbor-heights-c301/1200/800"],
          balcony: true,
          fireplace: true,
          walkInClosets: true,
          centralAir: true,
        },
        {
          unitNumber: "C302",
          unitType: "apartment",
          floor: 3,
          bedrooms: 1,
          bathrooms: 1,
          squareFootage: 700,
          rentAmount: 1800,
          securityDeposit: 1800,
          status: PropertyStatus.MAINTENANCE,
          images: ["https://picsum.photos/seed/harbor-heights-c302/1200/800"],
          notes: "Turnover maintenance in progress.",
        },
      ],
      ownerId: admin._id,
      managerId: manager._id,
    },
    {
      name: "Maple Court Townhomes",
      description:
        "Three-townhome courtyard property with attached garages and private patios.",
      type: PropertyType.TOWNHOUSE,
      status: PropertyStatus.AVAILABLE,
      address: {
        street: "48 Maple Court",
        city: "Austin",
        state: "TX",
        zipCode: "78702",
        country: "United States",
      },
      yearBuilt: 2016,
      images: [
        "https://picsum.photos/seed/maple-court-property-1/1400/900",
        "https://picsum.photos/seed/maple-court-property-2/1400/900",
      ],
      amenities: [
        { name: "Attached Garage", category: "Stationnement" },
        { name: "Private Patio", category: "Outdoor" },
        { name: "Smart Thermostat", category: "Climate" },
      ],
      units: [
        {
          unitNumber: "T1",
          unitType: "room",
          floor: 1,
          bedrooms: 3,
          bathrooms: 2.5,
          squareFootage: 1680,
          rentAmount: 2800,
          securityDeposit: 2800,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/maple-court-t1/1200/800"],
          patio: true,
          garden: true,
          dishwasher: true,
          inUnitLaundry: true,
          parking: { included: true, spaces: 2, type: "garage" },
        },
        {
          unitNumber: "T2",
          unitType: "room",
          floor: 1,
          bedrooms: 3,
          bathrooms: 2.5,
          squareFootage: 1725,
          rentAmount: 2925,
          securityDeposit: 2925,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/maple-court-t2/1200/800"],
          patio: true,
          dishwasher: true,
          inUnitLaundry: true,
          parking: { included: true, spaces: 2, type: "garage" },
        },
        {
          unitNumber: "T3",
          unitType: "room",
          floor: 1,
          bedrooms: 2,
          bathrooms: 2,
          squareFootage: 1390,
          rentAmount: 2400,
          securityDeposit: 2400,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/maple-court-t3/1200/800"],
          patio: true,
          dishwasher: true,
          centralAir: true,
          parking: { included: true, spaces: 1, type: "garage" },
        },
      ],
      ownerId: admin._id,
      managerId: manager._id,
    },
    {
      name: "Cedar Ridge Lofts",
      description:
        "Converted loft property near transit with open layouts and flexible work-from-home spaces.",
      type: PropertyType.CONDO,
      status: PropertyStatus.AVAILABLE,
      address: {
        street: "900 Cedar Ridge Blvd",
        city: "Denver",
        state: "CO",
        zipCode: "80202",
        country: "United States",
      },
      yearBuilt: 2020,
      images: [
        "https://picsum.photos/seed/cedar-ridge-property-1/1400/900",
        "https://picsum.photos/seed/cedar-ridge-property-2/1400/900",
      ],
      amenities: [
        { name: "Coworking Lounge", category: "Living" },
        { name: "Fitness Studio", category: "Recreation" },
        { name: "EV Charging", category: "Stationnement" },
      ],
      units: [
        {
          unitNumber: "L1",
          unitType: "loft",
          floor: 1,
          bedrooms: 1,
          bathrooms: 1,
          squareFootage: 840,
          rentAmount: 2100,
          securityDeposit: 2100,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/cedar-ridge-l1/1200/800"],
          hardwoodFloors: true,
          centralAir: true,
          parking: { included: true, spaces: 1, type: "open" },
        },
        {
          unitNumber: "L2",
          unitType: "loft",
          floor: 2,
          bedrooms: 2,
          bathrooms: 2,
          squareFootage: 1180,
          rentAmount: 2700,
          securityDeposit: 2700,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/cedar-ridge-l2/1200/800"],
          balcony: true,
          dishwasher: true,
          inUnitLaundry: true,
        },
        {
          unitNumber: "L3",
          unitType: "studio",
          floor: 3,
          bedrooms: 0,
          bathrooms: 1,
          squareFootage: 560,
          rentAmount: 1550,
          securityDeposit: 1550,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/cedar-ridge-l3/1200/800"],
          centralAir: true,
          appliances: {
            refrigerator: true,
            stove: true,
            oven: true,
            microwave: true,
          },
        },
      ],
      ownerId: admin._id,
      managerId: manager._id,
    },
    {
      name: "Sunset Villas",
      description:
        "Garden-style homes with spacious layouts, fenced yards, and quiet walking paths.",
      type: PropertyType.HOUSE,
      status: PropertyStatus.AVAILABLE,
      address: {
        street: "410 Sunset Villas Drive",
        city: "Phoenix",
        state: "AZ",
        zipCode: "85004",
        country: "United States",
      },
      yearBuilt: 2014,
      images: [
        "https://picsum.photos/seed/sunset-villas-property-1/1400/900",
        "https://picsum.photos/seed/sunset-villas-property-2/1400/900",
      ],
      amenities: [
        { name: "Community Greenway", category: "Outdoor" },
        { name: "Pet Relief Area", category: "Outdoor" },
        { name: "Covered Parking", category: "Stationnement" },
      ],
      units: [
        {
          unitNumber: "H1",
          unitType: "room",
          floor: 1,
          bedrooms: 3,
          bathrooms: 2,
          squareFootage: 1540,
          rentAmount: 2650,
          securityDeposit: 2650,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/sunset-villas-h1/1200/800"],
          patio: true,
          garden: true,
          inUnitLaundry: true,
          parking: { included: true, spaces: 2, type: "covered" },
        },
        {
          unitNumber: "H2",
          unitType: "room",
          floor: 1,
          bedrooms: 4,
          bathrooms: 2.5,
          squareFootage: 1780,
          rentAmount: 3050,
          securityDeposit: 3050,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/sunset-villas-h2/1200/800"],
          patio: true,
          dishwasher: true,
          centralAir: true,
          parking: { included: true, spaces: 2, type: "covered" },
        },
      ],
      ownerId: admin._id,
      managerId: manager._id,
    },
    {
      name: "Oakline Residences",
      description:
        "Mid-rise apartment community with coworking nooks and an updated fitness room.",
      type: PropertyType.APARTMENT,
      status: PropertyStatus.AVAILABLE,
      address: {
        street: "275 Oakline Street",
        city: "Portland",
        state: "OR",
        zipCode: "97205",
        country: "United States",
      },
      yearBuilt: 2019,
      images: [
        "https://picsum.photos/seed/oakline-residences-property-1/1400/900",
        "https://picsum.photos/seed/oakline-residences-property-2/1400/900",
      ],
      amenities: [
        { name: "Coworking Pods", category: "Living" },
        { name: "Fitness Room", category: "Recreation" },
        { name: "Secure Entry", category: "Sécurité" },
      ],
      units: [
        {
          unitNumber: "O101",
          unitType: "apartment",
          floor: 1,
          bedrooms: 1,
          bathrooms: 1,
          squareFootage: 690,
          rentAmount: 1725,
          securityDeposit: 1725,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/oakline-residences-o101/1200/800"],
          dishwasher: true,
          inUnitLaundry: true,
          centralAir: true,
        },
        {
          unitNumber: "O204",
          unitType: "apartment",
          floor: 2,
          bedrooms: 2,
          bathrooms: 2,
          squareFootage: 980,
          rentAmount: 2295,
          securityDeposit: 2295,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/oakline-residences-o204/1200/800"],
          balcony: true,
          dishwasher: true,
          inUnitLaundry: true,
        },
        {
          unitNumber: "O305",
          unitType: "studio",
          floor: 3,
          bedrooms: 0,
          bathrooms: 1,
          squareFootage: 520,
          rentAmount: 1495,
          securityDeposit: 1495,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/oakline-residences-o305/1200/800"],
          centralAir: true,
        },
      ],
      ownerId: admin._id,
      managerId: manager._id,
    },
    {
      name: "Pinecrest Commons",
      description:
        "Family-friendly townhouse cluster near schools with shared courtyards and storage.",
      type: PropertyType.TOWNHOUSE,
      status: PropertyStatus.AVAILABLE,
      address: {
        street: "88 Pinecrest Lane",
        city: "Charlotte",
        state: "NC",
        zipCode: "28202",
        country: "United States",
      },
      yearBuilt: 2015,
      images: [
        "https://picsum.photos/seed/pinecrest-commons-property-1/1400/900",
        "https://picsum.photos/seed/pinecrest-commons-property-2/1400/900",
      ],
      amenities: [
        { name: "Shared Courtyard", category: "Outdoor" },
        { name: "Resident Storage", category: "Living" },
        { name: "Guest Parking", category: "Stationnement" },
      ],
      units: [
        {
          unitNumber: "P1",
          unitType: "room",
          floor: 1,
          bedrooms: 3,
          bathrooms: 2.5,
          squareFootage: 1610,
          rentAmount: 2480,
          securityDeposit: 2480,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/pinecrest-commons-p1/1200/800"],
          patio: true,
          dishwasher: true,
          inUnitLaundry: true,
          parking: { included: true, spaces: 2, type: "open" },
        },
        {
          unitNumber: "P2",
          unitType: "room",
          floor: 1,
          bedrooms: 2,
          bathrooms: 2,
          squareFootage: 1375,
          rentAmount: 2190,
          securityDeposit: 2190,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/pinecrest-commons-p2/1200/800"],
          patio: true,
          centralAir: true,
          parking: { included: true, spaces: 1, type: "open" },
        },
      ],
      ownerId: admin._id,
      managerId: manager._id,
    },
    {
      name: "Lakeview Condominiums",
      description:
        "Contemporary condos with large windows, lake views, and a resident club room.",
      type: PropertyType.CONDO,
      status: PropertyStatus.AVAILABLE,
      address: {
        street: "620 Lakeview Boulevard",
        city: "Chicago",
        state: "IL",
        zipCode: "60611",
        country: "United States",
      },
      yearBuilt: 2021,
      images: [
        "https://picsum.photos/seed/lakeview-condominiums-property-1/1400/900",
        "https://picsum.photos/seed/lakeview-condominiums-property-2/1400/900",
      ],
      amenities: [
        { name: "Resident Club Room", category: "Living" },
        { name: "Secured Parking", category: "Stationnement" },
        { name: "Parcel Lockers", category: "Sécurité" },
      ],
      units: [
        {
          unitNumber: "C12",
          unitType: "apartment",
          floor: 1,
          bedrooms: 1,
          bathrooms: 1,
          squareFootage: 745,
          rentAmount: 2050,
          securityDeposit: 2050,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/lakeview-condominiums-c12/1200/800"],
          dishwasher: true,
          inUnitLaundry: true,
          centralAir: true,
        },
        {
          unitNumber: "C24",
          unitType: "apartment",
          floor: 2,
          bedrooms: 2,
          bathrooms: 2,
          squareFootage: 1090,
          rentAmount: 2780,
          securityDeposit: 2780,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/lakeview-condominiums-c24/1200/800"],
          balcony: true,
          dishwasher: true,
          inUnitLaundry: true,
        },
      ],
      ownerId: admin._id,
      managerId: manager._id,
    },
    {
      name: "Rivergate Flats",
      description:
        "Urban apartment building near transit with modern finishes and flexible lease options.",
      type: PropertyType.APARTMENT,
      status: PropertyStatus.AVAILABLE,
      address: {
        street: "150 Rivergate Avenue",
        city: "Nashville",
        state: "TN",
        zipCode: "37203",
        country: "United States",
      },
      yearBuilt: 2017,
      images: [
        "https://picsum.photos/seed/rivergate-flats-property-1/1400/900",
        "https://picsum.photos/seed/rivergate-flats-property-2/1400/900",
      ],
      amenities: [
        { name: "Transit Shuttle Stop", category: "Autre" },
        { name: "Outdoor Lounge", category: "Recreation" },
        { name: "Package Lockers", category: "Sécurité" },
      ],
      units: [
        {
          unitNumber: "R110",
          unitType: "apartment",
          floor: 1,
          bedrooms: 1,
          bathrooms: 1,
          squareFootage: 710,
          rentAmount: 1690,
          securityDeposit: 1690,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/rivergate-flats-r110/1200/800"],
          dishwasher: true,
          centralAir: true,
        },
        {
          unitNumber: "R220",
          unitType: "apartment",
          floor: 2,
          bedrooms: 2,
          bathrooms: 2,
          squareFootage: 1015,
          rentAmount: 2140,
          securityDeposit: 2140,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/rivergate-flats-r220/1200/800"],
          balcony: true,
          inUnitLaundry: true,
          centralAir: true,
        },
        {
          unitNumber: "R330",
          unitType: "studio",
          floor: 3,
          bedrooms: 0,
          bathrooms: 1,
          squareFootage: 505,
          rentAmount: 1325,
          securityDeposit: 1325,
          status: PropertyStatus.AVAILABLE,
          images: ["https://picsum.photos/seed/rivergate-flats-r330/1200/800"],
          centralAir: true,
        },
      ],
      ownerId: admin._id,
      managerId: manager._id,
    },
  ]);

  return Object.fromEntries(
    properties.map((property: any) => [property.name, property]),
  );
}

async function createTenantProfiles(
  users: Record<string, any>,
  leaseStart: Date,
) {
  const profiles = await Tenant.create([
    {
      userId: users["tenant@propertypro.com"]._id,
      dateOfBirth: new Date("1992-05-12"),
      employmentInfo: {
        employer: "Northstar Design",
        position: "Product Designer",
        income: 92000,
        startDate: new Date("2021-03-15"),
      },
      emergencyContacts: [
        {
          name: "Nora Reed",
          relationship: "Sister",
          phone: "+12065550111",
          email: "nora.reed@example.com",
        },
      ],
      creditScore: 742,
      backgroundCheckStatus: "approved",
      applicationDate: addMonths(leaseStart, -1),
      moveInDate: leaseStart,
    },
    {
      userId: users["liam.carter@example.com"]._id,
      dateOfBirth: new Date("1988-11-03"),
      employmentInfo: {
        employer: "Civic Health",
        position: "Operations Manager",
        income: 105000,
        startDate: new Date("2019-08-01"),
      },
      emergencyContacts: [
        {
          name: "Grace Carter",
          relationship: "Mother",
          phone: "+12065550113",
          email: "grace.carter@example.com",
        },
      ],
      creditScore: 718,
      backgroundCheckStatus: "approved",
      applicationDate: addMonths(leaseStart, -1),
      moveInDate: leaseStart,
    },
    {
      userId: users["sofia.martinez@example.com"]._id,
      dateOfBirth: new Date("1995-02-21"),
      employmentInfo: {
        employer: "Atlas Legal Group",
        position: "Paralegal",
        income: 78000,
        startDate: new Date("2020-10-12"),
      },
      emergencyContacts: [
        {
          name: "Carlos Martinez",
          relationship: "Father",
          phone: "+12065550115",
          email: "carlos.martinez@example.com",
        },
      ],
      creditScore: 781,
      backgroundCheckStatus: "approved",
      applicationDate: addMonths(leaseStart, -1),
      moveInDate: leaseStart,
    },
    {
      userId: users["noah.kim@example.com"]._id,
      dateOfBirth: new Date("1990-07-19"),
      employmentInfo: {
        employer: "Greenline Energy",
        position: "Field Engineer",
        income: 88000,
        startDate: new Date("2018-04-09"),
      },
      emergencyContacts: [
        {
          name: "Hana Kim",
          relationship: "Conjoint",
          phone: "+12065550117",
          email: "hana.kim@example.com",
        },
      ],
      creditScore: 696,
      backgroundCheckStatus: "approved",
      applicationDate: addMonths(leaseStart, -1),
      moveInDate: leaseStart,
    },
  ]);

  return Object.fromEntries(
    profiles.map((tenant: any) => [tenant.userId.toString(), tenant]),
  );
}

async function createApplications(
  users: Record<string, any>,
  properties: Record<string, any>,
) {
  const admin = users["admin@propertypro.com"];
  const harbor = properties["Harbor Heights Apartments"];
  const maple = properties["Maple Court Townhomes"];

  await Application.create([
    {
      propertyId: harbor._id,
      applicantId: users["maya.chen@example.com"]._id,
      status: ApplicationStatus.UNDER_REVIEW,
      applicationFee: {
        amount: 55,
        status: ApplicationFeeStatus.PAID,
        paymentMethod: "credit_card",
        transactionId: "APP-DEMO-1001",
        paidAt: new Date(),
      },
      personalInfo: {
        firstName: "Maya",
        lastName: "Chen",
        email: "maya.chen@example.com",
        phone: "+12065550120",
        dateOfBirth: new Date("1994-09-30"),
        ssn: "123-45-6789",
      },
      employmentInfo: {
        employer: "Peakline Software",
        position: "Customer Success Lead",
        income: 97000,
        startDate: new Date("2022-02-01"),
        employerContact: "hr@peakline.example.com",
      },
      emergencyContacts: [
        {
          name: "Victor Chen",
          relationship: "Brother",
          phone: "+12065550122",
          email: "victor.chen@example.com",
        },
      ],
      previousAddresses: [
        {
          address: "77 Pine St, Portland, OR 97204",
          landlordName: "Willow Homes",
          landlordContact: "leasing@willow.example.com",
          moveInDate: new Date("2021-06-01"),
          moveOutDate: new Date("2024-12-31"),
          reasonForLeaving: "Relocating for work",
        },
      ],
      documents: [
        {
          type: "id_verification",
          fileName: "maya-id.pdf",
          fileUrl: "/uploads/demo/maya-id.pdf",
          verified: true,
        },
      ],
      additionalInfo: {
        pets: "One indoor cat",
        vehicles: "One compact vehicle",
        reasonForMoving: "Closer to office",
      },
      submittedAt: addDays(new Date(), -4),
      reviewedAt: addDays(new Date(), -1),
      reviewedBy: admin._id,
      reviewNotes: "Employment verified. Awaiting final reference response.",
    },
    {
      propertyId: maple._id,
      applicantId: users["jordan.patel@example.com"]._id,
      status: ApplicationStatus.SUBMITTED,
      applicationFee: {
        amount: 55,
        status: ApplicationFeeStatus.PENDING,
      },
      personalInfo: {
        firstName: "Jordan",
        lastName: "Patel",
        email: "jordan.patel@example.com",
        phone: "+12065550121",
        dateOfBirth: new Date("1986-12-05"),
        ssn: "987-65-4321",
      },
      employmentInfo: {
        employer: "Blue Oak Logistics",
        position: "Finance Analyst",
        income: 84000,
        startDate: new Date("2020-01-15"),
        employerContact: "people@blueoak.example.com",
      },
      emergencyContacts: [
        {
          name: "Anika Patel",
          relationship: "Sister",
          phone: "+12065550123",
          email: "anika.patel@example.com",
        },
      ],
      previousAddresses: [
        {
          address: "410 Lake Dr, Austin, TX 78701",
          landlordName: "Lakeview Rentals",
          landlordContact: "manager@lakeview.example.com",
          moveInDate: new Date("2020-02-01"),
          moveOutDate: new Date("2025-01-31"),
          reasonForLeaving: "Needs more space",
        },
      ],
      documents: [],
      submittedAt: addDays(new Date(), -1),
    },
  ]);
}

async function createLeases(
  users: Record<string, any>,
  tenants: Record<string, any>,
  properties: Record<string, any>,
  leaseStart: Date,
  leaseEnd: Date,
) {
  const assignments = [
    {
      tenantUser: users["tenant@propertypro.com"],
      property: properties["Harbor Heights Apartments"],
      unitNumber: "A101",
    },
    {
      tenantUser: users["liam.carter@example.com"],
      property: properties["Harbor Heights Apartments"],
      unitNumber: "A102",
    },
    {
      tenantUser: users["sofia.martinez@example.com"],
      property: properties["Maple Court Townhomes"],
      unitNumber: "T1",
    },
    {
      tenantUser: users["noah.kim@example.com"],
      property: properties["Cedar Ridge Lofts"],
      unitNumber: "L1",
    },
  ];

  const leases = [];

  for (const assignment of assignments) {
    const unit = findUnit(assignment.property, assignment.unitNumber);
    const lease = await Lease.create({
      propertyId: assignment.property._id,
      unitId: unit._id,
      tenantId: assignment.tenantUser._id,
      startDate: leaseStart,
      endDate: leaseEnd,
      status: LeaseStatus.ACTIVE,
      paymentStatus: "current",
      terms: {
        rentAmount: unit.rentAmount,
        securityDeposit: unit.securityDeposit,
        lateFee: 75,
        utilities: ["water", "sewer", "trash"],
        restrictions: ["no_smoking"],
        paymentConfig: rentPaymentConfig(),
      },
      renewalOptions: {
        available: true,
        terms: "Eligible for twelve-month renewal after account review.",
      },
      notes: `Demo lease for unit ${assignment.unitNumber}.`,
    });

    await User.updateOne(
      { _id: assignment.tenantUser._id },
      {
        $set: {
          currentLeaseId: lease._id,
          moveInDate: leaseStart,
          tenantStatus: "active",
          lastStatusUpdate: new Date(),
        },
        $push: {
          leaseHistory: {
            leaseId: lease._id,
            startDate: leaseStart,
            status: "active",
          },
        },
      },
    );

    await Tenant.updateOne(
      { _id: tenants[assignment.tenantUser._id.toString()]._id },
      { $set: { moveInDate: leaseStart } },
    );

    leases.push({
      lease,
      property: assignment.property,
      tenantUser: assignment.tenantUser,
      unit,
    });
  }

  return leases;
}

async function createInvoiceAndPayment({
  lease,
  property,
  tenantUser,
  unit,
  category,
  dueDate,
  amount,
  description,
  paymentStatus,
  paymentMethod,
  amountPaid = 0,
}: {
  lease: any;
  property: any;
  tenantUser: any;
  unit: any;
  category: InvoiceType;
  dueDate: Date;
  amount: number;
  description: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
}) {
  const invoice = new Invoice({
    invoiceNumber: `INV-DEMO-${invoiceSequence++}`,
    tenantId: tenantUser._id,
    propertyId: property._id,
    leaseId: lease._id,
    unitId: unit._id,
    category,
    issueDate: addDays(dueDate, -10),
    dueDate,
    subtotal: amount,
    totalAmount: amount,
    amountPaid,
    lineItems: [
      {
        description,
        amount,
        type: category,
        quantity: 1,
        unitPrice: amount,
        dueDate,
      },
    ],
    notes: `Demo ${description.toLowerCase()} for ${property.name} ${unit.unitNumber}.`,
  });
  await invoice.save();

  const isPaidLike =
    paymentStatus === PaymentStatus.PAID ||
    paymentStatus === PaymentStatus.PARTIAL;
  const paymentCreatedAt = addDays(dueDate, -15);
  const paidDate = isPaidLike
    ? addDays(dueDate, paymentStatus === PaymentStatus.PARTIAL ? 3 : 1)
    : undefined;

  const payment = new Payment({
    tenantId: tenantUser._id,
    propertyId: property._id,
    leaseId: lease._id,
    invoiceId: invoice._id,
    amount,
    amountPaid,
    type:
      category === InvoiceType.SECURITY_DEPOSIT
        ? PaymentType.SECURITY_DEPOSIT
        : PaymentType.RENT,
    status: paymentStatus,
    paymentMethod,
    dueDate,
    paidDate,
    createdAt: paymentCreatedAt,
    updatedAt: paidDate || paymentCreatedAt,
    description,
    paymentHistory:
      amountPaid > 0 && paymentMethod
        ? [
            {
              amount: amountPaid,
              paymentMethod,
              paidDate,
              transactionId: `TXN-DEMO-${transactionSequence++}`,
              notes: "Demo payment record",
            },
          ]
        : [],
    statusHistory: [
      {
        status: paymentStatus,
        changedAt: new Date(),
        changedBy: "demo-seed",
        reason: "Created by exact demo data seed",
      },
    ],
  });
  await payment.save();

  invoice.paymentIds = [payment._id];
  invoice.amountPaid = amountPaid;
  invoice.lastPaymentDate = paidDate;
  await invoice.save();

  if (paymentStatus === PaymentStatus.PAID) {
    await PaymentReceipt.create({
      paymentId: payment._id,
      tenantId: tenantUser._id,
      propertyId: property._id,
      receiptNumber: `RCP-DEMO-${receiptSequence++}`,
      amount,
      paymentMethod: paymentMethod || PaymentMethod.BANK_TRANSFER,
      transactionId: `TXN-DEMO-${transactionSequence++}`,
      paidDate: paidDate || new Date(),
      description,
      receiptData: {
        tenantName: `${tenantUser.firstName} ${tenantUser.lastName}`,
        propertyAddress: fullAddress(property),
        paymentDetails: {
          amount,
          type:
            category === InvoiceType.SECURITY_DEPOSIT
              ? "Dépôt de garantie"
              : "Loyer",
          dueDate,
          paidDate: paidDate || new Date(),
        },
        companyInfo,
      },
      emailSent: true,
      emailSentDate: new Date(),
    });
  }

  return { invoice, payment };
}

async function createFinancialData(
  leases: DemoContext["leases"],
  monthStart: Date,
) {
  const payments = [];
  const invoices = [];
  const notablePayments = [];

  for (let index = 0; index < leases.length; index++) {
    const leaseContext = leases[index];
    const deposit = await createInvoiceAndPayment({
      ...leaseContext,
      category: InvoiceType.SECURITY_DEPOSIT,
      dueDate: leaseContext.lease.startDate,
      amount: leaseContext.unit.securityDeposit,
      description: "Security deposit",
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amountPaid: leaseContext.unit.securityDeposit,
    });

    await SecurityDeposit.create({
      leaseId: leaseContext.lease._id,
      tenantId: leaseContext.tenantUser._id,
      propertyId: leaseContext.property._id,
      unitId: leaseContext.unit._id,
      amount: leaseContext.unit.securityDeposit,
      status: SecurityDepositStatus.COLLECTED,
      collectedDate: new Date(),
      collectedPaymentId: deposit.payment._id,
      notes: "Collected at lease signing in demo data.",
    });

    invoices.push(deposit.invoice);
    payments.push(deposit.payment);

    for (const monthOffset of [-2, -1, 0, 1]) {
      const dueDate = addMonths(monthStart, monthOffset);
      const description = `Monthly rent - ${monthLabel(dueDate)}`;
      let paymentStatus = PaymentStatus.PAID;
      let amountPaid = leaseContext.unit.rentAmount;
      let paymentMethod = PaymentMethod.BANK_TRANSFER;

      if (monthOffset === 0 && index === 0) {
        paymentStatus = PaymentStatus.OVERDUE;
        amountPaid = 0;
        paymentMethod = undefined as unknown as PaymentMethod;
      } else if (monthOffset === 0 && index === 1) {
        paymentStatus = PaymentStatus.PARTIAL;
        amountPaid = Math.round(leaseContext.unit.rentAmount / 2);
        paymentMethod = PaymentMethod.CREDIT_CARD;
      } else if (monthOffset === 1) {
        paymentStatus = PaymentStatus.PENDING;
        amountPaid = 0;
        paymentMethod = undefined as unknown as PaymentMethod;
      }

      const result = await createInvoiceAndPayment({
        ...leaseContext,
        category: InvoiceType.RENT,
        dueDate,
        amount: leaseContext.unit.rentAmount,
        description,
        paymentStatus,
        paymentMethod,
        amountPaid,
      });

      invoices.push(result.invoice);
      payments.push(result.payment);

      if (
        result.payment.status === PaymentStatus.OVERDUE ||
        (result.payment.status === PaymentStatus.PENDING && monthOffset === 1)
      ) {
        notablePayments.push(result.payment);
      }
    }

    await RecurringPayment.create({
      tenantId: leaseContext.tenantUser._id,
      propertyId: leaseContext.property._id,
      leaseId: leaseContext.lease._id,
      amount: leaseContext.unit.rentAmount,
      type: PaymentType.RENT,
      frequency: PaymentFrequency.MONTHLY,
      startDate: leaseContext.lease.startDate,
      endDate: leaseContext.lease.endDate,
      nextPaymentDate: addMonths(monthStart, 1),
      isActive: true,
      description: `Recurring rent for ${leaseContext.property.name} ${leaseContext.unit.unitNumber}`,
      totalPaymentsMade: 3,
      failedPaymentCount: 0,
    });
  }

  for (const payment of notablePayments.slice(0, 6)) {
    const tenantUser = await User.findById(payment.tenantId).lean();
    await PaymentNotification.create({
      tenantId: payment.tenantId,
      paymentId: payment._id,
      type: payment.status === PaymentStatus.OVERDUE ? "overdue" : "reminder",
      status: "pending",
      scheduledDate: new Date(),
      emailAddress: tenantUser?.email || "tenant@example.com",
      subject:
        payment.status === PaymentStatus.OVERDUE
          ? "Rent payment overdue"
          : "Upcoming rent reminder",
      message:
        payment.status === PaymentStatus.OVERDUE
          ? "Your rent payment is past due. Please submit payment from the tenant portal."
          : "Your next rent payment is coming due soon.",
    });
  }

  return { payments, invoices };
}

async function createOperationsData(
  users: Record<string, any>,
  tenants: Record<string, any>,
  leases: DemoContext["leases"],
) {
  const manager = users["manager@propertypro.com"];
  const maintenance = users["maintenance@propertypro.com"];
  const now = new Date();

  const requests = [];
  const requestDefinitions = [
    {
      leaseContext: leases[0],
      title: "Kitchen sink leak",
      description: "Water is dripping from the pipe under the kitchen sink.",
      priority: MaintenancePriority.HIGH,
      status: MaintenanceStatus.IN_PROGRESS,
      category: "Plumbing",
      estimatedCost: 220,
      assignedTo: maintenance._id,
      createdAt: addDays(now, -2),
      notes: "Technician ordered replacement trap assembly.",
    },
    {
      leaseContext: leases[1],
      title: "HVAC filter replacement",
      description: "Airflow has dropped and the filter indicator is red.",
      priority: MaintenancePriority.MEDIUM,
      status: MaintenanceStatus.ASSIGNED,
      category: "HVAC",
      estimatedCost: 90,
      assignedTo: maintenance._id,
      createdAt: addDays(now, -1),
    },
    {
      leaseContext: leases[2],
      title: "Garage door keypad battery",
      description: "The exterior keypad is not responding consistently.",
      priority: MaintenancePriority.LOW,
      status: MaintenanceStatus.COMPLETED,
      category: "Doors",
      estimatedCost: 45,
      actualCost: 38,
      assignedTo: maintenance._id,
      createdAt: addDays(now, -5),
      completedDate: addDays(now, -3),
      notes: "Battery replaced and keypad tested.",
    },
    {
      leaseContext: leases[3],
      title: "No hot water",
      description: "Hot water is unavailable in the bathroom and kitchen.",
      priority: MaintenancePriority.EMERGENCY,
      status: MaintenanceStatus.SUBMITTED,
      category: "Emergency",
      estimatedCost: 350,
      createdAt: now,
    },
    {
      leaseContext: leases[0],
      title: "Bedroom window seal",
      description: "Cold air is coming through the lower bedroom window.",
      priority: MaintenancePriority.MEDIUM,
      status: MaintenanceStatus.COMPLETED,
      category: "Windows",
      estimatedCost: 130,
      actualCost: 115,
      assignedTo: maintenance._id,
      createdAt: addDays(now, -6),
      completedDate: addDays(now, -4),
      notes: "Seal replaced and frame cleaned.",
    },
  ];

  for (const definition of requestDefinitions) {
    const request = await MaintenanceRequest.create({
      propertyId: definition.leaseContext.property._id,
      unitId: definition.leaseContext.unit._id,
      tenantId: definition.leaseContext.tenantUser._id,
      assignedTo: definition.assignedTo,
      title: definition.title,
      description: definition.description,
      priority: definition.priority,
      status: definition.status,
      category: definition.category,
      contactPhone: definition.leaseContext.tenantUser.phone,
      estimatedCost: definition.estimatedCost,
      actualCost: definition.actualCost,
      completedDate: definition.completedDate,
      notes: definition.notes,
      createdAt: definition.createdAt,
      updatedAt: definition.completedDate || definition.createdAt,
    });
    requests.push(request);
  }

  await WorkOrder.create([
    {
      maintenanceRequestId: requests[0]._id,
      assignedTo: maintenance._id,
      title: "Repair sink trap assembly",
      description: "Replace trap assembly and test for leaks.",
      status: WorkOrderStatus.IN_PROGRESS,
      priority: MaintenancePriority.HIGH,
      estimatedCost: 220,
      scheduledDate: addDays(new Date(), 1),
      materials: ["Trap assembly", "Plumber putty"],
      laborHours: 1.5,
    },
    {
      maintenanceRequestId: requests[1]._id,
      assignedTo: maintenance._id,
      title: "Replace HVAC filter",
      description: "Install new MERV 11 filter and inspect air handler.",
      status: WorkOrderStatus.ASSIGNED,
      priority: MaintenancePriority.MEDIUM,
      estimatedCost: 90,
      scheduledDate: addDays(new Date(), 2),
      materials: ["20x25x1 filter"],
      laborHours: 0.75,
    },
    {
      maintenanceRequestId: requests[2]._id,
      assignedTo: maintenance._id,
      title: "Replace keypad battery",
      description: "Replace battery and verify garage door keypad.",
      status: WorkOrderStatus.COMPLETED,
      priority: MaintenancePriority.LOW,
      estimatedCost: 45,
      actualCost: 38,
      scheduledDate: new Date(),
      completedDate: new Date(Date.now() + 120000),
      materials: ["9V battery"],
      laborHours: 0.25,
    },
  ]);

  await Ticket.create([
    {
      ticketNumber: await nextTicketNumber(),
      tenantId: leases[0].tenantUser._id,
      propertyId: leases[0].property._id,
      unitId: leases[0].unit._id,
      assignedTo: manager._id,
      createdBy: { userId: leases[0].tenantUser._id, role: UserRole.TENANT },
      title: "Question about renter insurance upload",
      description: "I uploaded the policy but still see a reminder.",
      category: TicketCategory.GENERAL,
      priority: TicketPriority.MEDIUM,
      status: TicketStatus.OPEN,
      comments: [
        {
          userId: manager._id,
          message: "We are checking the document status now.",
          isInternal: false,
        },
      ],
    },
    {
      ticketNumber: await nextTicketNumber(),
      tenantId: leases[1].tenantUser._id,
      propertyId: leases[1].property._id,
      unitId: leases[1].unit._id,
      assignedTo: manager._id,
      createdBy: { userId: leases[1].tenantUser._id, role: UserRole.TENANT },
      title: "Partial payment plan",
      description: "Please confirm the remaining balance due date.",
      category: TicketCategory.BILLING,
      priority: TicketPriority.HIGH,
      status: TicketStatus.IN_PROGRESS,
    },
    {
      ticketNumber: await nextTicketNumber(),
      tenantId: leases[2].tenantUser._id,
      propertyId: leases[2].property._id,
      unitId: leases[2].unit._id,
      createdBy: { userId: leases[2].tenantUser._id, role: UserRole.TENANT },
      title: "Neighbor parking question",
      description: "A guest vehicle has been parked in front of my garage.",
      category: TicketCategory.GENERAL,
      priority: TicketPriority.LOW,
      status: TicketStatus.RESOLVED,
    },
  ]);

  await Expense.create([
    {
      propertyId: leases[0].property._id,
      unitId: leases[0].unit._id,
      category: ExpenseCategory.MAINTENANCE,
      description: "Plumbing parts for Harbor Heights A101",
      amount: 86.45,
      date: addDays(new Date(), -3),
      paymentMethod: PaymentMethod.CREDIT_CARD,
      referenceNumber: "EXP-DEMO-PLUMBING",
      status: ExpenseStatus.PAID,
      taxDeductible: true,
      createdBy: manager._id,
    },
    {
      propertyId: leases[1].property._id,
      category: ExpenseCategory.UTILITIES,
      description: "Common area electric bill",
      amount: 410.22,
      date: addDays(new Date(), -7),
      paymentMethod: PaymentMethod.ACH,
      referenceNumber: "EXP-DEMO-ELECTRIC",
      status: ExpenseStatus.PAID,
      taxDeductible: true,
      createdBy: manager._id,
    },
    {
      propertyId: leases[2].property._id,
      category: ExpenseCategory.LANDSCAPING,
      description: "Courtyard spring cleanup",
      amount: 675,
      date: addDays(new Date(), -12),
      paymentMethod: PaymentMethod.CHECK,
      referenceNumber: "EXP-DEMO-LAWN",
      status: ExpenseStatus.APPROVED,
      taxDeductible: true,
      createdBy: manager._id,
    },
  ]);

  await Inspection.create([
    {
      propertyId: leases[0].property._id,
      tenantId: tenants[leases[0].tenantUser._id.toString()]._id,
      leaseId: leases[0].lease._id,
      type: InspectionType.MOVE_IN,
      status: "completed",
      scheduledDate: new Date(Date.now() + 120000),
      completedDate: new Date(Date.now() + 180000),
      inspectorId: manager._id,
      overallCondition: "good",
      items: [
        {
          room: "Kitchen",
          item: "Appliances",
          condition: "good",
          notes: "All appliances operational.",
          requiresAttention: false,
        },
        {
          room: "Bedroom",
          item: "Window seal",
          condition: "fair",
          notes: "Seal later replaced through maintenance.",
          requiresAttention: true,
        },
      ],
      inspectorSignature: {
        signature: "demo-inspector-signature",
      },
    },
    {
      propertyId: leases[2].property._id,
      tenantId: tenants[leases[2].tenantUser._id.toString()]._id,
      leaseId: leases[2].lease._id,
      type: InspectionType.ROUTINE,
      status: "scheduled",
      scheduledDate: addDays(new Date(), 14),
      inspectorId: manager._id,
      items: [],
    },
  ]);

  return requests;
}

async function createDocumentsAndTemplates(
  users: Record<string, any>,
  tenants: Record<string, any>,
  leases: DemoContext["leases"],
) {
  const admin = users["admin@propertypro.com"];

  await DocumentTemplate.create([
    {
      name: "Standard Residential Lease",
      description:
        "Demo lease template with tenant, property, and payment variables.",
      category: "lease",
      type: "residential_lease",
      version: "1.0.0",
      content:
        "This lease is between {{company_name}} and {{tenant_name}} for {{property_address}}.",
      variables: [
        {
          name: "tenant_name",
          label: "Tenant Name",
          type: "text",
          required: true,
        },
        {
          name: "property_address",
          label: "Property Address",
          type: "text",
          required: true,
        },
      ],
      createdBy: admin._id,
      isPublic: true,
      allowedRoles: [UserRole.ADMIN, UserRole.MANAGER],
      status: "active",
    },
    {
      name: "Maintenance Notice",
      description: "Short notice template for scheduled property work.",
      category: "notice",
      type: "maintenance_notice",
      version: "1.0.0",
      content:
        "Maintenance is scheduled for {{scheduled_date}} at {{property_name}}.",
      createdBy: admin._id,
      isPublic: true,
      allowedRoles: [UserRole.ADMIN, UserRole.MANAGER],
      status: "active",
    },
  ]);

  await Document.create([
    {
      name: "Emma Reed Lease Agreement",
      description: "Signed demo lease agreement.",
      type: "lease",
      category: "lease",
      fileUrl: "/uploads/demo/emma-lease.pdf",
      fileSize: 245760,
      mimeType: "application/pdf",
      uploadedBy: admin._id,
      tenantId: tenants[leases[0].tenantUser._id.toString()]._id,
      propertyId: leases[0].property._id,
      leaseId: leases[0].lease._id,
      sharedWith: [leases[0].tenantUser._id],
      tags: ["lease", "signed", "demo"],
      status: "signed",
      isRequired: true,
      requiresSignature: false,
      versions: [
        {
          version: 1,
          fileUrl: "/uploads/demo/emma-lease.pdf",
          fileSize: 245760,
          uploadedBy: admin._id,
          changeLog: "Initial signed lease.",
        },
      ],
      sharing: {
        isPublic: false,
        allowDownload: true,
        allowPrint: true,
        passwordProtected: false,
        currentDownloads: 0,
      },
      metadata: {
        author: "PropertyPro Demo",
        keywords: ["lease"],
        language: "en",
      },
      encryption: { isEncrypted: false },
      compliance: { legalHold: false, retentionPeriod: 2555 },
    },
    {
      name: "Harbor Heights Insurance Certificate",
      description: "Property insurance proof for the demo portfolio.",
      type: "insurance",
      category: "insurance",
      fileUrl: "/uploads/demo/harbor-insurance.pdf",
      fileSize: 180224,
      mimeType: "application/pdf",
      uploadedBy: admin._id,
      propertyId: leases[0].property._id,
      tags: ["insurance", "property"],
      status: "active",
      isRequired: false,
      requiresSignature: false,
      sharing: {
        isPublic: false,
        allowDownload: true,
        allowPrint: true,
        passwordProtected: false,
        currentDownloads: 0,
      },
      metadata: {
        author: "PropertyPro Demo",
        keywords: ["insurance"],
        language: "en",
      },
      encryption: { isEncrypted: false },
      compliance: { legalHold: false },
    },
    {
      name: "Maple Court Move-In Checklist",
      description: "Move-in condition checklist for the townhome demo lease.",
      type: "inspection",
      category: "lease",
      fileUrl: "/uploads/demo/maple-move-in.pdf",
      fileSize: 132096,
      mimeType: "application/pdf",
      uploadedBy: admin._id,
      tenantId: tenants[leases[2].tenantUser._id.toString()]._id,
      propertyId: leases[2].property._id,
      leaseId: leases[2].lease._id,
      sharedWith: [leases[2].tenantUser._id],
      tags: ["inspection", "move-in"],
      status: "active",
      isRequired: true,
      requiresSignature: false,
      sharing: {
        isPublic: false,
        allowDownload: true,
        allowPrint: true,
        passwordProtected: false,
        currentDownloads: 0,
      },
      metadata: {
        author: "PropertyPro Demo",
        keywords: ["inspection"],
        language: "en",
      },
      encryption: { isEncrypted: false },
      compliance: { legalHold: false },
    },
  ]);
}

async function createMessagingData(
  users: Record<string, any>,
  leases: DemoContext["leases"],
) {
  const manager = users["manager@propertypro.com"];
  const messages = [];

  for (const leaseContext of leases) {
    const conversation = await (
      Conversation as any
    ).createIndividualConversation(
      manager._id.toString(),
      leaseContext.tenantUser._id.toString(),
      leaseContext.property._id.toString(),
    );
    await conversation.save();

    const first = await Message.create({
      conversationId: conversation._id,
      senderId: manager._id,
      recipientId: leaseContext.tenantUser._id,
      propertyId: leaseContext.property._id,
      subject: "Welcome to your tenant portal",
      content:
        "Welcome. You can view your lease, pay rent, upload documents, and submit maintenance requests here.",
      messageType: "general",
      priority: "normal",
      status: "read",
      readBy: [
        {
          userId: leaseContext.tenantUser._id,
          readAt: new Date(),
        },
      ],
    });

    const second = await Message.create({
      conversationId: conversation._id,
      senderId: leaseContext.tenantUser._id,
      recipientId: manager._id,
      propertyId: leaseContext.property._id,
      subject: "Re: Welcome to your tenant portal",
      content: "Thanks. I found the rent payment page and lease documents.",
      messageType: "general",
      priority: "normal",
      status: "delivered",
    });

    await MessageStatus.create({
      messageId: first._id,
      conversationId: conversation._id.toString(),
      senderId: manager._id,
      recipientId: leaseContext.tenantUser._id,
      status: "read",
      deliveredAt: new Date(),
      readAt: new Date(),
    });

    await MessageStatus.create({
      messageId: second._id,
      conversationId: conversation._id.toString(),
      senderId: leaseContext.tenantUser._id,
      recipientId: manager._id,
      status: "delivered",
      deliveredAt: new Date(),
    });

    messages.push(first, second);
  }

  return messages;
}

async function createCalendarAndCommunications(
  users: Record<string, any>,
  leases: DemoContext["leases"],
  maintenanceRequests: any[],
) {
  const admin = users["admin@propertypro.com"];
  const manager = users["manager@propertypro.com"];

  await Event.create([
    {
      title: "Harbor Heights Routine Inspection",
      description: "Quarterly inspection for common areas and selected units.",
      type: EventType.PROPERTY_INSPECTION,
      status: EventStatus.SCHEDULED,
      priority: EventPriority.MEDIUM,
      startDate: addDays(new Date(), 7),
      endDate: addDays(new Date(), 7),
      allDay: false,
      timezone: "America/Los_Angeles",
      location: {
        type: LocationType.PHYSICAL,
        address: fullAddress(leases[0].property),
      },
      propertyId: leases[0].property._id,
      organizer: manager._id,
      attendees: [
        {
          userId: leases[0].tenantUser._id,
          email: leases[0].tenantUser.email,
          name: `${leases[0].tenantUser.firstName} ${leases[0].tenantUser.lastName}`,
          role: UserRole.TENANT,
          status: "accepted",
        },
      ],
      reminders: [{ type: "email", minutesBefore: 1440, sent: false }],
      createdBy: manager._id,
    },
    {
      title: "Maple Court Lease Check-In",
      description: "Mid-term tenant satisfaction check-in.",
      type: EventType.TENANT_MEETING,
      status: EventStatus.CONFIRMED,
      priority: EventPriority.LOW,
      startDate: addDays(new Date(), 10),
      endDate: addDays(new Date(), 10),
      allDay: false,
      timezone: "America/Chicago",
      location: {
        type: LocationType.PHYSICAL,
        address: fullAddress(leases[2].property),
      },
      propertyId: leases[2].property._id,
      leaseId: leases[2].lease._id,
      organizer: manager._id,
      attendees: [
        {
          userId: leases[2].tenantUser._id,
          email: leases[2].tenantUser.email,
          name: `${leases[2].tenantUser.firstName} ${leases[2].tenantUser.lastName}`,
          role: UserRole.TENANT,
          status: "pending",
        },
      ],
      reminders: [{ type: "in_app", minutesBefore: 120, sent: false }],
      createdBy: manager._id,
    },
    {
      title: "Kitchen Sink Repair Appointment",
      description: "Technician visit for A101 sink repair.",
      type: EventType.MAINTENANCE_APPOINTMENT,
      status: EventStatus.SCHEDULED,
      priority: EventPriority.HIGH,
      startDate: addDays(new Date(), 1),
      endDate: addDays(new Date(), 1),
      allDay: false,
      timezone: "America/Los_Angeles",
      propertyId: leases[0].property._id,
      leaseId: leases[0].lease._id,
      maintenanceRequestId: maintenanceRequests[0]._id,
      organizer: manager._id,
      attendees: [],
      reminders: [{ type: "email", minutesBefore: 60, sent: false }],
      createdBy: manager._id,
    },
  ]);

  await Announcement.create([
    {
      title: "Welcome to the PropertyPro Demo",
      content:
        "This demo contains realistic properties, leases, payments, maintenance requests, documents, messages, and reports.",
      priority: "normal",
      type: "general",
      targetAudience: { includeAll: true },
      publishedAt: new Date(),
      status: "published",
      isSticky: true,
      allowComments: true,
      createdBy: admin._id,
      views: [
        { userId: manager._id, viewedAt: new Date() },
        { userId: leases[0].tenantUser._id, viewedAt: new Date() },
      ],
      reactions: [
        { userId: manager._id, type: "helpful", createdAt: new Date() },
      ],
    },
    {
      title: "Harbor Heights Water Shutoff",
      content:
        "Water service in Harbor Heights will be unavailable next Saturday from 9 AM to noon for planned maintenance.",
      priority: "high",
      type: "maintenance",
      targetAudience: {
        propertyIds: [leases[0].property._id],
        includeAll: false,
      },
      publishedAt: new Date(),
      expiresAt: addDays(new Date(), 14),
      status: "published",
      isSticky: false,
      allowComments: true,
      createdBy: admin._id,
    },
    {
      title: "Updated Parking Policy",
      content:
        "Guest parking permits must be requested through the tenant portal before overnight stays.",
      priority: "normal",
      type: "policy",
      targetAudience: { roles: [UserRole.TENANT], includeAll: false },
      publishedAt: new Date(),
      status: "published",
      isSticky: false,
      allowComments: false,
      createdBy: admin._id,
    },
  ]);

  const notifications = leases.flatMap((leaseContext) => [
    {
      userId: leaseContext.tenantUser._id,
      title: "Rent reminder",
      message: "Your next rent invoice is available in the tenant portal.",
      type: "payment",
      priority: "normal",
      read: false,
      actionUrl: "/dashboard/payments",
      metadata: { leaseId: leaseContext.lease._id.toString() },
    },
    {
      userId: leaseContext.tenantUser._id,
      title: "Lease document ready",
      message: "A lease document is available for review.",
      type: "document",
      priority: "medium",
      read: leaseContext !== leases[0],
      readAt: leaseContext !== leases[0] ? new Date() : null,
      actionUrl: "/dashboard/leases/documents",
      metadata: { propertyId: leaseContext.property._id.toString() },
    },
  ]);

  await Notification.create([
    ...notifications,
    {
      userId: manager._id,
      title: "Maintenance queue updated",
      message: "There are active demo maintenance requests assigned today.",
      type: "maintenance",
      priority: "high",
      read: false,
      actionUrl: "/dashboard/maintenance",
    },
  ]);
}

async function createAuditLogs(
  users: Record<string, any>,
  leases: DemoContext["leases"],
) {
  const admin = users["admin@propertypro.com"];
  const manager = users["manager@propertypro.com"];

  await AuditLog.create([
    {
      category: AuditCategory.AUTHENTICATION,
      action: AuditAction.LOGIN,
      severity: AuditSeverity.LOW,
      userId: admin._id,
      userEmail: admin.email,
      userRole: admin.role,
      description: "Demo administrator signed in.",
      source: "web",
      tags: ["demo", "auth"],
    },
    {
      category: AuditCategory.PROPERTY_MANAGEMENT,
      action: AuditAction.CREATE,
      severity: AuditSeverity.MEDIUM,
      userId: manager._id,
      userEmail: manager.email,
      userRole: manager.role,
      resourceType: "property",
      resourceId: leases[0].property._id,
      resourceName: leases[0].property.name,
      description: "Demo property portfolio created.",
      source: "system",
      tags: ["demo", "property"],
    },
    {
      category: AuditCategory.PAYMENT_MANAGEMENT,
      action: AuditAction.PAYMENT_PROCESSED,
      severity: AuditSeverity.LOW,
      userId: leases[0].tenantUser._id,
      userEmail: leases[0].tenantUser.email,
      userRole: leases[0].tenantUser.role,
      resourceType: "payment",
      description: "Demo rent payment activity recorded.",
      source: "system",
      tags: ["demo", "payment"],
    },
  ]);
}

async function runSeed() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 9, 0, 0, 0);
  const leaseStart = addMonths(monthStart, -4);
  const leaseEnd = addMonths(leaseStart, 12);

  const { default: connectDB } = await import("@/lib/mongodb");
  await connectDB();
  await ensurePaymentIndexes();
  await assertDatabaseIsReadyForSeed();

  const users = await createUsers();
  await createRoles(users["admin@propertypro.com"]);

  const properties = await createProperties(users);
  const tenants = await createTenantProfiles(users, leaseStart);
  await createApplications(users, properties);

  const leases = await createLeases(
    users,
    tenants,
    properties,
    leaseStart,
    leaseEnd,
  );

  const { payments, invoices } = await createFinancialData(leases, monthStart);
  const maintenanceRequests = await createOperationsData(
    users,
    tenants,
    leases,
  );
  await createDocumentsAndTemplates(users, tenants, leases);
  const messages = await createMessagingData(users, leases);
  await createCalendarAndCommunications(users, leases, maintenanceRequests);
  await createAuditLogs(users, leases);

  const systemSettings = await SystemSettingsService.getSettings();
  await migrationHelpers.initializeSystemConfig();

  return {
    users: await User.countDocuments({}),
    roles: await Role.countDocuments({}),
    properties: await Property.countDocuments({}),
    embeddedUnits: Object.values(properties).reduce(
      (sum: number, property: any) => sum + property.units.length,
      0,
    ),
    tenantProfiles: await Tenant.countDocuments({}),
    applications: await Application.countDocuments({}),
    leases: await Lease.countDocuments({}),
    invoices: invoices.length,
    payments: payments.length,
    paymentReceipts: await PaymentReceipt.countDocuments({}),
    paymentNotifications: await PaymentNotification.countDocuments({}),
    recurringPayments: await RecurringPayment.countDocuments({}),
    securityDeposits: await SecurityDeposit.countDocuments({}),
    maintenanceRequests: maintenanceRequests.length,
    workOrders: await WorkOrder.countDocuments({}),
    tickets: await Ticket.countDocuments({}),
    expenses: await Expense.countDocuments({}),
    inspections: await Inspection.countDocuments({}),
    documents: await Document.countDocuments({}),
    documentTemplates: await DocumentTemplate.countDocuments({}),
    conversations: await Conversation.countDocuments({}),
    messages: messages.length,
    messageStatuses: await MessageStatus.countDocuments({}),
    notifications: await Notification.countDocuments({}),
    events: await Event.countDocuments({}),
    announcements: await Announcement.countDocuments({}),
    auditLogs: await AuditLog.countDocuments({}),
    systemSettings: systemSettings?._id?.toString() || null,
    demoAccounts: {
      admin: "admin@propertypro.com / Admin123$",
      manager: "manager@propertypro.com / Manager123$",
      maintenance: "maintenance@propertypro.com / Maintenance123$",
      tenant: "tenant@propertypro.com / Tenant123$",
      applicant: "maya.chen@example.com / Applicant123$",
    },
  };
}

if (process.env.PROPERTYPRO_SCRIPT_IMPORT_ONLY !== "true") {
  runSeed()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error) => {
      console.error("Demo seed failed:", error?.message || error);
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.connection.close().catch(() => undefined);
    });
}
