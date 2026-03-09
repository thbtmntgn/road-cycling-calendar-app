import { Race, RaceFilterGroup, UciClass } from '../types';

export interface RaceFilterDefinition {
  key: RaceFilterGroup;
  label: string;
  defaultEnabled: boolean;
}

export type RaceFilterState = Record<RaceFilterGroup, boolean>;

export const RACE_FILTER_DEFINITIONS: RaceFilterDefinition[] = [
  {
    key: RaceFilterGroup.WorldTour,
    label: 'WorldTour',
    defaultEnabled: true,
  },
  {
    key: RaceFilterGroup.SpecialEvent,
    label: 'Special Events',
    defaultEnabled: true,
  },
  {
    key: RaceFilterGroup.ProSeries,
    label: 'ProSeries',
    defaultEnabled: true,
  },
  {
    key: RaceFilterGroup.ContinentalClass1,
    label: 'Continental – Class 1',
    defaultEnabled: true,
  },
  {
    key: RaceFilterGroup.ContinentalClass2,
    label: 'Continental – Class 2',
    defaultEnabled: false,
  },
  {
    key: RaceFilterGroup.NationalChampionship,
    label: 'National Championships',
    defaultEnabled: true,
  },
];

const UCI_CLASS_TO_FILTER_GROUP: Record<UciClass, RaceFilterGroup> = {
  '1.UWT': RaceFilterGroup.WorldTour,
  '2.UWT': RaceFilterGroup.WorldTour,
  '1.WWT': RaceFilterGroup.WorldTour,
  '2.WWT': RaceFilterGroup.WorldTour,
  '1.Pro': RaceFilterGroup.ProSeries,
  '2.Pro': RaceFilterGroup.ProSeries,
  '1.PRO': RaceFilterGroup.ProSeries,
  '2.PRO': RaceFilterGroup.ProSeries,
  '1.1': RaceFilterGroup.ContinentalClass1,
  '2.1': RaceFilterGroup.ContinentalClass1,
  '1.2': RaceFilterGroup.ContinentalClass2,
  '2.2': RaceFilterGroup.ContinentalClass2,
  WC: RaceFilterGroup.SpecialEvent,
  OG: RaceFilterGroup.SpecialEvent,
  CC: RaceFilterGroup.SpecialEvent,
  NC: RaceFilterGroup.NationalChampionship,
};

export const makeDefaultRaceFilterState = (): RaceFilterState =>
  RACE_FILTER_DEFINITIONS.reduce(
    (filters, definition) => ({
      ...filters,
      [definition.key]: definition.defaultEnabled,
    }),
    {} as RaceFilterState
  );

export const isDefaultRaceFilterState = (filters: RaceFilterState): boolean =>
  RACE_FILTER_DEFINITIONS.every(
    (definition) => filters[definition.key] === definition.defaultEnabled
  );

export const getEnabledRaceFilterCount = (filters: RaceFilterState): number =>
  RACE_FILTER_DEFINITIONS.filter((definition) => filters[definition.key]).length;

export const getRaceFilterGroupFromUciClass = (uciClass: string | undefined | null) =>
  uciClass ? UCI_CLASS_TO_FILTER_GROUP[uciClass as UciClass] ?? null : null;

export const isRaceVisibleForFilterState = (
  race: Pick<Race, 'filterGroup'>,
  filters: RaceFilterState
): boolean => filters[race.filterGroup] ?? false;
