import { Race } from '../types';

export type CalendarStackParamList = {
  Calendar: undefined;
  RaceDetail: { race: Race; selectedDate?: string; initialTab?: 'results' | 'classification' };
};
