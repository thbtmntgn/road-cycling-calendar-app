import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { formatDateForDisplay } from '../utils/dateUtils';

interface DateSelectorProps {
  dates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const { width } = Dimensions.get('window');
const DATE_ITEM_WIDTH = width / 4; // Show approximately 4 dates at once

const DateSelector: React.FC<DateSelectorProps> = ({ 
  dates, 
  selectedDate, 
  onSelectDate 
}) => {
  // Reference to scroll view for programmatic scrolling
  const scrollViewRef = React.useRef<ScrollView>(null);
  
  // Scroll to selected date when component mounts or selected date changes
  React.useEffect(() => {
    const selectedIndex = dates.indexOf(selectedDate);
    if (selectedIndex !== -1 && scrollViewRef.current) {
      // Calculate scroll position to center the selected date
      scrollViewRef.current.scrollTo({
        x: (selectedIndex * DATE_ITEM_WIDTH) - (width / 2) + (DATE_ITEM_WIDTH / 2),
        animated: true
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
            style={[
              styles.dateItem,
              date === selectedDate && styles.selectedDateItem
            ]}
            onPress={() => onSelectDate(date)}
          >
            <Text
              style={[
                styles.dateText,
                date === selectedDate && styles.selectedDateText
              ]}
            >
              {formatDateForDisplay(date)}
            </Text>
            {date === selectedDate && <View style={styles.indicator} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111111',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  scrollContent: {
    paddingVertical: 10,
  },
  dateItem: {
    width: DATE_ITEM_WIDTH,
    paddingVertical: 8,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDateItem: {
    // Selected date styling
  },
  dateText: {
    color: '#888888',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedDateText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  indicator: {
    position: 'absolute',
    bottom: -2,
    width: 24,
    height: 3,
    backgroundColor: '#4CAF50', // Green underline similar to Fotmob
    borderRadius: 1.5,
  },
});

export default DateSelector;