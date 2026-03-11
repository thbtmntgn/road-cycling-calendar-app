import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
import { formatDateWithRelativeLabel } from '../utils/dateUtils';

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

const LEVEL_BADGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  WT:  { bg: '#0d2010', color: '#4ade80', border: '#1a4a25' },
  WWT: { bg: '#0d2010', color: '#4ade80', border: '#1a4a25' },
  PT:  { bg: '#0d1020', color: '#818cf8', border: '#1e2455' },
  WPT: { bg: '#0d1020', color: '#818cf8', border: '#1e2455' },
  CT:  { bg: '#1a1005', color: '#fb923c', border: '#3d2408' },
  WCT: { bg: '#1a1005', color: '#fb923c', border: '#3d2408' },
};

const LevelBadge: React.FC<{ level: string }> = ({ level }) => {
  const c = LEVEL_BADGE_COLORS[level] ?? { bg: '#181018', color: '#a78bfa', border: '#2e1d4a' };
  return (
    <View style={[styles.levelBadge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.levelBadgeText, { color: c.color }]}>{level}</Text>
    </View>
  );
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
  const isStageRace = race.startDate !== race.endDate;
  const [currentDate, setCurrentDate] = useState(selectedDateParam ?? dayjs().format('YYYY-MM-DD'));
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
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileImgNaturalSize, setProfileImgNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [profileContainerH, setProfileContainerH] = useState(0);
  const [profileExpanded, setProfileExpanded] = useState(false);

  // Stage tile swipe gesture
  const stagePanState = useRef({ prevDate: null as string | null, nextDate: null as string | null });
  const stagePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => {
        if (!isStageRace) return false;
        const h = Math.abs(gs.dx);
        const v = Math.abs(gs.dy);
        return h > 14 && h > v * 1.3;
      },
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dy) > 72 || Math.abs(gs.dx) < 56) return;
        const { prevDate, nextDate } = stagePanState.current;
        if (gs.dx < 0 && nextDate) setCurrentDate(nextDate);
        else if (gs.dx > 0 && prevDate) setCurrentDate(prevDate);
      },
    }),
  ).current;

  // Startlist swipe gesture
  const teamSwipeState = useRef({ index: 0, total: 0 });
  teamSwipeState.current.index = selectedTeamIndex;
  teamSwipeState.current.total = startlist.length;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => {
        const h = Math.abs(gs.dx);
        const v = Math.abs(gs.dy);
        return h > 14 && h > v * 1.3;
      },
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dy) > 72 || Math.abs(gs.dx) < 56) return;
        const { index, total } = teamSwipeState.current;
        let newIndex = index;
        if (gs.dx < 0 && index < total - 1) newIndex = index + 1;
        else if (gs.dx > 0 && index > 0) newIndex = index - 1;
        if (newIndex !== index) {
          teamSwipeState.current.index = newIndex;
          setSelectedTeamIndex(newIndex);
        }
      },
    }),
  ).current;
  // Screen-level swipe gesture for stage date navigation
  const screenSwipeRef = useRef({ prevDate: null as string | null, nextDate: null as string | null, activeTab: 'profile' as DetailTab });
  const screenSwipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => {
        const tab = screenSwipeRef.current.activeTab;
        if (!isStageRace || tab === 'startlist' || tab === 'profile') return false;
        const h = Math.abs(gs.dx);
        const v = Math.abs(gs.dy);
        return h > 14 && h > v * 1.3;
      },
      onPanResponderRelease: (_, gs) => {
        const tab = screenSwipeRef.current.activeTab;
        if (!isStageRace || tab === 'startlist' || tab === 'profile') return;
        if (Math.abs(gs.dy) > 72 || Math.abs(gs.dx) < 56) return;
        const { prevDate, nextDate } = screenSwipeRef.current;
        if (gs.dx < 0 && nextDate) setCurrentDate(nextDate);
        else if (gs.dx > 0 && prevDate) setCurrentDate(prevDate);
      },
    })
  ).current;

  const teamTabsRef = useRef<FlatList<StartlistTeam>>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('profile');
  const [activeClassificationTab, setActiveClassificationTab] = useState<ClassificationTab>('gc');
  const [activeResultsTab, setActiveResultsTab] = useState<ClassificationTab>('gc');
  const categoryColor = getCategoryAccentColor(race.category, race.startDate === race.endDate);
  const sortedStages = [...stages].sort(compareStageOrder);
  const sortedUniqueDates = [...new Set(sortedStages.map((s) => s.date))].sort();
  const currentDateIndex = sortedUniqueDates.indexOf(currentDate);
  const prevStageDate = currentDateIndex > 0 ? sortedUniqueDates[currentDateIndex - 1] : null;
  const nextStageDate =
    currentDateIndex < sortedUniqueDates.length - 1 ? sortedUniqueDates[currentDateIndex + 1] : null;
  stagePanState.current = { prevDate: prevStageDate, nextDate: nextStageDate };
  screenSwipeRef.current.prevDate = prevStageDate;
  screenSwipeRef.current.nextDate = nextStageDate;
  screenSwipeRef.current.activeTab = activeTab;
  const stagesOnSelectedDate = sortedStages.filter((stage) => stage.date === currentDate);
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

  // Build a map of lowercase rider name → first stage number where they went absent.
  // PCS omits DNF/DNS riders from stage results entirely (no explicit DNF row), so we
  // detect abandonment by absence: a startlist rider missing from a completed stage's
  // results is treated as having abandoned that stage. Names are compared lowercase to
  // handle the case difference between startlist ("AYUSO Juan") and results ("Ayuso Juan").
  const currentStageNum = stageNumberOnSelectedDate ?? Infinity;
  const dnfRiderMap = new Map<string, number>(); // lowercase riderName → stage number
  if (isStageRace && startlist.length > 0) {
    const stagePresent = new Map<number, Set<string>>();
    for (const [sk, rows] of Object.entries(stageResultsByStage)) {
      const stageNum = Number(sk);
      stagePresent.set(stageNum, new Set(rows.map((r) => r.riderName.toLowerCase())));
    }
    const completedStages = [...stagePresent.keys()]
      .sort((a, b) => a - b)
      .filter((n) => n < currentStageNum);
    for (const team of startlist) {
      for (const rider of team.riders) {
        const nameLower = rider.name.toLowerCase();
        for (const stageNum of completedStages) {
          if (!stagePresent.get(stageNum)!.has(nameLower)) {
            dnfRiderMap.set(nameLower, stageNum);
            break;
          }
        }
      }
    }
  }
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
    loadRaceData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const dateLabel = isStageRace ? currentDate : race.startDate;
    navigation.setOptions({
      headerTitle: () => (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
            {race.name}
          </Text>
          <Text style={{ color: '#8B93A1', fontSize: 12, fontWeight: '500' }}>
            {formatDateWithRelativeLabel(dateLabel)}
          </Text>
        </View>
      ),
    });
  }, [currentDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Disable native back gesture for stage races (tile swipe handles horizontal gestures)
    navigation.setOptions({ gestureEnabled: !isStageRace && activeTab !== 'startlist' });
  }, [activeTab, isStageRace]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (startlist.length > 0) {
      teamTabsRef.current?.scrollToIndex({
        index: selectedTeamIndex,
        animated: true,
        viewPosition: 0.5,
      });
    }
  }, [selectedTeamIndex, startlist.length]);

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
      setSelectedTeamIndex(0);
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
      let raceHasResults = false;
      if (isStageRace) {
        const sortedLoaded = [...stagesData].sort(compareStageOrder);
        const stagesOnDate = sortedLoaded.filter((s) => s.date === currentDate);
        const stageOnDate = stagesOnDate.length > 0 ? stagesOnDate[stagesOnDate.length - 1] : null;
        const key = stageOnDate?.stageNumber != null ? String(stageOnDate.stageNumber) : null;
        raceHasResults = key != null && (stageResultsData[key]?.length ?? 0) > 0;
      } else {
        raceHasResults = resultData.length > 0;
      }
      setActiveTab(raceHasResults ? 'results' : 'profile');
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
      setActiveTab('profile');
      setError('Failed to load race details');
    } finally {
      setLoading(false);
    }
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

    // Rank 1: show absolute time. Rank 2+: show gap only.
    const displayTime = index === 0 ? trailingLabel : (gap ?? trailingLabel);
    const isGap = index > 0 && gap !== null;

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

        {riderFlag ? <Text style={styles.resultFlag}>{riderFlag}</Text> : null}

        <Text style={styles.resultName} numberOfLines={1}>
          {item.riderName}
          {item.teamName ? <Text style={styles.resultTeamInline}> · {item.teamName}</Text> : null}
        </Text>

        {displayTime ? (
          <Text style={isGap ? styles.resultGap : styles.resultTime} numberOfLines={1}>
            {displayTime}
          </Text>
        ) : null}
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
    const leaderSeconds = isYouth
      ? (generalStandingRows[0]?.time ? parseTimeToSeconds(generalStandingRows[0].time) : null)
      : (activeResultRows[0]?.time ? parseTimeToSeconds(activeResultRows[0].time) : null);
    return renderClassificationRow(item, index, activeResultRows.length, leaderSeconds, false);
  };

  const profileImageUrl = isStageRace
    ? stageOnSelectedDate?.profileImageUrl
    : race.profileImageUrl;

  useEffect(() => {
    setProfileImgNaturalSize(null);
    setProfileExpanded(false);
    if (!profileImageUrl) return;
    Image.getSize(
      profileImageUrl,
      (w, h) => { if (w > 0 && h > 0) setProfileImgNaturalSize({ w, h }); },
      () => {},
    );
  }, [profileImageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderProfile = () => {
    if (!profileImageUrl) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="map-outline" size={40} color="#555555" />
          <Text style={styles.emptyText}>Profile not available yet</Text>
        </View>
      );
    }

    const availableW = Dimensions.get('window').width - SCREEN_PADDING * 2;
    const ratio = profileImgNaturalSize != null ? profileImgNaturalSize.w / profileImgNaturalSize.h : null;

    const HINT_H = 20;
    const maxH = profileContainerH > HINT_H ? profileContainerH - HINT_H : Math.round(Dimensions.get('window').height * 0.45);

    let imgW: number;
    let imgH: number;
    if (profileExpanded && profileImgNaturalSize != null) {
      // Expanded: native pixel dimensions, capped to available height (no upscaling, no overflow)
      imgH = Math.min(profileImgNaturalSize.h, maxH);
      imgW = Math.round(imgH * (profileImgNaturalSize.w / profileImgNaturalSize.h));
    } else {
      // Collapsed: fit full image within available width
      imgW = availableW;
      imgH = ratio != null ? Math.round(availableW / ratio) : Math.round(availableW * 0.5);
    }

    const needsScroll = profileExpanded && imgW > availableW;

    const imgEl = (
      <TouchableOpacity
        onPress={() => setProfileExpanded((v) => !v)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: profileImageUrl }}
          style={{ width: imgW, height: imgH }}
          resizeMode="contain"
        />
      </TouchableOpacity>
    );

    return (
      <View
        style={styles.profileContainer}
        onLayout={(e) => setProfileContainerH(e.nativeEvent.layout.height)}
      >
        {needsScroll ? (
          <ScrollView
            horizontal
            style={styles.profileHScroll}
            contentContainerStyle={{ width: imgW }}
            showsHorizontalScrollIndicator={false}
            bounces
          >
            {imgEl}
          </ScrollView>
        ) : (
          <View style={{ borderRadius: 12, overflow: 'hidden' }}>{imgEl}</View>
        )}
        <Text style={styles.profileHint}>
          {profileExpanded ? '← drag to scroll · tap to fit →' : 'Tap to expand'}
        </Text>
      </View>
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

    const currentTeam = startlist[selectedTeamIndex];
    const teamFlag = getCountryFlag(currentTeam.countryCode);

    return (
      <View style={styles.startlistContainer} {...panResponder.panHandlers}>
        <View style={styles.teamCard}>
          <ScrollView
            style={styles.teamContentScroll}
            contentContainerStyle={styles.teamContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View style={styles.teamNameRow}>
              {teamFlag ? <Text style={styles.teamFlag}>{teamFlag}</Text> : null}
              <Text style={styles.teamName}>{currentTeam.teamName}</Text>
              {currentTeam.uciClass ? <LevelBadge level={currentTeam.uciClass} /> : null}
              <Text style={styles.teamCounter}>
                {selectedTeamIndex + 1} / {startlist.length}
              </Text>
            </View>
            <View style={styles.teamDivider} />
            <View style={styles.ridersList}>
              {currentTeam.riders.map((rider, riderIndex) => {
                const riderFlag = getCountryFlag(rider.nationality);
                const dnfStage = dnfRiderMap.get(rider.name.toLowerCase());
                const isDnf = dnfStage !== undefined;
                return (
                  <View
                    key={`${currentTeam.teamName}-${rider.name}-${riderIndex}`}
                    style={styles.riderRow}
                  >
                    <Text style={[styles.riderIndex, isDnf && styles.riderDnfMuted]}>
                      {riderIndex + 1}
                    </Text>
                    <View style={styles.riderIdentity}>
                      {riderFlag ? (
                        <Text style={[styles.riderFlag, isDnf && styles.riderDnfMuted]}>
                          {riderFlag}
                        </Text>
                      ) : (
                        <View style={styles.riderFlagPlaceholder} />
                      )}
                      <Text style={[styles.riderName, isDnf && styles.riderDnfName]}>
                        {rider.name}
                      </Text>
                      {isDnf ? (
                        <View style={styles.dnfBadge}>
                          <Text style={styles.dnfBadgeText}>DNF S{dnfStage}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
            <TeamJersey key={currentTeam.teamName} uri={currentTeam.jerseyImageUrl} />
          </ScrollView>
        </View>

        {startlist.length > 1 ? (
          <FlatList
            ref={teamTabsRef}
            data={startlist}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => `tab-${item.teamName}-${index}`}
            style={styles.teamTabStrip}
            contentContainerStyle={styles.teamTabStripContent}
            onScrollToIndexFailed={() => {}}
            renderItem={({ item, index }) => {
              const isActive = index === selectedTeamIndex;
              const flag = getCountryFlag(item.countryCode);
              const abbr = item.teamName
                .split(' ')[0]
                .replace('|', '')
                .substring(0, 3)
                .toUpperCase();
              return (
                <TouchableOpacity
                  onPress={() => setSelectedTeamIndex(index)}
                  style={[
                    styles.teamTab,
                    isActive
                      ? { backgroundColor: `${categoryColor}22`, borderColor: categoryColor }
                      : null,
                  ]}
                  activeOpacity={0.75}
                >
                  {flag ? <Text style={styles.teamTabFlag}>{flag}</Text> : null}
                  <Text
                    style={[
                      styles.teamTabLabel,
                      isActive ? { color: '#fff' } : null,
                    ]}
                  >
                    {abbr}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        ) : null}
      </View>
    );
  };


  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container} {...screenSwipeResponder.panHandlers}>
        <View {...(isStageRace ? stagePanResponder.panHandlers : {})}>
          <RaceItem
            race={race}
            currentStage={stageOnSelectedDate}
            currentStageProgress={stageProgressOnSelectedDate}
            totalStages={sortedStages.length || undefined}
          />
        </View>

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
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  resultFlag: {
    fontSize: 14,
    lineHeight: 18,
  },
  resultName: {
    flex: 1,
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  resultTeamInline: {
    color: '#8B93A1',
    fontSize: 12,
    fontWeight: '400',
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
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'right',
  },
  profileContainer: {
    flex: 1,
    gap: 8,
  },
  profileHScroll: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  profileHint: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: 10,
    textAlign: 'center',
  },
  startlistContainer: {
    flex: 1,
    gap: 10,
  },
  teamCard: {
    flex: 1,
    backgroundColor: '#171920',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#252833',
    overflow: 'hidden',
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
    alignItems: 'center',
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
  teamCounter: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
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
  teamTabStrip: {
    flexGrow: 0,
  },
  teamTabStripContent: {
    gap: 6,
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  teamTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#171920',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#252833',
    gap: 3,
    minWidth: 52,
  },
  levelBadge: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  levelBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  teamTabFlag: {
    fontSize: 14,
  },
  teamTabLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#555',
    letterSpacing: 0.5,
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
  riderDnfMuted: {
    opacity: 0.3,
  },
  riderDnfName: {
    flex: 1,
    color: '#6B7280',
    fontSize: 16,
    lineHeight: 22,
    textDecorationLine: 'line-through',
    textDecorationColor: '#6B7280',
  },
  dnfBadge: {
    backgroundColor: '#3D1A1A',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#7A2020',
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignSelf: 'center',
  },
  dnfBadgeText: {
    color: '#E57373',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

export default RaceDetailScreen;
