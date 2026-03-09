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
  JuniorMen = 'JuniorMen',
  JuniorWomen = 'JuniorWomen',
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
  departure?: string; // one-day races only
  arrival?: string;   // one-day races only
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
  jerseyImageUrl?: string;
  riders: Rider[];
}

// Final results for completed races (top rows only)
export interface RaceResult {
  rankLabel: string;
  riderName: string;
  pcsSlug?: string;
  nationality?: string; // ISO 3166-1 alpha-2
  teamName?: string;
  time?: string;
  status?: string;
}

// Stage-race general classification snapshots keyed by stage number ("1", "2", ...)
export interface RaceGeneralStandingsByStage {
  [stageNumber: string]: RaceResult[];
}

// Stage-race stage result snapshots keyed by stage number ("1", "2", ...)
export interface RaceStageResultsByStage {
  [stageNumber: string]: RaceResult[];
}

// Stage-race points classification snapshots keyed by stage number ("1", "2", ...)
export interface RacePointsStandingsByStage {
  [stageNumber: string]: RaceResult[];
}

// Stage-race KOM classification snapshots keyed by stage number ("1", "2", ...)
export interface RaceKomStandingsByStage {
  [stageNumber: string]: RaceResult[];
}

// Stage-race youth classification snapshots keyed by stage number ("1", "2", ...)
export interface RaceYouthStandingsByStage {
  [stageNumber: string]: RaceResult[];
}

// Stage-race team classification snapshots keyed by stage number ("1", "2", ...)
export interface RaceTeamsStandingsByStage {
  [stageNumber: string]: RaceResult[];
}
