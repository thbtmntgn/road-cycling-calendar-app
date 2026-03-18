import React, { useState } from 'react';
import { Dimensions, View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';

// Estimate bar width upfront so dots render on the first frame (avoids flash)
const INITIAL_BAR_WIDTH = Dimensions.get('window').width - 32; // 16px list padding each side
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getCategoryAccentColor,
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
import { Race, Stage } from '../types';
import { formatStageLabel } from '../utils/stageUtils';
import { countryToFlag } from '../utils/flagUtils';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type RaceTierBadgeType = RaceSubgroupKey;

interface RaceItemProps {
  race: Race;
  onPress?: () => void;
  currentStage?: Stage | null;
  currentStageProgress?: number | null;
  totalStages?: number;
}



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

// ─── HorizontalProgressBar ────────────────────────────────────────────────────

interface HorizontalProgressBarProps {
  current: number; // 1-based
  total: number;
  color: string;
}

const HorizontalProgressBar: React.FC<HorizontalProgressBarProps> = ({
  current,
  total,
  color,
}) => {
  const [barWidth, setBarWidth] = useState(INITIAL_BAR_WIDTH);
  const progress = Math.min(current / total, 1);

  return (
    <View
      style={progressBarStyles.wrapper}
      onLayout={(e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width)}
    >
      <View
        style={[progressBarStyles.fill, { width: `${progress * 100}%`, backgroundColor: color }]}
      />
      {Array.from({ length: total }).map((_, i) => {
        const stageNum = i + 1;
        const left = (stageNum / total) * barWidth;
        const isCurrent = stageNum === current;
        const dotSize = isCurrent ? 6 : 4;
        return (
          <View
            key={i}
            style={[
              progressBarStyles.dot,
              {
                left: left - dotSize / 2,
                top: (8 - dotSize) / 2,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: isCurrent ? color : 'rgba(255,255,255,0.85)',
                borderWidth: isCurrent ? 1.5 : 0,
                borderColor: isCurrent ? '#FFFFFF' : 'transparent',
              },
            ]}
          />
        );
      })}
    </View>
  );
};

// The wrapper IS the track — its background fills the full 8px band, no floating stripe.
// Fill overlays from left; dots are centered: (8 - dotSize) / 2 → 6px→1, 4px→2 (integers).
const progressBarStyles = StyleSheet.create({
  wrapper: {
    height: 8,
    backgroundColor: '#1D1D22',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    // Only round the right end — left is flush with the card edge
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  dot: {
    position: 'absolute',
  },
});

// ─── RaceItem ─────────────────────────────────────────────────────────────────

const RaceItem: React.FC<RaceItemProps> = ({
  race,
  onPress,
  currentStage,
  currentStageProgress,
  totalStages,
}) => {
  const isOneDay = race.startDate === race.endDate;
  const categoryColor = getCategoryAccentColor(race.category, isOneDay);
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
  const showProgressBar =
    hasActiveStage && totalStages != null && currentStageProgress != null;
  const hasRoute = !!(departure || arrival);
  const hasBottomRightTierBadge = raceTier != null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {showProgressBar && (
        <HorizontalProgressBar
          current={currentStageProgress!}
          total={totalStages!}
          color={categoryColor}
        />
      )}

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
            {departure ? <Text style={styles.departure} numberOfLines={1}>{departure}</Text> : null}
            {departure && arrival ? <Text style={styles.routeArrow}>→</Text> : null}
            {arrival ? <Text style={styles.arrival} numberOfLines={1}>{arrival}</Text> : null}
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
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#141820',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E2130',
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
    color: '#6B7280',
    fontSize: 12,
    flexShrink: 1,
  },
  routeArrow: {
    color: '#374151',
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
    backgroundColor: '#1D1D22',
    borderWidth: 1,
    borderColor: '#2A2A31',
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

export default RaceItem;
