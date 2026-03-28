// Race categories
export enum RaceCategory {
  WorldTour = 'WorldTour',
  WomenWorldTour = 'WomenWorldTour',
  SpecialEvent = 'SpecialEvent',
  WomenSpecialEvent = 'WomenSpecialEvent',
  ProSeries = 'ProSeries',
  WomenProSeries = 'WomenProSeries',
  NationalChampionship = 'NationalChampionship',
  WomenNationalChampionship = 'WomenNationalChampionship',
  ContinentalClass1 = 'ContinentalClass1',
  ContinentalClass2 = 'ContinentalClass2',
}

// Gender types
export enum Gender {
  Men = 'Men',
  Women = 'Women',
}

export type UciClass =
  | '1.UWT'
  | '2.UWT'
  | '1.WWT'
  | '2.WWT'
  | '1.Pro'
  | '2.Pro'
  | '1.PRO'
  | '2.PRO'
  | '1.1'
  | '2.1'
  | '1.2'
  | '2.2'
  | 'WC'
  | 'OG'
  | 'CC'
  | 'NC';

export enum RaceFilterGroup {
  WorldTour = 'worldtour',
  SpecialEvent = 'special_event',
  ProSeries = 'proseries',
  ContinentalClass1 = 'continental_class1',
  ContinentalClass2 = 'continental_class2',
  NationalChampionship = 'national_championship',
}

// Race data interface
export interface Race {
  id: string;
  pcsSlug?: string;
  name: string;
  startDate: string;
  endDate: string;
  uciClass: UciClass;
  filterGroup: RaceFilterGroup;
  category: RaceCategory;
  gender: Gender;
  country: string;
  departure?: string; // one-day races only
  arrival?: string;   // one-day races only
  distance?: number;  // km, only set for one-day races
  startTime?: string; // "HH:MM", one-day races only
  stageType?: 'flat' | 'hilly' | 'mountain' | 'itt' | 'ttt'; // one-day races only
  elevation?: number; // vertical metres, one-day races only
  profileImageUrl?: string; // PCS elevation profile image URL
  timeLimitGap?: string; // H:MM:SS gap from stage winner beyond which riders are OTL
  completed?: boolean;  // true once race has a confirmed rank-1 finish; false/absent = in progress or upcoming
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
  stageType?: 'flat' | 'hilly' | 'mountain' | 'itt' | 'ttt';
  elevation?: number;  // vertical metres
  profileImageUrl?: string; // PCS elevation profile image URL
  timeLimitGap?: string; // H:MM:SS gap from stage winner beyond which riders are OTL
}

// Startlist types
export interface Rider {
  name: string;
  bibNumber?: number;
  pcsSlug?: string;
  nationality?: string; // ISO 3166-1 alpha-2, e.g. "FR"
}

export interface StartlistTeam {
  teamName: string;
  countryCode?: string; // ISO 3166-1 alpha-2 team licence country
  uciClass?: string;    // e.g. "WT", "PT", "CT", "WWT", "WPT", "WCT"
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
  bonus?: string;  // bonus seconds in "H:MM:SS" format, stage results only
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
