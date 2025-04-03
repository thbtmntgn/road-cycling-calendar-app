// Race categories
export enum RaceCategory {
  WorldTour = 'WorldTour',
  ProSeries = 'ProSeries',
  Continental = 'Continental',
  WomenWorldTour = 'WomenWorldTour',
  WomenProSeries = 'WomenProSeries',
}

// Gender types
export enum Gender {
  Men = 'Men',
  Women = 'Women',
}

// Race data interface
export interface Race {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  category: RaceCategory;
  gender: Gender;
  country: string;
  isFavorite?: boolean;
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
