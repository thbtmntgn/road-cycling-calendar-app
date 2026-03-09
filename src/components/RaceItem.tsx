import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getCategoryAccentColor,
  RACE_SUBGROUP_COLORS,
  RACE_TYPE_COLORS,
  RaceSubgroupKey,
  StageTypeKey,
} from '../constants/raceColors';
import {
  getRacePresentation,
  isGrandTourRace,
  isMajorTourRace,
  isMonumentRace,
  isTopClassicRace,
} from '../constants/racePresentation';
import { Gender, Race, Stage } from '../types';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface RaceItemProps {
  race: Race;
  onPress?: () => void;
  currentStage?: Stage | null;
  totalStages?: number;
}

const countryToFlag = (code: string): string =>
  code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');

const STAGE_TYPE_CONFIG: Record<StageTypeKey, { icon: MCIName; label: string }> = {
  flat: { icon: 'minus', label: 'Flat' },
  hilly: { icon: 'chart-bell-curve', label: 'Hilly' },
  mountain: { icon: 'image-filter-hdr', label: 'Mountain' },
  tt: { icon: 'timer-outline', label: 'Time Trial' },
};

const SIDEBAR_WIDTH = 56;
const BAR_HEIGHT = 44;
const DOT_SIZE = 7;
const DOT_GAP = 3;

// ─── StageTypeTag ────────────────────────────────────────────────────────────

interface StageTypeTagProps {
  type: StageTypeKey;
}

