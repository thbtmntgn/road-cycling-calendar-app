import { ApiResponse, Race, Gender, StartlistTeam, Stage } from '../types';
import pcsData from '../generated/pcsData';

const localData = pcsData as {
  races: Race[];
  startlists: Record<string, StartlistTeam[]>;
  stages: Record<string, Stage[]>;
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
