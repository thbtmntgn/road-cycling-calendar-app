import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getEnabledRaceFilterCount,
  isDefaultRaceFilterState,
  makeDefaultRaceFilterState,
  RACE_FILTER_DEFINITIONS,
  RaceFilterState,
} from '../constants/raceFilters';
import { RaceFilterGroup } from '../types';

interface Props {
  visible: boolean;
  savedFilters: RaceFilterState;
  onSave: (filters: RaceFilterState) => void;
  onClose: () => void;
}

interface FilterScreenBodyProps {
  local: RaceFilterState;
  toggle: (group: RaceFilterGroup) => void;
  onReset: () => void;
  onSave: (filters: RaceFilterState) => void;
  onClose: () => void;
}

const FilterScreenBody: React.FC<FilterScreenBodyProps> = ({
  local,
  toggle,
  onReset,
  onSave,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const enabledCount = getEnabledRaceFilterCount(local);
  const isDefault = isDefaultRaceFilterState(local);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle}>Race Levels</Text>
          <Text style={styles.headerSub}>Applied after gender filtering</Text>
        </View>
        <TouchableOpacity onPress={onReset} activeOpacity={0.7} disabled={isDefault}>
          <Text style={[styles.resetText, isDefault && styles.resetTextDisabled]}>
            Reset
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {RACE_FILTER_DEFINITIONS.map((definition, index) => {
          const enabled = local[definition.key];
          return (
            <TouchableOpacity
              key={definition.key}
              style={[
                styles.row,
                index < RACE_FILTER_DEFINITIONS.length - 1 && styles.rowDivider,
              ]}
              onPress={() => toggle(definition.key)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, enabled && styles.checkboxOn]}>
                {enabled && <MaterialCommunityIcons name="check" size={13} color="#000000" />}
              </View>
              <Text style={[styles.rowText, enabled && styles.rowTextOn]}>
                {definition.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>ACTIVE FILTERS</Text>
          <Text style={styles.statusValue}>
            {enabledCount} of {RACE_FILTER_DEFINITIONS.length} race levels enabled
          </Text>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={() => onSave(local)} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>SAVE PREFERENCES</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const FilterScreenModalBody: React.FC<Omit<Props, 'visible'>> = ({
  savedFilters,
  onSave,
  onClose,
}) => {
  const [local, setLocal] = useState<RaceFilterState>({ ...savedFilters });

  const toggle = (group: RaceFilterGroup) => {
    setLocal((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaProvider>
        <FilterScreenBody
          local={local}
          toggle={toggle}
          onReset={() => setLocal(makeDefaultRaceFilterState())}
          onSave={onSave}
          onClose={onClose}
        />
      </SafeAreaProvider>
    </Modal>
  );
};

const FilterScreen: React.FC<Props> = ({ visible, savedFilters, onSave, onClose }) =>
  visible ? (
    <FilterScreenModalBody savedFilters={savedFilters} onSave={onSave} onClose={onClose} />
  ) : null;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMid: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSub: {
    color: '#52525B',
    fontSize: 11,
    marginTop: 1,
  },
  resetText: {
    color: '#F5C842',
    fontSize: 12,
    fontWeight: '700',
  },
  resetTextDisabled: {
    color: '#3F3F46',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#141418',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2A2A31',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: '#F5C842',
    borderColor: '#F5C842',
  },
  rowText: {
    flex: 1,
    color: '#52525B',
    fontSize: 14,
    fontWeight: '400',
  },
  rowTextOn: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#141418',
    gap: 14,
  },
  statusCard: {
    backgroundColor: '#0F0F12',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#141418',
  },
  statusLabel: {
    color: '#F5C842',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statusValue: {
    color: '#D4D4D8',
    fontSize: 12,
  },
  saveBtn: {
    padding: 14,
    backgroundColor: '#F5C842',
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});

export default FilterScreen;
