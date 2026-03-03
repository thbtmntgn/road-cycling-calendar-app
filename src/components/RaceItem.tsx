import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Race, Stage } from '../types';
import { formatDateRange } from '../utils/dateUtils';

interface RaceItemProps {
  race: Race;
  onPress?: () => void;
  currentStage?: Stage | null;
  totalStages?: number;
}

const countryToFlag = (code: string): string => {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
};

const RaceItem: React.FC<RaceItemProps> = ({ race, onPress, currentStage, totalStages }) => {
  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'WorldTour':
        return '#F44336';
      case 'WomenWorldTour':
        return '#E91E63';
      case 'WorldChampionship':
        return '#FF6D00';
      case 'WomenWorldChampionship':
        return '#AD1457';
      case 'ProSeries':
        return '#2196F3';
      case 'WomenProSeries':
        return '#9C27B0';
      case 'NationalChampionship':
        return '#37474F';
      case 'WomenNationalChampionship':
        return '#546E7A';
      case 'Continental':
        return '#FF9800';
      default:
        return '#4CAF50';
    }
  };

  const categoryColor = getCategoryColor(race.category);
  const isOneDay = race.startDate === race.endDate;

  let badge = '';
  let stageDetails = '';
  if (isOneDay) {
    badge = 'One Day';
  } else if (currentStage != null) {
    const num = currentStage.stageNumber === 0 ? 'P' : String(currentStage.stageNumber);
    badge = totalStages ? `Stage ${num}/${totalStages}` : `Stage ${num}`;

    const parts: string[] = [];
    if (currentStage.departure || currentStage.arrival) {
      parts.push(`${currentStage.departure} → ${currentStage.arrival}`);
    }
    if (currentStage.distance > 0) parts.push(`${currentStage.distance} km`);
    if (currentStage.startTime && currentStage.startTime !== '-') parts.push(currentStage.startTime);
    stageDetails = parts.join(' · ');
  }

  const detailParts: string[] = [];
  if (isOneDay && race.distance && race.distance > 0) detailParts.push(`${race.distance} km`);
  detailParts.push(formatDateRange(race.startDate, race.endDate));

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
          {badge !== '' && (
            <View style={styles.stageBadge}>
              <Text style={styles.stageBadgeText}>{badge}</Text>
            </View>
          )}
        </View>

        {currentStage === null && (
          <Text style={styles.stageRow}>Rest day</Text>
        )}
        {currentStage != null && stageDetails !== '' && (
          <Text style={styles.stageRow}>{stageDetails}</Text>
        )}

        <Text style={styles.detailRow}>{detailParts.join(' · ')}</Text>
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
  stageBadge: {
    backgroundColor: '#00838F',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
    marginLeft: 6,
  },
  stageBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  detailRow: {
    color: '#BBBBBB',
    fontSize: 12,
    marginTop: 6,
  },
  stageRow: {
    color: '#888888',
    fontSize: 12,
    marginTop: 6,
  },
});

export default RaceItem;
