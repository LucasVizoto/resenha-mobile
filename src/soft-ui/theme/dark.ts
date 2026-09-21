import { palette, brandGradient, brandGradientVertical } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { spacing, screenPadding } from '../tokens/spacing';
import { radii } from '../tokens/radii';
import { shadows } from '../tokens/shadows';
import type { AppTheme } from './light';

export const darkTheme: AppTheme = {
  mode: 'dark',
  colors: {
    background: palette.gray900,
    backgroundSubtle: palette.gray800,
    surface: palette.gray800,
    surfaceElevated: palette.gray700,
    textPrimary: palette.gray50,
    textSecondary: palette.gray300,
    textMuted: palette.gray400,
    textOnBrand: palette.white,
    placeholder: palette.gray400,
    borderSubtle: palette.gray700,
    inputFill: palette.gray800,
    overlay: 'rgba(0, 0, 0, 0.55)',
    danger: palette.red400,
    success: '#4ADE80',
    brand: {
      solid: palette.blue400,
      soft: palette.blue900,
      muted: palette.blue800,
    },
  },
  gradient: {
    ...brandGradient,
    colors: [palette.violet600, palette.blue700, palette.cyan400],
  },
  gradientVertical: {
    ...brandGradientVertical,
    colors: [palette.blue900, palette.cyan500],
  },
  typography,
  spacing,
  screenPadding,
  radii,
  shadows: {
    soft: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 4,
    },
    softStrong: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.45,
      shadowRadius: 24,
      elevation: 8,
    },
    fab: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 10,
    },
    brand: {
      shadowColor: '#4C9DFF',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 18,
      elevation: 8,
    },
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 4,
    },
    button: {
      shadowColor: '#4C9DFF',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 18,
      elevation: 8,
    },
  },
};
