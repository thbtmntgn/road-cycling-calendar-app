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
import { compareStageOrder, formatStageLabel, getStageProgressIndex } from '../utils/stageUtils';

// Self-contained param list — works from both CalendarStack and FavoritesStack
type RaceDetailParams = { RaceDetail: { race: Race; selectedDate?: string } };

interface RaceDetailScreenProps {
  navigation: NativeStackNavigationProp<RaceDetailParams, 'RaceDetail'>;
  route: RouteProp<RaceDetailParams, 'RaceDetail'>;
}

type DetailTab = 'classification' | 'results' | 'startlist';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<DetailTab>('startlist');
  const [activeClassificationTab, setActiveClassificationTab] = useState<ClassificationTab>('gc');
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
    isStageRace && stageNumberOnSelectedDate !== null
      ? stageResultsByStage[String(stageNumberOnSelectedDate)] ?? []
      : [];
  const canShowResults = isStageRace || results.length > 0;
  const canShowGeneralStandings = isStageRace;
  const availableTabs: DetailTab[] = [];
  if (canShowResults) {
    availableTabs.push('results');
  }
  if (canShowGeneralStandings) {
    availableTabs.push('classification');
  }
  availableTabs.push('startlist');

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
      setCurrentTeamIndex(0);
      setActiveClassificationTab('gc');
      if (isStageRace) {
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
      setCurrentTeamIndex(0);
      setActiveClassificationTab('gc');
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

  const renderClassificationRow = (item: RaceResult, index: number, totalRows: number) => {
    const riderFlag = getCountryFlag(item.nationality);
    const trailingLabel = item.time || item.status;

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
          <Text style={[styles.resultRankText, { color: categoryColor }]}>{item.rankLabel}</Text>
        </View>

        <View style={styles.resultIdentity}>
          <View style={styles.resultNameRow}>
            {riderFlag ? <Text style={styles.resultFlag}>{riderFlag}</Text> : null}
            <Text style={styles.resultName}>{item.riderName}</Text>
          </View>
          {item.teamName ? <Text style={styles.resultTeam}>{item.teamName}</Text> : null}
        </View>

        {trailingLabel ? <Text style={styles.resultTime}>{trailingLabel}</Text> : null}
      </View>
    );
  };

  const renderResultRow = ({
    item,
    index,
  }: {
    item: RaceResult;
    index: number;
  }) => renderClassificationRow(item, index, isStageRace ? stageResultRows.length : results.length);

  const renderResults = () => {
    const resultRows = isStageRace ? stageResultRows : results;
    let emptyMessage = 'Results not available yet';
    if (isStageRace) {
      emptyMessage = stageOnSelectedDate
        ? 'Stage results not available yet'
        : 'No stage scheduled on this date';
    }

    if (resultRows.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="ribbon-outline" size={40} color="#555555" />
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={resultRows}
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
  }) => renderClassificationRow(item, index, activeClassificationRows.length);

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

  const activeTabTitle =
    activeTab === 'classification'
      ? 'Classification'
      : activeTab === 'results'
        ? 'Results'
        : 'Startlist';

  let activeTabMeta: string | null = null;
  if (activeTab === 'classification') {
    if (activeClassificationRows.length > 0) {
      activeTabMeta = `${activeClassificationLabel} · Top ${activeClassificationRows.length}`;
      if (stageOnSelectedDate) {
        activeTabMeta += ` · After ${formatStageLabel(stageOnSelectedDate.stageNumber)}`;
      }
    } else {
      activeTabMeta = activeClassificationLabel;
    }
  } else if (activeTab === 'results') {
    if (isStageRace) {
      if (stageResultRows.length > 0) {
        activeTabMeta = `Top ${stageResultRows.length}`;
        if (stageOnSelectedDate) {
          activeTabMeta += ` · ${formatStageLabel(stageOnSelectedDate.stageNumber)}`;
        }
      }
    } else {
      activeTabMeta = results.length > 0 ? `Top ${results.length}` : null;
    }
  } else if (startlist.length > 0) {
    activeTabMeta = `${currentTeamIndex + 1} / ${startlist.length}`;
  }

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
                  {tab === 'classification'
                    ? 'Classification'
                    : tab === 'results'
                      ? 'Results'
                      : 'Startlist'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {activeTab === 'classification' ? (
          <View style={styles.classificationSubtabsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.classificationSubtabs}
            >
              {CLASSIFICATION_TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.classificationSubtab,
                    activeClassificationTab === tab.key ? styles.classificationSubtabActive : null,
                  ]}
                  onPress={() => setActiveClassificationTab(tab.key)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.classificationSubtabText,
                      activeClassificationTab === tab.key ? styles.classificationSubtabTextActive : null,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.startlistHeader}>
          <Text style={styles.startlistTitle}>{activeTabTitle}</Text>
          {activeTabMeta ? <Text style={styles.startlistCount}>{activeTabMeta}</Text> : null}
        </View>

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
          activeTab === 'classification'
            ? renderClassificationStandings()
            : activeTab === 'results'
              ? renderResults()
              : renderStartlist()
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
  resultTime: {
    maxWidth: 88,
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'right',
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
