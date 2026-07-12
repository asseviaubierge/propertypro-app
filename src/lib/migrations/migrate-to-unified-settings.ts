/**
 * PropertyPro - Migration to Unified Settings Collection
 * Migrate existing UserSettings and SystemSettings to unified Settings collection
 */

import mongoose from "mongoose";
import Settings, { SettingsType, SettingsCategory } from "@/models/Settings";
import User from "@/models/User";

interface OldUserSettings {
  _id: string;
  userId: string;
  notifications?: any;
  display?: any;
  privacy?: any;
  security?: any;
  createdAt: Date;
  updatedAt: Date;
}

interface OldSystemSettings {
  _id: string;
  category: string;
  key: string;
  value: any;
  dataType: string;
  description?: string;
  isPublic: boolean;
  isEditable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Migrate UserSettings to unified Settings collection
 */
async function migrateUserSettings() {

  try {
    // Get old UserSettings collection
    const oldUserSettings = await mongoose.connection.db
      .collection("usersettings")
      .find({})
      .toArray();


    let migratedCount = 0;
    let errorCount = 0;

    for (const oldSetting of oldUserSettings) {
      try {
        const userId = oldSetting.userId;

        // Migrate each category as separate documents
        const categories = [
          {
            category: SettingsCategory.NOTIFICATIONS,
            data: oldSetting.notifications,
          },
          { category: SettingsCategory.DISPLAY, data: oldSetting.display },
          { category: SettingsCategory.PRIVACY, data: oldSetting.privacy },
          { category: SettingsCategory.SECURITY, data: oldSetting.security },
        ];

        for (const { category, data } of categories) {
          if (data && Object.keys(data).length > 0) {
            // Check if setting already exists
            const existingSetting = await Settings.findOne({
              userId: new mongoose.Types.ObjectId(userId),
              type: SettingsType.USER,
              category,
            });

            if (!existingSetting) {
              const newSetting = new Settings({
                userId: new mongoose.Types.ObjectId(userId),
                type: SettingsType.USER,
                category,
                [category]: data,
                createdBy: new mongoose.Types.ObjectId(userId),
                updatedBy: new mongoose.Types.ObjectId(userId),
                createdAt: oldSetting.createdAt,
                updatedAt: oldSetting.updatedAt,
              });

              await newSetting.save();
              migratedCount++;
            }
          }
        }

        // Create default profile settings if user exists
        const user = await User.findById(userId);
        if (user) {
          const existingProfile = await Settings.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            type: SettingsType.USER,
            category: SettingsCategory.PROFILE,
          });

          if (!existingProfile) {
            const profileSetting = new Settings({
              userId: new mongoose.Types.ObjectId(userId),
              type: SettingsType.USER,
              category: SettingsCategory.PROFILE,
              profile: {
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                email: user.email || "",
                phone: user.phone || "",
                bio: user.bio || "",
                avatar: user.avatar || "",
              },
              createdBy: new mongoose.Types.ObjectId(userId),
              updatedBy: new mongoose.Types.ObjectId(userId),
            });

            await profileSetting.save();
            migratedCount++;
          }
        }
      } catch (error) {
        console.error(
          `❌ Error migrating user setting ${oldSetting._id}:`,
          error
        );
        errorCount++;
      }
    }


    if (errorCount > 0) {

    }
  } catch (error) {
    console.error("❌ Error during user settings migration:", error);
    throw error;
  }
}

/**
 * Migrate SystemSettings to unified Settings collection
 */
