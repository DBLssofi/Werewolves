/**
 * Design tokens. Mirrors the Figma file "Werewolf game" (collections Primitives / Color / Size,
 * and the text styles). Change a value here and in Figma together.
 */
import type { TextStyle } from 'react-native';

const primitives = {
  ink950: '#12121A',
  ink900: '#161616',
  ink850: '#222233',
  ink800: '#2A2A2A',
  ink700: '#303030',
  blood900: '#4A111A',
  blood800: '#711A1F',
  blood700: '#931515',
  blood600: '#CB3530',
  dusk500: '#474B6B',
  sand500: '#B89B6D',
  sand200: '#E6D3A3',
  grey500: '#555555',
  grey300: '#9A9AA8',
  white: '#FFFFFF',
};

export const color = {
  bgApp: primitives.ink950,
  bgSurface: primitives.ink700,
  bgCard: primitives.dusk500,
  bgSecondary: primitives.ink900,
  bgSecondaryPressed: primitives.ink850,
  accent: primitives.blood600,
  accentPressed: primitives.blood700,
  accentDeep: primitives.blood800,
  accentDarkest: primitives.blood900,
  selected: primitives.sand500,
  dead: primitives.grey500,
  textPrimary: primitives.white,
  textMuted: primitives.grey300,
  textAccent: primitives.blood600,
  textGold: primitives.sand200,
  textOnAccent: primitives.white,
  textDisabled: primitives.grey500,
  border: primitives.ink800,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, x2: 32 };
export const radius = { sm: 10, md: 16, full: 999 };

/** Font family names as loaded in app/_layout.tsx. */
export const font = {
  display: 'Cinzel_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodyBold: 'Inter_700Bold',
};

/** The Figma text styles. Letter spacing in Figma is a percentage of the font size. */
const ls = (percent: number, size: number) => (percent * size) / 100;

export const text: Record<
  'title' | 'heading' | 'option' | 'card' | 'caps' | 'body' | 'small' | 'buttonLarge' | 'buttonMedium',
  TextStyle
> = {
  title: { fontFamily: font.display, fontSize: 40, letterSpacing: ls(-4, 40) },
  heading: { fontFamily: font.display, fontSize: 28, letterSpacing: ls(-2, 28) },
  option: { fontFamily: font.display, fontSize: 20, letterSpacing: ls(-1.9, 20), lineHeight: 30 },
  card: { fontFamily: font.display, fontSize: 13, letterSpacing: ls(6, 13) },
  caps: { fontFamily: font.body, fontSize: 16, letterSpacing: ls(20, 16) },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: font.body, fontSize: 14, lineHeight: 20 },
  buttonLarge: { fontFamily: font.bodyBold, fontSize: 20 },
  buttonMedium: { fontFamily: font.bodyBold, fontSize: 16 },
};

/** Minimum touch target (one-handed use in the dark). */
export const touch = 48;
