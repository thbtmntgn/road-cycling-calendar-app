import { Race, RaceCategory } from '../types';

export type StageTypeKey = NonNullable<Race['stageType']>;
export type RaceSubgroupKey = 'grand-tour' | 'monument' | 'major-tour' | 'top-classic';

interface CategoryAccentPalette {
  oneDay: string;
  stage: string;
}

interface BadgePalette {
  text: string;
  bg: string;
  border: string;
}

interface RaceSubgroupPalette extends BadgePalette {
  label: string;
}

export const CATEGORY_ACCENT_COLORS: Record<RaceCategory, CategoryAccentPalette> = {
  [RaceCategory.WorldTour]: { oneDay: '#EF4444', stage: '#DC2626' },
  [RaceCategory.WomenWorldTour]: { oneDay: '#F472B6', stage: '#EC4899' },
  [RaceCategory.WorldChampionship]: { oneDay: '#FB923C', stage: '#F97316' },
  [RaceCategory.WomenWorldChampionship]: { oneDay: '#FDA4AF', stage: '#FB7185' },
  [RaceCategory.ProSeries]: { oneDay: '#5AB6E3', stage: '#3C9FD0' },
  [RaceCategory.WomenProSeries]: { oneDay: '#B39BFF', stage: '#9A7CF6' },
  [RaceCategory.NationalChampionship]: { oneDay: '#A8B4C5', stage: '#8A98AB' },
  [RaceCategory.WomenNationalChampionship]: { oneDay: '#D7DEE9', stage: '#BEC8D8' },
  [RaceCategory.Continental]: { oneDay: '#F6B67A', stage: '#F4A261' },
};

const DEFAULT_CATEGORY_ACCENTS: CategoryAccentPalette = {
  oneDay: '#8FA1B2',
  stage: '#738497',
};

export const getCategoryAccentColor = (
  category: RaceCategory | string,
  isOneDayRace: boolean
): string => {
  const palette = CATEGORY_ACCENT_COLORS[category as RaceCategory] ?? DEFAULT_CATEGORY_ACCENTS;
  return isOneDayRace ? palette.oneDay : palette.stage;
};

export const RACE_TYPE_COLORS: Record<StageTypeKey, BadgePalette> = {
  flat: {
    text: '#4ADE80',
    bg: 'rgba(74,222,128,0.12)',
    border: 'rgba(74,222,128,0.35)',
  },
  hilly: {
    text: '#FACC15',
    bg: 'rgba(250,204,21,0.12)',
    border: 'rgba(250,204,21,0.35)',
  },
  mountain: {
    text: '#F87171',
    bg: 'rgba(248,113,113,0.12)',
    border: 'rgba(248,113,113,0.35)',
  },
  tt: {
    text: '#A78BFA',
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.35)',
  },
};

export const RACE_SUBGROUP_COLORS: Record<RaceSubgroupKey, RaceSubgroupPalette> = {
  'grand-tour': {
    label: 'Grand Tour',
    text: '#6EE7F7',
    bg: 'rgba(110,231,247,0.10)',
    border: 'rgba(110,231,247,0.30)',
  },
  monument: {
    label: 'Monument',
    text: '#F0A500',
    bg: 'rgba(240,165,0,0.12)',
    border: 'rgba(240,165,0,0.35)',
  },
  'major-tour': {
    label: 'Major Tour',
    text: '#38BDF8',
    bg: 'rgba(56,189,248,0.10)',
    border: 'rgba(56,189,248,0.30)',
  },
  'top-classic': {
    label: 'Top Classic',
    text: '#C084FC',
    bg: 'rgba(192,132,252,0.10)',
    border: 'rgba(192,132,252,0.30)',
  },
};
