import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RaceItem from './RaceItem';
import { Race, RaceCategory } from '../types';

interface RacesListProps {
  races: Race[];
  showEmptyMessage?: boolean;
  onPressRace?: (race: Race) => void;
}

interface Section {
  title: string;
  data: Race[];
  isOpen: boolean;
}

const RacesList: React.FC<RacesListProps> = ({ races, showEmptyMessage = true, onPressRace }) => {
  const groupRacesByCategory = (): Section[] => {
    const sections: { [key: string]: Race[] } = {};

    races.forEach((race) => {
      if (!sections[race.category]) {
        sections[race.category] = [];
      }
      sections[race.category].push(race);
    });

    const categoryOrder = {
      [RaceCategory.WorldTour]: 1,
      [RaceCategory.WomenWorldTour]: 2,
      [RaceCategory.ProSeries]: 3,
      [RaceCategory.WomenProSeries]: 4,
      [RaceCategory.Continental]: 5,
    };

    return Object.keys(sections)
      .map((category) => ({
        title: category,
        data: sections[category],
        isOpen: true,
      }))
      .sort((a, b) => {
        const aPriority = categoryOrder[a.title as RaceCategory] || 99;
        const bPriority = categoryOrder[b.title as RaceCategory] || 99;
        return aPriority - bPriority;
      });
  };

  const [sections, setSections] = React.useState<Section[]>(groupRacesByCategory());

  React.useEffect(() => {
    setSections(groupRacesByCategory());
  }, [races]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSection = (sectionTitle: string) => {
    setSections((prevSections) =>
      prevSections.map((section) =>
        section.title === sectionTitle ? { ...section, isOpen: !section.isOpen } : section
      )
    );
  };

  const renderSectionHeader = (section: Section) => (
    <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(section.title)}>
      <View style={styles.sectionTitleContainer}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionCount}>{section.data.length}</Text>
      </View>

      <Ionicons name={section.isOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#AAAAAA" />
    </TouchableOpacity>
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
    <ScrollView style={styles.container}>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          {renderSectionHeader(section)}

          {section.isOpen && section.data.length > 0 && (
            <View style={styles.raceItemsContainer}>
              {section.data.map((race) => (
                <RaceItem
                  key={race.id}
                  race={race}
                  onPress={onPressRace ? () => onPressRace(race) : undefined}
                />
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#333333',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionCount: {
    marginLeft: 8,
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: '400',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 10,
    color: '#777777',
    fontSize: 16,
  },
  raceItemsContainer: {
    paddingTop: 5,
    paddingBottom: 5,
  },
});

export default RacesList;
