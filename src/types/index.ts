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
  distance?: number; // km, only set for one-day races
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
}

// Startlist types
export interface Rider {
  name: string;
  pcsSlug?: string;
}

export interface StartlistTeam {
  teamName: string;
  riders: Rider[];
}
