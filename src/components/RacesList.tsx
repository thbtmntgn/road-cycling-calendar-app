import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RaceItem from './RaceItem';
import { getRacePresentation } from '../constants/racePresentation';
import { Race, Stage } from '../types';

interface RacesListProps {
  races: Race[];
  showEmptyMessage?: boolean;
  onPressRace?: (race: Race) => void;
  stagesMap?: Record<string, Stage | null>;
  stageCountsMap?: Record<string, number>;
  bottomPadding?: number;
  footer?: React.ReactNode;
  onViewportHeightChange?: (height: number) => void;
  onMainContentHeightChange?: (height: number) => void;
}

const sortRacesByCategoryPriority = (races: Race[]): Race[] =>
  [...races].sort((a, b) => {
    const priorityDiff =
      getRacePresentation(a.category).priority - getRacePresentation(b.category).priority;

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return a.name.localeCompare(b.name);
  });

const RacesList: React.FC<RacesListProps> = ({
  races,
  showEmptyMessage = true,
  onPressRace,
  stagesMap,
  stageCountsMap,
  bottomPadding = 28,
  footer,
  onViewportHeightChange,
  onMainContentHeightChange,
}) => {
  const sortedRaces = React.useMemo(() => sortRacesByCategoryPriority(races), [races]);

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
        <View style={styles.raceItemsContainer}>
          {sortedRaces.map((race) => (
            <RaceItem
              key={race.id}
              race={race}
              onPress={onPressRace ? () => onPressRace(race) : undefined}
              currentStage={stagesMap ? stagesMap[race.id] : undefined}
              totalStages={stageCountsMap?.[race.id]}
            />
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
  raceItemsContainer: {
    gap: 10,
  },
});

export default RacesList;
