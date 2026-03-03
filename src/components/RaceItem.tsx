import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Race, Stage } from '../types';

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

const CATEGORY_COLORS: Record<string, string> = {
  WorldTour: '#F44336',
  WomenWorldTour: '#E91E63',
  WorldChampionship: '#FF6D00',
  WomenWorldChampionship: '#AD1457',
  ProSeries: '#2196F3',
  WomenProSeries: '#9C27B0',
  NationalChampionship: '#37474F',
  WomenNationalChampionship: '#546E7A',
  Continental: '#FF9800',
};

const getCategoryColor = (category: string): string =>
  CATEGORY_COLORS[category] ?? '#4CAF50';

type StageTypeKey = 'flat' | 'hilly' | 'mountain' | 'tt';

const STAGE_TYPE_CONFIG: Record<StageTypeKey, { icon: MCIName; color: string; label: string }> = {
  flat:     { icon: 'minus',            color: '#4ADE80', label: 'Flat' },
  hilly:    { icon: 'chart-bell-curve', color: '#FACC15', label: 'Hilly' },
  mountain: { icon: 'image-filter-hdr', color: '#F87171', label: 'Mountain' },
  tt:       { icon: 'timer-outline',    color: '#A78BFA', label: 'Time Trial' },
};

const SIDEBAR_WIDTH = 56;
const BAR_HEIGHT = 40;
const DOT_SIZE = 7;
const DOT_GAP = 3;

// ─── StageTypeTag ────────────────────────────────────────────────────────────

interface StageTypeTagProps {
  type: StageTypeKey;
}

const StageTypeTag: React.FC<StageTypeTagProps> = ({ type }) => {
  const config = STAGE_TYPE_CONFIG[type];
  if (!config) return null;
  return (
    <View
      style={[
        tagStyles.tag,
        { backgroundColor: config.color + '15', borderColor: config.color + '40' },
      ]}
    >
      <MaterialCommunityIcons name={config.icon} size={11} color={config.color} />
      <Text style={[tagStyles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const tagStyles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '500',
  },
});

// ─── MetadataChips ────────────────────────────────────────────────────────────

interface MetadataChipsProps {
  startTime?: string | null;
  distance?: number;
  elevation?: number;
}

const MetadataChips: React.FC<MetadataChipsProps> = ({ startTime, distance, elevation }) => {
  const chips: { icon: MCIName; text: string }[] = [];
  if (startTime) chips.push({ icon: 'clock-outline', text: startTime });
  if (distance && distance > 0) chips.push({ icon: 'road', text: `${distance} km` });
  if (elevation && elevation > 0) chips.push({ icon: 'arrow-up', text: `${elevation} m` });
  if (chips.length === 0) return null;

  return (
    <View style={chipStyles.row}>
      {chips.map((chip, i) => (
        <View key={i} style={chipStyles.chip}>
          <MaterialCommunityIcons name={chip.icon} size={11} color="#999999" />
          <Text style={chipStyles.text}>{chip.text}</Text>
        </View>
      ))}
    </View>
  );
};

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
    gap: 4,
  },
  text: {
    color: '#AAAAAA',
    fontSize: 11,
  },
});

// ─── SidebarProgress ─────────────────────────────────────────────────────────

interface SidebarProgressProps {
  current: number; // 1-based
  total: number;
  color: string;
}

const SidebarProgress: React.FC<SidebarProgressProps> = ({ current, total, color }) => {
  if (total <= 7) {
    return (
      <View style={progressStyles.dotsContainer}>
        {Array.from({ length: total }, (_, i) => {
          const idx = i + 1;
          const isPast = idx < current;
          const isCurrent = idx === current;
          return (
            <View
              key={i}
              style={[
                progressStyles.dot,
                isPast    && { backgroundColor: color + '80' },
                isCurrent && progressStyles.dotCurrent,
              ]}
            />
          );
        })}
      </View>
    );
  }

  // Vertical bar for 8+ stages — fill from bottom
  const fillHeight = Math.round(Math.max(0, (current - 1) / total) * BAR_HEIGHT);
  const showTicks = total >= 18;
  return (
    <View style={progressStyles.barContainer}>
      <View style={progressStyles.barTrack}>
        <View
          style={[
            progressStyles.barFill,
            { height: fillHeight, backgroundColor: color },
          ]}
        />
        {showTicks && (
          <>
            <View style={[progressStyles.tick, { bottom: Math.round(BAR_HEIGHT * 0.33) }]} />
            <View style={[progressStyles.tick, { bottom: Math.round(BAR_HEIGHT * 0.66) }]} />
          </>
        )}
      </View>
    </View>
  );
};

