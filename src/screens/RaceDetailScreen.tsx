import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { fetchStartlist } from '../api/racesApi';
import { getRacePresentation, isMonumentRace } from '../constants/racePresentation';
import { Gender, Race, StartlistTeam } from '../types';
import { formatDateRange } from '../utils/dateUtils';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Self-contained param list — works from both CalendarStack and FavoritesStack
type RaceDetailParams = { RaceDetail: { race: Race } };

interface RaceDetailScreenProps {
  navigation: NativeStackNavigationProp<RaceDetailParams, 'RaceDetail'>;
  route: RouteProp<RaceDetailParams, 'RaceDetail'>;
}

type StageTypeKey = 'flat' | 'hilly' | 'mountain' | 'tt';

const STAGE_TYPE_CONFIG: Record<StageTypeKey, { icon: MCIName; color: string; label: string }> = {
  flat: { icon: 'minus', color: '#4ADE80', label: 'Flat' },
  hilly: { icon: 'chart-bell-curve', color: '#FACC15', label: 'Hilly' },
  mountain: { icon: 'image-filter-hdr', color: '#F87171', label: 'Mountain' },
  tt: { icon: 'timer-outline', color: '#A78BFA', label: 'Time Trial' },
};

const SUMMARY_SIDEBAR_WIDTH = 64;
const TEAM_SIDEBAR_WIDTH = 72;
const SCREEN_PADDING = 16;

const getCountryFlag = (code?: string | null): string | null => {
  const normalized = (code ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return null;
  }

  return normalized
    .split('')
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join('');
};

const getRaceFormat = (dayCount: number): string => {
  if (dayCount <= 4) {
    return `${dayCount} days`;
  }
  if (dayCount <= 8) {
    return '1 week';
  }
  if (dayCount <= 14) {
    return '2 weeks';
  }
  return '3 weeks';
};

const parseDuration = (value: string): { primary: string; secondary: string } => {
  const [primary, ...rest] = value.split(' ');
  return {
    primary,
    secondary: rest.join(' '),
  };
};

interface StageTypeTagProps {
  type: StageTypeKey;
}

