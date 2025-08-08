import en from './en';
import ar from './ar';

// Available languages
export const languages = {
  en: {
    id: 'en',
    name: 'English',
    rtl: false,
    translations: en
  },
  ar: {
    id: 'ar',
    name: 'العربية', // Arabic
    rtl: false, // Disabled RTL to prevent UI mirroring
    translations: ar
  }
};

// Get translation for a specific key
export function getTranslation(langId, key) {
  // Default to English if language is not found
  const language = languages[langId] || languages.en;
  return language.translations[key] || key; // Return the key itself if translation not found
}

// Get all translations for a language
export function getAllTranslations(langId) {
  return (languages[langId] || languages.en).translations;
}

// Get language object
export function getLanguage(langId) {
  return languages[langId] || languages.en;
}

// Export language utilities
export default {
  languages,
  getTranslation,
  getAllTranslations,
  getLanguage
};
