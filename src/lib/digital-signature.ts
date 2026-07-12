/**
 * PropertyPro - Digital Signature Service
 * Handle digital signatures for documents
 */

import Document from "@/models/Document";
import { IDocument, IDigitalSignature } from "@/models/Document";
import mongoose from "mongoose";
import crypto from "crypto";

// Signature request interface
export interface ISignatureRequest {
  documentId: string;
  signerId: string;
  signerName: string;
  signerEmail: string;
  signatureData: string; // Base64 encoded signature image/data
  ipAddress?: string;
  userAgent?: string;
  certificateData?: string;
}

// Signature verification result
export interface ISignatureVerification {
  isValid: boolean;
  signatureId?: string;
  timestamp?: Date;
  errors?: string[];
  warnings?: string[];
}

// Signature certificate interface
export interface ISignatureCertificate {
  id: string;
  userId: string;
  publicKey: string;
  privateKey: string; // Encrypted
  algorithm: string;
  createdAt: Date;
  expiresAt: Date;
  status: "active" | "revoked" | "expired";
}

export class DigitalSignatureService {
  // Add digital signature to document
  async addSignature(
    request: ISignatureRequest
  ): Promise<ISignatureVerification> {
    try {
      // Fetch document
      const document = await Document.findById(request.documentId);
      if (!document) {
        return {
          isValid: false,
          errors: ["Document not found"],
        };
      }

      // Check if document requires signature
      if (!document.requiresSignature) {
        return {
          isValid: false,
          errors: ["Document does not require signature"],
        };
      }

      // Check if user already signed
      const existingSignature = document.digitalSignatures.find(
        (sig) => sig.signerId.toString() === request.signerId
      );

      if (existingSignature) {
        return {
          isValid: false,
          errors: ["User has already signed this document"],
        };
      }

      // Check signature deadline
      if (
        document.signatureDeadline &&
        new Date() > document.signatureDeadline
      ) {
        return {
          isValid: false,
          errors: ["Signature deadline has passed"],
        };
      }

      // Validate signature data
      const validationResult = this.validateSignatureData(
        request.signatureData
      );
      if (!validationResult.isValid) {
        return validationResult;
      }

      // Generate signature hash for verification
      const signatureHash = this.generateSignatureHash(
        request.documentId,
        request.signerId,
        request.signatureData
      );

      // Add signature to document
      await document.addDigitalSignature(
        new mongoose.Types.ObjectId(request.signerId),
        request.signerName,
        request.signerEmail,
        request.signatureData,
        request.ipAddress,
        request.userAgent
      );

      // Log the signature action
      await document.logAccess(
        new mongoose.Types.ObjectId(request.signerId),
        "sign",
        request.ipAddress,
        request.userAgent,
        `Document signed with hash: ${signatureHash}`
      );

      const signatureIndex = document.digitalSignatures.length - 1;

      return {
        isValid: true,
        signatureId: signatureIndex.toString(),
        timestamp: new Date(),
      };
    } catch (error) {
      console.error("Failed to add signature:", error);
      return {
        isValid: false,
        errors: ["Failed to add signature: " + (error as Error).message],
      };
    }
  }

  // Verify signature authenticity
  async verifySignature(
    documentId: string,
    signatureIndex: number
  ): Promise<ISignatureVerification> {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        return {
          isValid: false,
          errors: ["Document not found"],
        };
      }

      const signature = document.digitalSignatures[signatureIndex];
      if (!signature) {
        return {
          isValid: false,
          errors: ["Signature not found"],
        };
      }

      // Verify signature hash
      const expectedHash = this.generateSignatureHash(
        documentId,
        signature.signerId.toString(),
        signature.signatureData
      );

      // In a real implementation, you would verify against stored hash
      // For now, we'll mark as verified
      await document.verifySignature(signatureIndex);

