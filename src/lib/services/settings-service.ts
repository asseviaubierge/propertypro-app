/**
 * PropertyPro - Settings Service Layer
 * Business logic and database operations for all settings categories
 */

import {
  ProfileSettings,
  NotificationSettings,
  SecuritySettings,
  DisplaySettings,
  PrivacySettings,
  SystemSettingsNew,
} from "@/models";
import type { IProfileSettings } from "@/models/ProfileSettings";
import type { INotificationSettings } from "@/models/NotificationSettings";
import type { ISecuritySettings } from "@/models/SecuritySettings";
import type { IDisplaySettings } from "@/models/DisplaySettings";
import type { IPrivacySettings } from "@/models/PrivacySettings";
import type { ISystemSettingsNew } from "@/models/SystemSettingsNew";

// ============================================================================
// Profile Settings Service
// ============================================================================
export class ProfileSettingsService {
  static async getByUserId(userId: string): Promise<IProfileSettings | null> {
    try {
      let settings = await ProfileSettings.findByUserId(userId);
      if (!settings) {
        settings = await ProfileSettings.createDefaultProfile(userId);
      }
      return settings;
    } catch (error) {
      console.error("ProfileSettingsService.getByUserId error:", error);
      throw new Error("Failed to retrieve profile settings");
    }
  }

  static async updateByUserId(
    userId: string,
    data: Partial<IProfileSettings>,
    updatedBy?: string
  ): Promise<IProfileSettings> {
    try {
      const settings = await ProfileSettings.updateByUserId(userId, {
        ...data,
        updatedBy: updatedBy || userId,
      });
      return settings;
    } catch (error) {
      console.error("ProfileSettingsService.updateByUserId error:", error);
      throw new Error("Failed to update profile settings");
    }
  }

  static async resetToDefaults(
    userId: string,
    userInfo?: { name?: string; email?: string }
  ): Promise<IProfileSettings> {
    try {
      // Deactivate existing settings
      const existing = await ProfileSettings.findByUserId(userId);
      if (existing) {
        existing.isActive = false;
        await existing.save();
      }

      // Create new default settings
      const defaultData: Partial<IProfileSettings> = {};
      if (userInfo?.name) {
        const nameParts = userInfo.name.split(" ");
        defaultData.firstName = nameParts[0];
        defaultData.lastName = nameParts.slice(1).join(" ");
      }
      if (userInfo?.email) {
        defaultData.email = userInfo.email;
      }

      return await ProfileSettings.createDefaultProfile(userId, defaultData);
    } catch (error) {
      console.error("ProfileSettingsService.resetToDefaults error:", error);
      throw new Error("Failed to reset profile settings");
    }
  }

  static async getPublicProfile(userId: string): Promise<any> {
    try {
      const settings = await this.getByUserId(userId);
      return settings?.getPublicProfile();
    } catch (error) {
      console.error("ProfileSettingsService.getPublicProfile error:", error);
      throw new Error("Failed to retrieve public profile");
    }
  }
}

// ============================================================================
// Notification Settings Service
// ============================================================================
export class NotificationSettingsService {
  static async getByUserId(
    userId: string
  ): Promise<INotificationSettings | null> {
    try {
      let settings = await NotificationSettings.findByUserId(userId);
      if (!settings) {
        settings = await NotificationSettings.createDefaultNotifications(
          userId
        );
      }
      return settings;
    } catch (error) {
      console.error("NotificationSettingsService.getByUserId error:", error);
      throw new Error("Failed to retrieve notification settings");
    }
  }

  static async updateByUserId(
    userId: string,
    data: Partial<INotificationSettings>,
    updatedBy?: string
  ): Promise<INotificationSettings> {
    try {
      let settings = await NotificationSettings.findByUserId(userId);
      if (!settings) {
        settings = await NotificationSettings.createDefaultNotifications(
          userId
        );
      }

      await settings.updateNotifications({
        ...data,
        updatedBy: updatedBy || userId,
      });

      return settings;
    } catch (error) {
      console.error("NotificationSettingsService.updateByUserId error:", error);
      throw new Error("Failed to update notification settings");
    }
  }

