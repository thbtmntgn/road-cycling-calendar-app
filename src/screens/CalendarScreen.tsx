import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateSelector from '../components/DateSelector';
import RacesList from '../components/RacesList';
import { getDateRange, getTodayDate } from '../utils/dateUtils';
import { fetchRaces, getRacesForDate, filterRacesByGender } from '../api/racesApi';
import { Race, Gender } from '../types';
import { useFavoritesStore } from '../store/favoritesStore';
import { CalendarStackParamList } from '../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<CalendarStackParamList, 'CalendarMain'>;
}

const CalendarScreen: React.FC<Props> = ({ navigation }) => {
  const [dates] = useState<string[]>(getDateRange(2, 10));
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());
  const [races, setRaces] = useState<Race[]>([]);
  const [filteredRaces, setFilteredRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);

  const { favoriteRaces, loadFavorites } = useFavoritesStore();

  // Load favorites from storage
  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Load races — fetchRaces handles offline via AsyncStorage cache + bundled fallback
  useEffect(() => {
    const loadRaces = async () => {
      try {
        setLoading(true);
        const response = await fetchRaces();

        if (response.success) {
          setRaces(response.data);
        }
      } catch (error) {
        console.error('Error loading races:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRaces();
  }, []);

  // Filter races when date, gender filter, or favorites change
  useEffect(() => {
    if (races.length > 0) {
      let racesForDate = getRacesForDate(races, selectedDate);

      if (selectedGender !== null) {
        racesForDate = filterRacesByGender(racesForDate, selectedGender);
      }

      racesForDate = racesForDate.map((race) => ({
        ...race,
        isFavorite: favoriteRaces.includes(race.id),
      }));

      setFilteredRaces(racesForDate);
    }
  }, [races, selectedDate, selectedGender, favoriteRaces]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const toggleGenderFilter = (gender: Gender | null) => {
    setSelectedGender((prevGender) => (prevGender === gender ? null : gender));
  };

  const handleRacePress = (race: Race) => {
    navigation.navigate('RaceDetail', { race });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#111111" />

      <View style={styles.container}>
        <DateSelector dates={dates} selectedDate={selectedDate} onSelectDate={handleDateSelect} />

        {/* Gender filter buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, selectedGender === Gender.Men && styles.activeFilterButton]}
            onPress={() => toggleGenderFilter(Gender.Men)}
          >
            <Ionicons
              name="man"
              size={18}
              color={selectedGender === Gender.Men ? '#FFFFFF' : '#AAAAAA'}
            />
            <Text
              style={[styles.filterText, selectedGender === Gender.Men && styles.activeFilterText]}
            >
              Men
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedGender === Gender.Women && styles.activeFilterButton,
            ]}
            onPress={() => toggleGenderFilter(Gender.Women)}
          >
            <Ionicons
              name="woman"
              size={18}
              color={selectedGender === Gender.Women ? '#FFFFFF' : '#AAAAAA'}
            />
            <Text
              style={[
                styles.filterText,
                selectedGender === Gender.Women && styles.activeFilterText,
              ]}
            >
              Women
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        ) : (
          <RacesList races={filteredRaces} onPressRace={handleRacePress} />
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
});

export default CalendarScreen;
