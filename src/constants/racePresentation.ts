import { Race, RaceCategory } from '../types';

export type RaceTier = 1 | 2 | 3;

interface TierPalette {
  headerBackground: string;
  headerBorder: string;
  bodyBackground: string;
  bodyBorder: string;
  badgeBackground: string;
  badgeBorder: string;
}

export interface RacePresentation {
  label: string;
  priority: number;
  tier: RaceTier;
  accentColor: string;
  headerBackground: string;
  headerBorder: string;
  bodyBackground: string;
  bodyBorder: string;
  badgeBackground: string;
  badgeBorder: string;
}

const TIER_PALETTES: Record<RaceTier, TierPalette> = {
  1: {
    headerBackground: '#161114',
    headerBorder: '#322027',
    bodyBackground: '#0B090C',
    bodyBorder: '#24151C',
    badgeBackground: '#24171B',
    badgeBorder: '#4A3037',
  },
  2: {
    headerBackground: '#10151A',
    headerBorder: '#1F2D3A',
    bodyBackground: '#090D12',
    bodyBorder: '#16202A',
    badgeBackground: '#17212A',
    badgeBorder: '#30485E',
  },
  3: {
    headerBackground: '#17130F',
    headerBorder: '#34271A',
    bodyBackground: '#0D0A08',
    bodyBorder: '#241A12',
    badgeBackground: '#231A12',
    badgeBorder: '#503822',
  },
};

const buildPresentation = (
  label: string,
  priority: number,
  tier: RaceTier,
  accentColor: string
): RacePresentation => ({
  label,
  priority,
  tier,
  accentColor,
  ...TIER_PALETTES[tier],
});

export const CATEGORY_PRESENTATION: Record<RaceCategory, RacePresentation> = {
  [RaceCategory.WorldTour]: buildPresentation('WorldTour', 1, 1, '#E63946'),
  [RaceCategory.WomenWorldTour]: buildPresentation('Women WorldTour', 2, 1, '#FF6B9D'),
  [RaceCategory.WorldChampionship]: buildPresentation('World Championship', 3, 1, '#F97316'),
  [RaceCategory.WomenWorldChampionship]: buildPresentation(
    'Women World Championship',
    4,
    1,
    '#FB7185'
  ),
  [RaceCategory.ProSeries]: buildPresentation('ProSeries', 5, 2, '#4EA8DE'),
  [RaceCategory.WomenProSeries]: buildPresentation('Women ProSeries', 6, 2, '#A78BFA'),
  [RaceCategory.NationalChampionship]: buildPresentation(
    'National Championship',
    7,
    2,
    '#94A3B8'
  ),
  [RaceCategory.WomenNationalChampionship]: buildPresentation(
    'Women National Championship',
    8,
    2,
    '#CBD5E1'
  ),
  [RaceCategory.Continental]: buildPresentation('Continental', 9, 3, '#F4A261'),
};

const DEFAULT_PRESENTATION = buildPresentation('Race', 99, 3, '#7C8B9B');

export const getRacePresentation = (category: RaceCategory | string): RacePresentation =>
  CATEGORY_PRESENTATION[category as RaceCategory] ?? DEFAULT_PRESENTATION;

const MONUMENT_SLUGS = new Set([
  'milano-sanremo',
  'ronde-van-vlaanderen',
  'paris-roubaix',
  'liege-bastogne-liege',
  'il-lombardia',
]);

const getRaceSlug = (race: Pick<Race, 'id' | 'pcsSlug'>): string | null => {
  if (race.pcsSlug) {
    const [, slug] = race.pcsSlug.split('/');
    if (slug) {
      return slug;
    }
  }

  const match = race.id.match(/^race-(.+)-\d{4}$/);
  return match?.[1] ?? null;
};

export const isMonumentRace = (race: Pick<Race, 'id' | 'pcsSlug'>): boolean => {
  const slug = getRaceSlug(race);
  return slug ? MONUMENT_SLUGS.has(slug) : false;
};

const GRAND_TOUR_SLUGS = new Set([
  // Men
  'tour-de-france',
  'giro-d-italia',
  'vuelta-a-espana',
  // Women
  'tour-de-france-femmes',
  'tour-de-france-femmes-avec-zwift',
  'giro-donne',
  'giro-d-italia-donne',
  'vuelta-femenina',
]);

const MAJOR_TOUR_SLUGS = new Set([
  // Men
  'paris-nice',
  'tirreno-adriatico',
  'volta-a-catalunya',
  'tour-de-romandie',
  'tour-de-suisse',
  'criterium-du-dauphine',
  'itzulia-basque-country',
  // Women
  'paris-nice-femmes',
  'paris-nice-women',
  'tirreno-adriatico-donne',
  'tirreno-adriatico-women',
  'volta-a-catalunya-femenina',
  'volta-a-catalunya-women',
  'tour-de-romandie-feminin',
  'tour-de-romandie-women',
  'tour-de-suisse-women',
  'criterium-du-dauphine-feminin',
  'criterium-du-dauphine-women',
  'itzulia-women',
  'itzulia-basque-country-women',
]);

const TOP_CLASSIC_SLUGS = new Set([
  // Men
  'omloop-het-nieuwsblad',
  'strade-bianche',
  'e3-harelbeke',
  'e3-saxo-bank-classic',
  'gent-wevelgem',
  'dwars-door-vlaanderen',
  'eschborn-frankfurt',
  'amstel-gold-race',
  'la-fleche-wallonne',
  'clasica-ciclista-san-sebastian',
  'clasica-san-sebastian',
  'bretagne-classic-ouest-france',
  'bretagne-classic',
  'grand-prix-cycliste-de-quebec',
  'grand-prix-cycliste-de-montreal',
  // Women
  'omloop-het-nieuwsblad-we',
  'strade-bianche-donne',
  'e3-harelbeke-we',
  'e3-saxo-bank-classic-we',
  'gent-wevelgem-women-elite',
  'dwars-door-vlaanderen-we',
  'eschborn-frankfurt-women',
  'eschborn-frankfurt-we',
  'amstel-gold-race-women',
  'amstel-gold-race-we',
  'la-fleche-wallonne-feminine',
  'la-fleche-wallonne-we',
  'clasica-san-sebastian-women',
  'clasica-san-sebastian-we',
  'clasica-ciclista-san-sebastian-women',
  'bretagne-classic-femmes',
  'bretagne-classic-we',
  'grand-prix-cycliste-de-quebec-we',
  'grand-prix-cycliste-de-quebec-women',
  'grand-prix-cycliste-de-montreal-we',
  'grand-prix-cycliste-de-montreal-women',
]);

export const isGrandTourRace = (race: Pick<Race, 'id' | 'pcsSlug'>): boolean => {
  const slug = getRaceSlug(race);
  return slug ? GRAND_TOUR_SLUGS.has(slug) : false;
};

export const isMajorTourRace = (race: Pick<Race, 'id' | 'pcsSlug'>): boolean => {
  const slug = getRaceSlug(race);
  return slug ? MAJOR_TOUR_SLUGS.has(slug) : false;
};

export const isTopClassicRace = (race: Pick<Race, 'id' | 'pcsSlug'>): boolean => {
  const slug = getRaceSlug(race);
  return slug ? TOP_CLASSIC_SLUGS.has(slug) : false;
};
