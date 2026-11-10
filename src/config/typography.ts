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
    tagline: {
      fontSize: 18,
      color: palette.textSecondary,
    },
    footer: {
      fontSize: 12,
      letterSpacing: 2,
      color: palette.textMuted,
    },
  },
} as const;

export type TypographyStyle = keyof typeof typography.styles;
