/**
 * PropertyPro - Error Logging API
 * Endpoint for logging client-side errors
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  createSuccessResponse as createApiSuccessResponse,
  createErrorResponse as createApiErrorResponse,
} from "@/lib/api-utils";
import { resolveAccessProfile } from "@/lib/server-permissions";

// Error log schema (you can create a Mongoose model if you want to persist errors)
interface ErrorLog {
  id: string;
  message: string;
  stack?: string;
  category: string;
  severity: string;
  context: {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    url?: string;
    path?: string;
    method?: string;
    userAgent?: string;
    timestamp: string;
    sessionId?: string;
    requestId?: string;
    [key: string]: any;
  };
  digest?: string;
  metadata?: Record<string, any>;
}

interface ErrorLogRequest {
  errors: ErrorLog[];
}

interface ErrorLogResultPayload {
  logged: number;
}

interface ErrorStatsPayload {
  totalErrors: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  recentErrors: ErrorLog[];
}

/**
 * POST /api/errors/log
 * Log client-side errors
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body: ErrorLogRequest = await req.json();

    if (!body.errors || !Array.isArray(body.errors)) {
      return createApiErrorResponse(
        "Invalid request body",
        400,
        "Invalid request body"
      );
    }

    // Enhance errors with session information
    const enhancedErrors = body.errors.map((error) => ({
      ...error,
      context: {
        ...error.context,
        userId: session?.user?.id || error.context.userId,
        userEmail: session?.user?.email || error.context.userEmail,
        userRole: session?.user?.role || error.context.userRole,
        serverTimestamp: new Date().toISOString(),
      },
    }));

    // Log errors to console (in production, you'd send to a logging service)
    enhancedErrors.forEach((error) => {
      const logLevel = getLogLevel(error.severity);
      const logMessage = formatErrorLog(error);

      switch (logLevel) {
        case "critical":
        case "error":
          console.error(logMessage);
          break;
        case "warn":
          console.warn(logMessage);
          break;
        default:
      }
    });

    // TODO: Persist errors to database if needed
    // await connectDB();
    // await ErrorLogModel.insertMany(enhancedErrors);

    // TODO: Send critical errors to monitoring service
    const criticalErrors = enhancedErrors.filter(
      (e) => e.severity === "critical" || e.severity === "high"
    );

    if (criticalErrors.length > 0) {
      // Send alerts for critical errors
      await sendCriticalErrorAlerts(criticalErrors);
    }

    return createApiSuccessResponse<ErrorLogResultPayload>(
      { logged: enhancedErrors.length },
      "Errors logged successfully"
    );
  } catch (error) {
    console.error("Error logging endpoint failed:", error);

    // Don't fail the request even if logging fails
    return createApiErrorResponse(
      "Failed to log errors",
      500,
      "Failed to log errors"
    );
  }
}

/**
 * GET /api/errors/log
 * Get error statistics (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    const accessProfile = session?.user?.role
      ? await resolveAccessProfile(session.user.role)
      : null;

    if (!session?.user || !accessProfile?.isAdmin) {
      return createApiErrorResponse("Unauthorized", 401, "Unauthorized");
    }

    // TODO: Implement error statistics retrieval from database
    // For now, return a placeholder response
    const stats: ErrorStatsPayload = {
      totalErrors: 0,
      byCategory: {},
      bySeverity: {},
      recentErrors: [],
    };

    return createApiSuccessResponse<ErrorStatsPayload>(stats);
  } catch (error) {
    console.error("Error retrieving error stats:", error);
    return createApiErrorResponse(
      "Failed to retrieve error statistics",
      500,
      "Failed to retrieve error statistics"
    );
  }
}

/**
 * Helper: Get log level from severity
 */
function getLogLevel(severity: string): string {
  switch (severity) {
    case "critical":
      return "critical";
    case "high":
      return "error";
    case "medium":
      return "warn";
    case "low":
      return "info";
    default:
      return "log";
  }
}

/**
 * Helper: Format error log for console output
 */
function formatErrorLog(error: ErrorLog): string {
  const parts = [
    `[${error.severity.toUpperCase()}]`,
    `[${error.category}]`,
    error.message,
  ];

  if (error.context.userId) {
    parts.push(`(User: ${error.context.userId})`);
  }

  if (error.context.path) {
    parts.push(`(Path: ${error.context.path})`);
  }

  return parts.join(" ");
}

/**
 * Helper: Send alerts for critical errors
 */
async function sendCriticalErrorAlerts(errors: ErrorLog[]): Promise<void> {
  // TODO: Implement alerting mechanism
  // Examples:
  // - Send email to admin
  // - Send Slack notification
  // - Trigger PagerDuty alert
  // - Send SMS for critical errors

  if (process.env.NODE_ENV === "development") {
    errors.forEach((error) => {});
  }

  // Example: Send email notification
  // if (process.env.ADMIN_EMAIL) {
  //   try {
  //     await sendEmail({
  //       to: process.env.ADMIN_EMAIL,
  //       subject: `Critical Error Alert - ${errors.length} error(s)`,
  //       html: generateErrorAlertEmail(errors),
  //     });
  //   } catch (emailError) {
  //     console.error("Failed to send error alert email:", emailError);
  //   }
  // }
}

/**
 * Helper: Generate error alert email HTML
 */
function generateErrorAlertEmail(errors: ErrorLog[]): string {
  const errorList = errors
    .map(
      (error) => `
    <div style="margin-bottom: 20px; padding: 15px; background: #fee; border-left: 4px solid #f00;">
      <h3 style="margin: 0 0 10px 0; color: #c00;">${error.message}</h3>
      <p><strong>Category:</strong> ${error.category}</p>
      <p><strong>Severity:</strong> ${error.severity}</p>
      <p><strong>User:</strong> ${error.context.userEmail || "Anonymous"}</p>
      <p><strong>Path:</strong> ${error.context.path || "N/A"}</p>
      <p><strong>Time:</strong> ${error.context.timestamp}</p>
      ${
        error.stack
          ? `<pre style="background: #f5f5f5; padding: 10px; overflow-x: auto;">${error.stack}</pre>`
          : ""
      }
    </div>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Critical Error Alert</title>
      </head>
      <body style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
        <div style="max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
          <h1 style="color: #c00; margin-bottom: 20px;">🚨 Critical Error Alert</h1>
          <p style="margin-bottom: 20px;">
            ${errors.length} critical error(s) detected in PropertyPro application.
          </p>
          ${errorList}
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px;">
            This is an automated alert from PropertyPro Error Monitoring System.
          </p>
        </div>
      </body>
    </html>
  `;
}
