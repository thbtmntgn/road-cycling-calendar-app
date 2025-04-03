import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ActivityIndicator, 
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Text,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateSelector from '../components/DateSelector';
import RacesList from '../components/RacesList';
import NoConnection from '../components/NoConnection';
import { getDateRange, getTodayDate } from '../utils/dateUtils';
import { fetchRaces, getRacesForDate, filterRacesByGender } from '../api/racesApi';
import { Race, Gender } from '../types';
import { useFavoritesStore } from '../store/favoritesStore';
import NetInfo from '@react-native-community/netinfo';

const CalendarScreen: React.FC = () => {
 
  // Add a debug flag
  const [showDebug, setShowDebug] = useState<boolean>(false);
  
  // State variables
  const [dates] = useState<string[]>(getDateRange(2, 10));
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());
  const [races, setRaces] = useState<Race[]>([]);
  const [filteredRaces, setFilteredRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);
  
  // Debug state
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...');
  
  // Get favorites data
  const { favoriteRaces, loadFavorites } = useFavoritesStore();
  
  // Check network connection
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });
    
    return () => unsubscribe();
  }, []);
  
  // Load favorites from storage
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);
  
  // Load races data
  useEffect(() => {
    const loadRaces = async () => {
      try {
        setLoading(true);
        setDebugInfo('Fetching races...');
        const response = await fetchRaces();
        
        if (response.success) {
          setDebugInfo(`Loaded ${response.data.length} races`);
          setRaces(response.data);
        }
      } catch (error) {
        console.error('Error loading races:', error);
        setDebugInfo(`Error: ${error}`);
      } finally {
        setLoading(false);
      }
    };
    
    if (isConnected) {
      loadRaces();
    }
  }, [isConnected]);
  
  // Filter races when date, gender filter, or favorites change
  useEffect(() => {
    if (races.length > 0) {
      setDebugInfo(`Selected date: ${selectedDate}, Total races: ${races.length}`);

      // Get races for selected date
      let racesForDate = getRacesForDate(races, selectedDate);
      setDebugInfo(prev => `${prev}\nRaces for date: ${racesForDate.length}`);
      
      // Apply gender filter if selected
      if (selectedGender !== null) {
        racesForDate = filterRacesByGender(racesForDate, selectedGender);
        setDebugInfo(prev => `${prev}\nAfter gender filter: ${racesForDate.length}`);
      }
      
      // Mark favorite races
      racesForDate = racesForDate.map(race => ({
        ...race,
        isFavorite: favoriteRaces.includes(race.id)
      }));
      
      setDebugInfo(prev => `${prev}\nFinal races: ${racesForDate.length}`);
      
      // Add race names to debug
      if (racesForDate.length > 0) {
        setDebugInfo(prev => `${prev}\nRaces: ${racesForDate.map(r => r.name).join(', ')}`);
      }
      
      setFilteredRaces(racesForDate);
    }
  }, [races, selectedDate, selectedGender, favoriteRaces]);
  
  // Handle date selection
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };
  
  // Toggle gender filter
  const toggleGenderFilter = (gender: Gender | null) => {
    setSelectedGender(prevGender => prevGender === gender ? null : gender);
  };
  
  // Network error state
  if (isConnected === false) {
    return <NoConnection />;
  }
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#111111" />
      
      <View style={styles.container}>
        {/* Debug toggle */}
        <TouchableOpacity 
          style={styles.debugButton} 
          onPress={() => setShowDebug(!showDebug)}
        >
          <Text style={styles.debugButtonText}>Debug: {showDebug ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
        
        {/* Date selector */}
        <DateSelector 
          dates={dates} 
          selectedDate={selectedDate} 
          onSelectDate={handleDateSelect} 
        />
        
        {/* Gender filter buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedGender === Gender.Men && styles.activeFilterButton
            ]}
            onPress={() => toggleGenderFilter(Gender.Men)}
          >
            <Ionicons 
              name="man" 
              size={18} 
              color={selectedGender === Gender.Men ? '#FFFFFF' : '#AAAAAA'} 
            />
            <Text style={[
              styles.filterText,
              selectedGender === Gender.Men && styles.activeFilterText
            ]}>Men</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedGender === Gender.Women && styles.activeFilterButton
            ]}
            onPress={() => toggleGenderFilter(Gender.Women)}
          >
            <Ionicons 
              name="woman" 
              size={18} 
              color={selectedGender === Gender.Women ? '#FFFFFF' : '#AAAAAA'} 
            />
            <Text style={[
              styles.filterText,
              selectedGender === Gender.Women && styles.activeFilterText
            ]}>Women</Text>
          </TouchableOpacity>
        </View>
        
        {/* Debug Info */}
        {showDebug && (
          <ScrollView style={styles.debugContainer}>
            <Text style={styles.debugText}>{debugInfo}</Text>
          </ScrollView>
        )}
        
        {/* Loading indicator */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        ) : (
          <RacesList races={filteredRaces} />
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
  filterContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#222222',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#333333',
  },
  activeFilterButton: {
    backgroundColor: '#4CAF50',
  },
  filterText: {
    color: '#AAAAAA',
    marginLeft: 5,
    fontSize: 14,
  },
  activeFilterText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  debugContainer: {
    maxHeight: 200,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    margin: 10,
    borderRadius: 5,
  },
  debugText: {
    color: '#00FF00',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  debugButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#333',
    padding: 5,
    borderRadius: 5,
    zIndex: 10,
  },
  debugButtonText: {
    color: '#FFF',
    fontSize: 10,
  }
});

export default CalendarScreen;