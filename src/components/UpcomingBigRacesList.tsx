import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import dayjs from 'dayjs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RACE_SUBGROUP_COLORS, RaceSubgroupKey } from '../constants/raceColors';
import { Race } from '../types';
import { countryToFlag } from '../utils/flagUtils';

export type UpcomingBigRaceType = RaceSubgroupKey;

export interface UpcomingBigRace {
  race: Race;
  type: UpcomingBigRaceType;
  daysAway: number;
}

interface UpcomingBigRacesSectionProps {
  races: UpcomingBigRace[];
  onPressRace?: (race: Race) => void;
}

interface UpcomingBigRacesListProps {
  races: UpcomingBigRace[];
  selectedDate: string;
  onPressRace?: (race: Race) => void;
  bottomPadding?: number;
  filteredOutByFilters?: boolean;
}

const formatRaceDate = (date: string): string => dayjs(date).format('ddd DD MMM');

const getOrdinalSuffix = (day: number): string => {
  if (day >= 11 && day <= 13) {
    return 'th';
  }

  const lastDigit = day % 10;
  if (lastDigit === 1) {
    return 'st';
  }
  if (lastDigit === 2) {
    return 'nd';
  }
  if (lastDigit === 3) {
    return 'rd';
  }
  return 'th';
};

const getNoRacesLabel = (selectedDate: string, filteredOutByFilters = false): string => {
  const targetDate = dayjs(selectedDate).startOf('day');
  const today = dayjs().startOf('day');

  if (targetDate.isSame(today, 'day')) {
    return filteredOutByFilters
      ? 'No races today with current filters.'
      : 'No races today.';
  }

  if (targetDate.isSame(today.add(1, 'day'), 'day')) {
    return filteredOutByFilters
      ? 'No races tomorrow with current filters.'
      : 'No races tomorrow.';
  }

  const day = targetDate.date();
  return filteredOutByFilters
    ? `No races on ${targetDate.format('MMMM')} ${day}${getOrdinalSuffix(day)} with current filters.`
    : `No races on ${targetDate.format('MMMM')} ${day}${getOrdinalSuffix(day)}.`;
};

export const UpcomingBigRacesSection: React.FC<UpcomingBigRacesSectionProps> = ({
  races,
  onPressRace,
}) => (
  <View style={styles.sectionContainer}>
    <Text style={styles.sectionTitle}>Upcoming Big Races</Text>

    {races.length === 0 ? (
      <View style={styles.fallbackWrap}>
        <Text style={styles.fallbackText}>No upcoming big races in the current data window.</Text>
      </View>
    ) : (
      <View style={styles.rowsContainer}>
        {races.map(({ race, type, daysAway }) => {
          const colors = RACE_SUBGROUP_COLORS[type];
          return (
            <TouchableOpacity
              key={race.id}
              style={styles.row}
              onPress={onPressRace ? () => onPressRace(race) : undefined}
              activeOpacity={0.85}
              disabled={!onPressRace}
              accessibilityRole="button"
              accessibilityLabel={`Go to ${race.name} date`}
            >
              <View style={styles.flagWrap}>
                <Text style={styles.flag}>{countryToFlag(race.country)}</Text>
              </View>

              <View style={styles.infoWrap}>
                <Text style={styles.raceName} numberOfLines={1}>
                  {race.name}
                </Text>
                <View style={styles.metaRow}>
                  <View
                    style={[
                      styles.typeBadge,
                      { backgroundColor: colors.bg, borderColor: colors.border },
                    ]}
                  >
                    <View style={[styles.typeDot, { backgroundColor: colors.text }]} />
                    <Text style={[styles.typeText, { color: colors.text }]}>
                      {colors.label.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.dateText}>{formatRaceDate(race.startDate)}</Text>
                </View>
              </View>

              <View style={styles.daysWrap}>
                <Text style={[styles.daysValue, daysAway <= 10 && styles.daysValueSoon]}>
                  {daysAway}
                </Text>
                <Text style={styles.daysLabel}>{daysAway === 1 ? 'day' : 'days'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    )}
  </View>
);

const UpcomingBigRacesList: React.FC<UpcomingBigRacesListProps> = ({
  races,
  selectedDate,
  onPressRace,
  bottomPadding = 28,
  filteredOutByFilters = false,
}) => {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
    >
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="bicycle" size={26} color="rgba(255,255,255,0.28)" />
        <Text style={styles.emptyStateTitle}>
          {getNoRacesLabel(selectedDate, filteredOutByFilters)}
        </Text>
      </View>

      <View style={styles.upcomingSection}>
        <UpcomingBigRacesSection races={races} onPressRace={onPressRace} />
      </View>
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
  },
  emptyState: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  emptyStateTitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.44)',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    textAlign: 'center',
  },
  sectionTitle: {
    marginBottom: 8,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionContainer: {
    marginTop: 4,
  },
  upcomingSection: {
    marginTop: 'auto',
  },
  fallbackWrap: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  rowsContainer: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  flagWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  flag: {
    fontSize: 17,
  },
  infoWrap: {
    flex: 1,
    minWidth: 0,
  },
  raceName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  typeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  typeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dateText: {
    color: 'rgba(255,255,255,0.33)',
    fontSize: 10,
    fontWeight: '500',
  },
  daysWrap: {
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 34,
  },
  daysValue: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 16,
  },
  daysValueSoon: {
    color: '#F0A500',
  },
  daysLabel: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.25)',
    fontSize: 9,
    fontWeight: '600',
  },
});

export default UpcomingBigRacesList;
