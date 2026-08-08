/**
 * PropertyPro - Localization Provider
 * Context provider for localization features
 */

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  localizationService,
  Currency,
  Locale,
  TranslateOptions,
} from "@/lib/services/localization.service";
import { ensureIntlCurrencyPatch } from "@/lib/utils/ensure-intl-currency-patch";
import { useSettings } from "@/components/providers/SettingsProvider";

export interface LocalizationContextType {
  currentLocale: string;
  currentCurrency: string;
  locale: Locale | undefined;
  currency: Currency | undefined;
  allLocales: Locale[];
  allCurrencies: Currency[];
  setLocale: (localeCode: string) => void;
  setCurrency: (currencyCode: string) => void;
  formatCurrency: (
    amount: number,
    currencyCode?: string,
    options?: any
  ) => string;
  formatDate: (date: Date | string, options?: any) => string;
  formatTime: (date: Date | string, options?: any) => string;
  formatNumber: (number: number, options?: any) => string;
  formatPercentage: (value: number, options?: any) => string;
  convertCurrency: (
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ) => number;
  isRTL: boolean;
  firstDayOfWeek: number;
  loading: boolean;
  language: string;
  t: (key: string, options?: TranslateOptions) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(
  undefined
);

export function useLocalizationContext(): LocalizationContextType {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error(
      "useLocalizationContext must be used within a LocalizationProvider"
    );
  }
  return context;
}
import { formatCurrency } from "@/lib/utils/formatting";

interface LocalizationProviderProps {
  children: React.ReactNode;
  initialLocale?: string;
  initialCurrency?: string;
}

