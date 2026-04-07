import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

// Self-contained param list for CalendarStack
type RaceDetailParams = { RaceDetail: { race: Race; selectedDate?: string; initialTab?: 'results' | 'classification' } };

interface RaceDetailScreenProps {
  navigation: NativeStackNavigationProp<RaceDetailParams, 'RaceDetail'>;
  route: RouteProp<RaceDetailParams, 'RaceDetail'>;
}

type DetailTab = 'profile' | 'classification' | 'results' | 'startlist';
type ClassificationTab = 'gc' | 'points' | 'kom' | 'youth' | 'teams';
type LeaderJerseyKey = Exclude<ClassificationTab, 'teams'>;

const CLASSIFICATION_TABS: { key: ClassificationTab; label: string }[] = [
  { key: 'gc', label: 'GC' },
  { key: 'points', label: 'Points' },
  { key: 'kom', label: 'KOM' },
  { key: 'youth', label: 'Youth' },
  { key: 'teams', label: 'Teams' },
];

const LEADER_JERSEY_META: Record<
  LeaderJerseyKey,
  { label: string; backgroundColor: string; borderColor: string; textColor: string }
> = {
  gc: {
    label: 'GC',
    backgroundColor: '#3A2D08',
    borderColor: '#9A7B16',
    textColor: '#FDE68A',
  },
  points: {
    label: 'PTS',
    backgroundColor: '#0D2619',
    borderColor: '#166534',
    textColor: '#86EFAC',
  },
  kom: {
    label: 'KOM',
    backgroundColor: '#301416',
    borderColor: '#B91C1C',
    textColor: '#FECACA',
  },
  youth: {
    label: 'YTH',
    backgroundColor: '#20232D',
    borderColor: '#6B7280',
    textColor: '#F4F4F5',
  },
};

const SCREEN_PADDING = 16;

