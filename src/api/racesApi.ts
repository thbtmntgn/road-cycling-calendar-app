import {
  ApiResponse,
  Race,
  Gender,
  RaceGeneralStandingsByStage,
  RaceKomStandingsByStage,
  RacePointsStandingsByStage,
  RaceResult,
  RaceStageResultsByStage,
  RaceTeamsStandingsByStage,
  RaceYouthStandingsByStage,
  StartlistTeam,
  Stage,
} from '../types';
import pcsData from '../generated/pcsData';

const localData = pcsData as {
  races: Race[];
  startlists: Record<string, StartlistTeam[]>;
  stages: Record<string, Stage[]>;
  results?: Record<string, RaceResult[]>;
  gcStandings?: Record<string, RaceGeneralStandingsByStage>;
  stageResults?: Record<string, RaceStageResultsByStage>;
  pointsStandings?: Record<string, RacePointsStandingsByStage>;
  komStandings?: Record<string, RaceKomStandingsByStage>;
  youthStandings?: Record<string, RaceYouthStandingsByStage>;
  teamsStandings?: Record<string, RaceTeamsStandingsByStage>;
};

export const fetchRaces = async (): Promise<ApiResponse> => {
  return { success: true, data: localData.races };
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
