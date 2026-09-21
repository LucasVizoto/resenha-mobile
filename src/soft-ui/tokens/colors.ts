/**
 * Resenha — paleta azul Soft UI (mockup messenger clean).
 * Gradiente: azul → ciano. Acentos violeta/magenta nos avatares.
 */

export const palette = {
  blue900: '#1E4FD8',
  blue800: '#2F6BFF',
  blue700: '#3D8BFF',
  blue600: '#4AA4FF',
  blue500: '#4C9DFF',
  blue400: '#6EC8FF',
  blue300: '#8ADFFF',
  blue200: '#C5F0FF',
  blue100: '#E8F7FF',
  blue50: '#F4FBFF',

  cyan600: '#1EC8D4',
  cyan500: '#2EE0E8',
  cyan400: '#5BE7F0',

  violet600: '#6B5CFF',
  violet500: '#7B6CFF',
  violet400: '#9B8CFF',

  magenta500: '#E85AD0',
  magenta400: '#F08CDE',

  // Neutrals
  white: '#FFFFFF',
  black: '#0D0D0D',
  gray50: '#F7F8FB',
  gray100: '#EEEEF4',
  gray200: '#E0E2EA',
  gray300: '#C8CAD4',
  gray400: '#9A9AA8',
  gray500: '#6E6E7C',
  gray600: '#4A4A56',
  gray700: '#2E2E38',
  gray800: '#1C1C24',
  gray900: '#121218',

  // Danger (alertas)
  red500: '#E11D48',
  red400: '#FB7185',
  red50: '#FFF1F3',
} as const;

export type ColorToken = keyof typeof palette;

export const avatarAccents = [
  palette.cyan500,
  palette.violet500,
  palette.blue600,
  palette.magenta500,
  palette.blue400,
] as const;

/** Gradiente dos destaques (header onda, botão primário, balões enviados). */
export const brandGradient = {
  colors: [palette.violet600, palette.blue600, palette.cyan400] as const,
  locations: [0, 0.48, 1] as const,
  start: { x: 0, y: 0.5 },
  end: { x: 1, y: 0.5 },
} as const;

export const brandGradientVertical = {
  colors: [palette.blue800, palette.cyan400] as const,
  locations: [0, 1] as const,
  start: { x: 0.5, y: 0 },
  end: { x: 0.5, y: 1 },
} as const;
