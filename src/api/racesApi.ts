import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { ApiResponse, Race, Gender, StartlistTeam, Stage } from '../types';
import racesData from '../data/races.json';

const RACES_URL =
  'https://raw.githubusercontent.com/thbtmntgn/road-cycling-calendar-app/main/src/data/races.json';
const STARTLIST_BASE_URL =
  'https://raw.githubusercontent.com/thbtmntgn/road-cycling-calendar-app/main/src/data/startlists';
const STAGES_BASE_URL =
  'https://raw.githubusercontent.com/thbtmntgn/road-cycling-calendar-app/main/src/data/stages';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL) return null;
    return entry.data;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore storage errors
  }
}

// Get all races — tries remote first, falls back to cached, then bundled JSON
export const fetchRaces = async (): Promise<ApiResponse> => {
  const cached = await readCache<Race[]>('races_cache');
  if (cached) {
    return { success: true, data: cached };
  }

  try {
    const response = await axios.get<Race[]>(RACES_URL, { timeout: 10000 });
    await writeCache('races_cache', response.data);
    return { success: true, data: response.data };
  } catch {
    return { success: true, data: racesData as Race[] };
  }
};

// Fetch startlist for a race by its id — throws on network/parse errors, caller handles empty (404)
export const fetchStartlist = async (raceId: string): Promise<StartlistTeam[]> => {
  const cacheKey = `startlist_${raceId}`;
  const cached = await readCache<StartlistTeam[]>(cacheKey);
  if (cached) return cached;

  const url = `${STARTLIST_BASE_URL}/${raceId}.json`;
  const response = await axios.get<StartlistTeam[]>(url, { timeout: 10000 });
  await writeCache(cacheKey, response.data);
  return response.data;
};

// Fetch stages for a race by its id — throws on network/parse errors, caller handles 404
export const fetchStages = async (raceId: string): Promise<Stage[]> => {
  const cacheKey = `stages_${raceId}`;
  const cached = await readCache<Stage[]>(cacheKey);
  if (cached) return cached;

  const url = `${STAGES_BASE_URL}/${raceId}.json`;
  const response = await axios.get<Stage[]>(url, { timeout: 10000 });
  await writeCache(cacheKey, response.data);
  return response.data;
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
