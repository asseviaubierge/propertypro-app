/**
 * PropertyPro - Demo Accounts Seed Script
 * Creates demo accounts for testing and demonstration purposes
 *
 * Usage: npm run seed:demo
 */

// IMPORTANT: Load environment variables FIRST before any other imports
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Now import other modules after env is loaded
import mongoose from "mongoose";
import User from "../models/User";

const DEMO_ACCOUNTS = [
  {
    email: "admin@propertypro.com",
    password: "Admin123$",
    firstName: "Super",
    lastName: "Admin",
    role: "admin",
    phone: "+1234567890",
    isActive: true,
    emailVerified: new Date(),
  },
  {
    email: "manager@propertypro.com",
    password: "Manager123$",
    firstName: "Bien",
    lastName: "Manager",
    role: "manager",
    phone: "+1234567891",
    isActive: true,
    emailVerified: new Date(),
  },
  {
    email: "tenant@propertypro.com",
    password: "Tenant123$",
    firstName: "Demo",
    lastName: "Locataire",
    role: "tenant",
    phone: "+1234567892",
    isActive: true,
    emailVerified: new Date(),
    // Tenant-specific fields
    dateOfBirth: new Date("1990-01-01"),
    tenantStatus: "active",
    backgroundCheckStatus: "approved",
    creditScore: 720,
    employmentInfo: {
      employer: "Tech Corp",
      position: "Software Engineer",
      income: 75000,
      startDate: new Date("2020-01-01"),
    },
    emergencyContacts: [
      {
        name: "Contact d’urgence",
        relationship: "Family",
        phone: "+1234567893",
        email: "emergency@example.com",
      },
    ],
  },
] as const;

function redactMongoUri(uri: string | undefined): string {
  if (!uri) return "(not set)";
  const schemeSplitIndex = uri.indexOf("://");
  if (schemeSplitIndex === -1) return "(invalid uri)";
  const scheme = uri.slice(0, schemeSplitIndex + 3);
  const rest = uri.slice(schemeSplitIndex + 3);
  const firstSlashIndex = rest.indexOf("/");
  const authorityEndIndex =
    firstSlashIndex === -1 ? rest.length : firstSlashIndex;
  const atIndex = rest.lastIndexOf("@", authorityEndIndex);
  const sanitizedRest =
    atIndex === -1 ? rest : rest.slice(atIndex + 1, rest.length);
  return `${scheme}${sanitizedRest}`;
}

/**
 * Seed demo accounts
 */
async function seedDemoAccounts() {
  let exitCode = 0;
  try {
    const { default: connectDB } = await import("@/lib/mongodb");
    await connectDB();

    // Delete existing demo accounts

    const demoEmails = DEMO_ACCOUNTS.map((account) => account.email);
    const deleteResult = await User.deleteMany({ email: { $in: demoEmails } });

    // Create demo accounts

    const createdAccounts = [];
    for (const accountData of DEMO_ACCOUNTS) {
      try {
        const account = new User(accountData);
        await account.save();
        createdAccounts.push(account);
      } catch (error: any) {
        console.error(
          `   ❌ Failed to create ${accountData.email}:`,
          error.message
        );
      }
    }
  } catch (error: any) {
    console.error("❌ Error seeding demo accounts:", error.message);
    const message = String(error?.message || "");
    if (
      error?.name === "MongooseServerSelectionError" ||
      /Server selection timed out/i.test(message)
    ) {
      console.error("   MONGODB_URI:", redactMongoUri(process.env.MONGODB_URI));
      console.error(
        "   Expected local example: mongodb://127.0.0.1:27017/PropertyPro"
      );
    }
    console.error(error);
    exitCode = 1;
  } finally {
    try {
      await mongoose.connection.close();
    } catch {}
    process.exit(exitCode);
  }
}

// Run the seed function
seedDemoAccounts();