  static async resetToDefaults(userId: string): Promise<INotificationSettings> {
    try {
      // Deactivate existing settings
      const existing = await NotificationSettings.findByUserId(userId);
      if (existing) {
        existing.isActive = false;
        await existing.save();
      }

      // Create new default settings
      return await NotificationSettings.createDefaultNotifications(userId);
    } catch (error) {
      console.error(
        "NotificationSettingsService.resetToDefaults error:",
        error
      );
      throw new Error("Failed to reset notification settings");
    }
  }

  static async isNotificationEnabled(
    userId: string,
    type: string,
    category: string
  ): Promise<boolean> {
    try {
      const settings = await this.getByUserId(userId);
      return settings?.isNotificationEnabled(type, category) || false;
    } catch (error) {
      console.error(
        "NotificationSettingsService.isNotificationEnabled error:",
        error
      );
      return false;
    }
  }
}

// ============================================================================
// Security Settings Service
// ============================================================================
export class SecuritySettingsService {
  static async getByUserId(userId: string): Promise<ISecuritySettings | null> {
    try {
      let settings = await SecuritySettings.findByUserId(userId);
      if (!settings) {
        settings = await SecuritySettings.createDefaultSecurity(userId);
      }
      return settings;
    } catch (error) {
      console.error("SecuritySettingsService.getByUserId error:", error);
      throw new Error("Failed to retrieve security settings");
    }
  }

  static async updateByUserId(
    userId: string,
    data: Partial<ISecuritySettings>,
    updatedBy?: string
  ): Promise<ISecuritySettings> {
    try {
      let settings = await SecuritySettings.findByUserId(userId);
      if (!settings) {
        settings = await SecuritySettings.createDefaultSecurity(userId);
      }

      await settings.updateSecurity({
        ...data,
        updatedBy: updatedBy || userId,
      });

      return settings;
    } catch (error) {
      console.error("SecuritySettingsService.updateByUserId error:", error);
      throw new Error("Failed to update security settings");
    }
  }

  static async resetToDefaults(userId: string): Promise<ISecuritySettings> {
    try {
      // Deactivate existing settings
      const existing = await SecuritySettings.findByUserId(userId);
      if (existing) {
        existing.isActive = false;
        await existing.save();
      }

      // Create new default settings
      return await SecuritySettings.createDefaultSecurity(userId);
    } catch (error) {
      console.error("SecuritySettingsService.resetToDefaults error:", error);
      throw new Error("Failed to reset security settings");
    }
  }

  static async addTrustedDevice(
    userId: string,
    deviceInfo: {
      deviceId: string;
      deviceName: string;
      userAgent?: string;
      ipAddress?: string;
    }
  ): Promise<ISecuritySettings> {
    try {
      const settings = await this.getByUserId(userId);
      if (!settings) {
        throw new Error("Security settings not found");
      }

      await settings.addTrustedDevice(deviceInfo);
      return settings;
    } catch (error) {
      console.error("SecuritySettingsService.addTrustedDevice error:", error);
      throw new Error("Failed to add trusted device");
    }
  }

  static async removeTrustedDevice(
    userId: string,
    deviceId: string
  ): Promise<ISecuritySettings> {
    try {
      const settings = await this.getByUserId(userId);
      if (!settings) {
        throw new Error("Security settings not found");
      }

      await settings.removeTrustedDevice(deviceId);
      return settings;
    } catch (error) {
      console.error(
        "SecuritySettingsService.removeTrustedDevice error:",
        error
      );
      throw new Error("Failed to remove trusted device");
    }
  }

  static async isTrustedDevice(
    userId: string,
    deviceId: string
  ): Promise<boolean> {
    try {
      const settings = await this.getByUserId(userId);
      return settings?.isTrustedDevice(deviceId) || false;
    } catch (error) {
      console.error("SecuritySettingsService.isTrustedDevice error:", error);
      return false;
    }
  }

