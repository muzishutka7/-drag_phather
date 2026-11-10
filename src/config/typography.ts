import { palette } from './palette';

export const typography = {
  fontFamily: 'Arial, sans-serif',
  styles: {
    title: {
      fontSize: 56,
      fontStyle: 'bold',
      letterSpacing: 4,
      color: palette.textPrimary,
    },
    mode: {
      fontSize: 28,
      fontStyle: 'bold',
      letterSpacing: 12,
      color: palette.accent,
    },
    button: {
      fontSize: 30,
      fontStyle: 'bold',
      letterSpacing: 2,
      color: palette.textPrimary,
    },
    tagline: {
      fontSize: 18,
      color: palette.textSecondary,
    },
    footer: {
      fontSize: 12,
      letterSpacing: 2,
      color: palette.textMuted,
    },
    qualityLabel: {
      fontSize: 13,
      letterSpacing: 1,
      color: palette.textMuted,
    },
    qualityOption: {
      fontSize: 11,
      fontStyle: 'bold',
      color: palette.textSecondary,
    },
    frameRateOption: {
      fontSize: 11,
      fontStyle: 'bold',
      color: palette.textSecondary,
    },
    settingsTitle: {
      fontSize: 14,
      fontStyle: 'bold',
      letterSpacing: 1,
      color: palette.textPrimary,
    },
    settingsClose: {
      fontSize: 20,
      fontStyle: 'bold',
      color: palette.textSecondary,
    },
  },
} as const;

export type TypographyStyle = keyof typeof typography.styles;