const progressStyles = StyleSheet.create({
  dotsContainer: {
    alignItems: 'center',
    gap: DOT_GAP,
    marginTop: 5,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: '#2C2C2E',
  },
  dotCurrent: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4,
    shadowOpacity: 0.9,
  },
  barContainer: {
    marginTop: 6,
    alignItems: 'center',
  },
  barTrack: {
    width: 6,
    height: BAR_HEIGHT,
    backgroundColor: '#2C2C2E',
    borderRadius: 3,
    overflow: 'hidden',
    // fill is absolute-positioned from bottom
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
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#1E1E1E',
  },
});

// ─── RaceItem ─────────────────────────────────────────────────────────────────

const RaceItem: React.FC<RaceItemProps> = ({ race, onPress, currentStage, totalStages }) => {
  const categoryColor = getCategoryColor(race.category);
  const isOneDay = race.startDate === race.endDate;
  const isRestDay = !isOneDay && currentStage === null;
  const hasActiveStage = !isOneDay && currentStage != null;

  const stageType = (
    hasActiveStage ? currentStage!.stageType : isOneDay ? race.stageType : undefined
  ) as StageTypeKey | undefined;

  const elevation = hasActiveStage ? currentStage!.elevation : race.elevation;
  const distance = isOneDay ? race.distance : hasActiveStage ? currentStage!.distance : undefined;

  const startTime = isOneDay
    ? (race.startTime && race.startTime !== '-' ? race.startTime : null)
    : hasActiveStage && currentStage!.startTime && currentStage!.startTime !== '-'
      ? currentStage!.startTime
      : null;

  const departure = hasActiveStage ? currentStage!.departure || '' : '';
  const arrival   = hasActiveStage ? currentStage!.arrival   || '' : '';
  const hasRoute  = !!(departure || arrival);

  // ── Sidebar ──
  const renderSidebar = () => {
    if (isOneDay) {
      return (
        <View style={sidebarStyles.centered}>
          <Text style={[sidebarStyles.oneDayNum, { color: categoryColor }]}>1</Text>
          <Text style={[sidebarStyles.oneDayLabel, { color: categoryColor }]}>Day</Text>
        </View>
      );
    }

    if (isRestDay) {
      return (
        <View style={sidebarStyles.centered}>
          <Text style={sidebarStyles.restDash}>—</Text>
        </View>
      );
    }

    if (hasActiveStage && totalStages) {
      const sn = currentStage!.stageNumber;
      const displayNum = sn === 0 ? 'P' : String(sn);
      const progressCurrent = sn === 0 ? 1 : sn;
      return (
        <View style={sidebarStyles.centered}>
          <Text style={[sidebarStyles.stageLabel, { color: categoryColor }]}>
            S{displayNum}
          </Text>
          <View style={[sidebarStyles.divider, { backgroundColor: categoryColor + '40' }]} />
          <SidebarProgress current={progressCurrent} total={totalStages} color={categoryColor} />
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
      {/* Sidebar */}
      <View
        style={[
          styles.sidebar,
          { backgroundColor: categoryColor + '18', borderLeftColor: categoryColor },
        ]}
      >
        {renderSidebar()}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Race name */}
        <View style={styles.nameRow}>
          <Text style={styles.flag}>{countryToFlag(race.country)}</Text>
          <Text style={styles.raceName} numberOfLines={2}>
            {race.name}
          </Text>
        </View>

        {isRestDay ? (
          <Text style={styles.restText}>Rest day</Text>
        ) : (
          <>
            {hasRoute && (
              <Text style={styles.routeText} numberOfLines={1}>
                {departure} → {arrival}
              </Text>
            )}
            {stageType && <View style={styles.tagRow}><StageTypeTag type={stageType} /></View>}
            <MetadataChips startTime={startTime} distance={distance} elevation={elevation} />
          </>
        )}

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
  oneDayNum: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  oneDayLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    opacity: 0.8,
    textTransform: 'uppercase',
  },
  stageLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    width: 22,
    marginVertical: 4,
  },
  restDash: {
    fontSize: 18,
    color: '#444444',
  },
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    marginVertical: 5,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    borderLeftWidth: 3,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  flag: {
    fontSize: 18,
    lineHeight: 22,
  },
  raceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    lineHeight: 20,
  },
  routeText: {
    color: '#888888',
    fontSize: 12,
    marginTop: 5,
  },
  tagRow: {
    marginTop: 5,
  },
  restText: {
    color: '#666666',
    fontSize: 12,
    marginTop: 5,
    fontStyle: 'italic',
  },
});

export default RaceItem;
