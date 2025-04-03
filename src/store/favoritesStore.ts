import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoritesState {
  favoriteRaces: string[];
  addFavorite: (raceId: string) => void;
  removeFavorite: (raceId: string) => void;
  toggleFavorite: (raceId: string) => void;
  isFavorite: (raceId: string) => boolean;
  loadFavorites: () => Promise<void>;
}

// Create favorites store with Zustand
export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favoriteRaces: [],
  
  // Add a race to favorites
  addFavorite: (raceId: string) => {
    set((state) => {
      const updatedFavorites = [...state.favoriteRaces, raceId];
      AsyncStorage.setItem('favoriteRaces', JSON.stringify(updatedFavorites));
      return { favoriteRaces: updatedFavorites };
    });
  },
  
  // Remove a race from favorites
  removeFavorite: (raceId: string) => {
    set((state) => {
      const updatedFavorites = state.favoriteRaces.filter(id => id !== raceId);
      AsyncStorage.setItem('favoriteRaces', JSON.stringify(updatedFavorites));
      return { favoriteRaces: updatedFavorites };
    });
  },
  
  // Toggle favorite status
  toggleFavorite: (raceId: string) => {
    const isFavorite = get().isFavorite(raceId);
    if (isFavorite) {
      get().removeFavorite(raceId);
    } else {
      get().addFavorite(raceId);
    }
  },
  
  // Check if a race is favorited
  isFavorite: (raceId: string) => {
    return get().favoriteRaces.includes(raceId);
  },
  
  // Load favorites from storage on app start
  loadFavorites: async () => {
    try {
      const storedFavorites = await AsyncStorage.getItem('favoriteRaces');
      if (storedFavorites) {
        set({ favoriteRaces: JSON.parse(storedFavorites) });
      }
    } catch (error) {
      console.error('Failed to load favorites', error);
    }
  },
}));