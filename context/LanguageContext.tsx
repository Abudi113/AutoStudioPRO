
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations } from '../i18n';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: keyof typeof translations['en']) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'carveo-lang';
const GERMAN_DEFAULT_COUNTRIES = new Set(['DE', 'AT', 'LI']);

const parseLocale = (locale: string): { language: string; country?: string } => {
    const normalized = locale.replace('_', '-').trim();
    const [language = '', country] = normalized.split('-');
    return { language: language.toLowerCase(), country: country?.toUpperCase() };
};

const detectDefaultLanguage = (): Language => {
    if (typeof navigator === 'undefined') {
        return 'en';
    }

    const browserLocales = navigator.languages?.length ? navigator.languages : [navigator.language];

    for (const locale of browserLocales) {
        const { country } = parseLocale(locale);
        if (country && GERMAN_DEFAULT_COUNTRIES.has(country)) {
            return 'de';
        }
    }

    // Fallback: if country is missing but browser preference is German, default to German.
    for (const locale of browserLocales) {
        const { language } = parseLocale(locale);
        if (language === 'de') {
            return 'de';
        }
    }

    return 'en';
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'de' || saved === 'en') {
            return saved;
        }

        return detectDefaultLanguage();
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, language);
        document.dir = 'ltr';
    }, [language]);

    const t = (key: keyof typeof translations['en']): string => {
        const langData = translations[language] || translations['en'];
        return (langData as any)[key] || (translations['en'] as any)[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
};
