import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RaceItem from './RaceItem';
import { Race, Gender, RaceCategory } from '../types';

interface RacesListProps {
  races: Race[];
  showEmptyMessage?: boolean;
}

interface Section {
  title: string;
  data: Race[];
  isOpen: boolean;
}

const RacesList: React.FC<RacesListProps> = ({ 
  races, 
  showEmptyMessage = true 
}) => {
  // Group races by category
  const groupRacesByCategory = (): Section[] => {
    const sections: { [key: string]: Race[] } = {};
    
    // Group races by their category
    races.forEach(race => {
      if (!sections[race.category]) {
        sections[race.category] = [];
      }
      sections[race.category].push(race);
    });
    
    // Convert to array and sort by category priority
    const categoryOrder = {
      [RaceCategory.WorldTour]: 1,
      [RaceCategory.WomenWorldTour]: 2,
      [RaceCategory.ProSeries]: 3,
      [RaceCategory.WomenProSeries]: 4,
      [RaceCategory.Continental]: 5
    };
    
    return Object.keys(sections)
      .map(category => ({
        title: category,
        data: sections[category],
        isOpen: true // Default to open
      }))
      .sort((a, b) => {
        const aPriority = categoryOrder[a.title as RaceCategory] || 99;
        const bPriority = categoryOrder[b.title as RaceCategory] || 99;
        return aPriority - bPriority;
      });
  };
  
  // Section visibility state
  const [sections, setSections] = React.useState<Section[]>(groupRacesByCategory());
  
  // Update sections when races prop changes
  React.useEffect(() => {
    setSections(groupRacesByCategory());
  }, [races]);
  
  // Toggle section open/closed
  const toggleSection = (sectionTitle: string) => {
    setSections(prevSections => 
      prevSections.map(section => 
        section.title === sectionTitle 
          ? { ...section, isOpen: !section.isOpen } 
          : section
      )
    );
  };
  
  // Render section header
  const renderSectionHeader = (section: Section) => (
    <TouchableOpacity 
      style={styles.sectionHeader}
      onPress={() => toggleSection(section.title)}
    >
      <View style={styles.sectionTitleContainer}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionCount}>{section.data.length}</Text>
      </View>
      
      <Ionicons 
        name={section.isOpen ? 'chevron-up' : 'chevron-down'} 
        size={20} 
        color="#AAAAAA" 
      />
    </TouchableOpacity>
  );
  
  // If no races, show empty message
  if (races.length === 0 && showEmptyMessage) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bicycle" size={60} color="#555555" />
        <Text style={styles.emptyText}>No races found for this date</Text>
      </View>
    );
  }

  // For debugging
  const debugRender = (race: Race) => (
    <View key={race.id} style={styles.debugItem}>
      <Text style={styles.debugText}>Name: {race.name}</Text>
      <Text style={styles.debugText}>Category: {race.category}</Text>
      <Text style={styles.debugText}>Date: {race.startDate} to {race.endDate}</Text>
    </View>
  );
  
  return (
    <ScrollView style={styles.container}>
      {sections.map(section => (
        <View key={section.title} style={styles.section}>
          {renderSectionHeader(section)}
          
          {section.isOpen && section.data.length > 0 && (
            <View style={styles.raceItemsContainer}>
              {section.data.map(race => (
                <RaceItem key={race.id} race={race} />
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
  debugItem: {
    margin: 10,
    padding: 10,
    backgroundColor: '#444',
    borderRadius: 5
  },
  debugText: {
    color: '#FFF',
    fontSize: 12
  }
});

export default RacesList;