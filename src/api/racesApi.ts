import {
  ApiResponse,
  Race,
  Gender,
  RaceCategory,
  RaceFilterGroup,
  RaceGeneralStandingsByStage,
  RaceKomStandingsByStage,
  RacePointsStandingsByStage,
  RaceResult,
  RaceStageResultsByStage,
  RaceTeamsStandingsByStage,
  UciClass,
  RaceYouthStandingsByStage,
  StartlistTeam,
  Stage,
} from '../types';
import { getRaceFilterGroupFromUciClass } from '../constants/raceFilters';
import pcsData from '../generated/pcsData';

const localData = pcsData as {
  races: Array<Partial<Race> & { category?: string; filterGroup?: string; uciClass?: string }>;
  startlists: Record<string, StartlistTeam[]>;
  stages: Record<string, Stage[]>;
  results?: Record<string, RaceResult[]>;
  gcStandings?: Record<string, RaceGeneralStandingsByStage>;
  stageResults?: Record<string, RaceStageResultsByStage>;
  pointsStandings?: Record<string, RacePointsStandingsByStage>;
  komStandings?: Record<string, RaceKomStandingsByStage>;
  youthStandings?: Record<string, RaceYouthStandingsByStage>;
  teamsStandings?: Record<string, RaceTeamsStandingsByStage>;
  teamsStageResults?: Record<string, RaceTeamsStandingsByStage>;
};

const normalizeUciClass = (uciClass: string | undefined): UciClass | null => {
  if (!uciClass) {
    return null;
  }

  const normalized = uciClass.trim();
  return getRaceFilterGroupFromUciClass(normalized) ? (normalized as UciClass) : null;
};

const getLegacyUciClass = (
  category: string | undefined,
  filterGroup: RaceFilterGroup | null,
  isOneDayRace: boolean
): UciClass | null => {
  switch (category) {
    case RaceCategory.WorldTour:
      return isOneDayRace ? '1.UWT' : '2.UWT';
    case RaceCategory.WomenWorldTour:
      return isOneDayRace ? '1.WWT' : '2.WWT';
    case RaceCategory.SpecialEvent:
    case RaceCategory.WomenSpecialEvent:
      return 'WC';
    case RaceCategory.ProSeries:
    case RaceCategory.WomenProSeries:
      return isOneDayRace ? '1.Pro' : '2.Pro';
    case RaceCategory.NationalChampionship:
    case RaceCategory.WomenNationalChampionship:
      return 'NC';
    case 'Continental':
    case RaceCategory.ContinentalClass1:
      return isOneDayRace ? '1.1' : '2.1';
    case RaceCategory.ContinentalClass2:
      return isOneDayRace ? '1.2' : '2.2';
    default:
      if (filterGroup === RaceFilterGroup.ContinentalClass2) {
        return isOneDayRace ? '1.2' : '2.2';
      }
      if (filterGroup === RaceFilterGroup.ContinentalClass1) {
        return isOneDayRace ? '1.1' : '2.1';
      }
      return null;
  }
};

const normalizeFilterGroup = (
  filterGroup: string | undefined,
  uciClass: UciClass
): RaceFilterGroup | null => {
  if (filterGroup && Object.values(RaceFilterGroup).includes(filterGroup as RaceFilterGroup)) {
    return filterGroup as RaceFilterGroup;
  }

  return getRaceFilterGroupFromUciClass(uciClass);
};

const getCategoryForFilterGroup = (
  filterGroup: RaceFilterGroup,
  gender: Gender
): RaceCategory => {
  switch (filterGroup) {
    case RaceFilterGroup.WorldTour:
      return gender === Gender.Women ? RaceCategory.WomenWorldTour : RaceCategory.WorldTour;
    case RaceFilterGroup.SpecialEvent:
      return gender === Gender.Women ? RaceCategory.WomenSpecialEvent : RaceCategory.SpecialEvent;
    case RaceFilterGroup.ProSeries:
      return gender === Gender.Women ? RaceCategory.WomenProSeries : RaceCategory.ProSeries;
    case RaceFilterGroup.ContinentalClass1:
      return RaceCategory.ContinentalClass1;
    case RaceFilterGroup.ContinentalClass2:
      return RaceCategory.ContinentalClass2;
    case RaceFilterGroup.NationalChampionship:
      return gender === Gender.Women
        ? RaceCategory.WomenNationalChampionship
        : RaceCategory.NationalChampionship;
    default:
      return RaceCategory.ContinentalClass1;
  }
};

