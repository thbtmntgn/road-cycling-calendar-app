import axios from 'axios';
import { ApiResponse, Race, Gender, RaceCategory } from '../types';

// For the proof of concept, we'll use mock data
// Later this can be replaced with actual API calls

// Mock cycling race data
const mockRaces: Race[] = [
  {
    id: '1',
    name: 'Tour de France',
    startDate: '2025-06-27',
    endDate: '2025-07-19',
    category: RaceCategory.WorldTour,
    gender: Gender.Men,
    country: 'FR',
  },
  {
    id: '2',
    name: 'Giro d\'Italia',
    startDate: '2025-05-10',
    endDate: '2025-06-01',
    category: RaceCategory.WorldTour,
    gender: Gender.Men,
    country: 'IT',
  },
  {
    id: '3',
    name: 'La Vuelta a España',
    startDate: '2025-08-16',
    endDate: '2025-09-07',
    category: RaceCategory.WorldTour,
    gender: Gender.Men,
    country: 'ES',
  },
  {
    id: '4',
    name: 'Paris-Roubaix',
    startDate: '2025-04-13',
    endDate: '2025-04-13',
    category: RaceCategory.WorldTour,
    gender: Gender.Men,
    country: 'FR',
  },
  {
    id: '5',
    name: 'Tour of Flanders',
    startDate: '2025-04-06',
    endDate: '2025-04-06',
    category: RaceCategory.WorldTour,
    gender: Gender.Men,
    country: 'BE',
  },
  {
    id: '6',
    name: 'Giro d\'Italia Women',
    startDate: '2025-07-05',
    endDate: '2025-07-14',
    category: RaceCategory.WomenWorldTour,
    gender: Gender.Women,
    country: 'IT',
  },
  {
    id: '7',
    name: 'La Course by Le Tour de France',
    startDate: '2025-07-19',
    endDate: '2025-07-19',
    category: RaceCategory.WomenWorldTour,
    gender: Gender.Women,
    country: 'FR',
  },
  {
    id: '8',
    name: 'Tour of California',
    startDate: '2025-05-14',
    endDate: '2025-05-20',
    category: RaceCategory.ProSeries,
    gender: Gender.Men,
    country: 'US',
  },
  {
    id: '9',
    name: 'Amstel Gold Race',
    startDate: '2025-04-20',
    endDate: '2025-04-20',
    category: RaceCategory.WorldTour,
    gender: Gender.Men,
    country: 'NL',
  },
  {
    id: '10',
    name: 'Strade Bianche',
    startDate: '2025-03-08',
    endDate: '2025-03-08',
    category: RaceCategory.WorldTour,
    gender: Gender.Men,
    country: 'IT',
  },
  {
    id: '11',
    name: 'Strade Bianche Women',
    startDate: '2025-03-08',
    endDate: '2025-03-08',
    category: RaceCategory.WomenWorldTour,
    gender: Gender.Women,
    country: 'IT',
  },
  {
    id: '12',
    name: 'Tour Down Under',
    startDate: '2025-01-14',
    endDate: '2025-01-19',
    category: RaceCategory.WorldTour,
    gender: Gender.Men,
    country: 'AU',
  },
];

// Function to get all races
export const fetchRaces = async (): Promise<ApiResponse> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    success: true,
    data: mockRaces,
  };
};

// Filter races by gender
export const filterRacesByGender = (races: Race[], gender: Gender | null): Race[] => {
  if (!gender) return races;
  return races.filter(race => race.gender === gender);
};

// Get races for a specific date
export const getRacesForDate = (races: Race[], date: string): Race[] => {
  return races.filter(race => {
    const startDate = new Date(race.startDate);
    const endDate = new Date(race.endDate);
    const targetDate = new Date(date);
    
    // Reset hours to compare dates only
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    
    return targetDate >= startDate && targetDate <= endDate;
  });
};

// In a future implementation, replace this with actual API calls:
// Example:
/*
export const fetchRacesFromAPI = async (): Promise<ApiResponse> => {
  try {
    const response = await axios.get('https://api.example.com/races');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      error: 'Failed to fetch races',
    };
  }
};
*/