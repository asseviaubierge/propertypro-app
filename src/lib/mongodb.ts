import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  (process.env.MONGODB_DB
    ? `mongodb://localhost:27017/${process.env.MONGODB_DB}`
    : "mongodb://localhost:27017/PropertyPro");

// Don't throw error in development if MongoDB is not available
if (!process.env.MONGODB_URI && process.env.NODE_ENV === "production") {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 30000, // Keep trying to send operations for 30 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      connectTimeoutMS: 30000, // Give up initial connection after 30 seconds
      family: 4, // Use IPv4, skip trying IPv6
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongoose) => {
        return mongoose;
      })
      .catch((error) => {
        console.error("❌ MongoDB connection failed:", error.message);
        cached.promise = null;
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error("❌ MongoDB connection error:", e);
    throw e;
  }

  return cached.conn;
}

export default connectDB;

// Export alias for compatibility
export { connectDB as connectToDatabase };

/**
 * Safe connection that doesn't throw errors in development
 */
export async function connectDBSafe() {
  try {
    return await connectDB();
  } catch (error) {
    console.warn(
      "⚠️ MongoDB connection failed, running in offline mode:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * Disconnect from MongoDB
 * Useful for testing or graceful shutdowns
 */
export async function disconnectDB() {
  if (cached.conn) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}

/**
 * Check if MongoDB is connected
 */
export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Get connection status
 */
export function getConnectionStatus(): string {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  return (
    states[mongoose.connection.readyState as keyof typeof states] || "unknown"
  );
}

// Handle connection events
mongoose.connection.on("connected", () => {});

mongoose.connection.on("error", (err) => {
  console.error("🔴 Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {});

// Handle process termination
process.on("SIGINT", async () => {
  await mongoose.connection.close();

  process.exit(0);
});
