import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Race, Stage } from '../types';
import { formatDateRange } from '../utils/dateUtils';
import { useFavoritesStore } from '../store/favoritesStore';

interface RaceItemProps {
  race: Race;
  onPress?: () => void;
  currentStage?: Stage | null;
}

const countryToFlag = (code: string): string => {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
};

const RaceItem: React.FC<RaceItemProps> = ({ race, onPress, currentStage }) => {
  const { toggleFavorite, isFavorite } = useFavoritesStore();

  const favorited = isFavorite(race.id);

  const handleFavoritePress = () => {
    toggleFavorite(race.id);
  };

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

  const categoryColor = getCategoryColor(race.category);

  return (
    <TouchableOpacity
      style={[styles.container, { borderLeftColor: categoryColor }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.raceInfo}>
        <View style={styles.raceHeader}>
          <Text style={styles.flag}>{countryToFlag(race.country)}</Text>
          <Text style={styles.raceName}>{race.name}</Text>
          <TouchableOpacity onPress={handleFavoritePress} style={styles.favoriteButton}>
            <Ionicons
              name={favorited ? 'star' : 'star-outline'}
              size={22}
              color={favorited ? '#FFD700' : '#888888'}
            />
          </TouchableOpacity>
        </View>

        {currentStage === null && (
          <Text style={styles.stageRow}>Rest day</Text>
        )}
        {currentStage != null && (
          <Text style={styles.stageRow}>
            {(() => {
              const label = `Stage ${currentStage.stageNumber === 0 ? 'P' : currentStage.stageNumber}`;
              const hasRoute = currentStage.departure || currentStage.arrival;
              const hasDist = currentStage.distance > 0;
              const hasTime = !!currentStage.startTime;
              const route = hasRoute ? `${currentStage.departure} → ${currentStage.arrival}` : '';
              const dist = hasDist ? `${currentStage.distance} km` : '';
              const time = hasTime ? currentStage.startTime : '';
              const parts = [route, dist, time].filter(Boolean);
              return parts.length > 0 ? `${label} · ${parts.join(' · ')}` : label;
            })()}
          </Text>
        )}

        <View style={styles.raceDetails}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
            <Text style={styles.categoryText}>{race.category}</Text>
          </View>

          <Text style={styles.dateText}>{formatDateRange(race.startDate, race.endDate)}</Text>
        </View>
      </View>
    </TouchableOpacity>
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
  },
  raceInfo: {
    flex: 1,
  },
  raceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flag: {
    fontSize: 20,
    marginRight: 8,
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
  stageRow: {
    color: '#888888',
    fontSize: 12,
    marginTop: 4,
  },
});

export default RaceItem;
