import { Race } from '../types';

export type CalendarStackParamList = {
  CalendarMain: undefined;
  RaceDetail: { race: Race };
};

export type FavoritesStackParamList = {
  FavoritesMain: undefined;
  RaceDetail: { race: Race };
};
