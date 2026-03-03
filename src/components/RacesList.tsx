import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RaceItem from './RaceItem';
import { getRacePresentation } from '../constants/racePresentation';
import { Race, RaceCategory, Stage } from '../types';

interface RacesListProps {
  races: Race[];
  showEmptyMessage?: boolean;
  onPressRace?: (race: Race) => void;
  stagesMap?: Record<string, Stage | null>;
  stageCountsMap?: Record<string, number>;
}

interface Section {
  category: RaceCategory;
  data: Race[];
}

const groupRacesByCategory = (races: Race[]): Section[] => {
  const grouped = new Map<RaceCategory, Race[]>();

  races.forEach((race) => {
    const current = grouped.get(race.category) ?? [];
    current.push(race);
    grouped.set(race.category, current);
  });

  return Array.from(grouped.entries())
    .map(([category, data]) => ({ category, data }))
    .sort(
      (a, b) =>
        getRacePresentation(a.category).priority - getRacePresentation(b.category).priority
    );
};

const RacesList: React.FC<RacesListProps> = ({
  races,
  showEmptyMessage = true,
  onPressRace,
  stagesMap,
  stageCountsMap,
}) => {
  const sections = groupRacesByCategory(races);
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setOpenSections((current) => {
      const nextState: Record<string, boolean> = {};

      groupRacesByCategory(races).forEach((section) => {
        nextState[section.category] = current[section.category] ?? true;
      });

      const nextKeys = Object.keys(nextState);
      const currentKeys = Object.keys(current);
      const isUnchanged =
        nextKeys.length === currentKeys.length &&
        nextKeys.every((key) => current[key] === nextState[key]);

      return isUnchanged ? current : nextState;
    });
  }, [races]);

  const toggleSection = (category: RaceCategory) => {
    setOpenSections((current) => ({
      ...current,
      [category]: !(current[category] ?? true),
    }));
  };

  if (races.length === 0 && showEmptyMessage) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bicycle" size={60} color="#555555" />
        <Text style={styles.emptyText}>No races found for this date</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {sections.map((section) => {
        const presentation = getRacePresentation(section.category);
        const isOpen = openSections[section.category] ?? true;

        return (
          <View key={section.category} style={styles.section}>
            <TouchableOpacity
              style={[
                styles.sectionHeader,
                {
                  backgroundColor: presentation.headerBackground,
                  borderColor: presentation.headerBorder,
                },
                isOpen && styles.sectionHeaderOpen,
              ]}
              onPress={() => toggleSection(section.category)}
              activeOpacity={0.85}
            >
              <View style={styles.sectionLead}>
                <View
                  style={[
                    styles.sectionDot,
                    { backgroundColor: presentation.accentColor },
                  ]}
                />
                <Text style={styles.sectionTitle}>{presentation.label}</Text>
              </View>
              <View style={styles.sectionMeta}>
                <View
                  style={[
                    styles.sectionCountBadge,
                    {
                      backgroundColor: presentation.badgeBackground,
                      borderColor: presentation.badgeBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sectionCount,
                      { color: presentation.accentColor },
                    ]}
                  >
                    {section.data.length}
                  </Text>
                </View>
                <Ionicons
                  name={isOpen ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color={presentation.accentColor}
                />
              </View>
            </TouchableOpacity>
            {isOpen && section.data.length > 0 && (
              <View
                style={[
                  styles.sectionBody,
                  {
                    backgroundColor: presentation.bodyBackground,
                    borderColor: presentation.bodyBorder,
                  },
                ]}
              >
                <View style={styles.raceItemsContainer}>
                  {section.data.map((race) => (
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
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 18,
  },
  sectionHeaderOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sectionLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  sectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCountBadge: {
    minWidth: 32,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionBody: {
    padding: 10,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
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
    gap: 8,
  },
});

export default RacesList;
