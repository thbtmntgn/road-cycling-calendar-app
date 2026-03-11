import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import dayjs from 'dayjs';
import { formatDateForDisplay } from '../utils/dateUtils';

const getRelativeDateSub = (dateString: string): string | null => {
  const date = dayjs(dateString);
  const today = dayjs();
  if (
    date.isSame(today, 'day') ||
    date.isSame(today.add(1, 'day'), 'day') ||
    date.isSame(today.subtract(1, 'day'), 'day')
  ) {
    return date.format('D MMM');
  }
  return null;
};

interface DateSelectorProps {
  dates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const { width } = Dimensions.get('window');
const DATE_ITEM_WIDTH = Math.max(96, Math.floor(width / 4));
const DATE_ITEM_GAP = 10;
const DATE_TRACK_PADDING = Math.max(16, width / 2 - DATE_ITEM_WIDTH / 2);
const DATE_ITEM_STRIDE = DATE_ITEM_WIDTH + DATE_ITEM_GAP;

const DateSelector: React.FC<DateSelectorProps> = ({ dates, selectedDate, onSelectDate }) => {
  const scrollViewRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    const selectedIndex = dates.indexOf(selectedDate);
    if (selectedIndex !== -1 && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: selectedIndex * DATE_ITEM_STRIDE,
        animated: true,
      });
    }
  }, [selectedDate, dates]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {dates.map((date) => (
          <TouchableOpacity
            key={date}
            style={[styles.dateItem, date === selectedDate && styles.selectedDateItem]}
            onPress={() => onSelectDate(date)}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.dateText, date === selectedDate && styles.selectedDateText]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {formatDateForDisplay(date)}
            </Text>
            {getRelativeDateSub(date) !== null && (
              <Text
                style={[styles.dateSubText, date === selectedDate && styles.selectedDateSubText]}
                numberOfLines={1}
              >
                {getRelativeDateSub(date)}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: DATE_TRACK_PADDING,
    paddingVertical: 4,
    gap: DATE_ITEM_GAP,
  },
  dateItem: {
    width: DATE_ITEM_WIDTH,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#141418',
    borderColor: '#1F1F24',
  },
  selectedDateItem: {
    backgroundColor: '#F3F4F6',
    borderColor: '#F3F4F6',
  },
  dateText: {
    color: '#8D95A3',
    fontSize: 13,
    fontWeight: '600',
  },
  selectedDateText: {
    color: '#0A0A0C',
    fontWeight: '700',
  },
  dateSubText: {
    color: '#5A6370',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  selectedDateSubText: {
    color: '#4A5058',
  },
});

export default DateSelector;
