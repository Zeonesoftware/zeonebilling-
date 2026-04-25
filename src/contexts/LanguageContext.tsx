import React, { createContext, useContext, useState } from 'react';

type Language = 'en' | 'hi' | 'ta' | 'te';

interface Translations {
  [key: string]: {
    [lang in Language]: string;
  };
}

const translations: Translations = {
  dashboard: { en: 'Dashboard', hi: 'डैशबोर्ड', ta: 'டாஷ்போர்டு', te: 'డాష్‌బోర్డ్' },
  invoices: { en: 'Invoices', hi: 'इनवॉइस', ta: 'இன்வாய்ஸ்கள்', te: 'ఇన్‌వాయిస్‌లు' },
  products: { en: 'Products', hi: 'उत्पाद', ta: 'தயாரிப்புகள்', te: 'ఉత్పత్తులు' },
  clients: { en: 'Clients', hi: 'ग्राहक', ta: 'வாடிக்கையாளர்கள்', te: 'క్లయింట్లు' },
  expenses: { en: 'Expenses', hi: 'खर्चे', ta: 'செலவுகள்', te: 'ఖర్చులు' },
  reports: { en: 'Reports', hi: 'रिपोर्ट', ta: 'அறிக்கைகள்', te: 'నివేదికలు' },
  settings: { en: 'Settings', hi: 'सेटिंग्स', ta: 'அமைப்புகள்', te: 'సెట్టింగ్‌లు' },
  total_sales: { en: 'Total Sales', hi: 'कुल बिक्री', ta: 'மொத்த விற்பனை', te: 'మొత్తం అమ్మకాలు' },
  outstanding: { en: 'Outstanding', hi: 'बकाया', ta: 'நிலுவையில் உள்ளது', te: 'బకాయి ఉంది' },
  recent_invoices: { en: 'Recent Invoices', hi: 'हाल के इनवॉइस', ta: 'சமீபத்திய இன்வாய்ஸ்கள்', te: 'ఇటీవలి ఇన్వాయిస్లు' },
  new_invoice: { en: 'New Invoice', hi: 'नया इनवॉइस', ta: 'புதிய இன்வாய்ஸ்', te: 'కొత్త ఇన్వాయిస్' },
  search_placeholder: { en: 'Search...', hi: 'खोजें...', ta: 'தேடு...', te: 'వెతకండి...' }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('zeone_lang') as Language) || 'en';
  });

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('zeone_lang', lang);
  };

  const t = (key: string) => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useTranslation must be used within LanguageProvider');
  return context;
}
