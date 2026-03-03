import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Race, StartlistTeam } from '../types';
import { fetchStartlist } from '../api/racesApi';
import { formatDateRange } from '../utils/dateUtils';

// Self-contained param list — works from both CalendarStack and FavoritesStack
type RaceDetailParams = { RaceDetail: { race: Race } };

interface RaceDetailScreenProps {
  navigation: NativeStackNavigationProp<RaceDetailParams, 'RaceDetail'>;
  route: RouteProp<RaceDetailParams, 'RaceDetail'>;
}

const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'WorldTour':
      return '#F44336';
    case 'ProSeries':
      return '#2196F3';
    case 'Continental':
      return '#FF9800';
    case 'WomenWorldTour':
      return '#E91E63';
    case 'WomenProSeries':
      return '#9C27B0';
    default:
      return '#4CAF50';
  }
};

const RaceDetailScreen: React.FC<RaceDetailScreenProps> = ({ navigation, route }) => {
  const { race } = route.params;
  const [startlist, setStartlist] = useState<StartlistTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: race.name });
    loadStartlist();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStartlist = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchStartlist(race.id);
      setStartlist(data);
    } catch (err: unknown) {
      const axiosError = err as { response?: { status: number } };
      if (axiosError?.response?.status === 404) {
        setStartlist([]);
      } else {
        setError('Failed to load startlist');
      }
    } finally {
      setLoading(false);
    }
  };

  const categoryColor = getCategoryColor(race.category);

  const renderTeam = ({ item }: { item: StartlistTeam }) => (
    <View style={styles.teamContainer}>
      <Text style={styles.teamName}>{item.teamName}</Text>
      {item.riders.map((rider, index) => (
        <Text key={index} style={styles.riderName}>
          {rider.name}
        </Text>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={[styles.header, { borderLeftColor: categoryColor }]}>
        <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
          <Text style={styles.categoryText}>{race.category}</Text>
        </View>
        <Text style={styles.dateText}>{formatDateRange(race.startDate, race.endDate)}</Text>
        <Text style={styles.countryText}>{race.country}</Text>
      </View>

      <Text style={styles.startlistTitle}>Startlist</Text>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="warning-outline" size={40} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadStartlist}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : startlist.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="time-outline" size={40} color="#555555" />
          <Text style={styles.emptyText}>Startlist not yet published</Text>
        </View>
      ) : (
        <FlatList
          data={startlist}
          keyExtractor={(item, index) => `${item.teamName}-${index}`}
          renderItem={renderTeam}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#111111',
  },
  header: {
    backgroundColor: '#222222',
    padding: 16,
    borderLeftWidth: 4,
    margin: 10,
    borderRadius: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dateText: {
    color: '#BBBBBB',
    fontSize: 14,
    marginBottom: 4,
  },
  countryText: {
    color: '#888888',
    fontSize: 12,
  },
  startlistTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#333333',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  emptyText: {
    color: '#777777',
    fontSize: 16,
    marginTop: 10,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  teamContainer: {
    backgroundColor: '#222222',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  riderName: {
    color: '#CCCCCC',
    fontSize: 13,
    paddingVertical: 2,
    paddingLeft: 8,
  },
});

export default RaceDetailScreen;