const parseTimeToSeconds = (time: string): number | null => {
  const isNegative = time.trimStart().startsWith('-');
  const normalized = isNegative ? time.trimStart().slice(1) : time;
  const parts = normalized.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  let secs: number;
  if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
  else if (parts.length === 2) secs = parts[0] * 60 + parts[1];
  else return null;
  return isNegative ? -secs : secs;
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

const groupResultsByTime = (
  rows: RaceResult[],
): Array<{ timeSecs: number | null; items: RaceResult[] }> => {
  const groups: Array<{ timeSecs: number | null; items: RaceResult[] }> = [];
  for (const row of rows) {
    const timeSecs = row.time != null ? parseTimeToSeconds(row.time) : null;
    const last = groups[groups.length - 1];
    if (last && last.timeSecs === timeSecs && timeSecs !== null) {
      last.items.push(row);
    } else {
      groups.push({ timeSecs, items: [row] });
    }
  }
  return groups;
};

const SAME_TIME_MARKERS = new Set([',,', "''", '‘‘', '’’']);

const isSameTimeMarker = (time?: string | null): boolean =>
  SAME_TIME_MARKERS.has((time ?? '').trim());

const formatGapFromTimeValue = (time: string | undefined, leaderSeconds: number | null): string | null => {
  const normalizedTime = time?.trim();
  if (!normalizedTime || isSameTimeMarker(normalizedTime) || leaderSeconds === null) {
    return null;
  }

  const timeSeconds = parseTimeToSeconds(normalizedTime);
  if (timeSeconds === null) {
    return null;
  }

  return timeSeconds >= leaderSeconds
    ? formatGap(Math.max(0, timeSeconds - leaderSeconds))
    : formatGap(timeSeconds);
};

// Returns { text, isMalus } so callers can choose styling.
// Positive bonus = bonification (time reduction, green).
// Negative bonus = malus/time penalty (time addition, red).
const parseBonus = (bonus: string | undefined): { text: string; isMalus: boolean } | null => {
  if (!bonus) return null;
  const secs = parseTimeToSeconds(bonus);
  if (secs === null || secs === 0) return null;
  const isMalus = secs < 0;
  const absSecs = Math.abs(secs);
  return { text: isMalus ? `+${absSecs}"` : `−${absSecs}"`, isMalus };
};


const formatBonusSecs = (secs: number | undefined): string | null => {
  if (secs === undefined || secs === null || secs === 0) return null;
  const isMalus = secs < 0;
  const absSecs = Math.abs(secs);
  return isMalus ? `+${absSecs}"` : `−${absSecs}"`;
};

const findInferredGap = (
  finisherRows: RaceResult[],
  reclassifiedIndex: number,
  leaderSeconds: number,
): string | null => {
  for (const delta of [-1, 1, -2, 2, -3, 3]) {
    const j = reclassifiedIndex + delta;
    if (j < 0 || j >= finisherRows.length) continue;
    const neighbour = finisherRows[j];
    const secs = neighbour.time ? parseTimeToSeconds(neighbour.time) : null;
    if (secs === null || secs === leaderSeconds) continue;
    return formatGapFromTimeValue(neighbour.time, leaderSeconds);
  }
  return null;
};

const computeClassificationDeltaMap = (
  current: RaceResult[],
  previous: RaceResult[],
): Map<string, { rankChange: number; earnedPoints: number }> => {
  const prevRankByName = new Map(previous.map((r, i) => [r.riderName, i + 1]));
  const prevPtsByName = new Map(previous.map((r) => [r.riderName, Number(r.time) || 0]));
  const out = new Map<string, { rankChange: number; earnedPoints: number }>();
  current.forEach((r, i) => {
    const prevRank = prevRankByName.get(r.riderName);
    out.set(r.riderName, {
      rankChange: prevRank !== undefined ? prevRank - (i + 1) : 0,
      earnedPoints: (Number(r.time) || 0) - (prevPtsByName.get(r.riderName) ?? 0),
    });
  });
  return out;
};

const computeStageEarned = (
  current: RaceResult[],
  previous: RaceResult[],
  mode: 'points' | 'time'
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
      : (parseTimeToSeconds(a.time ?? '') ?? 0) - (parseTimeToSeconds(b.time ?? '') ?? 0)
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

const getResultIdentity = (item: Pick<RaceResult, 'pcsSlug' | 'riderName'>): string => {
  const slug = item.pcsSlug?.trim().toLowerCase();
  if (slug) {
    return `pcs:${slug}`;
  }

  return `name:${item.riderName.trim().toLowerCase()}`;
};

const LEVEL_BADGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  WT: { bg: '#0d2010', color: '#4ade80', border: '#1a4a25' },
  WWT: { bg: '#0d2010', color: '#4ade80', border: '#1a4a25' },
  PT: { bg: '#0d1020', color: '#818cf8', border: '#1e2455' },
  WPT: { bg: '#0d1020', color: '#818cf8', border: '#1e2455' },
  CT: { bg: '#1a1005', color: '#fb923c', border: '#3d2408' },
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

const LeaderJerseyIcon: React.FC<{ jerseyKey: LeaderJerseyKey }> = ({ jerseyKey }) => {
  const jerseyMeta = LEADER_JERSEY_META[jerseyKey];

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${jerseyMeta.label} leader jersey`}
      style={[
        styles.leaderJerseyBadge,
        {
          backgroundColor: jerseyMeta.backgroundColor,
          borderColor: jerseyMeta.borderColor,
        },
      ]}
    >
      <Ionicons name="shirt" size={10} color={jerseyMeta.textColor} />
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
  const { race, selectedDate: selectedDateParam, initialTab } = route.params;
  const isStageRace = race.startDate !== race.endDate;
  const [currentDate, setCurrentDate] = useState(selectedDateParam ?? dayjs().format('YYYY-MM-DD'));
  const [startlist, setStartlist] = useState<StartlistTeam[]>([]);
  const [results, setResults] = useState<RaceResult[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [gcStandingsByStage, setGcStandingsByStage] = useState<RaceGeneralStandingsByStage>({});
  const [stageResultsByStage, setStageResultsByStage] = useState<RaceStageResultsByStage>({});
  const [pointsStandingsByStage, setPointsStandingsByStage] = useState<RacePointsStandingsByStage>(
    {}
  );
  const [komStandingsByStage, setKomStandingsByStage] = useState<RaceKomStandingsByStage>({});
  const [youthStandingsByStage, setYouthStandingsByStage] = useState<RaceYouthStandingsByStage>({});
  const [teamsStandingsByStage, setTeamsStandingsByStage] = useState<RaceTeamsStandingsByStage>({});
  const [teamsStageResultsByStage, setTeamsStageResultsByStage] =
    useState<RaceTeamsStandingsByStage>({});
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileImgNaturalSize, setProfileImgNaturalSize] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const [profileContainerH, setProfileContainerH] = useState(0);
  const [profileExpanded, setProfileExpanded] = useState(false);

  // Stage tile swipe gesture
  const stagePanState = useRef({
    prevDate: null as string | null,
    nextDate: null as string | null,
  });
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
    })
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
    })
  ).current;
  // Screen-level swipe gesture for stage date navigation
  const screenSwipeRef = useRef({
    prevDate: null as string | null,
    nextDate: null as string | null,
    activeTab: 'profile' as DetailTab,
  });
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
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab ?? 'profile');
  const [activeClassificationTab, setActiveClassificationTab] = useState<ClassificationTab>('gc');
  const [activeResultsTab, setActiveResultsTab] = useState<ClassificationTab>('gc');
  const [activeGapLabel, setActiveGapLabel] = useState<string | null>(null);
  const [activeIsReclassified, setActiveIsReclassified] = useState(false);
  const [activeOriginalLabel, setActiveOriginalLabel] = useState<string | null>(null);
  const groupHeaderYs = useRef<Map<number, { y: number; label: string; isReclassified: boolean; originalLabel?: string }>>(new Map());
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const classificationListRef = useRef<FlatList<RaceResult>>(null);
  const resultsScrollRef = useRef<ScrollView>(null);
  const resultRowYsRef = useRef<Map<string, number>>(new Map());
  const categoryColor = getCategoryAccentColor(race.category, race.startDate === race.endDate);
  const sortedStages = [...stages].sort(compareStageOrder);
  const sortedUniqueDates = [...new Set(sortedStages.map((s) => s.date))].sort();
  const currentDateIndex = sortedUniqueDates.indexOf(currentDate);
  const prevStageDate = currentDateIndex > 0 ? sortedUniqueDates[currentDateIndex - 1] : null;
  const nextStageDate =
    currentDateIndex < sortedUniqueDates.length - 1
      ? sortedUniqueDates[currentDateIndex + 1]
      : null;
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
  const generalStandingRows = isStageRace && stageKey ? (gcStandingsByStage[stageKey] ?? []) : [];
  const pointsStandingRows =
    isStageRace && stageKey ? (pointsStandingsByStage[stageKey] ?? []) : [];
  const komStandingRows = isStageRace && stageKey ? (komStandingsByStage[stageKey] ?? []) : [];
  const youthStandingRows = isStageRace && stageKey ? (youthStandingsByStage[stageKey] ?? []) : [];
  const teamsStandingRows = isStageRace && stageKey ? (teamsStandingsByStage[stageKey] ?? []) : [];
  const currentLeaderJerseysByRider = new Map<string, LeaderJerseyKey[]>();
  if (isStageRace) {
    const leaderRowsByJersey: Record<LeaderJerseyKey, RaceResult[]> = {
      gc: generalStandingRows,
      points: pointsStandingRows,
      kom: komStandingRows,
      youth: youthStandingRows,
    };

    (Object.entries(leaderRowsByJersey) as Array<[LeaderJerseyKey, RaceResult[]]>).forEach(
      ([jerseyKey, rows]) => {
        const leader = rows[0];
        if (!leader) {
          return;
        }

        const riderKey = getResultIdentity(leader);
        const jerseys = currentLeaderJerseysByRider.get(riderKey) ?? [];
        jerseys.push(jerseyKey);
        currentLeaderJerseysByRider.set(riderKey, jerseys);
      }
    );
  }
  const classificationRowsByTab: Record<ClassificationTab, RaceResult[]> = {
    gc: generalStandingRows,
    points: pointsStandingRows,
    kom: komStandingRows,
    youth: youthStandingRows,
    teams: teamsStandingRows,
  };
  const activeClassificationRows = classificationRowsByTab[activeClassificationTab];
  const stageResultRows =
    isStageRace && stageKey !== null ? (stageResultsByStage[stageKey] ?? []) : [];
  const cumulativeBonusMap = new Map<string, number>();
  if (isStageRace && stageKey !== null) {
    const currentStageNum = Number(stageKey);
    for (let s = 1; s <= currentStageNum; s++) {
      for (const r of stageResultsByStage[String(s)] ?? []) {
        if (r.bonus) {
          const secs = parseTimeToSeconds(r.bonus);
          if (secs !== null && secs !== 0) {
            cumulativeBonusMap.set(r.riderName, (cumulativeBonusMap.get(r.riderName) ?? 0) + secs);
          }
        }
      }
    }
  }
  const prevStageKey = stageKey !== null ? String(Number(stageKey) - 1) : null;
  const gcDeltaMap = computeClassificationDeltaMap(
    generalStandingRows,
    prevStageKey ? (gcStandingsByStage[prevStageKey] ?? []) : [],
  );
  const pointsDeltaMap = computeClassificationDeltaMap(
    pointsStandingRows,
    prevStageKey ? (pointsStandingsByStage[prevStageKey] ?? []) : [],
  );
  const komDeltaMap = computeClassificationDeltaMap(
    komStandingRows,
    prevStageKey ? (komStandingsByStage[prevStageKey] ?? []) : [],
  );
  const youthDeltaMap = computeClassificationDeltaMap(
    youthStandingRows,
    prevStageKey ? (youthStandingsByStage[prevStageKey] ?? []) : [],
  );
  const teamsDeltaMap = computeClassificationDeltaMap(
    teamsStandingRows,
    prevStageKey ? (teamsStandingsByStage[prevStageKey] ?? []) : [],
  );

  // Build a map of lowercase rider name → { stageNum, status } for their first non-finish.
  // PCS stage results include explicit DNS/DNF/OTL/DSQ rows; we use those when available.
  // For TTT stages, procyclingstats only returns riders who actually raced (_ttt_results never
  // returns DNS rows), so absence from a TTT is always inferred as DNS (individual mid-TTT DNF
  // doesn't happen in practice). For all other stages, absence falls back to DNF.
  // Names are compared lowercase to handle the case difference between startlist ("AYUSO Juan")
  // and results ("Ayuso Juan").
  const NON_FINISH_STATUSES = new Set(['DNF', 'DNS', 'OTL', 'DSQ']);
  const currentStageNum = stageNumberOnSelectedDate ?? Infinity;
  const stageTypeByNum = new Map(stages.map((s) => [s.stageNumber, s.stageType]));
  const dnfRiderMap = new Map<string, { stageNum: number; status: string }>(); // lowercase riderName → {stageNum, status}
  if (isStageRace && startlist.length > 0) {
    // Build per-stage maps: riderNameLower → status ('DF' for finishers, 'DNF'/'DNS'/etc. for non-finishers)
    const stageRiderStatus = new Map<number, Map<string, string>>();
    for (const [sk, rows] of Object.entries(stageResultsByStage)) {
      const stageNum = Number(sk);
      const riderStatusMap = new Map<string, string>();
      for (const r of rows) {
        riderStatusMap.set(r.riderName.toLowerCase(), r.status ?? 'DF');
      }
      stageRiderStatus.set(stageNum, riderStatusMap);
    }
    const completedStages = [...stageRiderStatus.keys()]
      .sort((a, b) => a - b)
      .filter((n) => n <= currentStageNum);
    for (const team of startlist) {
      for (const rider of team.riders) {
        const nameLower = rider.name.toLowerCase();
        for (const stageNum of completedStages) {
          const riderStatus = stageRiderStatus.get(stageNum)!.get(nameLower);
          if (riderStatus === undefined || NON_FINISH_STATUSES.has(riderStatus)) {
            // Absent or explicitly marked as non-finisher.
            // For TTT stages, absence always means DNS (procyclingstats never returns DNS rows for TTTs).
            const isTTT = stageTypeByNum.get(stageNum) === 'ttt';
            const resolvedStatus = riderStatus ?? (isTTT ? 'DNS' : 'DNF');
            dnfRiderMap.set(nameLower, { stageNum, status: resolvedStatus });
            break;
          }
        }
      }
    }
  }
  const youthRiderNames = new Set(
    (isStageRace && stageKey ? (youthStandingsByStage[stageKey] ?? []) : []).map((r) => r.riderName)
  );
  const gcRows = isStageRace ? stageResultRows : results;
  const resultRowsByTab: Record<ClassificationTab, RaceResult[]> = {
    gc: gcRows,
    points: computeStageEarned(
      isStageRace && stageKey ? (pointsStandingsByStage[stageKey] ?? []) : [],
      prevStageKey ? (pointsStandingsByStage[prevStageKey] ?? []) : [],
      'points'
    ),
    kom: computeStageEarned(
      isStageRace && stageKey ? (komStandingsByStage[stageKey] ?? []) : [],
      prevStageKey ? (komStandingsByStage[prevStageKey] ?? []) : [],
      'points'
    ),
    youth: gcRows
      .filter((r) => youthRiderNames.has(r.riderName))
      .map((r, i) => ({ ...r, rankLabel: String(i + 1) })),
    teams: isStageRace && stageKey ? (teamsStageResultsByStage[stageKey] ?? []) : [],
  };
  const activeResultRows = resultRowsByTab[activeResultsTab];
  const resolveRepeatedGapDisplay = (
    rows: RaceResult[],
    index: number,
    leaderSeconds: number | null,
    hideNonFinisherTrailingLabel: boolean
  ): string | null => {
    for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
      const previousItem = rows[previousIndex];
      const previousStatusLabel = previousItem.status?.trim() ?? '';
      const previousIsNonFinisherRow =
        hideNonFinisherTrailingLabel &&
        (NON_FINISH_STATUSES.has(previousStatusLabel) ||
          NON_FINISH_STATUSES.has(previousItem.rankLabel));
      if (previousIsNonFinisherRow) {
        continue;
      }

      const previousGap = formatGapFromTimeValue(previousItem.time, leaderSeconds);
      if (previousGap) {
        return previousGap;
      }
    }

    return leaderSeconds !== null ? formatGap(0) : null;
  };
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

  useEffect(() => {
    setActiveGapLabel(null);
    setActiveIsReclassified(false);
    setActiveOriginalLabel(null);
    groupHeaderYs.current.clear();
  }, [activeResultsTab, currentDate]);

  useEffect(() => {
    resultRowYsRef.current.clear();
  }, [activeResultsTab, currentDate]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKbHeight(Math.max(0, e.endCoordinates.height - insets.bottom));
    });
    const onHide = Keyboard.addListener(hideEvent, () => setKbHeight(0));
    return () => { onShow.remove(); onHide.remove(); };
  }, [insets.bottom]);

  useEffect(() => {
    if (!selectedAthlete) return;
    const timer = setTimeout(() => scrollToSelectedAthlete(selectedAthlete), 100);
    return () => clearTimeout(timer);
  }, [activeTab, activeClassificationTab, activeResultsTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToSelectedAthlete = (name: string) => {
    if (activeTab === 'classification') {
      const idx = activeClassificationRows.findIndex((r) => r.riderName === name);
      if (idx >= 0) {
        classificationListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
      }
    } else if (activeTab === 'results') {
      const y = resultRowYsRef.current.get(name);
      if (y !== undefined) {
        resultsScrollRef.current?.scrollTo({ y, animated: true });
      }
    }
  };

  const selectAthlete = (name: string) => {
    setSelectedAthlete(name);
    setSearchQuery(name);
    setShowAutocomplete(false);
    Keyboard.dismiss();
    setTimeout(() => scrollToSelectedAthlete(name), 350);
  };

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
      ] = await Promise.all([
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
        isStageRace ? fetchYouthStandings(race.id) : Promise.resolve<RaceYouthStandingsByStage>({}),
        isStageRace ? fetchTeamsStandings(race.id) : Promise.resolve<RaceTeamsStandingsByStage>({}),
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
      if (!initialTab) setActiveTab(raceHasResults ? 'results' : 'profile');
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
      if (!initialTab) setActiveTab('profile');
      setError('Failed to load race details');
    } finally {
      setLoading(false);
    }
  };

  const renderClassificationRow = (
    item: RaceResult,
    index: number,
    totalRows: number,
    rows: RaceResult[],
    leaderSeconds: number | null = null,
    showLeaderGap = false,
    hideNonFinisherTrailingLabel = false,
    rankChange?: number,
    earnedPoints?: number,
    bonusSecs?: number,
  ) => {
    const riderFlag = getCountryFlag(item.nationality);
    const rankLabel = item.rankLabel;
    const statusLabel = item.status?.trim() ?? '';
    const isNonFinisherRow =
      hideNonFinisherTrailingLabel &&
      (NON_FINISH_STATUSES.has(statusLabel) || NON_FINISH_STATUSES.has(rankLabel));
    const leaderJerseyKeys = isStageRace
      ? (currentLeaderJerseysByRider.get(getResultIdentity(item)) ?? [])
      : [];
    const trailingLabel = isNonFinisherRow ? null : item.time || item.status;
    const gap =
      !isNonFinisherRow && item.time && (index > 0 || showLeaderGap)
        ? isSameTimeMarker(item.time)
          ? resolveRepeatedGapDisplay(rows, index, leaderSeconds, hideNonFinisherTrailingLabel)
          : formatGapFromTimeValue(item.time, leaderSeconds)
        : null;

    // Rank 1 keeps its source value. Later rows prefer a resolved gap, whether PCS
    // provides an absolute time, an explicit gap, or a same-as-previous marker.
    const isSameTime = index > 0 && gap === formatGap(0);
    const resolvedGap = isSameTime ? 's.t.' : gap;
    const displayTime = isNonFinisherRow
      ? null
      : index === 0 && !showLeaderGap
        ? trailingLabel
        : (resolvedGap ?? trailingLabel);
    const isGap = index > 0 && resolvedGap !== null;

    const isSelected = selectedAthlete !== null && item.riderName === selectedAthlete;

    return (
      <View
        style={[
          styles.resultRow,
          index === 0 ? styles.resultRowFirst : null,
          index === totalRows - 1 ? styles.resultRowLast : null,
          isSelected ? styles.resultRowHighlighted : null,
        ]}
      >
        <View
          style={[
            styles.resultRankBadge,
            index === 0 ? styles.resultRankBadgeLeader : null,
            index > 0 && index < 3 ? styles.resultRankBadgePodium : null,
            isNonFinisherRow ? styles.resultRankBadgeStatus : null,
          ]}
        >
          <Text
            style={[
              styles.resultRankText,
              index === 0 ? styles.resultRankTextLeader : null,
              index > 0 && index < 3 ? styles.resultRankTextPodium : null,
              isNonFinisherRow ? styles.resultRankTextStatus : null,
            ]}
          >
            {rankLabel}
          </Text>
          {rankChange !== undefined && rankChange !== 0 ? (
            <Text style={rankChange > 0 ? styles.rankChangeUp : styles.rankChangeDown}>
              {rankChange > 0 ? `▲${rankChange}` : `▼${Math.abs(rankChange)}`}
            </Text>
          ) : null}
        </View>

        {riderFlag ? <Text style={styles.resultFlag}>{riderFlag}</Text> : null}

        <View style={styles.resultIdentity}>
          <View style={styles.resultPrimaryLine}>
            <Text style={styles.resultName} numberOfLines={1}>
              {item.riderName}
              {item.teamName ? <Text style={styles.resultTeamInline}> · {item.teamName}</Text> : null}
            </Text>

            {leaderJerseyKeys.length > 0 ? (
              <View style={styles.leaderJerseyInline}>
                {leaderJerseyKeys.map((jerseyKey) => (
                  <LeaderJerseyIcon key={`${item.riderName}-${jerseyKey}`} jerseyKey={jerseyKey} />
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {displayTime || bonusSecs ? (
          <View style={styles.resultTimeColumn}>
            {displayTime ? (
              <Text
                style={[
                  isGap ? styles.resultGap : styles.resultTime,
                  isSameTime ? styles.resultSameTime : null,
                ]}
                numberOfLines={1}
              >
                {displayTime}
              </Text>
            ) : null}
            {earnedPoints !== undefined && earnedPoints > 0 ? (
              <Text style={styles.earnedPointsText}>+{earnedPoints} pts</Text>
            ) : null}
            {bonusSecs ? (
              <View style={styles.bonusBadgeNeutral}>
                <Text style={styles.bonusBadgeTextNeutral}>{formatBonusSecs(bonusSecs)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const profileImageUrl = isStageRace ? stageOnSelectedDate?.profileImageUrl : race.profileImageUrl;

  useEffect(() => {
    setProfileImgNaturalSize(null);
    setProfileExpanded(false);
    if (!profileImageUrl) return;
    Image.getSize(
      profileImageUrl,
      (w, h) => {
        if (w > 0 && h > 0) setProfileImgNaturalSize({ w, h });
      },
      () => {}
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
    const ratio =
      profileImgNaturalSize != null ? profileImgNaturalSize.w / profileImgNaturalSize.h : null;

    const HINT_H = 20;
    const maxH =
      profileContainerH > HINT_H
        ? profileContainerH - HINT_H
        : Math.round(Dimensions.get('window').height * 0.45);

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
      <TouchableOpacity onPress={() => setProfileExpanded((v) => !v)} activeOpacity={0.9}>
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

    const DNS_DNF_LABELS = new Set(['DNS', 'DNF', 'OTL', 'DSQ', 'AB', 'NQ']);
    const isNonFinisher = (r: RaceResult) =>
      DNS_DNF_LABELS.has((r.rankLabel ?? '').toUpperCase()) ||
      DNS_DNF_LABELS.has((r.status ?? '').toUpperCase());

    const finisherRows = activeResultRows.filter((r) => !isNonFinisher(r));
    const dnsDnfRows = activeResultRows.filter(isNonFinisher);

    // No finishers means the race/stage hasn't completed yet — treat as unavailable.
    if (finisherRows.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="ribbon-outline" size={40} color="#555555" />
          <Text style={styles.emptyText}>
            {isStageRace ? `${activeResultsLabel} results not available yet` : 'Results not available yet'}
          </Text>
        </View>
      );
    }

    // Bonifications affect GC cumulative time, not stage finishing time — suppress the
    // corrected-gap display for stage result views (Results > GC and Results > Youth).
    const isStageResultView = isStageRace && (activeResultsTab === 'gc' || activeResultsTab === 'youth');

    const leaderSeconds = finisherRows[0]?.time
      ? parseTimeToSeconds(finisherRows[0].time)
      : null;

    const groups = groupResultsByTime(finisherRows);

    const interGroupGaps = groups.map((g, i) =>
      i === 0 ? 0 : (g.timeSecs ?? 0) - (groups[i - 1].timeSecs ?? 0),
    );
    const maxGap = Math.max(...interGroupGaps.slice(1), 1);
    const calcMargin = (gapSecs: number) =>
      6 + Math.round((gapSecs / maxGap) * 30);

    const checkerCols = 10;
    const checkerSize = 6;
    const renderChecker = (startLight: boolean) => (
      <View
        style={{
          width: checkerCols * checkerSize,
          height: 2 * checkerSize,
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 1,
          flexShrink: 0,
        }}
      >
        {[0, 1].map((row) => (
          <View key={row} style={{ flexDirection: 'row' }}>
            {Array.from({ length: checkerCols }).map((_, col) => {
              const isLight = (col + row) % 2 === (startLight ? 0 : 1);
              return (
                <View
                  key={col}
                  style={{
                    width: checkerSize,
                    height: checkerSize,
                    backgroundColor: isLight ? '#9CA3AF' : '#252833',
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    );

    const showPointsValue = activeResultsTab === 'points' || activeResultsTab === 'kom';

    const items: React.ReactNode[] = [];
    let globalIndex = 0;
    let finisherRowOffset = 0;
    let leaderTimeLabel: string | null = null;

    const renderResultRow = (item: RaceResult, idx: number, isFirst: boolean, isLast: boolean) => {
      const riderFlag = getCountryFlag(item.nationality);
      const isSelected = selectedAthlete !== null && item.riderName === selectedAthlete;
      return (
        <View
          key={`${item.rankLabel}-${item.riderName}-${idx}`}
          style={[
            styles.resultRow,
            isFirst ? styles.resultRowFirst : null,
            isLast ? styles.resultRowLast : null,
            !isFirst && !isLast ? styles.resultRowMid : null,
            isSelected ? styles.resultRowHighlighted : null,
          ]}
          onLayout={(e) => {
            resultRowYsRef.current.set(item.riderName, e.nativeEvent.layout.y);
          }}
        >
          <View style={styles.resultRankBadge}>
            <Text style={styles.resultRankText}>{item.rankLabel}</Text>
          </View>

          {riderFlag ? (
            <Text style={styles.resultFlag}>{riderFlag}</Text>
          ) : null}

          <Text style={styles.resultName} numberOfLines={1}>
            {item.riderName}
            {item.teamName ? (
              <Text style={styles.resultTeamInline}> · {item.teamName}</Text>
            ) : null}
          </Text>

          {!showPointsValue && item.bonus ? (() => {
            const parsed = parseBonus(item.bonus);
            if (!parsed) return null;
            return (
              <View style={parsed.isMalus ? styles.malusBadge : styles.bonusBadge}>
                <Text style={parsed.isMalus ? styles.malusBadgeText : styles.bonusBadgeText}>{parsed.text}</Text>
              </View>
            );
          })() : null}
          {showPointsValue && item.time ? (
            <Text style={styles.resultTime} numberOfLines={1}>+{item.time}</Text>
          ) : null}
        </View>
      );
    };

    if (showPointsValue) {
      return (
        <View style={styles.resultsList}>
          <ScrollView
            ref={resultsScrollRef}
            contentContainerStyle={styles.resultsListContent}
            showsVerticalScrollIndicator={false}
          >
            {finisherRows.map((item, i) =>
              renderResultRow(item, i, i === 0, i === finisherRows.length - 1)
            )}
          </ScrollView>
        </View>
      );
    }

    const timeLimitGap = stageOnSelectedDate?.timeLimitGap ?? (!isStageRace ? race.timeLimitGap : undefined);
    const timeLimitSecs = timeLimitGap ? parseTimeToSeconds(timeLimitGap) : null;
    const timeLimitLabel = timeLimitSecs !== null ? formatGap(timeLimitSecs) : null;
    const cutoffSeconds =
      leaderSeconds !== null && timeLimitSecs !== null ? leaderSeconds + timeLimitSecs : null;
    let timeLimitInserted = false;

    const renderTimeLimitSeparator = () => {
      items.push(
        <View key="otl-separator" style={{ backgroundColor: '#0A0A0C', marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}>
            {renderChecker(true)}
            <View style={{ flex: 1, height: 1, backgroundColor: '#2A2D3A', marginHorizontal: 8 }} />
            <View style={[styles.groupTimePill, { backgroundColor: '#2D1600', borderColor: '#92400E' }]}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#F59E0B', letterSpacing: 1 }}>TIME LIMIT</Text>
            </View>
            {timeLimitLabel ? (
              <>
                <Text style={{ color: '#92400E', marginHorizontal: 6, fontSize: 12 }}>·</Text>
                <View style={[styles.groupTimePill, { backgroundColor: '#2D1600', borderColor: '#92400E' }]}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#F59E0B' }}>{timeLimitLabel}</Text>
                </View>
              </>
            ) : null}
            <View style={{ flex: 1, height: 1, backgroundColor: '#2A2D3A', marginHorizontal: 8 }} />
            {renderChecker(false)}
          </View>
        </View>
      );
      timeLimitInserted = true;
    };

    groups.forEach((group, groupIdx) => {
      const startIndex = globalIndex;
      const groupStartInFinishers = finisherRowOffset;
      globalIndex += group.items.length;
      finisherRowOffset += group.items.length;

      // Insert the TIME LIMIT separator before the first group that exceeds the cutoff.
      // This handles riders kept in the race by organizers despite finishing after the limit.
      const insertedNow =
        !timeLimitInserted &&
        isStageResultView &&
        cutoffSeconds !== null &&
        group.timeSecs !== null &&
        group.timeSecs > cutoffSeconds;
      if (insertedNow) {
        renderTimeLimitSeparator();
      }

      // Skip the spacer for the group immediately after the separator — marginTop: 20
      // on the separator already provides enough breathing room.
      const mt = groupIdx === 0 ? 0 : calcMargin(interGroupGaps[groupIdx]);
      if (mt > 0 && !insertedNow) {
        items.push(<View key={`spacer-${groupIdx}`} style={{ height: mt }} />);
      }

      const isReclassified =
        groupIdx > 0 &&
        leaderSeconds !== null &&
        group.timeSecs === leaderSeconds;

      const timeLabel = (() => {
        if (!group.items[0]?.time) return null;
        if (leaderSeconds === null) return group.items[0].time;
        const secs = parseTimeToSeconds(group.items[0].time);
        if (secs === null) return null;
        return secs === leaderSeconds
          ? group.items[0].time
          : formatGap(Math.max(0, secs - leaderSeconds));
      })();

      // Bonus seconds from the first rider in the group (sprint/intermediate bonifications).
      const bonusSecs = (() => {
        const b = group.items[0]?.bonus;
        return b ? (parseTimeToSeconds(b) ?? 0) : 0;
      })();

      // For reclassified: prefer bonus-derived original gap over neighbour inference.
      const inferredGap = isReclassified
        ? (bonusSecs > 0 ? formatGap(bonusSecs) : findInferredGap(finisherRows, groupStartInFinishers, leaderSeconds!))
        : null;

      // Corrected-time case: rider has a bonus but their corrected time ≠ leader.
      // Show the corrected gap (red) alongside the original gap (strikethrough).
      const hasBonusCorrection = !isReclassified && !isStageResultView && bonusSecs !== 0 && leaderSeconds !== null && group.timeSecs !== null;
      const originalGapLabel = hasBonusCorrection
        ? formatGap((group.timeSecs! - leaderSeconds!) + bonusSecs)
        : null;

      if (timeLabel) {
        if (groupIdx === 0 && leaderSeconds !== null) {
          leaderTimeLabel = timeLabel;
        } else {
          items.push(
            <View
              key={`header-${groupIdx}`}
              onLayout={(e) => {
                groupHeaderYs.current.set(groupIdx, {
                  y: e.nativeEvent.layout.y,
                  label: hasBonusCorrection ? timeLabel : (inferredGap ?? timeLabel),
                  isReclassified,
                  originalLabel: originalGapLabel ?? undefined,
                });
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 4, paddingBottom: 4 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: '#2A2D3A', marginHorizontal: 8 }} />
                {isReclassified && inferredGap ? (
                  <View style={[styles.groupTimePill, styles.groupTimePillLeader]}>
                    <Text style={styles.groupTimeTextStrikethrough}>{inferredGap}</Text>
                  </View>
                ) : hasBonusCorrection && originalGapLabel ? (
                  <>
                    <View style={[styles.groupTimePill, styles.groupTimePillGap]}>
                      <Text style={styles.groupTimeTextGap}>{timeLabel}</Text>
                    </View>
                    <Text style={{ color: '#3A3F52', marginHorizontal: 6, fontSize: 12 }}>·</Text>
                    <View style={styles.groupTimePill}>
                      <Text style={styles.groupTimeTextStrikethrough}>{originalGapLabel}</Text>
                    </View>
                  </>
                ) : (
                  <View style={[styles.groupTimePill, styles.groupTimePillGap]}>
                    <Text style={styles.groupTimeTextGap}>{timeLabel}</Text>
                  </View>
                )}
                <View style={{ flex: 1, height: 1, backgroundColor: '#2A2D3A', marginHorizontal: 8 }} />
              </View>
            </View>
          );
        }
      }

      group.items.forEach((item, i) => {
        const idx = startIndex + i;
        items.push(renderResultRow(item, idx, i === 0, i === group.items.length - 1));
      });
    });

    const otlRows = dnsDnfRows.filter((r) => (r.rankLabel ?? '').toUpperCase() === 'OTL');
    const dnfRows = dnsDnfRows.filter((r) => (r.rankLabel ?? '').toUpperCase() === 'DNF');
    const dnsRows = dnsDnfRows.filter((r) => (r.rankLabel ?? '').toUpperCase() === 'DNS');
    const dsqRows = dnsDnfRows.filter((r) => (r.rankLabel ?? '').toUpperCase() === 'DSQ');
    const otherRows = dnsDnfRows.filter(
      (r) => !['OTL', 'DNF', 'DNS', 'DSQ'].includes((r.rankLabel ?? '').toUpperCase()),
    );

    // If no finisher group exceeded the cutoff (everyone within limit, or no cutoff data),
    // fall back to rendering the separator at the bottom — before OTL rows when present,
    // or as a reference line in GC/Youth when gap data is available.
    if (!timeLimitInserted && (otlRows.length > 0 || (isStageResultView && timeLimitLabel !== null) || (!isStageRace && timeLimitLabel !== null))) {
      renderTimeLimitSeparator();
    }
    if (otlRows.length > 0) {
      const otlGroups = groupResultsByTime(otlRows);
      let otlOffset = globalIndex;
      otlGroups.forEach((group, groupIdx) => {
        const otlTimeLabel = group.items[0]?.time && leaderSeconds !== null
          ? formatGap(Math.max(0, (group.timeSecs ?? 0) - leaderSeconds))
          : null;
        if (otlTimeLabel && groupIdx > 0) {
          const prevGroupSecs = otlGroups[groupIdx - 1].timeSecs ?? 0;
          const gap = (group.timeSecs ?? 0) - prevGroupSecs;
          const mt = gap > 0 ? Math.min(6 + Math.round((gap / maxGap) * 30), 36) : 0;
          if (mt > 0) {
            items.push(<View key={`otl-spacer-${groupIdx}`} style={{ height: mt }} />);
          }
        }
        if (otlTimeLabel) {
          items.push(
            <View key={`otl-header-${groupIdx}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 4, paddingBottom: 4 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: '#2A2D3A', marginHorizontal: 8 }} />
                <View style={[styles.groupTimePill, styles.otlTimePillGap]}>
                  <Text style={styles.otlTimeTextGap}>{otlTimeLabel}</Text>
                </View>
                <View style={{ flex: 1, height: 1, backgroundColor: '#2A2D3A', marginHorizontal: 8 }} />
              </View>
            </View>
          );
        }
        group.items.forEach((item, i) => {
          items.push(renderResultRow(item, otlOffset, i === 0, i === group.items.length - 1));
          otlOffset += 1;
        });
      });
      globalIndex = otlOffset;
    }

    let offset = globalIndex;
    const renderNonFinisherGroup = (
      rows: RaceResult[],
      label: string,
      key: string,
      pillStyle: object,
      textStyle: object,
    ) => {
      if (rows.length === 0) return;
      items.push(
        <View key={`${key}-separator`} style={{ marginTop: 20, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#2E3140', marginHorizontal: 8 }} />
            <View style={[styles.groupTimePill, pillStyle]}>
              <Text style={[{ fontSize: 11, fontWeight: '600', letterSpacing: 1 }, textStyle]}>{label}</Text>
            </View>
            <View style={{ flex: 1, height: 1, backgroundColor: '#2E3140', marginHorizontal: 8 }} />
          </View>
        </View>
      );
      rows.forEach((item, i) => {
        items.push(renderResultRow(item, offset + i, i === 0, i === rows.length - 1));
      });
      offset += rows.length;
    };

    renderNonFinisherGroup(dsqRows, 'DISQUALIFIED', 'dsq', { backgroundColor: '#13141A', borderColor: '#2E3140' }, { color: '#6B7280' });
    renderNonFinisherGroup(dnfRows, 'DID NOT FINISH', 'dnf', { backgroundColor: '#13141A', borderColor: '#2E3140' }, { color: '#6B7280' });
    renderNonFinisherGroup(dnsRows, 'DID NOT START', 'dns', { backgroundColor: '#13141A', borderColor: '#2E3140' }, { color: '#6B7280' });
    renderNonFinisherGroup(otherRows, 'OTHER', 'other', { backgroundColor: '#13141A', borderColor: '#2E3140' }, { color: '#6B7280' });

    return (
      <View style={styles.resultsList}>
        {leaderTimeLabel ? (
          <View style={{ backgroundColor: '#0A0A0C' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 6, paddingBottom: 6 }}>
              {renderChecker(true)}
              <View style={{ flex: 1, height: 1, backgroundColor: '#2A2D3A', marginHorizontal: 8 }} />
              <View style={[styles.groupTimePill, (!activeGapLabel || activeIsReclassified) ? styles.groupTimePillLeader : null]}>
                <Text style={[styles.groupTimeText, (!activeGapLabel || activeIsReclassified) ? styles.groupTimeTextLeader : null]}>
                  {leaderTimeLabel}
                </Text>
              </View>
              {activeGapLabel ? (
                <>
                  <Text style={{ color: '#3A3F52', marginHorizontal: 6, fontSize: 12 }}>·</Text>
                  <View style={[styles.groupTimePill, activeIsReclassified ? null : styles.groupTimePillGap]}>
                    <Text style={activeIsReclassified ? styles.groupTimeTextStrikethrough : styles.groupTimeTextGap}>
                      {activeGapLabel}
                    </Text>
                  </View>
                  {activeOriginalLabel ? (
                    <>
                      <Text style={{ color: '#3A3F52', marginHorizontal: 6, fontSize: 12 }}>·</Text>
                      <View style={styles.groupTimePill}>
                        <Text style={styles.groupTimeTextStrikethrough}>{activeOriginalLabel}</Text>
                      </View>
                    </>
                  ) : null}
                </>
              ) : null}
              <View style={{ flex: 1, height: 1, backgroundColor: '#2A2D3A', marginHorizontal: 8 }} />
              {renderChecker(false)}
            </View>
          </View>
        ) : null}
        <ScrollView
          ref={resultsScrollRef}
          contentContainerStyle={styles.resultsListContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => {
            const scrollY = e.nativeEvent.contentOffset.y;
            const entries = [...groupHeaderYs.current.values()].sort((a, b) => a.y - b.y);
            const active = entries.filter((entry) => entry.y <= scrollY).pop();
            setActiveGapLabel(active?.label ?? null);
            setActiveIsReclassified(active?.isReclassified ?? false);
            setActiveOriginalLabel(active?.originalLabel ?? null);
          }}
        >
          {items}
        </ScrollView>
      </View>
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
    const deltaMaps: Partial<Record<ClassificationTab, Map<string, { rankChange: number; earnedPoints: number }>>> = {
      gc: gcDeltaMap,
      points: pointsDeltaMap,
      kom: komDeltaMap,
      youth: youthDeltaMap,
      teams: teamsDeltaMap,
    };
    const deltaMap = deltaMaps[activeClassificationTab] ?? null;
    const showEarnedPoints = activeClassificationTab === 'points' || activeClassificationTab === 'kom';
    const showBonus = activeClassificationTab === 'gc' || activeClassificationTab === 'youth';
    const delta = deltaMap?.get(item.riderName);
    return renderClassificationRow(
      item,
      index,
      activeClassificationRows.length,
      activeClassificationRows,
      leaderSeconds,
      false,
      false,
      delta?.rankChange,
      showEarnedPoints ? delta?.earnedPoints : undefined,
      showBonus ? cumulativeBonusMap.get(item.riderName) : undefined,
    );
  };

  const activeClassificationLabel =
    CLASSIFICATION_TABS.find((tab) => tab.key === activeClassificationTab)?.label ??
    'Classification';

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
          stageOnSelectedDate.stageNumber === 1
            ? 'GC will appear after stage 1'
            : 'GC not available yet';
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
        ref={classificationListRef}
        data={activeClassificationRows}
        keyExtractor={(item, index) => `${item.rankLabel}-${item.riderName}-${index}`}
        renderItem={renderClassificationStandingRow}
        style={styles.resultsList}
        contentContainerStyle={styles.resultsListContent}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={(info) => {
          classificationListRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          });
        }}
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
      <View style={styles.startlistContainer}>
        <View style={styles.teamCard} {...panResponder.panHandlers}>
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
                const dnfEntry = dnfRiderMap.get(rider.name.toLowerCase());
                const isDnf = dnfEntry !== undefined;
                const riderBibLabel = rider.bibNumber?.toString() ?? '-';
                return (
                  <View
                    key={`${currentTeam.teamName}-${rider.name}-${riderIndex}`}
                    style={styles.riderRow}
                  >
                    <Text
                      style={[styles.riderIndex, isDnf && styles.riderDnfMuted]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {riderBibLabel}
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
                          <Text style={styles.dnfBadgeText}>
                            {dnfEntry!.status} S{dnfEntry!.stageNum}
                          </Text>
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
                  <Text style={[styles.teamTabLabel, isActive ? { color: '#fff' } : null]}>
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
                style={[styles.tabButton, activeTab === tab ? styles.tabButtonActive : null]}
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

        {activeTab === 'classification' || (activeTab === 'results' && isStageRace) ? (
          <View style={styles.classificationSubtabsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.classificationSubtabs}
            >
              {CLASSIFICATION_TABS.map((tab) => {
                const isActive =
                  activeTab === 'classification'
                    ? activeClassificationTab === tab.key
                    : activeResultsTab === tab.key;
                const onPress =
                  activeTab === 'classification'
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
          ) : activeTab === 'profile' ? (
            renderProfile()
          ) : activeTab === 'classification' ? (
            renderClassificationStandings()
          ) : activeTab === 'results' ? (
            renderResults()
          ) : (
            renderStartlist()
          )}
        </View>

        {((activeTab === 'classification' && activeClassificationTab !== 'teams') ||
          (activeTab === 'results' && activeResultsTab !== 'teams')) ? (
          <>
            {showAutocomplete && searchQuery.length > 0 ? (
              <View style={styles.autocompleteList}>
                <FlatList
                  data={(activeTab === 'classification' ? activeClassificationRows : activeResultRows).filter(
                    (r) => r.riderName.toLowerCase().includes(searchQuery.toLowerCase())
                  )}
                  keyExtractor={(item, index) => `${item.rankLabel}-${item.riderName}-${index}`}
                  keyboardShouldPersistTaps="always"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.autocompleteRow,
                        item.riderName === selectedAthlete ? styles.autocompleteRowSelected : null,
                      ]}
                      onPress={() => selectAthlete(item.riderName)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.autocompleteRank}>{item.rankLabel}</Text>
                      <Text style={styles.autocompleteRiderName} numberOfLines={1}>{item.riderName}</Text>
                      {item.riderName === selectedAthlete ? (
                        <Ionicons name="checkmark" size={15} color="#4CAF50" />
                      ) : null}
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.autocompleteContent}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            ) : null}
            {selectedAthlete && !showAutocomplete ? (
              <TouchableOpacity
                style={[styles.searchBar, { marginBottom: kbHeight }]}
                onPress={() => { setSearchQuery(''); setShowAutocomplete(true); }}
                activeOpacity={0.7}
              >
                <Ionicons name="person-outline" size={15} color="#4CAF50" />
                <Text style={styles.searchSelectedName} numberOfLines={1}>{selectedAthlete}</Text>
                <TouchableOpacity
                  onPress={() => { setSelectedAthlete(null); setSearchQuery(''); }}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={16} color="#8B93A1" />
                </TouchableOpacity>
              </TouchableOpacity>
            ) : (
              <View style={[styles.searchBar, { marginBottom: kbHeight }]}>
                <Ionicons name="search-outline" size={15} color="#8B93A1" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Find athlete..."
                  placeholderTextColor="#4A5568"
                  value={searchQuery}
                  onChangeText={(text) => { setSearchQuery(text); setShowAutocomplete(true); }}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                {searchQuery ? (
                  <TouchableOpacity
                    onPress={() => { setSearchQuery(''); setShowAutocomplete(false); }}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={16} color="#8B93A1" />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </>
        ) : null}
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
    gap: 6,
    paddingHorizontal: 12,
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
  resultRowMid: {
    borderBottomWidth: 0,
  },
  resultRowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  resultRowHighlighted: {
    backgroundColor: '#0D2A10',
    borderLeftColor: '#4CAF50',
    borderLeftWidth: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#12141A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252833',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    color: '#F3F4F6',
    fontSize: 14,
    padding: 0,
  },
  searchSelectedName: {
    flex: 1,
    color: '#F3F4F6',
    fontSize: 14,
  },
  autocompleteList: {
    backgroundColor: '#12141A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252833',
    maxHeight: 240,
    marginTop: 10,
    overflow: 'hidden',
  },
  autocompleteContent: {
    paddingVertical: 4,
  },
  autocompleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1D2030',
  },
  autocompleteRowSelected: {
    backgroundColor: '#0D2A10',
  },
  autocompleteRank: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 28,
    textAlign: 'right',
  },
  autocompleteRiderName: {
    flex: 1,
    color: '#F3F4F6',
    fontSize: 14,
  },
  groupTimePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#1E2130',
    borderWidth: 1,
    borderColor: '#3A3F52',
  },
  groupTimePillLeader: {
    backgroundColor: '#1C2B1E',
    borderColor: '#4CAF50',
  },
  groupTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C0C7D6',
    letterSpacing: 0.5,
  },
  groupTimeTextLeader: {
    color: '#4CAF50',
  },
  groupTimePillGap: {
    backgroundColor: '#1A0D0D',
    borderColor: '#4A1A1A',
  },
  groupTimeTextGap: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  groupTimeTextStrikethrough: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textDecorationLine: 'line-through',
    color: '#6b7280',
  },
  groupTimeTextCorrected: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  resultSameTime: {
    color: '#6b7280',
    fontStyle: 'italic',
    fontSize: 11,
  },
  resultTimeColumn: {
    alignItems: 'flex-end',
  },
  rankChangeUp: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4CAF50',
    lineHeight: 11,
  },
  rankChangeDown: {
    fontSize: 9,
    fontWeight: '700',
    color: '#EF4444',
    lineHeight: 11,
  },
  earnedPointsText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'right',
  },
  bonusBadge: {
    backgroundColor: '#1a2e1a',
    borderWidth: 1,
    borderColor: '#2d5a2d',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  bonusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4CAF50',
  },
  malusBadge: {
    backgroundColor: '#2e1a1a',
    borderWidth: 1,
    borderColor: '#5a2d2d',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  malusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  bonusBadgeNeutral: {
    backgroundColor: '#1c1e26',
    borderWidth: 1,
    borderColor: '#2E3140',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 3,
    alignSelf: 'flex-end',
  },
  bonusBadgeTextNeutral: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  otlTimePillGap: {
    backgroundColor: '#1A1400',
    borderColor: '#4A3800',
  },
  otlTimeTextGap: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  resultRankBadge: {
    minWidth: 32,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12141A',
    borderColor: '#2A2A31',
    flexShrink: 0,
  },
  resultRankBadgeLeader: {
    backgroundColor: '#192018',
    borderColor: '#31492A',
  },
  resultRankBadgePodium: {
    backgroundColor: '#181B22',
    borderColor: '#343C48',
  },
  resultRankBadgeStatus: {
    backgroundColor: '#241618',
    borderColor: '#5C2A30',
  },
  resultRankText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  resultRankTextLeader: {
    color: '#D9F99D',
  },
  resultRankTextPodium: {
    color: '#E4E4E7',
  },
  resultRankTextStatus: {
    color: '#FCA5A5',
  },
  resultFlag: {
    fontSize: 14,
    lineHeight: 18,
  },
  resultIdentity: {
    flex: 1,
    minWidth: 0,
  },
  resultPrimaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
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
  leaderJerseyInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  leaderJerseyBadge: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 28,
    flexShrink: 0,
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