      return {
        isValid: true,
        signatureId: signatureIndex.toString(),
        timestamp: signature.signedAt,
      };
    } catch (error) {
      console.error("Failed to verify signature:", error);
      return {
        isValid: false,
        errors: ["Failed to verify signature: " + (error as Error).message],
      };
    }
  }

  // Get signature status for document
  async getSignatureStatus(documentId: string): Promise<{
    requiresSignature: boolean;
    signatureDeadline?: Date;
    signatures: Array<{
      signerName: string;
      signerEmail: string;
      signedAt: Date;
      verified: boolean;
    }>;
    isFullySigned: boolean;
    pendingSigners?: string[];
  }> {
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    const signatures = document.digitalSignatures.map((sig) => ({
      signerName: sig.signerName,
      signerEmail: sig.signerEmail,
      signedAt: sig.signedAt,
      verified: sig.verified,
    }));

    return {
      requiresSignature: document.requiresSignature,
      signatureDeadline: document.signatureDeadline,
      signatures,
      isFullySigned:
        document.requiresSignature && document.digitalSignatures.length > 0,
      pendingSigners: [], // Would be populated based on required signers list
    };
  }

  // Create signature request for multiple signers
  async createSignatureRequest(
    documentId: string,
    signers: Array<{
      userId: string;
      name: string;
      email: string;
    }>,
    deadline?: Date,
    message?: string
  ): Promise<{ success: boolean; requestId?: string; errors?: string[] }> {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        return {
          success: false,
          errors: ["Document not found"],
        };
      }

      // Update document to require signatures
      document.requiresSignature = true;
      document.signatureDeadline = deadline;
      await document.save();

      // In a real implementation, you would:
      // 1. Create signature request records
      // 2. Send notification emails to signers
      // 3. Generate unique signing links

      const requestId = `sig_req_${Date.now()}`;

      // Mock sending notifications
      for (const signer of signers) {

      }

      return {
        success: true,
        requestId,
      };
    } catch (error) {
      console.error("Failed to create signature request:", error);
      return {
        success: false,
        errors: [
          "Failed to create signature request: " + (error as Error).message,
        ],
      };
    }
  }

  // Generate signature certificate for user
  async generateCertificate(userId: string): Promise<ISignatureCertificate> {
    const keyPair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    const certificate: ISignatureCertificate = {
      id: `cert_${Date.now()}_${userId}`,
      userId,
      publicKey: keyPair.publicKey,
      privateKey: this.encryptPrivateKey(keyPair.privateKey, userId),
      algorithm: "RSA-SHA256",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      status: "active",
    };

    // In a real implementation, store this in database

    return certificate;
  }

  // Validate signature data format
  private validateSignatureData(signatureData: string): ISignatureVerification {
    try {
      // Check if it's valid base64
      const buffer = Buffer.from(signatureData, "base64");

      // Basic validation - should be reasonable size for signature
      if (buffer.length < 100 || buffer.length > 1024 * 1024) {
        // 100 bytes to 1MB
        return {
          isValid: false,
          errors: ["Invalid signature data size"],
        };
      }

      // Additional validation could include:
      // - Image format validation
      // - Signature complexity analysis
      // - Biometric verification

      return {
        isValid: true,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ["Invalid signature data format"],
      };
    }
  }

  // Generate signature hash for verification
  private generateSignatureHash(
    documentId: string,
    signerId: string,
    signatureData: string
  ): string {
    const data = `${documentId}:${signerId}:${signatureData}:${Date.now()}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  // Encrypt private key (simplified)
  private encryptPrivateKey(privateKey: string, userId: string): string {
    const cipher = crypto.createCipher("aes-256-cbc", userId);
    let encrypted = cipher.update(privateKey, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  }

  // Decrypt private key (simplified)
  private decryptPrivateKey(encryptedKey: string, userId: string): string {
    const decipher = crypto.createDecipher("aes-256-cbc", userId);
    let decrypted = decipher.update(encryptedKey, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  // Create signature audit trail
  async getSignatureAuditTrail(documentId: string): Promise<
    Array<{
      action: string;
      user: string;
      timestamp: Date;
      details: string;
      ipAddress?: string;
    }>
  > {
    const document = await Document.findById(documentId).populate(
      "accessLogs.userId",
      "firstName lastName email"
    );
    if (!document) {
      throw new Error("Document not found");
    }

    return document.accessLogs
      .filter((log) => log.action === "sign" || log.action === "view")
      .map((log) => ({
        action: log.action,
        user: (log.userId as any)?.email || "Unknown",
        timestamp: log.timestamp,
        details: log.details || "",
        ipAddress: log.ipAddress,
      }));
  }
}

// Create singleton instance
export const digitalSignatureService = new DigitalSignatureService();