const StageTypeTag: React.FC<StageTypeTagProps> = ({ type }) => {
  const config = STAGE_TYPE_CONFIG[type];
  const colors = RACE_TYPE_COLORS[type];
  if (!config) return null;
  return (
    <View
      style={[
        tagStyles.tag,
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
    >
      <MaterialCommunityIcons name={config.icon} size={12} color={colors.text} />
      <Text style={[tagStyles.text, { color: colors.text }]}>{config.label}</Text>
    </View>
  );
};

const CategoryTag: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <View
    style={[
      tagStyles.tag,
      { backgroundColor: color + '14', borderColor: color + '35' },
    ]}
  >
    <MaterialCommunityIcons name="shape-outline" size={12} color={color} />
    <Text numberOfLines={1} style={[tagStyles.text, { color }]}>
      {label}
    </Text>
  </View>
);

const tagStyles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

type RaceTierBadgeType = RaceSubgroupKey;

const RACE_TIER_BADGE_CONFIG: Record<
  RaceTierBadgeType,
  { icon: MCIName }
> = {
  'grand-tour': { icon: 'crown' },
  monument: { icon: 'trophy-outline' },
  'major-tour': { icon: 'flag-variant' },
  'top-classic': { icon: 'star-four-points-outline' },
};

const RaceTierBadge: React.FC<{ tier: RaceTierBadgeType }> = ({ tier }) => {
  const { icon } = RACE_TIER_BADGE_CONFIG[tier];
  const colors = RACE_SUBGROUP_COLORS[tier];
  return (
    <View style={[raceTierStyles.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <MaterialCommunityIcons name={icon} size={12} color={colors.text} />
      <Text style={[raceTierStyles.text, { color: colors.text }]}>{colors.label}</Text>
    </View>
  );
};

const raceTierStyles = StyleSheet.create({
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
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

// ─── MetadataChips ────────────────────────────────────────────────────────────

interface MetadataChipsProps {
  startTime?: string | null;
  distance?: number;
  elevation?: number;
  stageType?: StageTypeKey;
  raceTier?: RaceTierBadgeType | null;
}

const MetadataChips: React.FC<MetadataChipsProps> = ({
  startTime,
  distance,
  elevation,
  stageType,
  raceTier,
}) => {
  const chips: { icon: MCIName; text: string }[] = [];
  if (startTime) chips.push({ icon: 'clock-outline', text: startTime });
  if (distance && distance > 0) chips.push({ icon: 'road', text: `${distance} km` });
  if (elevation && elevation > 0) {
    chips.push({ icon: 'arrow-up', text: `${elevation.toLocaleString()} m` });
  }
  if (chips.length === 0 && !stageType && !raceTier) return null;

  return (
    <View style={chipStyles.row}>
      {chips.map((chip, i) => (
        <View key={i} style={chipStyles.chip}>
          <MaterialCommunityIcons name={chip.icon} size={11} color="#8B93A1" />
          <Text style={chipStyles.text}>{chip.text}</Text>
        </View>
      ))}
      {stageType ? <StageTypeTag type={stageType} /> : null}
      {raceTier ? <RaceTierBadge tier={raceTier} /> : null}
    </View>
  );
};

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1D1D22',
    borderWidth: 1,
    borderColor: '#2A2A31',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    gap: 5,
  },
  text: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '600',
  },
});

// ─── SidebarProgress ─────────────────────────────────────────────────────────

interface SidebarProgressProps {
  current: number; // 1-based
  total: number;
  color: string;
}

const SidebarProgress: React.FC<SidebarProgressProps> = ({ current, total, color }) => {
  if (total <= 8) {
    return (
      <View style={progressStyles.dotsContainer}>
        {Array.from({ length: total }, (_, i) => {
          const isDone = i < current - 1;
          const isCurrent = i === current - 1;
          return (
            <View
              key={i}
              style={[
                progressStyles.dot,
                isDone && { backgroundColor: color },
                isCurrent && [
                  progressStyles.dotCurrent,
                  { shadowColor: color },
                ],
              ]}
            />
          );
        })}
      </View>
    );
  }

  const fillHeight = Math.round(
    Math.max(0, Math.min(1, current / total)) * BAR_HEIGHT
  );
  const ticks = total === 21 ? [7, 14].map((stage) => (stage / total) * BAR_HEIGHT) : [];

  return (
    <View style={progressStyles.barContainer}>
      <View style={progressStyles.barTrack}>
        <View
          style={[
            progressStyles.barFill,
            { height: fillHeight, backgroundColor: color },
          ]}
        />
        {ticks.map((bottom, index) => (
          <View key={index} style={[progressStyles.tick, { bottom }]} />
        ))}
      </View>
    </View>
  );
};

const progressStyles = StyleSheet.create({
  dotsContainer: {
    alignItems: 'center',
    gap: DOT_GAP,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: '#666F7D',
  },
  dotCurrent: {
    backgroundColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 5,
    shadowOpacity: 0.65,
  },
  barContainer: {
    alignItems: 'center',
  },
  barTrack: {
    width: 6,
    height: BAR_HEIGHT,
    backgroundColor: '#2A2A2E',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 3,
  },
  tick: {
    position: 'absolute',
    left: -2,
    right: -2,
    height: 1.5,
    backgroundColor: '#4A4A52',
  },
});

// ─── RaceItem ─────────────────────────────────────────────────────────────────

const RaceItem: React.FC<RaceItemProps> = ({ race, onPress, currentStage, totalStages }) => {
  const isOneDay = race.startDate === race.endDate;
  const presentation = getRacePresentation(race.category);
  const categoryColor = getCategoryAccentColor(race.category, isOneDay);
  const isRestDay = !isOneDay && currentStage === null;
  const hasActiveStage = !isOneDay && currentStage != null;

  const stageType = (
    hasActiveStage ? currentStage!.stageType : isOneDay ? race.stageType : undefined
  ) as StageTypeKey | undefined;

  const raceTier: RaceTierBadgeType | null =
    isGrandTourRace(race) ? 'grand-tour' :
    isMajorTourRace(race) ? 'major-tour' :
    (isOneDay && race.gender === Gender.Men && isMonumentRace(race)) ? 'monument' :
    isTopClassicRace(race) ? 'top-classic' :
    null;

  const elevation = hasActiveStage ? currentStage!.elevation : race.elevation;
  const distance = isOneDay ? race.distance : hasActiveStage ? currentStage!.distance : undefined;

  const startTime = isOneDay
    ? (race.startTime && race.startTime !== '-' ? race.startTime : null)
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
  const hasRoute = !!(departure || arrival);

  const renderSidebar = () => {
    if (isOneDay) {
      return (
        <View style={sidebarStyles.centered}>
          <Text style={[sidebarStyles.oneDayNum, { color: categoryColor }]}>1</Text>
          <Text style={[sidebarStyles.oneDayLabel, { color: categoryColor }]}>Day</Text>
          <Text style={[sidebarStyles.oneDayLabel, { color: categoryColor }]}>Race</Text>
        </View>
      );
    }

    if (isRestDay) {
      return (
        <View style={sidebarStyles.centered}>
          <Text style={sidebarStyles.restDash}>—</Text>
          <Text style={sidebarStyles.restLabel}>Rest</Text>
        </View>
      );
    }

    if (hasActiveStage) {
      const sn = currentStage!.stageNumber;
      const progressCurrent = sn === 0 ? 1 : sn;
      const stageLabelLines = sn === 0 ? ['Prologue'] : ['Stage', 'Race'];
      const stageValue = totalStages ? `${progressCurrent}/${totalStages}` : String(progressCurrent);

      return (
        <View style={sidebarStyles.centeredStage}>
          <View style={sidebarStyles.stageBlock}>
            {stageLabelLines.map((label) => (
              <Text key={label} style={[sidebarStyles.stageLabel, { color: categoryColor }]}>
                {label}
              </Text>
            ))}
          </View>
          {totalStages ? (
            <SidebarProgress current={progressCurrent} total={totalStages} color={categoryColor} />
          ) : null}
          <Text style={[sidebarStyles.stageValue, { color: categoryColor }]}>{stageValue}</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View
        style={[
          styles.sidebar,
          { backgroundColor: categoryColor + '18', borderRightColor: categoryColor },
        ]}
      >
        {renderSidebar()}
      </View>

      <View style={styles.content}>
        <View style={styles.topContent}>
          <View style={styles.headerRow}>
            <View style={styles.nameRow}>
              <Text style={styles.flag}>{countryToFlag(race.country)}</Text>
              <Text style={styles.raceName} numberOfLines={2}>
                {race.name}
              </Text>
            </View>
            <View style={styles.categoryTagSlot}>
              <CategoryTag label={presentation.label} color={categoryColor} />
            </View>
          </View>

          {isRestDay ? (
            <Text style={styles.restText}>Rest day</Text>
          ) : (
            <>
              {hasRoute && (
                <View style={styles.routeBlock}>
                  {departure ? (
                    <View style={styles.routeLine}>
                      <Text style={styles.routeLabel}>Start</Text>
                      <Text style={[styles.routeText, styles.routeDeparture]}>{departure}</Text>
                    </View>
                  ) : null}
                  {arrival ? (
                    <View style={styles.routeLine}>
                      <Text style={styles.routeLabel}>Finish</Text>
                      <Text style={[styles.routeText, styles.routeArrival]}>{arrival}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </>
          )}
        </View>
        {!isRestDay && (startTime || distance || elevation || stageType || raceTier) ? (
          <View style={styles.metadataRow}>
            <MetadataChips
              startTime={startTime}
              distance={distance}
              elevation={elevation}
              stageType={stageType}
              raceTier={raceTier}
            />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const sidebarStyles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  oneDayNum: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
  },
  oneDayLabel: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
    letterSpacing: 0.8,
    opacity: 0.9,
    textTransform: 'uppercase',
  },
  stageBlock: {
    alignItems: 'center',
  },
  stageLabel: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
    letterSpacing: 0.8,
    opacity: 0.9,
    textTransform: 'uppercase',
  },
  stageValue: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 15,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  restDash: {
    fontSize: 11,
    color: '#5A5A63',
    lineHeight: 13,
  },
  restLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#171920',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#252833',
    overflow: 'hidden',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    borderRightWidth: 3,
    paddingVertical: 16,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 15,
    justifyContent: 'space-between',
    minHeight: 126,
  },
  topContent: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  categoryTagSlot: {
    flexShrink: 0,
    maxWidth: '45%',
  },
  flag: {
    fontSize: 16,
    lineHeight: 18,
  },
  raceName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  routeBlock: {
    gap: 4,
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  routeText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  routeLabel: {
    color: '#6B7280',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    width: 52,
    paddingTop: 2,
  },
  routeDeparture: {
    color: '#A1A1AA',
  },
  routeArrival: {
    color: '#F4F4F5',
    fontWeight: '700',
  },
  metadataRow: {
    marginTop: 12,
  },
  restText: {
    color: '#8B93A1',
    fontSize: 12,
    fontStyle: 'italic',
  },
});

export default RaceItem;