const StageTypeTag: React.FC<StageTypeTagProps> = ({ type }) => {
  const config = STAGE_TYPE_CONFIG[type];
  if (!config) {
    return null;
  }

  return (
    <View
      style={[
        sharedStyles.badge,
        {
          backgroundColor: `${config.color}14`,
          borderColor: `${config.color}35`,
        },
      ]}
    >
      <MaterialCommunityIcons name={config.icon} size={12} color={config.color} />
      <Text style={[sharedStyles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const MonumentBadge: React.FC = () => (
  <View
    style={[
      sharedStyles.badge,
      {
        backgroundColor: '#342A10',
        borderColor: '#5B4716',
      },
    ]}
  >
    <MaterialCommunityIcons name="trophy-outline" size={12} color="#F7D774" />
    <Text style={[sharedStyles.badgeText, { color: '#F7D774' }]}>Monument</Text>
  </View>
);

interface MetadataChipsProps {
  startTime?: string | null;
  distance?: number;
  elevation?: number;
}

const MetadataChips: React.FC<MetadataChipsProps> = ({ startTime, distance, elevation }) => {
  const chips: { icon: MCIName; label: string }[] = [];

  if (startTime) {
    chips.push({ icon: 'clock-outline', label: startTime });
  }
  if (distance && distance > 0) {
    chips.push({ icon: 'road', label: `${distance} km` });
  }
  if (elevation && elevation > 0) {
    chips.push({ icon: 'arrow-up', label: `${elevation.toLocaleString()} m` });
  }
  if (chips.length === 0) {
    return null;
  }

  return (
    <View style={sharedStyles.chipsRow}>
      {chips.map((chip) => (
        <View key={`${chip.icon}-${chip.label}`} style={sharedStyles.chip}>
          <MaterialCommunityIcons name={chip.icon} size={11} color="#8B93A1" />
          <Text style={sharedStyles.chipText}>{chip.label}</Text>
        </View>
      ))}
    </View>
  );
};

interface DurationBlockProps {
  label: string;
  color: string;
}

const DurationBlock: React.FC<DurationBlockProps> = ({ label, color }) => {
  const { primary, secondary } = parseDuration(label);

  return (
    <View style={sharedStyles.durationBlock}>
      <Text style={[sharedStyles.durationValue, { color }]}>{primary}</Text>
      <Text style={[sharedStyles.durationLabel, { color }]}>{secondary}</Text>
    </View>
  );
};

interface RaceSummaryTileProps {
  race: Race;
}

const RaceSummaryTile: React.FC<RaceSummaryTileProps> = ({ race }) => {
  const presentation = getRacePresentation(race.category);
  const accentColor = presentation.accentColor;
  const isOneDay = race.startDate === race.endDate;
  const totalDays = dayjs(race.endDate).diff(dayjs(race.startDate), 'day') + 1;
  const stageType = race.stageType as StageTypeKey | undefined;
  const isMonument = isOneDay && race.gender === Gender.Men && isMonumentRace(race);
  const raceFlag = getCountryFlag(race.country);

  return (
    <View style={styles.summaryCard}>
      <View
        style={[
          styles.summarySidebar,
          {
            backgroundColor: `${accentColor}18`,
            borderRightColor: accentColor,
          },
        ]}
      >
        {isOneDay ? (
          <View style={styles.centered}>
            <Text style={[styles.summaryDayValue, { color: accentColor }]}>1</Text>
            <Text style={[styles.summaryDayLabel, { color: accentColor }]}>Day</Text>
          </View>
        ) : (
          <DurationBlock label={getRaceFormat(totalDays)} color={accentColor} />
        )}
      </View>

      <View style={styles.summaryContent}>
        <View style={styles.summaryHeaderRow}>
          <View style={styles.summaryNameRow}>
            {raceFlag ? <Text style={styles.summaryFlag}>{raceFlag}</Text> : null}
            <Text style={styles.summaryName}>{race.name}</Text>
          </View>
          <View style={styles.summaryTagColumn}>
            {stageType ? <StageTypeTag type={stageType} /> : null}
          </View>
        </View>

        {isMonument ? (
          <View style={styles.summarySecondaryRow}>
            <MonumentBadge />
          </View>
        ) : null}

        <Text style={styles.summaryDateText}>{formatDateRange(race.startDate, race.endDate)}</Text>
        <Text style={styles.summaryCountryText}>{race.country}</Text>
        <MetadataChips
          startTime={race.startTime && race.startTime !== '-' ? race.startTime : null}
          distance={race.distance}
          elevation={race.elevation}
        />
      </View>
    </View>
  );
};

const RaceDetailScreen: React.FC<RaceDetailScreenProps> = ({ navigation, route }) => {
  const { race } = route.params;
  const { width } = useWindowDimensions();
  const pagerWidth = Math.max(1, width - SCREEN_PADDING * 2);
  const [startlist, setStartlist] = useState<StartlistTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const categoryColor = getRacePresentation(race.category).accentColor;

  useEffect(() => {
    navigation.setOptions({ title: race.name });
    loadStartlist();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStartlist = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchStartlist(race.id);
      setStartlist(data);
      setCurrentTeamIndex(0);
    } catch (err: unknown) {
      const axiosError = err as { response?: { status: number } };
      setCurrentTeamIndex(0);
      if (axiosError?.response?.status === 404) {
        setStartlist([]);
      } else {
        setError('Failed to load startlist');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePagerScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (startlist.length === 0) {
      return;
    }

    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pagerWidth);
    const boundedIndex = Math.max(0, Math.min(startlist.length - 1, nextIndex));
    setCurrentTeamIndex(boundedIndex);
  };

  const renderTeamPage = ({
    item,
    index,
  }: {
    item: StartlistTeam;
    index: number;
  }) => {
    const teamFlag = getCountryFlag(item.countryCode);

    return (
      <View style={[styles.teamPage, { width: pagerWidth }]}>
        <View style={styles.teamPageInner}>
          <View style={styles.teamCard}>
            <View
              style={[
                styles.teamSidebar,
                {
                  backgroundColor: `${categoryColor}18`,
                  borderRightColor: categoryColor,
                },
              ]}
            >
              <Text style={[styles.teamSidebarLabel, { color: categoryColor }]}>Team</Text>
              <Text style={[styles.teamSidebarValue, { color: categoryColor }]}>
                {index + 1} / {startlist.length}
              </Text>
            </View>

            <View style={styles.teamContent}>
              <View style={styles.teamNameRow}>
                {teamFlag ? <Text style={styles.teamFlag}>{teamFlag}</Text> : null}
                <Text style={styles.teamName}>{item.teamName}</Text>
              </View>
              <View style={styles.teamDivider} />
              <View style={styles.ridersList}>
                {item.riders.map((rider, riderIndex) => {
                  const riderFlag = getCountryFlag(rider.nationality);

                  return (
                    <View
                      key={`${item.teamName}-${rider.name}-${riderIndex}`}
                      style={styles.riderRow}
                    >
                      <Text style={styles.riderIndex}>{riderIndex + 1}</Text>
                      <View style={styles.riderIdentity}>
                        {riderFlag ? (
                          <Text style={styles.riderFlag}>{riderFlag}</Text>
                        ) : (
                          <View style={styles.riderFlagPlaceholder} />
                        )}
                        <Text style={styles.riderName}>{rider.name}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        <RaceSummaryTile race={race} />

        <View style={styles.startlistHeader}>
          <Text style={styles.startlistTitle}>Startlist</Text>
          {startlist.length > 0 ? (
            <Text style={styles.startlistCount}>
              {currentTeamIndex + 1} / {startlist.length}
            </Text>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#F3F4F6" />
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="warning-outline" size={40} color="#FF6B6B" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadStartlist}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : startlist.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="time-outline" size={40} color="#555555" />
            <Text style={styles.emptyText}>Startlist not yet published</Text>
          </View>
        ) : (
          <FlatList
            data={startlist}
            horizontal
            pagingEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `${item.teamName}-${index}`}
            renderItem={renderTeamPage}
            onMomentumScrollEnd={handlePagerScrollEnd}
            style={styles.teamPager}
            scrollEnabled={startlist.length > 1}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const sharedStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1D1D22',
    borderWidth: 1,
    borderColor: '#2A2A31',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  chipText: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '600',
  },
  durationBlock: {
    alignItems: 'center',
  },
  durationValue: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  durationLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    opacity: 0.9,
    textTransform: 'uppercase',
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 12,
    paddingBottom: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#171920',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#252833',
    overflow: 'hidden',
  },
  summarySidebar: {
    width: SUMMARY_SIDEBAR_WIDTH,
    borderRightWidth: 3,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDayValue: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  summaryDayLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  summaryContent: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  summaryNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    flex: 1,
    minWidth: 0,
  },
  summaryTagColumn: {
    flexShrink: 0,
  },
  summaryFlag: {
    fontSize: 16,
    lineHeight: 18,
  },
  summaryName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  summarySecondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  summaryDateText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCountryText: {
    color: '#8B93A1',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  startlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  startlistTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  startlistCount: {
    color: '#8B93A1',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 22,
    backgroundColor: '#1D1D22',
    borderWidth: 1,
    borderColor: '#2A2A31',
    borderRadius: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    color: '#71717A',
    fontSize: 15,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },
  teamPager: {
    flex: 1,
  },
  teamPage: {
    flex: 1,
  },
  teamPageInner: {
    flex: 1,
    paddingBottom: 12,
  },
  teamCard: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#171920',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#252833',
    overflow: 'hidden',
  },
  teamSidebar: {
    width: TEAM_SIDEBAR_WIDTH,
    borderRightWidth: 3,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamSidebarLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    opacity: 0.9,
    textTransform: 'uppercase',
  },
  teamSidebarValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  teamContent: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  teamFlag: {
    fontSize: 18,
    lineHeight: 22,
  },
  teamName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  teamDivider: {
    height: 1,
    backgroundColor: '#252833',
    marginTop: 12,
    marginBottom: 12,
  },
  ridersList: {
    gap: 10,
  },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  riderIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  riderFlag: {
    fontSize: 15,
    lineHeight: 20,
  },
  riderFlagPlaceholder: {
    width: 16,
  },
  riderIndex: {
    width: 16,
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'right',
  },
  riderName: {
    flex: 1,
    color: '#D1D5DB',
    fontSize: 16,
    lineHeight: 22,
  },
});

export default RaceDetailScreen;
