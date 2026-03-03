// Race categories
export enum RaceCategory {
  WorldTour = 'WorldTour',
  WomenWorldTour = 'WomenWorldTour',
  WorldChampionship = 'WorldChampionship',
  WomenWorldChampionship = 'WomenWorldChampionship',
  ProSeries = 'ProSeries',
  WomenProSeries = 'WomenProSeries',
  NationalChampionship = 'NationalChampionship',
  WomenNationalChampionship = 'WomenNationalChampionship',
  Continental = 'Continental',
}

// Gender types
export enum Gender {
  Men = 'Men',
  Women = 'Women',
}

// Race data interface
export interface Race {
  id: string;
  pcsSlug?: string; // PCS URL slug, used for future RaceStartlist fetch
  name: string;
  startDate: string;
  endDate: string;
  category: RaceCategory;
  gender: Gender;
  country: string;
  distance?: number;  // km, only set for one-day races
  startTime?: string; // "HH:MM", one-day races only
  stageType?: 'flat' | 'hilly' | 'mountain' | 'tt'; // one-day races only
  elevation?: number; // vertical metres, one-day races only
}

// Grouped races by date
export interface RacesByDate {
  [date: string]: Race[];
}

// API response format
export interface ApiResponse {
  success: boolean;
  data: Race[];
  error?: string;
}

// Stage data for a single stage in a stage race
export interface Stage {
  stageNumber: number; // 0 = prologue
  date: string;        // "YYYY-MM-DD"
  departure: string;
  arrival: string;
  distance: number;    // km
  startTime?: string;  // "HH:MM"
  stageType?: 'flat' | 'hilly' | 'mountain' | 'tt';
  elevation?: number;  // vertical metres
}

// Startlist types
export interface Rider {
  name: string;
  pcsSlug?: string;
  nationality?: string; // ISO 3166-1 alpha-2, e.g. "FR"
}

export interface StartlistTeam {
  teamName: string;
  countryCode?: string; // ISO 3166-1 alpha-2 team licence country
  riders: Rider[];
}
