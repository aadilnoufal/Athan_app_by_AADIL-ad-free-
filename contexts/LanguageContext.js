import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { languages, getAllTranslations } from '../translations';

// Create the language context
const LanguageContext = createContext();

// Custom hook to use the language context
export const useLanguage = () => useContext(LanguageContext);

// Language provider component
export const LanguageProvider = ({ children }) => {
  const [currentLang, setCurrentLang] = useState('en'); // Default to English
  const [translations, setTranslations] = useState(getAllTranslations('en'));
  const [isRTL, setIsRTL] = useState(false); // Always false - RTL disabled

  // Load saved language preference on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('app_language');
        if (savedLang) {
          changeLanguage(savedLang);
        }
      } catch (error) {
        console.error('Error loading language preference:', error);
      }
    };
    
    loadLanguage();
  }, []);

  // Function to change the current language
  const changeLanguage = async (langId) => {
    try {
      if (languages[langId]) {
        // Save to storage
        await AsyncStorage.setItem('app_language', langId);
        
        // Update state
        setCurrentLang(langId);
        setTranslations(getAllTranslations(langId));
        // RTL is always disabled to prevent UI mirroring
        setIsRTL(false);
      }
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  // Translate function
  const t = (key) => {
    return translations[key] || key;
  };

  // Context value
  const contextValue = {
    currentLang,
    changeLanguage,
    t,
    isRTL,
    availableLanguages: languages
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
