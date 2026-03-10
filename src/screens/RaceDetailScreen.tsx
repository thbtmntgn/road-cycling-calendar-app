import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { getCategoryAccentColor } from '../constants/raceColors';
import {
  fetchGeneralStandings,
  fetchKomStandings,
  fetchPointsStandings,
  fetchResults,
  fetchStageResults,
  fetchStartlist,
  fetchStages,
  fetchTeamsStandings,
  fetchTeamsStageResults,
  fetchYouthStandings,
} from '../api/racesApi';
import RaceItem from '../components/RaceItem';
import {
  RaceKomStandingsByStage,
  RacePointsStandingsByStage,
  Race,
  RaceGeneralStandingsByStage,
  RaceResult,
  RaceStageResultsByStage,
  RaceTeamsStandingsByStage,
  RaceYouthStandingsByStage,
  Stage,
  StartlistTeam,
} from '../types';
import { compareStageOrder, getStageProgressIndex } from '../utils/stageUtils';

// Self-contained param list — works from both CalendarStack and FavoritesStack
type RaceDetailParams = { RaceDetail: { race: Race; selectedDate?: string } };

interface RaceDetailScreenProps {
  navigation: NativeStackNavigationProp<RaceDetailParams, 'RaceDetail'>;
  route: RouteProp<RaceDetailParams, 'RaceDetail'>;
}

type DetailTab = 'profile' | 'classification' | 'results' | 'startlist';
type ClassificationTab = 'gc' | 'points' | 'kom' | 'youth' | 'teams';

const CLASSIFICATION_TABS: { key: ClassificationTab; label: string }[] = [
  { key: 'gc', label: 'GC' },
  { key: 'points', label: 'Points' },
  { key: 'kom', label: 'KOM' },
  { key: 'youth', label: 'Youth' },
  { key: 'teams', label: 'Teams' },
];

const TEAM_SIDEBAR_WIDTH = 72;
const SCREEN_PADDING = 16;

const parseTimeToSeconds = (time: string): number | null => {
  const parts = time.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
};

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

const formatGap = (seconds: number): string => `+${formatDuration(seconds)}`;

const computeStageEarned = (
  current: RaceResult[],
  previous: RaceResult[],
  mode: 'points' | 'time',
): RaceResult[] => {
  const prevMap = new Map(previous.map((r) => [r.riderName, r.time ?? '0']));
  const earned = current.flatMap((r) => {
    const prevVal = prevMap.get(r.riderName);
    if (mode === 'points') {
      const diff = (Number(r.time) || 0) - (Number(prevVal) || 0);
      if (diff <= 0) return [];
      return [{ ...r, time: String(diff) }];
    } else {
      const currSecs = r.time ? parseTimeToSeconds(r.time) : null;
      const prevSecs = prevVal ? parseTimeToSeconds(prevVal) : null;
      if (currSecs === null) return [];
      const stageSecs = prevSecs !== null ? currSecs - prevSecs : currSecs;
      if (stageSecs <= 0) return [];
      return [{ ...r, time: formatDuration(stageSecs) }];
    }
  });
  const sorted = earned.sort((a, b) =>
    mode === 'points'
      ? (Number(b.time) || 0) - (Number(a.time) || 0)
      : (parseTimeToSeconds(a.time ?? '') ?? 0) - (parseTimeToSeconds(b.time ?? '') ?? 0),
  );
  return sorted.map((r, i) => ({ ...r, rankLabel: String(i + 1) }));
};

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

interface TeamJerseyProps {
  uri?: string;
}

const TeamJersey: React.FC<TeamJerseyProps> = ({ uri }) => {
  const [hasError, setHasError] = useState(false);

  if (!uri || hasError) {
    return null;
  }

  return (
    <View style={styles.teamJerseySection}>
      <View style={styles.teamJerseyFrame}>
        <Image
          source={{ uri }}
          style={styles.teamJerseyImage}
          resizeMode="contain"
          onError={() => setHasError(true)}
        />
      </View>
    </View>
  );
};

