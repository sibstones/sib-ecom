/** Stored in DB `lookbook.season`; labels via i18n `lookbook.*` keys. */
export const LOOKBOOK_SEASONS = [
  'Winter/Spring',
  'Spring',
  'Spring/Summer',
  'Summer',
  'Summer/Fall',
  'Fall',
  'Fall/Winter',
  'Winter',
] as const;

export type LookbookSeason = (typeof LOOKBOOK_SEASONS)[number];

export const LOOKBOOK_SEASON_I18N: Record<LookbookSeason, string> = {
  'Winter/Spring': 'lookbook.winterSpring',
  Spring: 'lookbook.spring',
  'Spring/Summer': 'lookbook.springSummer',
  Summer: 'lookbook.summer',
  'Summer/Fall': 'lookbook.summerFall',
  Fall: 'lookbook.fall',
  'Fall/Winter': 'lookbook.fallWinter',
  Winter: 'lookbook.winter',
};

/** Newest-first sort weight within a year (higher = later in fashion calendar). */
export const LOOKBOOK_SEASON_SORT_ORDER: Record<string, number> = {
  'Winter/Spring': 0,
  Spring: 1,
  'Spring/Summer': 2,
  Summer: 3,
  'Summer/Fall': 4,
  Fall: 5,
  'Fall/Winter': 6,
  Winter: 7,
};

export function compareLookbookSeasons(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const aOrder = a != null ? (LOOKBOOK_SEASON_SORT_ORDER[a] ?? -1) : -1;
  const bOrder = b != null ? (LOOKBOOK_SEASON_SORT_ORDER[b] ?? -1) : -1;
  return bOrder - aOrder;
}
