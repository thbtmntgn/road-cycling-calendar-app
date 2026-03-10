import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RaceItem from './RaceItem';
import { getRacePresentation, RacePresentation } from '../constants/racePresentation';
import { Race, Stage } from '../types';

interface RacesListProps {
  races: Race[];
  showEmptyMessage?: boolean;
  onPressRace?: (race: Race) => void;
  stagesMap?: Record<string, Stage | null>;
  stageProgressMap?: Record<string, number | null>;
  stageCountsMap?: Record<string, number>;
  bottomPadding?: number;
  footer?: React.ReactNode;
  onViewportHeightChange?: (height: number) => void;
  onMainContentHeightChange?: (height: number) => void;
}

const sortRacesByCategoryPriority = (
  races: Race[],
  stagesMap?: Record<string, Stage | null>,
): Race[] =>
  [...races].sort((a, b) => {
    const priorityDiff =
      getRacePresentation(a.category).priority - getRacePresentation(b.category).priority;

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const timeA = a.startTime ?? stagesMap?.[a.id]?.startTime;
    const timeB = b.startTime ?? stagesMap?.[b.id]?.startTime;

    if (timeA && timeB) return timeA.localeCompare(timeB);
    if (timeA) return -1;
    if (timeB) return 1;

    return a.name.localeCompare(b.name);
  });

interface RaceGroup {
  category: Race['category'];
  presentation: RacePresentation;
  races: Race[];
}

const groupRacesByCategory = (
  races: Race[],
  stagesMap?: Record<string, Stage | null>,
): RaceGroup[] => {
  const sortedRaces = sortRacesByCategoryPriority(races, stagesMap);
  const groups: RaceGroup[] = [];

  sortedRaces.forEach((race) => {
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.category === race.category) {
      lastGroup.races.push(race);
      return;
    }

    groups.push({
      category: race.category,
      presentation: getRacePresentation(race.category),
      races: [race],
    });
  });

  return groups;
};

const RacesList: React.FC<RacesListProps> = ({
  races,
  showEmptyMessage = true,
  onPressRace,
  stagesMap,
  stageProgressMap,
  stageCountsMap,
  bottomPadding = 28,
  footer,
  onViewportHeightChange,
  onMainContentHeightChange,
}) => {
  const groupedRaces = React.useMemo(
    () => groupRacesByCategory(races, stagesMap),
    [races, stagesMap],
  );

  if (races.length === 0 && showEmptyMessage) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bicycle" size={60} color="#555555" />
        <Text style={styles.emptyText}>No races found for this date</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
      onLayout={(event) => onViewportHeightChange?.(event.nativeEvent.layout.height)}
    >
      <View onLayout={(event) => onMainContentHeightChange?.(event.nativeEvent.layout.height)}>
        <View style={styles.sectionsContainer}>
          {groupedRaces.map((group) => (
            <View key={group.category} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View
                  style={[
                    styles.sectionMarker,
                    { backgroundColor: group.presentation.accentColor },
                  ]}
                />
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: group.presentation.accentColor },
                  ]}
                >
                  {group.presentation.label.toUpperCase()}
                </Text>
                <View
                  style={[
                    styles.sectionDivider,
                    { backgroundColor: `${group.presentation.accentColor}24` },
                  ]}
                />
                <Text style={styles.sectionCount}>{group.races.length}</Text>
              </View>

              <View style={styles.raceItemsContainer}>
                {group.races.map((race) => (
                  <RaceItem
                    key={race.id}
                    race={race}
                    onPress={onPressRace ? () => onPressRace(race) : undefined}
                    currentStage={stagesMap ? stagesMap[race.id] : undefined}
                    currentStageProgress={stageProgressMap?.[race.id]}
                    totalStages={stageCountsMap?.[race.id]}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
      {footer}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  sectionsContainer: {
    gap: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 12,
    color: '#71717A',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  sectionMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sectionDivider: {
    flex: 1,
    height: 1,
  },
  sectionCount: {
    color: '#3F3F46',
    fontSize: 10,
    fontWeight: '700',
  },
  raceItemsContainer: {
    gap: 10,
  },
});

export default RacesList;
