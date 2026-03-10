import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { languages, getAllTranslations } from '../translations';
import { forceRescheduleAllNotifications } from '../utils/prayerNotificationScheduler';
import { updateWidgetLanguage } from '../utils/widgetDataBridge';

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
        if (savedLang && languages[savedLang]) {
          // Apply directly without re-saving to storage
          setCurrentLang(savedLang);
          setTranslations(getAllTranslations(savedLang));
        }
      } catch (error) {
        console.error('Error loading language preference:', error);
      }
    };

    loadLanguage();
  }, []);

  // Function to change the current language
  const changeLanguage = useCallback(async (langId) => {
    try {
      if (languages[langId]) {
        // Save to storage
        await AsyncStorage.setItem('app_language', langId);

        // Update state
        setCurrentLang(langId);
        setTranslations(getAllTranslations(langId));
        // RTL is always disabled to prevent UI mirroring
        setIsRTL(false);

        // Reschedule notifications with new language (fire-and-forget)
        forceRescheduleAllNotifications().catch((err) =>
          console.log('⚠️ Notification reschedule after language change failed:', err)
        );

        // Push new language to widget native storage
        updateWidgetLanguage(langId);
      }
    } catch (error) {
      console.error('Error changing language:', error);
    }
  }, []);

  // Translate function
  const t = useCallback((key) => {
    return translations[key] || key;
  }, [translations]);

  // Context value — memoized to prevent unnecessary consumer re-renders
  const contextValue = useMemo(() => ({
    currentLang,
    language: currentLang, // alias for convenience
    changeLanguage,
    t,
    isRTL,
    availableLanguages: languages
  }), [currentLang, changeLanguage, t, isRTL]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
