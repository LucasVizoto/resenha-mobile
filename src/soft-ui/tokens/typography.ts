/**
 * Tipografia geométrica sans-serif (System / Inter / SF Pro).
 */
import { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  bold: 'System',
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 34,
} as const;

export const lineHeight = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 30,
  '2xl': 36,
  '3xl': 42,
} as const;

export const typography = {
  display: {
    fontSize: fontSize['3xl'],
    lineHeight: lineHeight['3xl'],
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -0.5,
  },
  title: {
    fontSize: fontSize['2xl'],
    lineHeight: lineHeight['2xl'],
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -0.3,
  },
  heading: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.xl,
    fontWeight: '600' as TextStyle['fontWeight'],
  },
  body: {
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
    fontWeight: '400' as TextStyle['fontWeight'],
  },
  bodyMedium: {
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
    fontWeight: '500' as TextStyle['fontWeight'],
  },
  label: {
    fontSize: fontSize.sm,
    lineHeight: lineHeight.sm,
    fontWeight: '500' as TextStyle['fontWeight'],
  },
  caption: {
    fontSize: fontSize.xs,
    lineHeight: lineHeight.xs,
    fontWeight: '400' as TextStyle['fontWeight'],
  },
  button: {
    fontSize: fontSize.md,
    lineHeight: lineHeight.md,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 0.2,
  },
} as const;
