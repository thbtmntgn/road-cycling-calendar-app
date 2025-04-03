import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Text
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RacesList from '../components/RacesList';
import { fetchRaces } from '../api/racesApi';
import { Race } from '../types';
import { useFavoritesStore } from '../store/favoritesStore';

const FavoritesScreen: React.FC = () => {
  // State variables
  const [loading, setLoading] = useState<boolean>(true);
  const [allRaces, setAllRaces] = useState<Race[]>([]);
  const [favoriteRaces, setFavoriteRaces] = useState<Race[]>([]);
  
  // Get favorites from store
  const { favoriteRaces: favoritesIds, loadFavorites } = useFavoritesStore();
  
  // Load favorites from storage on mount
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);
  
  // Fetch all races
  useEffect(() => {
    const loadRaces = async () => {
      try {
        setLoading(true);
        const response = await fetchRaces();
        
        if (response.success) {
          setAllRaces(response.data);
        }
      } catch (error) {
        console.error('Error loading races:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadRaces();
  }, []);
  
  // Filter races based on favorites
  useEffect(() => {
    const favorites = allRaces.filter(race => 
      favoritesIds.includes(race.id)
    );
    
    // Mark as favorites explicitly
    setFavoriteRaces(favorites.map(race => ({
      ...race,
      isFavorite: true
    })));
  }, [allRaces, favoritesIds]);
  
  // Show empty favorites message
  const renderEmptyFavorites = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="star" size={60} color="#555555" />
      <Text style={styles.emptyTitle}>No Favorites Yet</Text>
      <Text style={styles.emptyText}>
        Tap the star icon on races to add them to your favorites
      </Text>
    </View>
  );
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#111111" />
      
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        ) : favoriteRaces.length === 0 ? (
          renderEmptyFavorites()
        ) : (
          <RacesList 
            races={favoriteRaces} 
            showEmptyMessage={false} 
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#111111',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: '#AAAAAA',
    textAlign: 'center',
  },
});

export default FavoritesScreen;