import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Text,
  Dimensions,
  PanResponder,
} from 'react-native';
import dayjs from 'dayjs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateSelector from '../components/DateSelector';
import RacesList from '../components/RacesList';
import UpcomingBigRacesList, {
  UpcomingBigRace,
  UpcomingBigRacesSection,
} from '../components/UpcomingBigRacesList';
import FilterScreen from '../components/FilterScreen';
import {
  isDefaultRaceFilterState,
  isRaceVisibleForFilterState,
  makeDefaultRaceFilterState,
  RaceFilterState,
} from '../constants/raceFilters';
import { getDateRange, getTodayDate } from '../utils/dateUtils';
import { fetchRaces, getRacesForDate, filterRacesByGender, fetchStages } from '../api/racesApi';
import { Race, Gender, Stage } from '../types';
import { CalendarStackParamList } from '../navigation/types';
import {
  isGrandTourRace,
  isMajorTourRace,
  isMonumentRace,
  isTopClassicRace,
} from '../constants/racePresentation';

interface Props {
  navigation: NativeStackNavigationProp<CalendarStackParamList, 'Calendar'>;
}

const DEFAULT_DATE_WINDOW_DAYS = 7;
const DATE_WINDOW_EXTENSION = 14;
const DATE_EDGE_THRESHOLD = 2;
const TODAY_SHORTCUT_THRESHOLD_DAYS = 3;
const TODAY_FADE_HEIGHT = 96;
const TODAY_SHORTCUT_BOTTOM_PADDING = TODAY_FADE_HEIGHT + 16;
const UPCOMING_BIG_RACES_EMPTY_DAY_LIMIT = 5;
const UPCOMING_SECTION_TOP_MARGIN = 12;
const UPCOMING_SECTION_STATIC_HEIGHT = 18;
const UPCOMING_SECTION_ROW_STRIDE = 62;
const DAY_SWIPE_MIN_DISTANCE = 56;
const DAY_SWIPE_MAX_VERTICAL_DRIFT = 72;
const DAY_SWIPE_ACTIVATION_X = 14;
const DAY_SWIPE_DIRECTION_RATIO = 1.3;
const { width } = Dimensions.get('window');
const DATE_ITEM_WIDTH = Math.max(96, Math.floor(width / 4));

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
    return getDateRange(DEFAULT_DATE_WINDOW_DAYS, DEFAULT_DATE_WINDOW_DAYS);
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

const buildDateWindowAround = (centerDate: string): string[] =>
  Array.from({ length: DEFAULT_DATE_WINDOW_DAYS * 2 + 1 }, (_, index) =>
    dayjs(centerDate)
      .subtract(DEFAULT_DATE_WINDOW_DAYS - index, 'day')
      .format('YYYY-MM-DD')
  );

const ensureDateInWindow = (currentDates: string[], targetDate: string): string[] => {
  let nextDates = currentDates.length > 0 ? currentDates : buildDateWindowAround(targetDate);

  while (!nextDates.includes(targetDate)) {
    if (dayjs(targetDate).isBefore(dayjs(nextDates[0]), 'day')) {
      nextDates = [...prependDates(nextDates[0], DATE_WINDOW_EXTENSION), ...nextDates];
      continue;
    }

    nextDates = [...nextDates, ...appendDates(nextDates[nextDates.length - 1], DATE_WINDOW_EXTENSION)];
  }

  return nextDates;
};

const getBigRaceType = (race: Race): UpcomingBigRace['type'] | null => {
  if (isGrandTourRace(race)) {
    return 'grand-tour';
  }
  if (isMonumentRace(race)) {
    return 'monument';
  }
  if (isMajorTourRace(race)) {
    return 'major-tour';
  }
  if (isTopClassicRace(race)) {
    return 'top-classic';
  }
  return null;
};

