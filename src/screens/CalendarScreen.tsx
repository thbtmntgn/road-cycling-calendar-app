import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Text,
} from 'react-native';
import dayjs from 'dayjs';
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
  navigation: NativeStackNavigationProp<CalendarStackParamList, 'Calendar'>;
}

const INITIAL_DAYS_BACKWARD = 2;
const INITIAL_DAYS_FORWARD = 10;
const DATE_WINDOW_EXTENSION = 14;
const DATE_EDGE_THRESHOLD = 2;

const prependDates = (firstDate: string, count: number): string[] =>
  Array.from({ length: count }, (_, index) =>
    dayjs(firstDate)
      .subtract(count - index, 'day')
      .format('YYYY-MM-DD')
  );

const appendDates = (lastDate: string, count: number): string[] =>
  Array.from({ length: count }, (_, index) =>
    dayjs(lastDate)
      .add(index + 1, 'day')
      .format('YYYY-MM-DD')
  );

const extendDateWindow = (currentDates: string[], targetDate: string): string[] => {
  if (currentDates.length === 0) {
    return getDateRange(INITIAL_DAYS_BACKWARD, INITIAL_DAYS_FORWARD);
  }

  const selectedIndex = currentDates.indexOf(targetDate);
  if (selectedIndex === -1) {
    return currentDates;
  }

  let nextDates = currentDates;

  if (selectedIndex <= DATE_EDGE_THRESHOLD) {
    nextDates = [...prependDates(currentDates[0], DATE_WINDOW_EXTENSION), ...nextDates];
  }

  if (selectedIndex >= currentDates.length - 1 - DATE_EDGE_THRESHOLD) {
    nextDates = [...nextDates, ...appendDates(currentDates[currentDates.length - 1], DATE_WINDOW_EXTENSION)];
  }

  return nextDates;
};

const CalendarScreen: React.FC<Props> = ({ navigation }) => {
  const [dates, setDates] = useState<string[]>(
    getDateRange(INITIAL_DAYS_BACKWARD, INITIAL_DAYS_FORWARD)
  );
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
    if (races.length === 0) {
      setFilteredRaces([]);
      return;
    }

    let racesForDate = getRacesForDate(races, selectedDate);

    racesForDate = filterRacesByGender(racesForDate, selectedGender);

    setFilteredRaces(racesForDate);
  }, [races, selectedDate, selectedGender]);

  // Fetch stages for all multi-day races visible on the selected date
  useEffect(() => {
    const multiDayRaces = filteredRaces.filter((r) => r.startDate !== r.endDate);
    if (multiDayRaces.length === 0) {
      setStagesMap({});
      setStageCountsMap({});
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
    setDates((currentDates) => extendDateWindow(currentDates, date));
    setSelectedDate(date);
  };

  const handleRacePress = (race: Race) => {
    navigation.navigate('RaceDetail', { race });
  };

  const summaryLabel = `${dayjs(selectedDate).format('ddd DD MMM')} · ${selectedGender}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0C" />

      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.title}>Race Calendar</Text>
          <Text style={styles.subtitle}>{summaryLabel}</Text>
        </View>

        <DateSelector
          dates={dates}
          selectedDate={selectedDate}
          onSelectDate={handleDateSelect}
        />

        <View style={styles.filterContainer}>
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[
                styles.toggleSegment,
                selectedGender === Gender.Men && styles.toggleSegmentActive,
              ]}
              onPress={() => setSelectedGender(Gender.Men)}
              activeOpacity={0.85}
            >
              <Ionicons
                name="man"
                size={16}
                color={selectedGender === Gender.Men ? '#FFFFFF' : '#8B93A1'}
              />
              <Text
                style={[
                  styles.toggleText,
                  selectedGender === Gender.Men && styles.toggleTextActive,
                ]}
              >
                Men
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleSegment,
                selectedGender === Gender.Women && styles.toggleSegmentActive,
              ]}
              onPress={() => setSelectedGender(Gender.Women)}
              activeOpacity={0.85}
            >
              <Ionicons
                name="woman"
                size={16}
                color={selectedGender === Gender.Women ? '#FFFFFF' : '#8B93A1'}
              />
              <Text
                style={[
                  styles.toggleText,
                  selectedGender === Gender.Women && styles.toggleTextActive,
                ]}
              >
                Women
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F3F4F6" />
          </View>
        ) : (
          <RacesList
            races={filteredRaces}
            onPressRace={handleRacePress}
            stagesMap={stagesMap}
            stageCountsMap={stageCountsMap}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 4,
    color: '#71717A',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    alignItems: 'center',
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#141418',
    borderRadius: 18,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1F1F24',
  },
  toggleSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 14,
    gap: 6,
  },
  toggleSegmentActive: {
    backgroundColor: '#2563EB',
  },
  toggleText: {
    color: '#8B93A1',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default CalendarScreen;
