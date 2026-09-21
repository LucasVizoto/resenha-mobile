import { ViewStyle } from 'react-native';
import { palette, brandGradient, brandGradientVertical } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { spacing, screenPadding } from '../tokens/spacing';
import { radii } from '../tokens/radii';
import { shadows } from '../tokens/shadows';

export type AppTheme = {
  mode: 'light' | 'dark';
  colors: {
    background: string;
    backgroundSubtle: string;
    surface: string;
    surfaceElevated: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textOnBrand: string;
    placeholder: string;
    borderSubtle: string;
    inputFill: string;
    overlay: string;
    danger: string;
    success: string;
    brand: {
      solid: string;
      soft: string;
      muted: string;
    };
  };
  gradient: {
    colors: readonly [string, string, string];
    locations: readonly [number, number, number];
    start: { x: number; y: number };
    end: { x: number; y: number };
  };
  gradientVertical: {
    colors: readonly [string, string];
    locations: readonly [number, number];
    start: { x: number; y: number };
    end: { x: number; y: number };
  };
  typography: typeof typography;
  spacing: typeof spacing;
  screenPadding: typeof screenPadding;
  radii: typeof radii;
  shadows: {
    soft: ViewStyle;
    softStrong: ViewStyle;
    fab: ViewStyle;
    brand: ViewStyle;
    card: ViewStyle;
    button: ViewStyle;
  };
};

export const lightTheme: AppTheme = {
  mode: 'light',
  colors: {
    background: palette.white,
    backgroundSubtle: palette.gray50,
    surface: palette.white,
    surfaceElevated: palette.white,
    textPrimary: palette.gray900,
    textSecondary: palette.gray500,
    textMuted: palette.gray400,
    textOnBrand: palette.white,
    placeholder: palette.gray400,
    borderSubtle: palette.gray100,
    inputFill: palette.gray50,
    overlay: 'rgba(30, 79, 216, 0.28)',
    danger: palette.red500,
    success: '#16A34A',
    brand: {
      solid: palette.blue600,
      soft: palette.blue50,
      muted: palette.blue100,
    },
  },
  gradient: brandGradient,
  gradientVertical: brandGradientVertical,
  typography,
  spacing,
  screenPadding,
  radii,
  shadows: {
    ...shadows,
    card: shadows.soft,
    button: shadows.brand,
  },
};
