// Original Riftbound Duel display labels.
// DB columns and class slugs are NOT changed — these are pure UI overlays.
//
// Internal legacy name notes:
//   - characters.vibranium  -> shown as "Aetherium"
//   - class slug "mercenary" -> shown as "Iron Vanguard"
//   - class slug "tech-mage" -> shown as "Arc Engineer"
//   - class slug "gunner"    -> shown as "Rift Stalker"

export const APP_NAME = 'Riftbound Duel';
export const APP_NAME_PARTS = { primary: 'RIFTBOUND', secondary: 'DUEL' } as const;
export const APP_TAGLINE = 'Battle across the Rift in tactical sci-fi duels.';

export const CURRENCY = {
  credits: { label: 'Credits', short: 'c' },
  premium: { label: 'Aetherium', short: 'AE' },
} as const;

/** Display name overrides for class slugs. Falls back to slug if missing. */
export const CLASS_DISPLAY: Record<string, string> = {
  mercenary: 'Iron Vanguard',
  'tech-mage': 'Arc Engineer',
  gunner: 'Rift Stalker',
  blademaster: 'Blademaster',
  'tech-sentinel': 'Tech Sentinel',
  tactician: 'Tactician',
  'shadow-operative': 'Shadow Operative',
  demolisher: 'Demolisher',
  'cyber-warden': 'Cyber Warden',
};

export const CLASS_DISPLAY_UPPER: Record<string, string> = Object.fromEntries(
  Object.entries(CLASS_DISPLAY).map(([k, v]) => [k, v.toUpperCase()]),
);

export const classDisplayName = (slug: string | null | undefined): string =>
  (slug && CLASS_DISPLAY[slug]) || (slug ?? '');

export const classDisplayUpper = (slug: string | null | undefined): string =>
  (slug && CLASS_DISPLAY_UPPER[slug]) || (slug ?? '').toUpperCase();
