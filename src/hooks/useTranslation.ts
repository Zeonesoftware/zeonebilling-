import { useState, useCallback } from 'react';

type Language = 'en' | 'hi'| 'gu' | 'mr';

const translations: Record<Language, Record<string, string>> = {
  en: {
    dashboard: 'Dashboard',
    invoices: 'Invoices',
    products: 'Products',
    clients: 'Clients',
    expenses: 'Expenses',
    reports: 'Reports',
    settings: 'Settings',
    logout: 'Logout',
    profile: 'Profile',
    welcome: 'Welcome',
  },
  hi: {
    dashboard: 'डैशबोर्ड',
    invoices: 'इनवॉइस',
    products: 'उत्पाद',
    clients: 'ग्राहक',
    expenses: 'खर्च',
    reports: 'रिपोर्ट',
    settings: 'सेटिंग्स',
    logout: 'लॉगआउट',
    profile: 'प्रोफ़ाइल',
    welcome: 'स्वागत है',
  },
  gu: {
    dashboard: 'ડેશબોર્ડ',
    invoices: 'ઈનવોઈસ',
    products: 'ઉત્પાદનો',
    clients: 'ગ્રાહકો',
    expenses: 'ખર્ચ',
    reports: 'રિપોર્ટ',
    settings: 'સેટિંગ્સ',
    logout: 'લોગઆઉટ',
    profile: 'પ્રોફાઇલ',
    welcome: 'સ્વાગત છે',
  },
  mr: {
    dashboard: 'डॅशबोर्ड',
    invoices: 'इनव्हॉइस',
    products: 'उत्पादने',
    clients: 'ग्राहक',
    expenses: 'खर्च',
    reports: 'रिपोर्ट',
    settings: 'सेटिंग्ज',
    logout: 'लॉगआउट',
    profile: 'प्रोफाइल',
    welcome: 'स्वागत आहे',
  }
};

export function useTranslation() {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('language') as Language) || 'en';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  }, []);

  const t = useCallback((key: string) => {
    return translations[language][key] || key;
  }, [language]);

  return { t, language, setLanguage };
}
