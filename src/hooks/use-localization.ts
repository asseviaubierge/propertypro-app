/**
 * PropertyPro - Localization Hook
 * React hook for accessing localization features
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  localizationService,
  Currency,
  Locale,
  TranslateOptions,
} from "@/lib/services/localization.service";

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
  language: string;
  t: (key: string, options?: TranslateOptions) => string;
}

export function useLocalization(): LocalizationContextType {
  const [currentLocale, setCurrentLocale] = useState(
    localizationService.getCurrentLocale()
  );
  const [currentCurrency, setCurrentCurrency] = useState(
    localizationService.getCurrentCurrency()
  );
  const [locale, setLocale] = useState(
    localizationService.getLocale(currentLocale)
  );
  const [currency, setCurrency] = useState(
    localizationService.getCurrency(currentCurrency)
  );

  // Update local state when service state changes
  useEffect(() => {
    const updateState = () => {
      const newLocale = localizationService.getCurrentLocale();
      const newCurrency = localizationService.getCurrentCurrency();

      setCurrentLocale(newLocale);
      setCurrentCurrency(newCurrency);
      setLocale(localizationService.getLocale(newLocale));
      setCurrency(localizationService.getCurrency(newCurrency));
    };

    updateState();
  }, []);

  // Load user preferences from localStorage or API
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        // Try to load from localStorage first
        const savedLocale = "fr-FR";
        const savedCurrency = localStorage.getItem("GestionEImmo-currency");

        if (savedLocale) {
          localizationService.setLocale(savedLocale);
        }

        if (savedCurrency) {
          localizationService.setCurrency(savedCurrency);
        }

        // Update exchange rates
        await localizationService.updateExchangeRates();
      } catch (error) {
        console.warn("Impossible de charger les préférences locales :", error);
      }
    };

    loadUserPreferences();
  }, []);

  const handleSetLocale = useCallback(
    (_localeCode: string) => {
      const localeCode = "fr-FR";
      localizationService.setLocale(localeCode);
      setCurrentLocale(localeCode);
      setLocale(localizationService.getLocale(localeCode));

      // Save to localStorage
      localStorage.setItem("GestionEImmo-locale", localeCode);

    },
    []
  );

  const handleSetCurrency = useCallback((currencyCode: string) => {
    localizationService.setCurrency(currencyCode);
    setCurrentCurrency(currencyCode);
    setCurrency(localizationService.getCurrency(currencyCode));

    // Save to localStorage
    localStorage.setItem("GestionEImmo-currency", currencyCode);
  }, []);

  const formatCurrency = useCallback(
    (amount: number, currencyCode?: string, options?: any) => {
      return localizationService.formatCurrency(amount, currencyCode, options);
    },
    []
  );

  const formatDate = useCallback((date: Date | string, options?: any) => {
    return localizationService.formatDate(date, options);
  }, []);

  const formatTime = useCallback((date: Date | string, options?: any) => {
    return localizationService.formatTime(date, options);
  }, []);

  const formatNumber = useCallback((number: number, options?: any) => {
    return localizationService.formatNumber(number, options);
  }, []);

  const formatPercentage = useCallback((value: number, options?: any) => {
    return localizationService.formatPercentage(value, options);
  }, []);

  const convertCurrency = useCallback(
    (amount: number, fromCurrency: string, toCurrency: string) => {
      return localizationService.convertCurrency(
        amount,
        fromCurrency,
        toCurrency
      );
    },
    []
  );

  const language = "fr";

  const t = useCallback(
    (key: string, options?: TranslateOptions) => {
      return localizationService.translate(key, {
        language,
        ...(options || {}),
      });
    },
    [language]
  );

  return {
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
    language,
    t,
  };
}

// Utility hook for currency formatting only
export function useCurrency() {
  const { formatCurrency, currentCurrency, currency, convertCurrency } =
    useLocalization();

  return {
    formatCurrency,
    currentCurrency,
    currency,
    convertCurrency,
  };
}

// Utility hook for date/time formatting only
export function useDateTime() {
  const { formatDate, formatTime, currentLocale, locale } = useLocalization();

  return {
    formatDate,
    formatTime,
    currentLocale,
    locale,
  };
}

// Utility hook for number formatting only
export function useNumberFormat() {
  const { formatNumber, formatPercentage, currentLocale } = useLocalization();

  return {
    formatNumber,
    formatPercentage,
    currentLocale,
  };
}
