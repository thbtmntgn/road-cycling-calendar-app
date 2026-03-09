import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Gender, RaceCategory } from '../types';

export type GenderKey = 'men' | 'women';

export interface FilterCatDef {
  label: string;
  category: RaceCategory;
}

export const FILTER_CATS: Record<GenderKey, FilterCatDef[]> = {
  men: [
    { label: 'UCI WorldTour', category: RaceCategory.WorldTour },
    { label: 'UCI ProSeries', category: RaceCategory.ProSeries },
    { label: 'UCI World Championships', category: RaceCategory.WorldChampionship },
    { label: 'National Championship', category: RaceCategory.NationalChampionship },
    { label: 'Junior', category: RaceCategory.JuniorMen },
    { label: 'Continental', category: RaceCategory.Continental },
  ],
  women: [
    { label: "UCI Women's WorldTour", category: RaceCategory.WomenWorldTour },
    { label: 'UCI ProSeries', category: RaceCategory.WomenProSeries },
    { label: 'UCI World Championships', category: RaceCategory.WomenWorldChampionship },
    { label: 'National Championship', category: RaceCategory.WomenNationalChampionship },
    { label: 'Junior', category: RaceCategory.JuniorWomen },
    { label: 'Continental', category: RaceCategory.Continental },
  ],
};

export type CategoryFilter = { men: Set<string>; women: Set<string> };

export const makeDefaultFilter = (): CategoryFilter => ({
  men: new Set(FILTER_CATS.men.map((c) => c.label)),
  women: new Set(FILTER_CATS.women.map((c) => c.label)),
});

interface Props {
  visible: boolean;
  activeGender: Gender;
  savedFilters: CategoryFilter;
  onSave: (filters: CategoryFilter) => void;
  onClose: () => void;
}

const FilterScreen: React.FC<Props> = ({ visible, activeGender, savedFilters, onSave, onClose }) => {
  const [tab, setTab] = useState<GenderKey>(activeGender === Gender.Men ? 'men' : 'women');
  const [local, setLocal] = useState<CategoryFilter>({
    men: new Set(savedFilters.men),
    women: new Set(savedFilters.women),
  });

  // Reset local state each time the modal opens
  useEffect(() => {
    if (visible) {
      setTab(activeGender === Gender.Men ? 'men' : 'women');
      setLocal({ men: new Set(savedFilters.men), women: new Set(savedFilters.women) });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (label: string) => {
    setLocal((prev) => {
      const s = new Set(prev[tab]);
      s.has(label) ? s.delete(label) : s.add(label);
      return { ...prev, [tab]: s };
    });
  };

  const toggleAll = () => {
    const cats = FILTER_CATS[tab];
    const allOn = local[tab].size === cats.length;
    setLocal((prev) => ({
      ...prev,
      [tab]: allOn ? new Set() : new Set(cats.map((c) => c.label)),
    }));
  };

  const cats = FILTER_CATS[tab];
  const allOn = local[tab].size === cats.length;
  const menChanged = local.men.size !== FILTER_CATS.men.length;
  const womenChanged = local.women.size !== FILTER_CATS.women.length;
  const canSave = local.men.size > 0 && local.women.size > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.7}>
            <MaterialCommunityIcons name="arrow-left" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerMid}>
            <Text style={styles.headerTitle}>Race Categories</Text>
            <Text style={styles.headerSub}>Your personal feed preferences</Text>
          </View>
          <TouchableOpacity onPress={toggleAll} activeOpacity={0.7}>
            <Text style={styles.toggleAllText}>{allOn ? 'Clear all' : 'Select all'}</Text>
          </TouchableOpacity>
        </View>

        {/* Gender tabs */}
        <View style={styles.tabs}>
          {(['men', 'women'] as GenderKey[]).map((g) => {
            const isActive = tab === g;
            const changed = g === 'men' ? menChanged : womenChanged;
            return (
              <TouchableOpacity
                key={g}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setTab(g)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {g === 'men' ? '♂ Men' : '♀ Women'}
                </Text>
                {changed && (
                  <View
                    style={[
                      styles.tabDot,
                      { backgroundColor: g === 'men' ? '#5B9CF6' : '#F472B6' },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Category list */}
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {cats.map((c, i) => {
            const on = local[tab].has(c.label);
            return (
              <TouchableOpacity
                key={`${tab}-${c.label}`}
                style={[styles.row, i < cats.length - 1 && styles.rowDivider]}
                onPress={() => toggle(c.label)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, on && styles.checkboxOn]}>
                  {on && (
                    <MaterialCommunityIcons name="check" size={13} color="#000000" />
                  )}
                </View>
                <Text style={[styles.rowText, on && styles.rowTextOn]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.statusRow}>
            {(['men', 'women'] as GenderKey[]).map((g) => (
              <View
                key={g}
                style={[styles.statusCard, tab === g && styles.statusCardActive]}
              >
                <Text style={[styles.statusLabel, { color: g === 'men' ? '#5B9CF6' : '#F472B6' }]}>
                  {g === 'men' ? '♂ MEN' : '♀ WOMEN'}
                </Text>
                <Text style={[styles.statusValue, local[g].size === 0 && styles.statusValueNone]}>
                  {local[g].size === FILTER_CATS[g].length
                    ? 'All categories'
                    : local[g].size === 0
                    ? 'None selected'
                    : `${local[g].size} of ${FILTER_CATS[g].length}`}
                </Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={() => canSave && onSave(local)}
            activeOpacity={canSave ? 0.85 : 1}
          >
            <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>
              SAVE PREFERENCES
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

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
  toggleAllText: {
    color: '#F5C842',
    fontSize: 12,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#141418',
    borderRadius: 12,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#1D1D22',
  },
  tabText: {
    color: '#52525B',
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statusCard: {
    flex: 1,
    backgroundColor: '#0F0F12',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#141418',
  },
  statusCardActive: {
    borderColor: '#1D1D22',
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statusValue: {
    color: '#71717A',
    fontSize: 11,
  },
  statusValueNone: {
    color: '#EF4444',
  },
  saveBtn: {
    padding: 14,
    backgroundColor: '#F5C842',
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#1D1D22',
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  saveBtnTextDisabled: {
    color: '#3F3F46',
  },
});

export default FilterScreen;