  static async getSanitizedSettings(userId: string): Promise<any> {
    try {
      const settings = await this.getByUserId(userId);
      if (!settings) return null;

      // Remove sensitive data
      return {
        ...settings.toObject(),
        twoFactorAuth: {
          ...settings.twoFactorAuth,
          secret: undefined,
          backupCodes: settings.twoFactorAuth.backupCodes?.length || 0,
        },
        trustedDevices: settings.trustedDevices.map((device: any) => ({
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          addedAt: device.addedAt,
          lastUsed: device.lastUsed,
        })),
        securityQuestions: settings.securityQuestions.map((q: any) => ({
          question: q.question,
          createdAt: q.createdAt,
        })),
      };
    } catch (error) {
      console.error(
        "SecuritySettingsService.getSanitizedSettings error:",
        error
      );
      throw new Error("Failed to retrieve sanitized security settings");
    }
  }
}

// ============================================================================
// Display Settings Service
// ============================================================================
export class DisplaySettingsService {
  static async getByUserId(userId: string): Promise<IDisplaySettings | null> {
    try {
      let settings = await DisplaySettings.findByUserId(userId);
      if (!settings) {
        settings = await DisplaySettings.createDefaultDisplay(userId);
      }
      return settings;
    } catch (error) {
      console.error("DisplaySettingsService.getByUserId error:", error);
      throw new Error("Failed to retrieve display settings");
    }
  }

  static async updateByUserId(
    userId: string,
    data: Partial<IDisplaySettings>,
    updatedBy?: string
  ): Promise<IDisplaySettings> {
    try {
      let settings = await DisplaySettings.findByUserId(userId);
      if (!settings) {
        settings = await DisplaySettings.createDefaultDisplay(userId);
      }

      await settings.updateDisplay({
        ...data,
        updatedBy: updatedBy || userId,
      });

      return settings;
    } catch (error) {
      console.error("DisplaySettingsService.updateByUserId error:", error);
      throw new Error("Failed to update display settings");
    }
  }

  static async resetToDefaults(userId: string): Promise<IDisplaySettings> {
    try {
      // Deactivate existing settings
      const existing = await DisplaySettings.findByUserId(userId);
      if (existing) {
        existing.isActive = false;
        await existing.save();
      }

      // Create new default settings
      return await DisplaySettings.createDefaultDisplay(userId);
    } catch (error) {
      console.error("DisplaySettingsService.resetToDefaults error:", error);
      throw new Error("Failed to reset display settings");
    }
  }

  static async getThemeConfig(userId: string): Promise<any> {
    try {
      const settings = await this.getByUserId(userId);
      return settings?.getThemeConfig();
    } catch (error) {
      console.error("DisplaySettingsService.getThemeConfig error:", error);
      throw new Error("Failed to retrieve theme configuration");
    }
  }
}

// ============================================================================
// Privacy Settings Service
// ============================================================================
export class PrivacySettingsService {
  static async getByUserId(userId: string): Promise<IPrivacySettings | null> {
    try {
      let settings = await PrivacySettings.findByUserId(userId);
      if (!settings) {
        settings = await PrivacySettings.createDefaultPrivacy(userId);
      }
      return settings;
    } catch (error) {
      console.error("PrivacySettingsService.getByUserId error:", error);
      throw new Error("Failed to retrieve privacy settings");
    }
  }

  static async updateByUserId(
    userId: string,
    data: Partial<IPrivacySettings>,
    updatedBy?: string
  ): Promise<IPrivacySettings> {
    try {
      let settings = await PrivacySettings.findByUserId(userId);
      if (!settings) {
        settings = await PrivacySettings.createDefaultPrivacy(userId);
      }

      await settings.updatePrivacy({
        ...data,
        updatedBy: updatedBy || userId,
      });

      return settings;
    } catch (error) {
      console.error("PrivacySettingsService.updateByUserId error:", error);
      throw new Error("Failed to update privacy settings");
    }
  }

  static async resetToDefaults(userId: string): Promise<IPrivacySettings> {
    try {
      // Deactivate existing settings
      const existing = await PrivacySettings.findByUserId(userId);
      if (existing) {
        existing.isActive = false;
        await existing.save();
      }

      // Create new default settings
      return await PrivacySettings.createDefaultPrivacy(userId);
    } catch (error) {
      console.error("PrivacySettingsService.resetToDefaults error:", error);
      throw new Error("Failed to reset privacy settings");
    }
  }

