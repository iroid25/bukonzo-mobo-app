/**
 * Design tokens for the agent (field officer) side of the app.
 *
 * Pulled from the "SACCO Agent Portal" reference mock: a pale lime canvas,
 * white cards with hairline borders, deep forest ink, and a single bright lime
 * accent used for primary actions and data highlights. The floating tab bar in
 * `components/FloatingTabBar.tsx` already uses `forest`/`lime` - these tokens
 * keep the rest of the agent screens on the same palette.
 */

export const AGENT = {
  /** Page background - barely-there lime tint so white cards lift off it. */
  canvas: '#F3F7EC',
  /** Primary accent: action circles, active states, positive figures. */
  lime: '#C6F24E',
  /** Pressed / border variant of the accent. */
  limeDeep: '#A9DC3A',
  /** Wash behind icons and chips. */
  limeSoft: '#E9F8C4',
  /** Deep green used for the tab bar, headings and icons on lime. */
  forest: '#0D3D2B',

  card: '#FFFFFF',
  line: '#EAF0E1',

  ink: '#101A14',
  muted: '#6B7F72',
  faint: '#9BB0A2',

  positive: '#2ECC8A',
  warning: '#F5A524',
  danger: '#F05069',
} as const;

/** Radii used across agent cards so everything shares one silhouette. */
export const RADIUS = {
  card: 22,
  tile: 18,
  pill: 999,
} as const;

/** Soft, low-contrast card shadow (iOS) / elevation (Android). */
export const cardShadow = {
  shadowColor: '#1B2E22',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.05,
  shadowRadius: 12,
  elevation: 2,
} as const;
