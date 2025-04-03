import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Race } from '../types';
import { formatDateRange } from '../utils/dateUtils';
import { useFavoritesStore } from '../store/favoritesStore';

interface RaceItemProps {
  race: Race;
}

const RaceItem: React.FC<RaceItemProps> = ({ race }) => {
  // Access favorites store
  const { toggleFavorite, isFavorite } = useFavoritesStore();
  
  // Check if race is favorited
  const favorited = isFavorite(race.id);
  
  // Handle favorite button press
  const handleFavoritePress = () => {
    toggleFavorite(race.id);
  };
  
  // Get appropriate color for race category
  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'WorldTour':
        return '#F44336'; // Red
      case 'ProSeries':
        return '#2196F3'; // Blue
      case 'Continental':
        return '#FF9800'; // Orange
      case 'WomenWorldTour':
        return '#E91E63'; // Pink
      case 'WomenProSeries':
        return '#9C27B0'; // Purple
      default:
        return '#4CAF50'; // Green
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.raceInfo}>
        <View style={styles.raceHeader}>
          <Text style={styles.raceName}>{race.name}</Text>
          <TouchableOpacity 
            onPress={handleFavoritePress} 
            style={styles.favoriteButton}
          >
            <Ionicons 
              name={favorited ? 'star' : 'star-outline'} 
              size={22} 
              color={favorited ? '#FFD700' : '#888888'} 
            />
          </TouchableOpacity>
        </View>
        
        <View style={styles.raceDetails}>
          <View style={[
            styles.categoryBadge, 
            { backgroundColor: getCategoryColor(race.category) }
          ]}>
            <Text style={styles.categoryText}>{race.category}</Text>
          </View>
          
          <Text style={styles.dateText}>
            {formatDateRange(race.startDate, race.endDate)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#222222',
    borderRadius: 8,
    marginVertical: 5,
    marginHorizontal: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50', // Can be dynamic based on race type
  },
  raceInfo: {
    flex: 1,
  },
  raceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  raceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  favoriteButton: {
    padding: 4,
  },
  raceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  categoryBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dateText: {
    color: '#BBBBBB',
    fontSize: 12,
  },
});

export default RaceItem;