  static async giveGDPRConsent(
    userId: string,
    version: string = "1.0"
  ): Promise<IPrivacySettings> {
    try {
      const settings = await this.getByUserId(userId);
      if (!settings) {
        throw new Error("Privacy settings not found");
      }

      await settings.giveGDPRConsent(version);
      return settings;
    } catch (error) {
      console.error("PrivacySettingsService.giveGDPRConsent error:", error);
      throw new Error("Failed to give GDPR consent");
    }
  }

  static async revokeGDPRConsent(userId: string): Promise<IPrivacySettings> {
    try {
      const settings = await this.getByUserId(userId);
      if (!settings) {
        throw new Error("Privacy settings not found");
      }

      await settings.revokeGDPRConsent();
      return settings;
    } catch (error) {
      console.error("PrivacySettingsService.revokeGDPRConsent error:", error);
      throw new Error("Failed to revoke GDPR consent");
    }
  }

  static async requestDataPortability(
    userId: string
  ): Promise<IPrivacySettings> {
    try {
      const settings = await this.getByUserId(userId);
      if (!settings) {
        throw new Error("Privacy settings not found");
      }

      await settings.requestDataPortability();
      return settings;
    } catch (error) {
      console.error(
        "PrivacySettingsService.requestDataPortability error:",
        error
      );
      throw new Error("Failed to request data portability");
    }
  }

  static async requestRightToBeForgotten(
    userId: string
  ): Promise<IPrivacySettings> {
    try {
      const settings = await this.getByUserId(userId);
      if (!settings) {
        throw new Error("Privacy settings not found");
      }

      await settings.requestRightToBeForgotten();
      return settings;
    } catch (error) {
      console.error(
        "PrivacySettingsService.requestRightToBeForgotten error:",
        error
      );
      throw new Error("Failed to request right to be forgotten");
    }
  }
}

// ============================================================================
// System Settings Service
// ============================================================================
export class SystemSettingsService {
  static async getSettings(): Promise<ISystemSettingsNew | null> {
    try {
      let settings = await SystemSettingsNew.getSettings();
      if (!settings) {
        settings = await SystemSettingsNew.createDefaultSettings();
      }
      return settings;
    } catch (error) {
      console.error("SystemSettingsService.getSettings error:", error);
      throw new Error("Failed to retrieve system settings");
    }
  }

  static async updateSettings(
    data: Partial<ISystemSettingsNew>,
    updatedBy?: string
  ): Promise<ISystemSettingsNew> {
    try {
      let settings = await SystemSettingsNew.getSettings();
      if (!settings) {
        settings = await SystemSettingsNew.createDefaultSettings();
      }

      await settings.updateSettings({
        ...data,
        updatedBy,
      });

      return settings;
    } catch (error) {
      console.error("SystemSettingsService.updateSettings error:", error);
      throw new Error("Failed to update system settings");
    }
  }

  static async resetToDefaults(
    updatedBy?: string
  ): Promise<ISystemSettingsNew> {
    try {
      // Deactivate existing settings
      const existing = await SystemSettingsNew.getSettings();
      if (existing) {
        existing.isActive = false;
        await existing.save();
      }

      // Create new default settings
      const defaultSettings = await SystemSettingsNew.createDefaultSettings();
      if (updatedBy) {
        defaultSettings.createdBy = updatedBy;
        await defaultSettings.save();
      }
      return defaultSettings;
    } catch (error) {
      console.error("SystemSettingsService.resetToDefaults error:", error);
      throw new Error("Failed to reset system settings");
    }
  }

  static async enableMaintenance(
    message?: string,
    allowedIps?: string[],
    updatedBy?: string
  ): Promise<ISystemSettingsNew> {
    try {
      const settings = await this.getSettings();
      if (!settings) {
        throw new Error("System settings not found");
      }

      await settings.enableMaintenance(message, allowedIps);
      if (updatedBy) {
        settings.updatedBy = updatedBy;
        await settings.save();
      }
      return settings;
    } catch (error) {
      console.error("SystemSettingsService.enableMaintenance error:", error);
      throw new Error("Failed to enable maintenance mode");
    }
  }

