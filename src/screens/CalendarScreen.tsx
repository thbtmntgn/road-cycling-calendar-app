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
import { fetchRaces, getRacesForDate, filterRacesByGender, fetchStages } from '../api/racesApi';
import { Race, Gender, Stage } from '../types';
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
  const [selectedGender, setSelectedGender] = useState<Gender>(Gender.Men);
  const [stagesMap, setStagesMap] = useState<Record<string, Stage | null>>({});
  const [stageCountsMap, setStageCountsMap] = useState<Record<string, number>>({});

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

  // Filter races when date or gender filter changes
  useEffect(() => {
    if (races.length > 0) {
      let racesForDate = getRacesForDate(races, selectedDate);

      racesForDate = filterRacesByGender(racesForDate, selectedGender);

      setFilteredRaces(racesForDate);
    }
  }, [races, selectedDate, selectedGender]);

  // Fetch stages for all multi-day races visible on the selected date
  useEffect(() => {
    const multiDayRaces = filteredRaces.filter((r) => r.startDate !== r.endDate);
    if (multiDayRaces.length === 0) {
      setStagesMap({});
      return;
    }

    const loadStages = async () => {
      const entries = await Promise.all(
        multiDayRaces.map(async (race) => {
          try {
            const stages = await fetchStages(race.id);
            const stage = stages.find((s) => s.date === selectedDate) ?? null;
            return { id: race.id, stage, total: stages.length };
          } catch {
            return null;
          }
        })
      );
      const map: Record<string, Stage | null> = {};
      const countsMap: Record<string, number> = {};
      for (const entry of entries) {
        if (entry) {
          map[entry.id] = entry.stage;
          countsMap[entry.id] = entry.total;
        }
      }
      setStagesMap(map);
      setStageCountsMap(countsMap);
    };

    loadStages();
  }, [filteredRaces, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const handleRacePress = (race: Race) => {
    navigation.navigate('RaceDetail', { race });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#111111" />

      <View style={styles.container}>
        <DateSelector dates={dates} selectedDate={selectedDate} onSelectDate={handleDateSelect} />

        {/* Gender toggle */}
        <View style={styles.filterContainer}>
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleSegment, selectedGender === Gender.Men && styles.toggleSegmentActive]}
              onPress={() => setSelectedGender(Gender.Men)}
            >
              <Ionicons name="man" size={16} color={selectedGender === Gender.Men ? '#FFFFFF' : '#AAAAAA'} />
              <Text style={[styles.toggleText, selectedGender === Gender.Men && styles.toggleTextActive]}>Men</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleSegment, selectedGender === Gender.Women && styles.toggleSegmentActive]}
              onPress={() => setSelectedGender(Gender.Women)}
            >
              <Ionicons name="woman" size={16} color={selectedGender === Gender.Women ? '#FFFFFF' : '#AAAAAA'} />
              <Text style={[styles.toggleText, selectedGender === Gender.Women && styles.toggleTextActive]}>Women</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        ) : (
          <RacesList races={filteredRaces} onPressRace={handleRacePress} stagesMap={stagesMap} stageCountsMap={stageCountsMap} />
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
    padding: 10,
    backgroundColor: '#222222',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    alignItems: 'center',
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#333333',
    borderRadius: 20,
    padding: 3,
  },
  toggleSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 18,
    gap: 5,
  },
  toggleSegmentActive: {
    backgroundColor: '#4CAF50',
  },
  toggleText: {
    color: '#AAAAAA',
    fontSize: 14,
  },
  toggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

export default CalendarScreen;
