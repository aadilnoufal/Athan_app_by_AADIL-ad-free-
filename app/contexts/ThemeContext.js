// Re-export from root contexts to avoid empty-file import errors.
// The actual ThemeContext lives at contexts/ThemeContext.js
export { ThemeProvider, useTheme, ThemeNames, DarkColors } from '../../contexts/ThemeContext';
export { default } from '../../contexts/ThemeContext';
