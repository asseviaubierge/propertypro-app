/**
 * Gestion E-Immo - Auth.js API route
 * Exposes /api/auth/session, /api/auth/providers, callbacks and sign-in routes.
 */

import { handlers } from "@/lib/auth";

// MongoDB, Mongoose and the MongoDB adapter require the Node.js runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST } = handlers;