const RaceDetailScreen: React.FC<RaceDetailScreenProps> = ({ navigation, route }) => {
  const { race, selectedDate: selectedDateParam } = route.params;
  const selectedDate = selectedDateParam ?? dayjs().format('YYYY-MM-DD');
  const { width } = useWindowDimensions();
  const pagerWidth = Math.max(1, width - SCREEN_PADDING * 2);
  const isStageRace = race.startDate !== race.endDate;
  const [startlist, setStartlist] = useState<StartlistTeam[]>([]);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [gcStandingsByStage, setGcStandingsByStage] = useState<RaceGeneralStandingsByStage>({});
  const [stageResultsByStage, setStageResultsByStage] = useState<RaceStageResultsByStage>({});
  const [pointsStandingsByStage, setPointsStandingsByStage] = useState<RacePointsStandingsByStage>({});
  const [komStandingsByStage, setKomStandingsByStage] = useState<RaceKomStandingsByStage>({});
  const [youthStandingsByStage, setYouthStandingsByStage] = useState<RaceYouthStandingsByStage>({});
  const [teamsStandingsByStage, setTeamsStandingsByStage] = useState<RaceTeamsStandingsByStage>({});
  const [teamsStageResultsByStage, setTeamsStageResultsByStage] = useState<RaceTeamsStandingsByStage>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFutureRace = dayjs(race.startDate).isAfter(dayjs(), 'day');
  const [activeTab, setActiveTab] = useState<DetailTab>(isFutureRace ? 'profile' : 'startlist');
  const [activeClassificationTab, setActiveClassificationTab] = useState<ClassificationTab>('gc');
  const [activeResultsTab, setActiveResultsTab] = useState<ClassificationTab>('gc');
  const categoryColor = getCategoryAccentColor(race.category, race.startDate === race.endDate);
  const sortedStages = [...stages].sort(compareStageOrder);
  const stagesOnSelectedDate = sortedStages.filter((stage) => stage.date === selectedDate);
  const stageOnSelectedDate =
    stagesOnSelectedDate.length > 0 ? stagesOnSelectedDate[stagesOnSelectedDate.length - 1] : null;
  const stageProgressOnSelectedDate = getStageProgressIndex(sortedStages, stageOnSelectedDate);
  const stageNumberOnSelectedDate = stageOnSelectedDate?.stageNumber ?? null;
  const stageKey = stageNumberOnSelectedDate !== null ? String(stageNumberOnSelectedDate) : null;
  const generalStandingRows = isStageRace && stageKey ? gcStandingsByStage[stageKey] ?? [] : [];
  const pointsStandingRows = isStageRace && stageKey ? pointsStandingsByStage[stageKey] ?? [] : [];
  const komStandingRows = isStageRace && stageKey ? komStandingsByStage[stageKey] ?? [] : [];
  const youthStandingRows = isStageRace && stageKey ? youthStandingsByStage[stageKey] ?? [] : [];
  const teamsStandingRows = isStageRace && stageKey ? teamsStandingsByStage[stageKey] ?? [] : [];
  const classificationRowsByTab: Record<ClassificationTab, RaceResult[]> = {
    gc: generalStandingRows,
    points: pointsStandingRows,
    kom: komStandingRows,
    youth: youthStandingRows,
    teams: teamsStandingRows,
  };
  const activeClassificationRows = classificationRowsByTab[activeClassificationTab];
  const stageResultRows =
    isStageRace && stageKey !== null ? stageResultsByStage[stageKey] ?? [] : [];
  const prevStageKey = stageKey !== null ? String(Number(stageKey) - 1) : null;
  const youthRiderNames = new Set(
    (isStageRace && stageKey ? youthStandingsByStage[stageKey] ?? [] : []).map((r) => r.riderName),
  );
  const gcRows = isStageRace ? stageResultRows : results;
  const resultRowsByTab: Record<ClassificationTab, RaceResult[]> = {
    gc: gcRows,
    points: computeStageEarned(
      isStageRace && stageKey ? pointsStandingsByStage[stageKey] ?? [] : [],
      prevStageKey ? pointsStandingsByStage[prevStageKey] ?? [] : [],
      'points',
    ),
    kom: computeStageEarned(
      isStageRace && stageKey ? komStandingsByStage[stageKey] ?? [] : [],
      prevStageKey ? komStandingsByStage[prevStageKey] ?? [] : [],
      'points',
    ),
    youth: gcRows
      .filter((r) => youthRiderNames.has(r.riderName))
      .map((r, i) => ({ ...r, rankLabel: String(i + 1) })),
    teams: isStageRace && stageKey ? teamsStageResultsByStage[stageKey] ?? [] : [],
  };
  const activeResultRows = resultRowsByTab[activeResultsTab];
  const canShowResults = isStageRace || results.length > 0;
  const canShowGeneralStandings = isStageRace;
  const availableTabs: DetailTab[] = ['profile', 'startlist'];
  if (canShowResults) availableTabs.push('results');
  if (canShowGeneralStandings) availableTabs.push('classification');

  useEffect(() => {
    navigation.setOptions({ title: race.name });
    loadRaceData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRaceData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [
        startlistData,
        resultData,
        stagesData,
        gcStandingsData,
        stageResultsData,
        pointsStandingsData,
        komStandingsData,
        youthStandingsData,
        teamsStandingsData,
        teamsStageResultsData,
      ] =
        await Promise.all([
          fetchStartlist(race.id),
          fetchResults(race.id),
          isStageRace ? fetchStages(race.id) : Promise.resolve<Stage[]>([]),
          isStageRace
            ? fetchGeneralStandings(race.id)
            : Promise.resolve<RaceGeneralStandingsByStage>({}),
          isStageRace ? fetchStageResults(race.id) : Promise.resolve<RaceStageResultsByStage>({}),
          isStageRace
            ? fetchPointsStandings(race.id)
            : Promise.resolve<RacePointsStandingsByStage>({}),
          isStageRace ? fetchKomStandings(race.id) : Promise.resolve<RaceKomStandingsByStage>({}),
          isStageRace
            ? fetchYouthStandings(race.id)
            : Promise.resolve<RaceYouthStandingsByStage>({}),
          isStageRace
            ? fetchTeamsStandings(race.id)
            : Promise.resolve<RaceTeamsStandingsByStage>({}),
          isStageRace
            ? fetchTeamsStageResults(race.id)
            : Promise.resolve<RaceTeamsStandingsByStage>({}),
        ]);
      setStartlist(startlistData);
      setResults(resultData);
      setStages(stagesData);
      setGcStandingsByStage(gcStandingsData);
      setStageResultsByStage(stageResultsData);
      setPointsStandingsByStage(pointsStandingsData);
      setKomStandingsByStage(komStandingsData);
      setYouthStandingsByStage(youthStandingsData);
      setTeamsStandingsByStage(teamsStandingsData);
      setTeamsStageResultsByStage(teamsStageResultsData);

      setActiveClassificationTab('gc');
      setActiveResultsTab('gc');
      const raceIsFuture = dayjs(race.startDate).isAfter(dayjs(), 'day');
      if (raceIsFuture) {
        setActiveTab('profile');
      } else if (isStageRace) {
        setActiveTab('results');
      } else if (resultData.length > 0) {
        setActiveTab('results');
      } else {
        setActiveTab('startlist');
      }
    } catch {
      setStartlist([]);
      setResults([]);
      setStages([]);
      setGcStandingsByStage({});
      setStageResultsByStage({});
      setPointsStandingsByStage({});
      setKomStandingsByStage({});
      setYouthStandingsByStage({});
      setTeamsStandingsByStage({});

      setTeamsStageResultsByStage({});

      setActiveClassificationTab('gc');
      setActiveResultsTab('gc');
      setActiveTab('startlist');
      setError('Failed to load race details');
    } finally {
      setLoading(false);
    }
  };

  const handlePagerScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (startlist.length === 0) {
      return;
    }

    Math.round(event.nativeEvent.contentOffset.x / pagerWidth);
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

            <ScrollView
              style={styles.teamContentScroll}
              contentContainerStyle={styles.teamContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
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
              <TeamJersey uri={item.jerseyImageUrl} />
            </ScrollView>
          </View>
        </View>
      </View>
    );
  };

  const renderClassificationRow = (
    item: RaceResult,
    index: number,
    totalRows: number,
    leaderSeconds: number | null = null,
    showLeaderGap = false,
  ) => {
    const riderFlag = getCountryFlag(item.nationality);
    const trailingLabel = item.time || item.status;
    const rankLabel = item.rankLabel;

    let gap: string | null = null;
    if ((index > 0 || showLeaderGap) && leaderSeconds !== null && item.time) {
      const itemSeconds = parseTimeToSeconds(item.time);
      if (itemSeconds !== null) {
        gap = formatGap(Math.max(0, itemSeconds - leaderSeconds));
      }
    }

    return (
      <View
        style={[
          styles.resultRow,
          index === 0 ? styles.resultRowFirst : null,
          index === totalRows - 1 ? styles.resultRowLast : null,
        ]}
      >
        <View
          style={[
            styles.resultRankBadge,
            {
              backgroundColor: `${categoryColor}18`,
              borderColor: `${categoryColor}35`,
            },
          ]}
        >
          <Text style={[styles.resultRankText, { color: categoryColor }]}>{rankLabel}</Text>
        </View>

        <View style={styles.resultIdentity}>
          <View style={styles.resultNameRow}>
            {riderFlag ? <Text style={styles.resultFlag}>{riderFlag}</Text> : null}
            <Text style={styles.resultName}>{item.riderName}</Text>
          </View>
          {item.teamName ? <Text style={styles.resultTeam}>{item.teamName}</Text> : null}
        </View>

        <View style={styles.resultTrailing}>
          {trailingLabel ? <Text style={styles.resultTime}>{trailingLabel}</Text> : null}
          {gap ? <Text style={styles.resultGap}>{gap}</Text> : null}
        </View>
      </View>
    );
  };

  const renderResultRow = ({
    item,
    index,
  }: {
    item: RaceResult;
    index: number;
  }) => {
    const isYouth = activeResultsTab === 'youth';
    const isTeams = activeResultsTab === 'teams';
    const leaderSeconds = isYouth
      ? (generalStandingRows[0]?.time ? parseTimeToSeconds(generalStandingRows[0].time) : null)
      : (activeResultRows[0]?.time ? parseTimeToSeconds(activeResultRows[0].time) : null);
    return renderClassificationRow(item, index, activeResultRows.length, leaderSeconds, false);
  };

  const renderProfile = () => {
    const profileImageUrl = isStageRace
      ? stageOnSelectedDate?.profileImageUrl
      : race.profileImageUrl;

    if (!profileImageUrl) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="map-outline" size={40} color="#555555" />
          <Text style={styles.emptyText}>Profile not available yet</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.profileScroll}
        contentContainerStyle={styles.profileScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{ uri: profileImageUrl }}
          style={styles.profileImage}
          resizeMode="contain"
        />
      </ScrollView>
    );
  };

  const activeResultsLabel =
    CLASSIFICATION_TABS.find((t) => t.key === activeResultsTab)?.label ?? 'Results';

  const renderResults = () => {
    if (activeResultRows.length === 0) {
      let emptyMessage = 'Results not available yet';
      if (isStageRace) {
        emptyMessage = stageOnSelectedDate
          ? `${activeResultsLabel} results not available yet`
          : 'No stage scheduled on this date';
      }
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="ribbon-outline" size={40} color="#555555" />
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={activeResultRows}
        keyExtractor={(item, index) => `${item.rankLabel}-${item.riderName}-${index}`}
        renderItem={renderResultRow}
        style={styles.resultsList}
        contentContainerStyle={styles.resultsListContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderClassificationStandingRow = ({
    item,
    index,
  }: {
    item: RaceResult;
    index: number;
  }) => {
    const leaderSeconds = activeClassificationRows[0]?.time
      ? parseTimeToSeconds(activeClassificationRows[0].time)
      : null;
    return renderClassificationRow(item, index, activeClassificationRows.length, leaderSeconds);
  };

  const activeClassificationLabel =
    CLASSIFICATION_TABS.find((tab) => tab.key === activeClassificationTab)?.label ?? 'Classification';

  const renderClassificationStandings = () => {
    if (!stageOnSelectedDate) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="podium-outline" size={40} color="#555555" />
          <Text style={styles.emptyText}>No stage scheduled on this date</Text>
        </View>
      );
    }

    if (activeClassificationRows.length === 0) {
      let emptyMessage = `${activeClassificationLabel} classification not available yet`;
      if (activeClassificationTab === 'gc') {
        emptyMessage =
          stageOnSelectedDate.stageNumber === 1 ? 'GC will appear after stage 1' : 'GC not available yet';
      }

      return (
        <View style={styles.centerContainer}>
          <Ionicons name="podium-outline" size={40} color="#555555" />
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={activeClassificationRows}
        keyExtractor={(item, index) => `${item.rankLabel}-${item.riderName}-${index}`}
        renderItem={renderClassificationStandingRow}
        style={styles.resultsList}
        contentContainerStyle={styles.resultsListContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const renderStartlist = () => {
    if (startlist.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="time-outline" size={40} color="#555555" />
          <Text style={styles.emptyText}>Startlist not yet published</Text>
        </View>
      );
    }

    return (
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
    );
  };


  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        <RaceItem
          race={race}
          currentStage={stageOnSelectedDate}
          currentStageProgress={stageProgressOnSelectedDate}
          totalStages={sortedStages.length || undefined}
        />

        {availableTabs.length > 1 ? (
          <View style={styles.tabSwitcher}>
            {availableTabs.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabButton,
                  activeTab === tab ? styles.tabButtonActive : null,
                ]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.85}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabButtonText,
                    activeTab === tab ? styles.tabButtonTextActive : null,
                  ]}
                >
                  {tab === 'profile'
                    ? 'Profile'
                    : tab === 'classification'
                      ? 'Classification'
                      : tab === 'results'
                        ? 'Results'
                        : 'Startlist'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {(activeTab === 'classification' || (activeTab === 'results' && isStageRace)) ? (
          <View style={styles.classificationSubtabsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.classificationSubtabs}
            >
              {CLASSIFICATION_TABS.map((tab) => {
                const isActive = activeTab === 'classification'
                  ? activeClassificationTab === tab.key
                  : activeResultsTab === tab.key;
                const onPress = activeTab === 'classification'
                  ? () => setActiveClassificationTab(tab.key)
                  : () => setActiveResultsTab(tab.key);
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.classificationSubtab,
                      isActive ? styles.classificationSubtabActive : null,
                    ]}
                    onPress={onPress}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.classificationSubtabText,
                        isActive ? styles.classificationSubtabTextActive : null,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.tabContent}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#F3F4F6" />
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <Ionicons name="warning-outline" size={40} color="#FF6B6B" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadRaceData}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            activeTab === 'profile'
              ? renderProfile()
              : activeTab === 'classification'
                ? renderClassificationStandings()
                : activeTab === 'results'
                  ? renderResults()
                  : renderStartlist()
          )}
        </View>
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
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 12,
    paddingBottom: 16,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#12141A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#252833',
    padding: 4,
    marginTop: 18,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tabButtonActive: {
    backgroundColor: '#1D1D22',
  },
  tabButtonText: {
    color: '#8B93A1',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  classificationSubtabsWrap: {
    marginTop: 10,
  },
  classificationSubtabs: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  classificationSubtab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A31',
    backgroundColor: '#12141A',
  },
  classificationSubtabActive: {
    borderColor: '#393D4A',
    backgroundColor: '#1D1D22',
  },
  classificationSubtabText: {
    color: '#8B93A1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  classificationSubtabTextActive: {
    color: '#FFFFFF',
  },
  tabContent: {
    flex: 1,
    marginTop: 18,
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
  resultsList: {
    flex: 1,
  },
  resultsListContent: {
    paddingBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#171920',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#252833',
  },
  resultRowFirst: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  resultRowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  resultRankBadge: {
    minWidth: 42,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultRankText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  resultIdentity: {
    flex: 1,
    minWidth: 0,
  },
  resultNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  resultFlag: {
    fontSize: 14,
    lineHeight: 18,
  },
  resultName: {
    flex: 1,
    color: '#F4F4F5',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  resultTeam: {
    color: '#8B93A1',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  resultTrailing: {
    alignItems: 'flex-end',
  },
  resultTime: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'right',
  },
  resultGap: {
    color: '#FF6B6B',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'right',
  },
  profileScroll: {
    flex: 1,
  },
  profileScrollContent: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  profileImage: {
    width: '100%',
    height: 200,
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
  teamContentScroll: {
    flex: 1,
  },
  teamContent: {
    flexGrow: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
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
    gap: 6,
  },
  teamJerseySection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#252833',
    alignItems: 'center',
  },
  teamJerseyFrame: {
    width: '100%',
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A31',
    backgroundColor: '#12141A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  teamJerseyImage: {
    width: '100%',
    height: 92,
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
