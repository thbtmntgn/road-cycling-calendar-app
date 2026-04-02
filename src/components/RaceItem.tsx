import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  RACE_SUBGROUP_COLORS,
  RaceSubgroupKey,
  StageTypeKey,
} from '../constants/raceColors';
import {
  isGrandTourRace,
  isMajorTourRace,
  isMonumentRace,
  isTopClassicRace,
} from '../constants/racePresentation';
import { Race, RaceResult, Stage } from '../types';
import { formatStageLabel } from '../utils/stageUtils';
import { countryToFlag } from '../utils/flagUtils';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type RaceTierBadgeType = RaceSubgroupKey;

export type CompletedRaceResult = {
  winner: RaceResult | null;
  winnerGap?: string | null;
  /** Defined (even if null) for stage races; absent for one-day races */
  gcLeader?: RaceResult | null;
  gcGap?: string | null;
};

interface RaceItemProps {
  race: Race;
  onPress?: () => void;
  onWinnerPress?: () => void;
  onGcLeaderPress?: () => void;
  currentStage?: Stage | null;
  currentStageProgress?: number | null;
  totalStages?: number;
  completedResult?: CompletedRaceResult;
  allStages?: Stage[];
  onStageDatePress?: (date: string) => void;
}

/** Converts "H:MM:SS" or "M:SS" to cycling notation: "3h43′33″", "1′23″", "15″" */
const formatCyclingTime = (time: string): string => {
  const parts = time.split(':').map(Number);
  if (parts.some(isNaN)) return time;
  let h = 0, m = 0, s = 0;
  if (parts.length === 3) [h, m, s] = parts;
  else if (parts.length === 2) [m, s] = parts;
  else return time;
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}′${s.toString().padStart(2, '0')}″`;
  if (m > 0) return `${m}′${s.toString().padStart(2, '0')}″`;
  return `${s}″`;
};

const reverseRiderName = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`;
};



// ─── StageTypeTag ─────────────────────────────────────────────────────────────

const STAGE_TYPE_CONFIG: Record<StageTypeKey, { icon: MCIName; label: string }> = {
  flat: { icon: 'minus', label: 'Flat' },
  hilly: { icon: 'chart-bell-curve', label: 'Hilly' },
  mountain: { icon: 'image-filter-hdr', label: 'Mountain' },
  itt: { icon: 'timer-outline', label: 'ITT' },
  ttt: { icon: 'timer-outline', label: 'TTT' },
};

const StageTypeTag: React.FC<{ type: StageTypeKey }> = ({ type }) => {
  const config = STAGE_TYPE_CONFIG[type];
  if (!config) return null;
  return (
    <View style={tagStyles.tag}>
      <MaterialCommunityIcons name={config.icon} size={11} color="#A0AABB" />
      <Text style={tagStyles.text}>{config.label}</Text>
    </View>
  );
};

const tagStyles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#A0AABB',
  },
});


// ─── RaceTierBadge ────────────────────────────────────────────────────────────

const RACE_TIER_BADGE_CONFIG: Record<RaceTierBadgeType, { icon: MCIName }> = {
  'grand-tour': { icon: 'crown' },
  monument: { icon: 'trophy-outline' },
  'major-tour': { icon: 'flag-variant' },
  'top-classic': { icon: 'star-four-points-outline' },
};