const normalizeCategory = (
  category: string | undefined,
  filterGroup: RaceFilterGroup,
  gender: Gender
): RaceCategory => {
  switch (category) {
    case RaceCategory.WorldTour:
    case RaceCategory.WomenWorldTour:
    case RaceCategory.SpecialEvent:
    case RaceCategory.WomenSpecialEvent:
    case RaceCategory.ProSeries:
    case RaceCategory.WomenProSeries:
    case RaceCategory.NationalChampionship:
    case RaceCategory.WomenNationalChampionship:
    case RaceCategory.ContinentalClass1:
    case RaceCategory.ContinentalClass2:
      return category;
    case 'Continental':
      return getCategoryForFilterGroup(filterGroup, gender);
    default:
      return getCategoryForFilterGroup(filterGroup, gender);
  }
};

const normalizeRace = (race: Partial<Race> & { category?: string; filterGroup?: string; uciClass?: string }): Race | null => {
  if (
    !race.id ||
    !race.name ||
    !race.startDate ||
    !race.endDate ||
    !race.country ||
    !race.gender
  ) {
    return null;
  }

  const gender = race.gender as Gender;
  const isOneDayRace = race.startDate === race.endDate;
  const initialFilterGroup =
    race.filterGroup && Object.values(RaceFilterGroup).includes(race.filterGroup as RaceFilterGroup)
      ? (race.filterGroup as RaceFilterGroup)
      : null;
  const uciClass =
    normalizeUciClass(race.uciClass) ??
    getLegacyUciClass(race.category, initialFilterGroup, isOneDayRace);

  if (!uciClass) {
    return null;
  }

  const filterGroup = normalizeFilterGroup(race.filterGroup, uciClass);
  if (!filterGroup) {
    return null;
  }

  return {
    ...race,
    gender,
    uciClass,
    filterGroup,
    category: normalizeCategory(race.category, filterGroup, gender),
  } as Race;
};

const normalizedRaces = localData.races
  .map((race) => normalizeRace(race))
  .filter((race): race is Race => race !== null);

export const fetchRaces = async (): Promise<ApiResponse> => {
  return { success: true, data: normalizedRaces };
};

export const fetchStartlist = async (raceId: string): Promise<StartlistTeam[]> => {
  return localData.startlists[raceId] ?? [];
};

export const fetchStages = async (raceId: string): Promise<Stage[]> => {
  return localData.stages[raceId] ?? [];
};

export const fetchResults = async (raceId: string): Promise<RaceResult[]> => {
  return localData.results?.[raceId] ?? [];
};

export const fetchGeneralStandings = async (
  raceId: string
): Promise<RaceGeneralStandingsByStage> => {
  return localData.gcStandings?.[raceId] ?? {};
};

export const fetchStageResults = async (
  raceId: string
): Promise<RaceStageResultsByStage> => {
  return localData.stageResults?.[raceId] ?? {};
};

export const fetchPointsStandings = async (
  raceId: string
): Promise<RacePointsStandingsByStage> => {
  return localData.pointsStandings?.[raceId] ?? {};
};

export const fetchKomStandings = async (
  raceId: string
): Promise<RaceKomStandingsByStage> => {
  return localData.komStandings?.[raceId] ?? {};
};

export const fetchYouthStandings = async (
  raceId: string
): Promise<RaceYouthStandingsByStage> => {
  return localData.youthStandings?.[raceId] ?? {};
};

export const fetchTeamsStandings = async (
  raceId: string
): Promise<RaceTeamsStandingsByStage> => {
  return localData.teamsStandings?.[raceId] ?? {};
};

export const fetchTeamsStageResults = async (
  raceId: string
): Promise<RaceTeamsStandingsByStage> => {
  return localData.teamsStageResults?.[raceId] ?? {};
};

export const getResultsSync = (raceId: string): RaceResult[] =>
  localData.results?.[raceId] ?? [];

export const getStageResultsSync = (raceId: string, stageNumber: string): RaceResult[] =>
  localData.stageResults?.[raceId]?.[stageNumber] ?? [];

export const getGcStandingsSync = (raceId: string, stageNumber: string): RaceResult[] =>
  localData.gcStandings?.[raceId]?.[stageNumber] ?? [];

// Filter races by gender
export const filterRacesByGender = (races: Race[], gender: Gender | null): Race[] => {
  if (!gender) return races;
  return races.filter((race) => race.gender === gender);
};

// Get races for a specific date
export const getRacesForDate = (races: Race[], date: string): Race[] => {
  return races.filter((race) => {
    const startDate = new Date(race.startDate);
    const endDate = new Date(race.endDate);
    const targetDate = new Date(date);

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);

    return targetDate >= startDate && targetDate <= endDate;
  });
};
