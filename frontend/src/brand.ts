// SuiVerify Brand Colors
export const brandColors = {
    // Primary Blue
    primary: '#4DA2FF',
    
    // Dark Navy
    darkNavy: '#011829',
    
    // Light Blue
    lightBlue: '#c0e6ff',
    
    // Darker Navy
    darkerNavy: '#030f1c',
    
    // White
    white: '#ffffff',
  } as const;
  
  // Color variations for different use cases
  export const brandColorVariations = {
    primary: {
      DEFAULT: brandColors.primary,
      50: '#f0f8ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: brandColors.primary, // #4DA2FF
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
    darkNavy: {
      DEFAULT: brandColors.darkNavy,
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: brandColors.darkNavy, // #011829
    },
    lightBlue: {
      DEFAULT: brandColors.lightBlue,
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: brandColors.lightBlue, // #c0e6ff
    },
    darkerNavy: {
      DEFAULT: brandColors.darkerNavy,
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: brandColors.darkerNavy, // #030f1c
    },
  } as const;
  
  // Semantic color mappings
  export const semanticColors = {
    background: {
      primary: brandColors.darkerNavy,
      secondary: brandColors.darkNavy,
      light: brandColors.lightBlue,
    },
    text: {
      primary: brandColors.white,
      secondary: brandColors.lightBlue,
      muted: '#94a3b8',
    },
    accent: {
      primary: brandColors.primary,
      secondary: brandColors.lightBlue,
    },
    border: {
      primary: brandColors.primary,
      secondary: brandColors.lightBlue,
      muted: '#334155',
    },
  } as const;
  
  // Gradient definitions
  export const gradients = {
    primary: `linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.lightBlue} 100%)`,
    dark: `linear-gradient(135deg, ${brandColors.darkerNavy} 0%, ${brandColors.darkNavy} 100%)`,
    hero: `linear-gradient(135deg, ${brandColors.darkerNavy} 0%, ${brandColors.darkNavy} 50%, ${brandColors.darkNavy} 100%)`,
    card: `linear-gradient(135deg, ${brandColors.darkNavy} 0%, ${brandColors.darkNavy} 100%)`,
  } as const;
  
  // Export all colors for easy access
  export const colors = {
    ...brandColors,
    variations: brandColorVariations,
    semantic: semanticColors,
    gradients,
  } as const;
  
  export default colors;
  