const RaceTierBadge: React.FC<{ tier: RaceTierBadgeType; compact?: boolean }> = ({
  tier,
  compact = false,
}) => {
  const { icon } = RACE_TIER_BADGE_CONFIG[tier];
  const colors = RACE_SUBGROUP_COLORS[tier];
  return (
    <View
      style={[
        compact ? badgeStyles.compactTag : tagStyles.tag,
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
    >
      {compact ? (
        <View style={badgeStyles.compactIconWrap}>
          <MaterialCommunityIcons name={icon} size={10} color={colors.text} />
        </View>
      ) : (
        <MaterialCommunityIcons name={icon} size={11} color={colors.text} />
      )}
      <Text
        style={[
          compact ? badgeStyles.compactText : tagStyles.text,
          { color: colors.text },
        ]}
      >
        {colors.label}
      </Text>
    </View>
  );
};

const badgeStyles = StyleSheet.create({
  compactTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 7,
    borderWidth: 1,
    gap: 4,
  },
  compactIconWrap: {
    width: 11,
    height: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

// ─── StageNumberRow ───────────────────────────────────────────────────────────

const StageNumberRow: React.FC<{
  current: number;
  total: number;
  stageDates?: string[];
  onDatePress?: (date: string) => void;
}> = ({ current, total, stageDates, onDatePress }) => (
  <View style={stageRowStyles.strip}>
    <View style={stageRowStyles.row}>
      {Array.from({ length: total }).map((_, i) => {
        const stageNum = i + 1;
        const isCurrent = stageNum === current;
        const isPast = stageNum < current;
        const date = stageDates?.[i];
        return (
          <TouchableOpacity
            key={i}
            style={[
              stageRowStyles.bubble,
              isCurrent
                ? stageRowStyles.bubbleCurrent
                : isPast
                  ? stageRowStyles.bubblePast
                  : stageRowStyles.bubbleFuture,
            ]}
            onPress={date && onDatePress ? () => onDatePress(date) : undefined}
            activeOpacity={date && onDatePress ? 0.6 : 1}
          >
            <Text
              style={[
                stageRowStyles.bubbleText,
                isCurrent
                  ? stageRowStyles.bubbleTextCurrent
                  : isPast
                    ? stageRowStyles.bubbleTextPast
                    : stageRowStyles.bubbleTextFuture,
              ]}
            >
              {stageNum}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

const stageRowStyles = StyleSheet.create({
  strip: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  bubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleCurrent: {
    backgroundColor: '#5BA3D9',
    borderColor: '#7BBDE8',
  },
  bubblePast: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  bubbleFuture: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bubbleText: {
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
  },
  bubbleTextCurrent: {
    color: '#FFFFFF',
  },
  bubbleTextPast: {
    color: 'rgba(255,255,255,0.70)',
  },
  bubbleTextFuture: {
    color: 'rgba(255,255,255,0.30)',
  },
});

// ─── RaceItem ─────────────────────────────────────────────────────────────────

const RaceItem: React.FC<RaceItemProps> = ({
  race,
  onPress,
  onWinnerPress,
  onGcLeaderPress,
  currentStage,
  currentStageProgress,
  totalStages,
  completedResult,
  allStages,
  onStageDatePress,
}) => {
  const isOneDay = race.startDate === race.endDate;
const isRestDay = !isOneDay && currentStage === null;
  const hasActiveStage = !isOneDay && currentStage != null;

  const stageType = (
    hasActiveStage ? currentStage!.stageType : isOneDay ? race.stageType : undefined
  ) as StageTypeKey | undefined;

  const raceTier: RaceTierBadgeType | null =
    isGrandTourRace(race)
      ? 'grand-tour'
      : isMajorTourRace(race)
        ? 'major-tour'
        : isOneDay && isMonumentRace(race)
          ? 'monument'
          : isTopClassicRace(race)
            ? 'top-classic'
            : null;

  const elevation = hasActiveStage ? currentStage!.elevation : race.elevation;
  const distance = isOneDay
    ? race.distance
    : hasActiveStage
      ? currentStage!.distance
      : undefined;

  const startTime = isOneDay
    ? race.startTime && race.startTime !== '-'
      ? race.startTime
      : null
    : hasActiveStage && currentStage!.startTime && currentStage!.startTime !== '-'
      ? currentStage!.startTime
      : null;

  const departure = hasActiveStage
    ? currentStage!.departure || ''
    : isOneDay
      ? race.departure || ''
      : '';
  const arrival = hasActiveStage
    ? currentStage!.arrival || ''
    : isOneDay
      ? race.arrival || ''
      : '';

  const stageLabel = hasActiveStage ? formatStageLabel(currentStage!.stageNumber) : null;
  const showStageDots =
    hasActiveStage && totalStages != null && currentStageProgress != null;
  const hasRoute = !!(departure || arrival);
  const hasBottomRightTierBadge = raceTier != null;
  const isCompleted = completedResult != null;
  const isStageRaceResult = isCompleted && 'gcLeader' in completedResult!;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.content}>
        {/* Row 1: flag · name (+ stage inline) · terrain tag */}
        <View style={styles.headerRow}>
          <Text style={styles.flag}>{countryToFlag(race.country)}</Text>
          <Text style={styles.raceName} numberOfLines={2}>
            {race.name}
            {hasActiveStage && stageLabel ? (
              <Text style={styles.stageInline}>{' · '}{stageLabel.toUpperCase()}</Text>
            ) : null}
          </Text>
          {stageType ? <StageTypeTag type={stageType} /> : null}
        </View>

        {/* Row 2: route or rest day */}
        {isRestDay ? (
          <Text style={styles.restText}>Rest day</Text>
        ) : hasRoute ? (
          <View style={styles.routeRow}>
            {departure ? (
              <>
                <MaterialCommunityIcons name="map-marker-outline" size={11} color="#8AAAC8" />
                <Text style={styles.departure} numberOfLines={1}>{departure}</Text>
              </>
            ) : null}
            {departure && arrival ? <Text style={styles.routeArrow}>→</Text> : null}
            {arrival ? (
              <>
                <MaterialCommunityIcons name="flag-checkered" size={11} color="#8AAAC8" />
                <Text style={styles.arrival} numberOfLines={1}>{arrival}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        {/* Row 3: race-specific data chips */}
        <View style={styles.chipsRow}>
          <View style={styles.chipsWrap}>
            {startTime ? (
              <View style={styles.chip}>
                <MaterialCommunityIcons name="clock-outline" size={11} color="#8B93A1" />
                <Text style={styles.chipText}>{startTime}</Text>
              </View>
            ) : null}
            {distance && distance > 0 ? (
              <View style={styles.chip}>
                <MaterialCommunityIcons name="road" size={11} color="#8B93A1" />
                <Text style={styles.chipText}>{distance} km</Text>
              </View>
            ) : null}
            {elevation && elevation > 0 ? (
              <View style={styles.chip}>
                <MaterialCommunityIcons name="arrow-up" size={11} color="#8B93A1" />
                <Text style={styles.chipText}>{elevation.toLocaleString()} m</Text>
              </View>
            ) : null}
          </View>

          {raceTier && hasBottomRightTierBadge ? (
            <View style={styles.trailingBadgeWrap}>
              <RaceTierBadge tier={raceTier} compact />
            </View>
          ) : null}
        </View>

        {isCompleted && (completedResult!.winner || completedResult!.gcLeader) ? (
          <>
            <View style={resultStyles.divider} />
            <View style={resultStyles.pillsRow}>
              {completedResult!.winner ? (
                <TouchableOpacity
                  style={[resultStyles.pill, resultStyles.winnerPill]}
                  onPress={onWinnerPress ?? onPress}
                  activeOpacity={onWinnerPress ?? onPress ? 0.7 : 1}
                  disabled={!(onWinnerPress ?? onPress)}
                >
                  <MaterialCommunityIcons name="trophy" size={14} color="#A07800" />
                  <View style={resultStyles.pillBody}>
                    <Text style={[resultStyles.pillLabel, resultStyles.winnerLabel]}>
                      {isStageRaceResult ? 'STAGE WINNER' : 'WINNER'}
                    </Text>
                    <Text style={resultStyles.pillName} numberOfLines={1}>
                      {completedResult!.winner.nationality
                        ? countryToFlag(completedResult!.winner.nationality) + ' '
                        : ''}
                      {reverseRiderName(completedResult!.winner.riderName)}
                    </Text>
                    <Text style={resultStyles.pillMeta} numberOfLines={1}>
                      {completedResult!.winner.teamName ?? ''}
                    </Text>
                  </View>
                  {completedResult!.winner.time ? (
                    <View style={resultStyles.pillTimeBlock}>
                      <View style={resultStyles.timeLabels}>
                        <Text style={resultStyles.timeKey}>Time</Text>
                        {completedResult!.winnerGap ? <Text style={resultStyles.timeKey}>Gap</Text> : null}
                      </View>
                      <View style={resultStyles.timeValues}>
                        <Text style={resultStyles.pillTime}>
                          {formatCyclingTime(completedResult!.winner.time)}
                        </Text>
                        {completedResult!.winnerGap ? (
                          <Text style={resultStyles.pillGap}>
                            {formatCyclingTime(completedResult!.winnerGap)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ) : null}
              {completedResult!.gcLeader ? (
                <TouchableOpacity
                  style={[resultStyles.pill, resultStyles.gcPill]}
                  onPress={onGcLeaderPress ?? onPress}
                  activeOpacity={onGcLeaderPress ?? onPress ? 0.7 : 1}
                  disabled={!(onGcLeaderPress ?? onPress)}
                >
                  <View style={resultStyles.gcDot} />
                  <View style={resultStyles.pillBody}>
                    <Text style={[resultStyles.pillLabel, resultStyles.gcLabel]}>GC LEADER</Text>
                    <Text style={resultStyles.pillName} numberOfLines={1}>
                      {completedResult!.gcLeader.nationality
                        ? countryToFlag(completedResult!.gcLeader.nationality) + ' '
                        : ''}
                      {reverseRiderName(completedResult!.gcLeader.riderName)}
                    </Text>
                    <Text style={resultStyles.pillMeta} numberOfLines={1}>
                      {completedResult!.gcLeader.teamName ?? ''}
                    </Text>
                  </View>
                  {completedResult!.gcLeader.time ? (
                    <View style={resultStyles.pillTimeBlock}>
                      <View style={resultStyles.timeLabels}>
                        <Text style={resultStyles.timeKey}>Time</Text>
                        {completedResult!.gcGap ? <Text style={resultStyles.timeKey}>Gap</Text> : null}
                      </View>
                      <View style={resultStyles.timeValues}>
                        <Text style={resultStyles.pillTime}>
                          {formatCyclingTime(completedResult!.gcLeader.time)}
                        </Text>
                        {completedResult!.gcGap ? (
                          <Text style={resultStyles.pillGap}>
                            {formatCyclingTime(completedResult!.gcGap)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ) : null}
              {showStageDots && (
                <StageNumberRow
                  current={currentStageProgress!}
                  total={totalStages!}
                  stageDates={allStages?.map((s) => s.date)}
                  onDatePress={onStageDatePress}
                />
              )}
            </View>
          </>
        ) : showStageDots ? (
          <StageNumberRow
            current={currentStageProgress!}
            total={totalStages!}
            stageDates={allStages?.map((s) => s.date)}
            onDatePress={onStageDatePress}
          />
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A2840',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#253A5A',
    overflow: 'hidden',
  },
  content: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  flag: {
    fontSize: 15,
    lineHeight: 18,
  },
  raceName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  stageInline: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A0AABB',
    letterSpacing: 0.3,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  departure: {
    color: '#8AAAC8',
    fontSize: 12,
    flexShrink: 1,
  },
  routeArrow: {
    color: '#8AAAC8',
    fontSize: 12,
  },
  arrival: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  restText: {
    color: '#6B7280',
    fontSize: 12,
    fontStyle: 'italic',
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  chipsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
  },
  trailingBadgeWrap: {
    flexShrink: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111D2E',
    borderWidth: 1,
    borderColor: '#1E2F48',
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 7,
    gap: 4,
  },
  chipText: {
    color: '#D1D5DB',
    fontSize: 10,
    fontWeight: '600',
  },
});

const resultStyles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: '#253A5A',
  },
  pillsRow: {
    flexDirection: 'column',
    gap: 6,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
  },
  winnerPill: {
    backgroundColor: '#181200',
    borderColor: '#2C2000',
  },
  gcPill: {
    backgroundColor: '#001508',
    borderColor: '#002C10',
  },
  gcDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F5C518',
    flexShrink: 0,
  },
  pillBody: {
    flex: 1,
    minWidth: 0,
  },
  pillLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  winnerLabel: {
    color: '#F5C518',
  },
  gcLabel: {
    color: '#4ade80',
  },
  pillName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 14,
  },
  pillMeta: {
    fontSize: 9,
    color: '#8AAAC8',
    marginTop: 2,
  },
  pillTimeBlock: {
    flexDirection: 'row',
    flexShrink: 0,
    alignSelf: 'center',
    gap: 5,
  },
  timeLabels: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 3,
  },
  timeValues: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 3,
  },
  timeKey: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#7A9ABB',
    lineHeight: 14,
  },
  pillTime: {
    fontSize: 10,
    fontWeight: '600',
    color: '#C8DCF0',
    lineHeight: 14,
  },
  pillGap: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4ade80',
    lineHeight: 14,
  },
});

export default RaceItem;