const getUpcomingBigRacesForGender = (
  races: Race[],
  gender: Gender,
  referenceDate: string,
  filters: RaceFilterState
): UpcomingBigRace[] => {
  const from = dayjs(referenceDate).startOf('day');
  const racesForGender = filterRacesByGender(races, gender).filter((race) =>
    isRaceVisibleForFilterState(race, filters)
  );

  return racesForGender
    .map((race) => {
      const type = getBigRaceType(race);
      if (!type) {
        return null;
      }

      const daysAway = dayjs(race.startDate).startOf('day').diff(from, 'day');
      if (daysAway <= 0) {
        return null;
      }

      return { race, type, daysAway };
    })
    .filter((entry): entry is UpcomingBigRace => entry !== null)
    .sort((a, b) => {
      if (a.daysAway !== b.daysAway) {
        return a.daysAway - b.daysAway;
      }
      return a.race.name.localeCompare(b.race.name);
    });
};

const CalendarScreen: React.FC<Props> = ({ navigation }) => {
  const [dates, setDates] = useState<string[]>(
    getDateRange(DEFAULT_DATE_WINDOW_DAYS, DEFAULT_DATE_WINDOW_DAYS)
  );
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());
  const [races, setRaces] = useState<Race[]>([]);
  const [filteredRaces, setFilteredRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedGender, setSelectedGender] = useState<Gender>(Gender.Men);
  const [showFilter, setShowFilter] = useState(false);
  const [savedFilter, setSavedFilter] = useState<RaceFilterState>(makeDefaultRaceFilterState);
  const [stagesMap, setStagesMap] = useState<Record<string, Stage | null>>({});
  const [stageCountsMap, setStageCountsMap] = useState<Record<string, number>>({});
  const [racesViewportHeight, setRacesViewportHeight] = useState<number>(0);
  const [racesMainContentHeight, setRacesMainContentHeight] = useState<number>(0);

  // Load races from the local PCS data file generated by scripts/fetch_races.py
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

  // Filter races when date, gender, or race-level filter changes
  useEffect(() => {
    if (races.length === 0) {
      setFilteredRaces([]);
      return;
    }

    let result = getRacesForDate(races, selectedDate);
    result = filterRacesByGender(result, selectedGender);
    result = result.filter((race) => isRaceVisibleForFilterState(race, savedFilter));

    setFilteredRaces(result);
  }, [races, savedFilter, selectedDate, selectedGender]);

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

  const handleDateSelect = useCallback((date: string) => {
    setDates((currentDates) => {
      const nextDates = ensureDateInWindow(currentDates, date);
      return extendDateWindow(nextDates, date);
    });
    setSelectedDate(date);
  }, []);

  const todayDate = getTodayDate();
  const upcomingBigRaces = useMemo(
    () => getUpcomingBigRacesForGender(races, selectedGender, todayDate, savedFilter),
    [races, savedFilter, selectedGender, todayDate]
  );
  const emptyDayUpcomingBigRaces = useMemo(
    () => upcomingBigRaces.slice(0, UPCOMING_BIG_RACES_EMPTY_DAY_LIMIT),
    [upcomingBigRaces]
  );
  const availableSpaceForUpcoming = Math.max(0, racesViewportHeight - racesMainContentHeight);
  const dynamicUpcomingCount = useMemo(() => {
    if (filteredRaces.length === 0) {
      return 0;
    }
    const spaceAfterTopMargin = availableSpaceForUpcoming - UPCOMING_SECTION_TOP_MARGIN;
    if (spaceAfterTopMargin <= UPCOMING_SECTION_STATIC_HEIGHT) {
      return 0;
    }
    return Math.max(
      0,
      Math.min(
        upcomingBigRaces.length,
        Math.floor((spaceAfterTopMargin - UPCOMING_SECTION_STATIC_HEIGHT) / UPCOMING_SECTION_ROW_STRIDE)
      )
    );
  }, [filteredRaces.length, availableSpaceForUpcoming, upcomingBigRaces.length]);
  const dynamicUpcomingBigRaces = useMemo(
    () => upcomingBigRaces.slice(0, dynamicUpcomingCount),
    [upcomingBigRaces, dynamicUpcomingCount]
  );
  const showUpcomingSectionForShortDay = filteredRaces.length > 0 && dynamicUpcomingCount > 0;
  const showTodayShortcut =
    Math.abs(dayjs(selectedDate).diff(dayjs(todayDate), 'day')) >= TODAY_SHORTCUT_THRESHOLD_DAYS;
  const showBottomShortcut = showTodayShortcut;

  const isDefault = isDefaultRaceFilterState(savedFilter);

  const handleTodayPress = () => {
    setDates((currentDates) =>
      currentDates.includes(todayDate)
        ? extendDateWindow(currentDates, todayDate)
        : getDateRange(DEFAULT_DATE_WINDOW_DAYS, DEFAULT_DATE_WINDOW_DAYS)
    );
    setSelectedDate(todayDate);
  };

  const handleUpcomingRacePress = (race: Race) => {
    handleDateSelect(race.startDate);
  };

  const handleDaySwipe = useCallback((direction: 'previous' | 'next') => {
    const targetDate =
      direction === 'next'
        ? dayjs(selectedDate).add(1, 'day').format('YYYY-MM-DD')
        : dayjs(selectedDate).subtract(1, 'day').format('YYYY-MM-DD');
    handleDateSelect(targetDate);
  }, [selectedDate, handleDateSelect]);

  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const horizontal = Math.abs(gestureState.dx);
          const vertical = Math.abs(gestureState.dy);
          return (
            horizontal > DAY_SWIPE_ACTIVATION_X &&
            horizontal > vertical * DAY_SWIPE_DIRECTION_RATIO
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          const horizontal = gestureState.dx;
          const vertical = Math.abs(gestureState.dy);
          if (
            vertical > DAY_SWIPE_MAX_VERTICAL_DRIFT ||
            Math.abs(horizontal) < DAY_SWIPE_MIN_DISTANCE
          ) {
            return;
          }

          if (horizontal < 0) {
            handleDaySwipe('next');
            return;
          }

          handleDaySwipe('previous');
        },
      }),
    [handleDaySwipe]
  );

  const handleFilterSave = useCallback((newFilters: RaceFilterState) => {
    setSavedFilter({ ...newFilters });
    setShowFilter(false);
  }, []);

  const handleRacePress = (race: Race) => {
    navigation.navigate('RaceDetail', { race, selectedDate });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0C" />

      <View style={styles.container} {...swipeResponder.panHandlers}>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.wordmarkWrap}>
              <View style={styles.wordmarkRow}>
                <View style={styles.wordmarkLines} pointerEvents="none">
                  <View style={[styles.wordmarkLine, styles.wordmarkLineFaint]} />
                  <View style={[styles.wordmarkLine, styles.wordmarkLineSoft]} />
                  <View style={[styles.wordmarkLine, styles.wordmarkLineMid]} />
                  <View style={[styles.wordmarkLine, styles.wordmarkLineMain]} />
                  <View style={[styles.wordmarkLine, styles.wordmarkLineMid]} />
                  <View style={[styles.wordmarkLine, styles.wordmarkLineSoft]} />
                  <View style={[styles.wordmarkLine, styles.wordmarkLineFaint]} />
                </View>
                <View style={styles.wordmarkTextBlock}>
                  <Text style={styles.wordmarkText}>BREAKAWAY</Text>
                  <Text style={styles.wordmarkTagline}>PRO CYCLING CALENDAR</Text>
                </View>
              </View>
            </View>
            <View style={styles.heroControls}>
              <View style={styles.genderToggle}>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    selectedGender === Gender.Men && styles.genderButtonActive,
                  ]}
                  onPress={() => setSelectedGender(Gender.Men)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Show men's races"
                >
                  <Text
                    style={[
                      styles.genderSymbol,
                      { color: selectedGender === Gender.Men ? '#FFFFFF' : 'rgba(255,255,255,0.24)' },
                    ]}
                  >
                    ♂
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderButton,
                    selectedGender === Gender.Women && styles.genderButtonActive,
                  ]}
                  onPress={() => setSelectedGender(Gender.Women)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Show women's races"
                >
                  <Text
                    style={[
                      styles.genderSymbol,
                      { color: selectedGender === Gender.Women ? '#FFFFFF' : 'rgba(255,255,255,0.24)' },
                    ]}
                  >
                    ♀
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.filterBtn}
                onPress={() => setShowFilter(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Filter race levels"
              >
                <MaterialCommunityIcons
                  name="filter-variant"
                  size={18}
                  color={isDefault ? 'rgba(255,255,255,0.45)' : '#F5C842'}
                />
                {!isDefault && <View style={styles.filterDot} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.dateSelectorWrap}>
          <DateSelector
            dates={dates}
            selectedDate={selectedDate}
            onSelectDate={handleDateSelect}
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F3F4F6" />
          </View>
        ) : filteredRaces.length === 0 ? (
          <UpcomingBigRacesList
            races={emptyDayUpcomingBigRaces}
            selectedDate={selectedDate}
            onPressRace={handleUpcomingRacePress}
            bottomPadding={showBottomShortcut ? TODAY_SHORTCUT_BOTTOM_PADDING : 28}
          />
        ) : (
          <RacesList
            races={filteredRaces}
            onPressRace={handleRacePress}
            stagesMap={stagesMap}
            stageCountsMap={stageCountsMap}
            bottomPadding={showBottomShortcut ? TODAY_SHORTCUT_BOTTOM_PADDING : 28}
            onViewportHeightChange={setRacesViewportHeight}
            onMainContentHeightChange={setRacesMainContentHeight}
            footer={
              showUpcomingSectionForShortDay ? (
                <View style={styles.shortDayUpcomingFooter}>
                  <UpcomingBigRacesSection
                    races={dynamicUpcomingBigRaces}
                    onPressRace={handleUpcomingRacePress}
                  />
                </View>
              ) : undefined
            }
          />
        )}

        {showBottomShortcut ? (
          <>
            <LinearGradient
              colors={['transparent', 'rgba(10,10,12,0.85)', '#0A0A0C']}
              locations={[0, 0.4, 0.7]}
              style={styles.todayScrim}
              pointerEvents="none"
            />
            <TouchableOpacity
              style={styles.todayShortcut}
              onPress={handleTodayPress}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Jump to today"
            >
              <Text style={styles.todayShortcutText}>Today</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      <FilterScreen
        visible={showFilter}
        savedFilters={savedFilter}
        onSave={handleFilterSave}
        onClose={() => setShowFilter(false)}
      />
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
    paddingBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  wordmarkWrap: {
    flexShrink: 1,
    marginRight: 12,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 40,
    gap: 6,
  },
  wordmarkLines: {
    gap: 3,
    alignItems: 'flex-start',
  },
  wordmarkLine: {
    borderRadius: 999,
    backgroundColor: '#F5C842',
  },
  wordmarkLineMain: {
    width: 32,
    height: 4,
    opacity: 1,
  },
  wordmarkLineMid: {
    width: 30,
    height: 3,
    opacity: 0.65,
  },
  wordmarkLineSoft: {
    width: 27,
    height: 2,
    opacity: 0.35,
  },
  wordmarkLineFaint: {
    width: 24,
    height: 1,
    opacity: 0.15,
  },
  wordmarkTextBlock: {
    justifyContent: 'flex-start',
  },
  wordmarkText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1.4,
    lineHeight: 32,
  },
  wordmarkTagline: {
    marginTop: -1,
    color: '#F5C842',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.3,
  },
  heroControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  genderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  genderButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  genderSymbol: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '700',
  },
  genderButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F5C842',
    borderWidth: 1.5,
    borderColor: '#0A0A0C',
  },
  dateSelectorWrap: {
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortDayUpcomingFooter: {
    marginTop: UPCOMING_SECTION_TOP_MARGIN,
  },
  todayScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: TODAY_FADE_HEIGHT,
  },
  todayShortcut: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    width: DATE_ITEM_WIDTH,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#F3F4F6',
    borderColor: '#F3F4F6',
  },
  todayShortcutText: {
    color: '#0A0A0C',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default CalendarScreen;
