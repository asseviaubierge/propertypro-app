import enCommon from "./en/common.json";
import enSettings from "./en/settings.json";
import enDashboard from "./en/dashboard.json";
import enProperties from "./en/properties.json";
import enTenants from "./en/tenants.json";
import enLeases from "./en/leases.json";
import enMaintenance from "./en/maintenance.json";
import enPayments from "./en/payments.json";
import enMessages from "./en/messages.json";
import enCalendar from "./en/calendar.json";
import enAdmin from "./en/admin.json";
import enAnnouncements from "./en/announcements.json";
import enReports from "./en/reports.json";
import enInspections from "./en/inspections.json";
import esCommon from "./es/common.json";
import esSettings from "./es/settings.json";
import esDashboard from "./es/dashboard.json";
import esProperties from "./es/properties.json";
import esTenants from "./es/tenants.json";
import esLeases from "./es/leases.json";
import esMaintenance from "./es/maintenance.json";
import esPayments from "./es/payments.json";
import esMessages from "./es/messages.json";
import esCalendar from "./es/calendar.json";
import esAdmin from "./es/admin.json";
import esAnnouncements from "./es/announcements.json";
import esReports from "./es/reports.json";
import esInspections from "./es/inspections.json";
import frCommon from "./fr/common.json";
import frSettings from "./fr/settings.json";
import frDashboard from "./fr/dashboard.json";
import frProperties from "./fr/properties.json";
import frTenants from "./fr/tenants.json";
import frLeases from "./fr/leases.json";
import frMaintenance from "./fr/maintenance.json";
import frPayments from "./fr/payments.json";
import frMessages from "./fr/messages.json";
import frCalendar from "./fr/calendar.json";
import frAdmin from "./fr/admin.json";
import frAnnouncements from "./fr/announcements.json";
import frReports from "./fr/reports.json";
import frInspections from "./fr/inspections.json";
import deCommon from "./de/common.json";
import deSettings from "./de/settings.json";
import deDashboard from "./de/dashboard.json";
import deProperties from "./de/properties.json";
import deTenants from "./de/tenants.json";
import deLeases from "./de/leases.json";
import deMaintenance from "./de/maintenance.json";
import dePayments from "./de/payments.json";
import deMessages from "./de/messages.json";
import deCalendar from "./de/calendar.json";
import deAdmin from "./de/admin.json";
import deAnnouncements from "./de/announcements.json";
import deReports from "./de/reports.json";
import deInspections from "./de/inspections.json";
import arCommon from "./ar/common.json";
import arSettings from "./ar/settings.json";
import arDashboard from "./ar/dashboard.json";
import arProperties from "./ar/properties.json";
import arTenants from "./ar/tenants.json";
import arLeases from "./ar/leases.json";
import arMaintenance from "./ar/maintenance.json";
import arPayments from "./ar/payments.json";
import arMessages from "./ar/messages.json";
import arCalendar from "./ar/calendar.json";
import arAdmin from "./ar/admin.json";
import arAnnouncements from "./ar/announcements.json";
import arReports from "./ar/reports.json";
import arInspections from "./ar/inspections.json";

type LanguageCatalog = Record<string, string>;

const mergeCatalogs = (...sources: LanguageCatalog[]): LanguageCatalog => {
  return Object.assign({}, ...sources);
};

const catalogsByLanguage: Record<string, LanguageCatalog> = {
  en: mergeCatalogs(
    enCommon,
    enSettings,
    enDashboard,
    enProperties,
    enTenants,
    enLeases,
    enMaintenance,
    enPayments,
    enMessages,
    enCalendar,
    enAdmin,
    enAnnouncements,
    enReports,
    enInspections
  ),
  es: mergeCatalogs(
    esCommon,
    esSettings,
    esDashboard,
    esProperties,
    esTenants,
    esLeases,
    esMaintenance,
    esPayments,
    esMessages,
    esCalendar,
    esAdmin,
    esAnnouncements,
    esReports,
    esInspections
  ),
  fr: mergeCatalogs(
    frCommon,
    frSettings,
    frDashboard,
    frProperties,
    frTenants,
    frLeases,
    frMaintenance,
    frPayments,
    frMessages,
    frCalendar,
    frAdmin,
    frAnnouncements,
    frReports,
    frInspections
  ),
  de: mergeCatalogs(
    deCommon,
    deSettings,
    deDashboard,
    deProperties,
    deTenants,
    deLeases,
    deMaintenance,
    dePayments,
    deMessages,
    deCalendar,
    deAdmin,
    deAnnouncements,
    deReports,
    deInspections
  ),
  ar: mergeCatalogs(
    arCommon,
    arSettings,
    arDashboard,
    arProperties,
    arTenants,
    arLeases,
    arMaintenance,
    arPayments,
    arMessages,
    arCalendar,
    arAdmin,
    arAnnouncements,
    arReports,
    arInspections
  ),
};

export const translations: Record<string, Record<string, string>> = {};

for (const [language, catalog] of Object.entries(catalogsByLanguage)) {
  for (const [key, value] of Object.entries(catalog)) {
    if (!translations[key]) {
      translations[key] = {};
    }
    translations[key][language] = value;
  }
}