export function LocalizationProvider({
  children,
  initialLocale,
  initialCurrency,
}: LocalizationProviderProps) {
  ensureIntlCurrencyPatch();

  // Currency + language now flow from the global SettingsProvider (single source of truth).
  const { settings: displaySettings } = useSettings();

  const [currentLocale, setCurrentLocale] = useState(
    initialLocale || localizationService.getCurrentLocale()
  );
  const [currentCurrency, setCurrentCurrency] = useState(
    initialCurrency || localizationService.getCurrentCurrency()
  );
  const [locale, setLocale] = useState(
    localizationService.getLocale(currentLocale)
  );
  const [currency, setCurrency] = useState(
    localizationService.getCurrency(currentCurrency)
  );
  const [loading, setLoading] = useState(true);

  // Keep the latest currency in a ref so `applyCurrency` can stay referentially
  // stable. Without this, recreating `applyCurrency` on every currency change
  // re-runs the settings-sync effect below, which re-applies the saved currency
  // and reverts the user's just-made (unsaved) selection.
  const currentCurrencyRef = useRef(currentCurrency);
  useEffect(() => {
    currentCurrencyRef.current = currentCurrency;
  }, [currentCurrency]);

  const applyCurrency = useCallback(
    (currencyCode: string, persist = false) => {
      if (!currencyCode) {
        return;
      }

      const serviceCurrency = localizationService.getCurrentCurrency();
      if (
        currencyCode === currentCurrencyRef.current &&
        currencyCode === serviceCurrency
      ) {
        return;
      }

      localizationService.setCurrency(currencyCode);
      setCurrentCurrency(currencyCode);
      setCurrency(localizationService.getCurrency(currencyCode));

      if (persist && typeof window !== "undefined") {
        localStorage.setItem("GestionEImmo-currency", currencyCode);
      }
    },
    []
  );

  // Initialize localization service
  useEffect(() => {
    const initializeLocalization = async () => {
      try {
        // Load user preferences from localStorage
        const savedLocale = localStorage.getItem("GestionEImmo-locale");
        const savedCurrency = localStorage.getItem("GestionEImmo-currency");

        if (savedLocale && !initialLocale) {
          localizationService.setLocale(savedLocale);
          setCurrentLocale(savedLocale);
          setLocale(localizationService.getLocale(savedLocale));
        } else if (initialLocale) {
          localizationService.setLocale(initialLocale);
          setCurrentLocale(initialLocale);
          setLocale(localizationService.getLocale(initialLocale));
        }

        if (savedCurrency && !initialCurrency) {
          applyCurrency(savedCurrency);
        } else if (initialCurrency) {
          applyCurrency(initialCurrency);
        }

        // Update exchange rates
        await localizationService.updateExchangeRates();
      } catch (error) {
        console.error("Failed to initialize localization:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeLocalization();
  }, [initialLocale, initialCurrency, applyCurrency]);

  const handleSetLocale = useCallback(
    (localeCode: string) => {
      localizationService.setLocale(localeCode);
      setCurrentLocale(localeCode);
      setLocale(localizationService.getLocale(localeCode));

      localStorage.setItem("GestionEImmo-locale", localeCode);
    },
    []
  );

  const handleSetCurrency = useCallback(
    (currencyCode: string) => {
      applyCurrency(currencyCode, true);
    },
    [applyCurrency]
  );

  // Cross-tab currency changes coming from standalone currency switchers that
  // persist directly to localStorage (the SettingsProvider broadcast covers the
  // settings-form path).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "GestionEImmo-currency" || !event.newValue) return;
      if (event.newValue === currentCurrency) return;
      applyCurrency(event.newValue, false);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [applyCurrency, currentCurrency]);

  // Apply currency + language from the global SettingsProvider. This reacts to
  // the initial fetch and to live (same-tab/cross-tab) updates without a
  // separate network request.
  useEffect(() => {
    if (displaySettings?.currency) {
      applyCurrency(displaySettings.currency, true);
    }

    if (displaySettings?.language) {
      // Display settings store a short language code; locate a matching locale.
      const normalized = displaySettings.language.toLowerCase();
      const availableLocales = localizationService.getAllLocales();
      const matchingLocale = availableLocales.find(
        (locale) => locale.code.toLowerCase() === normalized
      );
      const localeByLanguage =
        matchingLocale ||
        availableLocales.find((locale) =>
          locale.code.toLowerCase().startsWith(`${normalized}-`)
        );

      if (localeByLanguage) {
        handleSetLocale(localeByLanguage.code);
      }
    }
  }, [
    displaySettings?.currency,
    displaySettings?.language,
    applyCurrency,
    handleSetLocale,
  ]);

  // const formatCurrency = (
  //   amount: number,
  //   currencyCode?: string,
  //   options?: any
  // ) => {
  //   return localizationService.formatCurrency(amount, currencyCode, options);
  // };

  const formatDate = (date: Date | string, options?: any) => {
    return localizationService.formatDate(date, options);
  };

  const formatTime = (date: Date | string, options?: any) => {
    return localizationService.formatTime(date, options);
  };

  const formatNumber = (number: number, options?: any) => {
    return localizationService.formatNumber(number, options);
  };

  const formatPercentage = (value: number, options?: any) => {
    return localizationService.formatPercentage(value, options);
  };

  const convertCurrency = (
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ) => {
    return localizationService.convertCurrency(
      amount,
      fromCurrency,
      toCurrency
    );
  };

  const language = (currentLocale || "en").split("-")[0].toLowerCase();

  const t = useCallback(
    (key: string, options?: TranslateOptions) => {
      return localizationService.translate(key, {
        language,
        ...(options || {}),
      });
    },
    [language]
  );

  const contextValue: LocalizationContextType = {
    currentLocale,
    currentCurrency,
    locale,
    currency,
    allLocales: localizationService.getAllLocales(),
    allCurrencies: localizationService.getAllCurrencies(),
    setLocale: handleSetLocale,
    setCurrency: handleSetCurrency,
    formatCurrency,
    formatDate,
    formatTime,
    formatNumber,
    formatPercentage,
    convertCurrency,
    isRTL: localizationService.isRTL(),
    firstDayOfWeek: localizationService.getFirstDayOfWeek(),
    loading,
    language,
    t,
  };

  return (
    <LocalizationContext.Provider value={contextValue}>
      {children}
    </LocalizationContext.Provider>
  );
}

// Export the context for direct use if needed
export { LocalizationContext };