  static async disableMaintenance(
    updatedBy?: string
  ): Promise<ISystemSettingsNew> {
    try {
      const settings = await this.getSettings();
      if (!settings) {
        throw new Error("System settings not found");
      }

      await settings.disableMaintenance();
      if (updatedBy) {
        settings.updatedBy = updatedBy;
        await settings.save();
      }
      return settings;
    } catch (error) {
      console.error("SystemSettingsService.disableMaintenance error:", error);
      throw new Error("Failed to disable maintenance mode");
    }
  }

  static async getSanitizedSettings(): Promise<any> {
    try {
      const settings = await this.getSettings();
      if (!settings) return null;

      // Remove sensitive data
      return {
        ...settings.toObject(),
        email: {
          ...settings.email,
          smtpPassword: settings.email.smtpPassword ? "***" : undefined,
        },
        payment: {
          ...settings.payment,
          stripeSecretKey: settings.payment.stripeSecretKey ? "***" : undefined,
          paypalClientSecret: settings.payment.paypalClientSecret
            ? "***"
            : undefined,
        },
        integrations: {
          ...settings.integrations,
          r2: {
            ...settings.integrations.r2,
            secretAccessKey: settings.integrations.r2.secretAccessKey
              ? "***"
              : undefined,
          },
          sms: {
            ...settings.integrations.sms,
            apiKey: settings.integrations.sms.apiKey ? "***" : undefined,
            apiSecret: settings.integrations.sms.apiSecret ? "***" : undefined,
          },
        },
      };
    } catch (error) {
      console.error("SystemSettingsService.getSanitizedSettings error:", error);
      throw new Error("Failed to retrieve sanitized system settings");
    }
  }
}

// ============================================================================
// Unified Settings Service (for backward compatibility and convenience)
// ============================================================================
export class SettingsService {
  static profile = ProfileSettingsService;
  static notifications = NotificationSettingsService;
  static security = SecuritySettingsService;
  static display = DisplaySettingsService;
  static privacy = PrivacySettingsService;
  static system = SystemSettingsService;

  static async getAllUserSettings(userId: string): Promise<{
    profile: IProfileSettings | null;
    notifications: INotificationSettings | null;
    security: any; // Sanitized
    display: IDisplaySettings | null;
    privacy: IPrivacySettings | null;
  }> {
    try {
      const [profile, notifications, security, display, privacy] =
        await Promise.all([
          ProfileSettingsService.getByUserId(userId),
          NotificationSettingsService.getByUserId(userId),
          SecuritySettingsService.getSanitizedSettings(userId),
          DisplaySettingsService.getByUserId(userId),
          PrivacySettingsService.getByUserId(userId),
        ]);

      return {
        profile,
        notifications,
        security,
        display,
        privacy,
      };
    } catch (error) {
      console.error("SettingsService.getAllUserSettings error:", error);
      throw new Error("Failed to retrieve all user settings");
    }
  }

  static async resetAllUserSettings(
    userId: string,
    userInfo?: { name?: string; email?: string }
  ): Promise<{
    profile: IProfileSettings;
    notifications: INotificationSettings;
    security: ISecuritySettings;
    display: IDisplaySettings;
    privacy: IPrivacySettings;
  }> {
    try {
      const [profile, notifications, security, display, privacy] =
        await Promise.all([
          ProfileSettingsService.resetToDefaults(userId, userInfo),
          NotificationSettingsService.resetToDefaults(userId),
          SecuritySettingsService.resetToDefaults(userId),
          DisplaySettingsService.resetToDefaults(userId),
          PrivacySettingsService.resetToDefaults(userId),
        ]);

      return {
        profile,
        notifications,
        security,
        display,
        privacy,
      };
    } catch (error) {
      console.error("SettingsService.resetAllUserSettings error:", error);
      throw new Error("Failed to reset all user settings");
    }
  }
}
