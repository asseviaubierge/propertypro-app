import { UserRole } from "./index";
import { MongoClient } from "mongodb";
import type { Mongoose } from "mongoose";

// Global type for MongoDB client promise caching
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var mongoose: {
    conn: Mongoose | null;
    promise: Promise<Mongoose> | null;
  };
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      image?: string;
      firstName?: string;
      lastName?: string;
      role: string;
      avatar?: string;
      bio?: string;
      location?: string;
      city?: string;
      website?: string;
      address?: string;
      phone?: string;
      isActive: boolean;
      createdAt?: Date;
    };
  }

  interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    avatar?: string;
    bio?: string;
    location?: string;
    city?: string;
    website?: string;
    address?: string;
    phone?: string;
    isActive: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: string;
    isActive: boolean;
  }
}
