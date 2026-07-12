/**
 * PropertyPro - guarded demo database reset.
 *
 * Usage:
 *   DEMO_RESET_CONFIRM=RESET_PROPERTYPRO_DEMO_DATABASE npm run db:reset
 *
 * The script deletes documents from application-owned collections but keeps
 * collections and indexes in place.
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import mongoose from "mongoose";
import "@/models";
import { PropertyAuditLogger } from "@/lib/services/property-audit-logger.service";

const RESET_CONFIRMATION = "RESET_PROPERTYPRO_DEMO_DATABASE";

const EXTRA_COLLECTIONS = [
  // Auth.js / NextAuth adapter collections.
  "accounts",
  "sessions",
  "verification_tokens",
  "verificationTokens",
  "authenticators",

  // Collections created by direct MongoDB calls or legacy migrations.
  "payment_logs",
  "stripe_webhook_events",
  "property_status_audit_logs",
  "settingshistories",
  "usersettings",
  "systemsettings",
  "usersettings_backup",
  "systemsettings_backup",
];

function redactMongoUri(uri: string | undefined): string {
  if (!uri) return "(not set)";

  const schemeIndex = uri.indexOf("://");
  if (schemeIndex === -1) return "(invalid uri)";

  const scheme = uri.slice(0, schemeIndex + 3);
  const rest = uri.slice(schemeIndex + 3);
  const slashIndex = rest.indexOf("/");
  const authorityEnd = slashIndex === -1 ? rest.length : slashIndex;
  const atIndex = rest.lastIndexOf("@", authorityEnd);

  return `${scheme}${atIndex === -1 ? rest : rest.slice(atIndex + 1)}`;
}

function getTargetCollections(): string[] {
  // Register the ad-hoc property status audit model before reading model names.
  PropertyAuditLogger.getInstance();

  const modelCollections = mongoose
    .modelNames()
    .map((name) => mongoose.model(name).collection.name);

  return [...new Set([...modelCollections, ...EXTRA_COLLECTIONS])].sort();
}

function assertResetIsAllowed(databaseName: string | undefined) {
  const confirmation = process.env.DEMO_RESET_CONFIRM;
  if (confirmation !== RESET_CONFIRMATION) {
    throw new Error(
      `Refusing to reset without DEMO_RESET_CONFIRM=${RESET_CONFIRMATION}`
    );
  }

  const looksProduction =
    process.env.NODE_ENV === "production" ||
    /prod|production/i.test(databaseName || "");

  if (
    looksProduction &&
    process.env.ALLOW_PRODUCTION_DEMO_RESET !== "true"
  ) {
    throw new Error(
      "Refusing to reset a production-looking database. Set ALLOW_PRODUCTION_DEMO_RESET=true only if this is intentional."
    );
  }
}

async function resetDemoData() {
  assertResetIsAllowed(undefined);

  const { default: connectDB } = await import("@/lib/mongodb");
  await connectDB();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection is missing a database handle.");
  }

  assertResetIsAllowed(db.databaseName);

  const existingCollections = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (collection) => collection.name
    )
  );

  const dryRun = process.argv.includes("--dry-run");
  const targetCollections = getTargetCollections();
  const results: Array<{
    collection: string;
    documents: number;
    action: "deleted" | "missing" | "would_delete";
  }> = [];

  for (const collectionName of targetCollections) {
    if (!existingCollections.has(collectionName)) {
      results.push({
        collection: collectionName,
        documents: 0,
        action: "missing",
      });
      continue;
    }

    const collection = db.collection(collectionName);
    const documents = await collection.estimatedDocumentCount();

    if (!dryRun) {
      await collection.deleteMany({});
    }

    results.push({
      collection: collectionName,
      documents,
      action: dryRun ? "would_delete" : "deleted",
    });
  }

  const affected = results.filter((result) => result.documents > 0);
  const total = affected.reduce((sum, result) => sum + result.documents, 0);

  console.log(
    JSON.stringify(
      {
        database: db.databaseName,
        uri: redactMongoUri(process.env.MONGODB_URI),
        dryRun,
        totalDocuments: total,
        affectedCollections: affected,
      },
      null,
      2
    )
  );
}

if (process.env.PROPERTYPRO_SCRIPT_IMPORT_ONLY !== "true") {
  resetDemoData()
    .catch((error) => {
      console.error("Demo reset failed:", error?.message || error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.connection.close().catch(() => undefined);
    });
}