async function migrateSystemSettings() {

  try {
    // Get old SystemSettings collection
    const oldSystemSettings = await mongoose.connection.db
      .collection("systemsettings")
      .find({})
      .toArray();


    // Group settings by category
    const settingsByCategory: Record<string, any> = {};

    for (const setting of oldSystemSettings) {
      const category = setting.category || "general";

      if (!settingsByCategory[category]) {
        settingsByCategory[category] = {};
      }

      settingsByCategory[category][setting.key] = setting.value;
    }

    let migratedCount = 0;
    let errorCount = 0;

    // Map old categories to new categories
    const categoryMapping: Record<string, SettingsCategory> = {
      branding: SettingsCategory.SYSTEM_BRANDING,
      email: SettingsCategory.SYSTEM_EMAIL,
      payment: SettingsCategory.SYSTEM_PAYMENT,
      security: SettingsCategory.SYSTEM_SECURITY,
      maintenance: SettingsCategory.SYSTEM_MAINTENANCE,
      integrations: SettingsCategory.SYSTEM_INTEGRATIONS,
    };

    for (const [oldCategory, data] of Object.entries(settingsByCategory)) {
      try {
        const newCategory =
          categoryMapping[oldCategory] || SettingsCategory.SYSTEM_BRANDING;

        // Check if setting already exists
        const existingSetting = await Settings.findOne({
          type: SettingsType.SYSTEM,
          category: newCategory,
        });

        if (!existingSetting) {
          let systemData: any = {};

          // Map data based on category
          if (newCategory === SettingsCategory.SYSTEM_BRANDING) {
            systemData = {
              branding: {
                companyName:
                  data.companyName || data.company_name || "PropertyPro",
                logo: data.logo || data.company_logo || "",
                favicon: data.favicon || "",
                primaryColor:
                  data.primaryColor || data.primary_color || "#3b82f6",
                secondaryColor:
                  data.secondaryColor || data.secondary_color || "#64748b",
              },
            };
          } else if (newCategory === SettingsCategory.SYSTEM_EMAIL) {
            systemData = {
              email: {
                smtpHost: data.smtpHost || data.smtp_host || "",
                smtpPort: data.smtpPort || data.smtp_port || 587,
                smtpUser: data.smtpUser || data.smtp_user || "",
                smtpPassword: data.smtpPassword || data.smtp_password || "",
                fromEmail: data.fromEmail || data.from_email || "",
                fromName: data.fromName || data.from_name || "",
                encryption: data.encryption || "tls",
              },
            };
          } else if (newCategory === SettingsCategory.SYSTEM_PAYMENT) {
            systemData = {
              payment: {
                stripePublishableKey:
                  data.stripePublishableKey ||
                  data.stripe_publishable_key ||
                  "",
                stripeSecretKey:
                  data.stripeSecretKey || data.stripe_secret_key || "",
                paypalClientId:
                  data.paypalClientId || data.paypal_client_id || "",
                paypalClientSecret:
                  data.paypalClientSecret || data.paypal_client_secret || "",
                currency: data.currency || "USD",
                taxRate: data.taxRate || data.tax_rate || 0,
              },
            };
          } else if (newCategory === SettingsCategory.SYSTEM_SECURITY) {
            systemData = {
              security: {
                requireEmailVerification: data.requireEmailVerification ?? true,
                passwordMinLength:
                  data.passwordMinLength || data.password_min_length || 8,
                sessionTimeout:
                  data.sessionTimeout || data.session_timeout || 60,
                maxLoginAttempts:
                  data.maxLoginAttempts || data.max_login_attempts || 5,
                enableTwoFactor:
                  data.enableTwoFactor || data.enable_two_factor || false,
              },
            };
          } else if (newCategory === SettingsCategory.SYSTEM_MAINTENANCE) {
            systemData = {
              maintenance: {
                enabled: data.enabled || false,
                message: data.message || "",
                allowedIps: data.allowedIps || data.allowed_ips || [],
              },
            };
          } else if (newCategory === SettingsCategory.SYSTEM_INTEGRATIONS) {
            systemData = {
              integrations: {
                googleMapsApiKey:
                  data.googleMapsApiKey || data.google_maps_api_key || "",
                twilioAccountSid:
                  data.twilioAccountSid || data.twilio_account_sid || "",
                twilioAuthToken:
                  data.twilioAuthToken || data.twilio_auth_token || "",
                twilioPhoneNumber:
                  data.twilioPhoneNumber || data.twilio_phone_number || "",
                enableAnalytics: data.enableAnalytics ?? true,
                analyticsId: data.analyticsId || data.analytics_id || "",
              },
            };
          }

          const newSetting = new Settings({
            type: SettingsType.SYSTEM,
            category: newCategory,
            ...systemData,
          });

          await newSetting.save();
          migratedCount++;
        }
      } catch (error) {
        console.error(
          `❌ Error migrating system setting category ${oldCategory}:`,
          error
        );
        errorCount++;
      }
    }


    if (errorCount > 0) {

    }
  } catch (error) {
    console.error("❌ Error during system settings migration:", error);
    throw error;
  }
}

/**
 * Create default settings for users without any settings
 */
async function createDefaultSettings() {

  try {
    const users = await User.find({});
    let createdCount = 0;

    for (const user of users) {
      const existingSettings = await Settings.findOne({
        userId: user._id,
        type: SettingsType.USER,
      });

      if (!existingSettings) {
        await Settings.createDefaultUserSettings(user._id.toString());
        createdCount++;
      }
    }


  } catch (error) {
    console.error("❌ Error creating default settings:", error);
    throw error;
  }
}

/**
 * Main migration function
 */
export async function migrateToUnifiedSettings() {

  try {
    // Run migrations in sequence
    await migrateUserSettings();
    await migrateSystemSettings();
    await createDefaultSettings();


    // Optionally backup old collections

    try {
      await mongoose.connection.db.collection("usersettings_backup").drop();
    } catch (e) {
      // Collection doesn't exist, ignore
    }

    try {
      await mongoose.connection.db.collection("systemsettings_backup").drop();
    } catch (e) {
      // Collection doesn't exist, ignore
    }

    // Copy old collections to backup
    const userSettingsExists = await mongoose.connection.db
      .listCollections({ name: "usersettings" })
      .hasNext();
    if (userSettingsExists) {
      await mongoose.connection.db
        .collection("usersettings")
        .aggregate([{ $out: "usersettings_backup" }])
        .toArray();

    }

    const systemSettingsExists = await mongoose.connection.db
      .listCollections({ name: "systemsettings" })
      .hasNext();
    if (systemSettingsExists) {
      await mongoose.connection.db
        .collection("systemsettings")
        .aggregate([{ $out: "systemsettings_backup" }])
        .toArray();

    }


  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

/**
 * Rollback migration (restore from backup)
 */
export async function rollbackUnifiedSettingsMigration() {

  try {
    // Drop current settings collection
    await Settings.collection.drop();

    // Restore from backup
    const userBackupExists = await mongoose.connection.db
      .listCollections({ name: "usersettings_backup" })
      .hasNext();
    if (userBackupExists) {
      await mongoose.connection.db
        .collection("usersettings_backup")
        .aggregate([{ $out: "usersettings" }])
        .toArray();

    }

    const systemBackupExists = await mongoose.connection.db
      .listCollections({ name: "systemsettings_backup" })
      .hasNext();
    if (systemBackupExists) {
      await mongoose.connection.db
        .collection("systemsettings_backup")
        .aggregate([{ $out: "systemsettings" }])
        .toArray();

    }


  } catch (error) {
    console.error("❌ Rollback failed:", error);
    throw error;
  }
}
