/** Espaçamento generoso Soft UI. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 56,
  '4xl': 72,
} as const;

export const screenPadding = {
  horizontal: spacing.lg,
  vertical: spacing.lg,
} as const;
