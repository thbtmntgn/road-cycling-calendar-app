import dayjs from 'dayjs';

// Generate an array of dates around the current date
export const getDateRange = (daysBackward: number = 2, daysForward: number = 7): string[] => {
  const dateRange: string[] = [];
  const today = dayjs();
  
  // Add past dates
  for (let i = daysBackward; i > 0; i--) {
    dateRange.push(today.subtract(i, 'day').format('YYYY-MM-DD'));
  }
  
  // Add today
  dateRange.push(today.format('YYYY-MM-DD'));
  
  // Add future dates
  for (let i = 1; i <= daysForward; i++) {
    dateRange.push(today.add(i, 'day').format('YYYY-MM-DD'));
  }
  
  return dateRange;
};

// Format date for display in the UI
export const formatDateForDisplay = (dateString: string): string => {
  const date = dayjs(dateString);
  const today = dayjs();
  const tomorrow = dayjs().add(1, 'day');
  const yesterday = dayjs().subtract(1, 'day');
  
  if (date.isSame(today, 'day')) {
    return 'Today';
  } else if (date.isSame(tomorrow, 'day')) {
    return 'Tomorrow';
  } else if (date.isSame(yesterday, 'day')) {
    return 'Yesterday';
  } else {
    return date.format('ddd DD MMM'); // e.g. "Fri 04 Apr"
  }
};

// Get today's date in YYYY-MM-DD format
export const getTodayDate = (): string => {
  return dayjs().format('YYYY-MM-DD');
};

// Format a date range for display
export const formatDateRange = (startDate: string, endDate: string): string => {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  
  if (start.isSame(end, 'day')) {
    return start.format('DD MMM YYYY'); // Single day event
  }
  
  if (start.isSame(end, 'month') && start.isSame(end, 'year')) {
    return `${start.format('DD')} - ${end.format('DD MMM YYYY')}`; // Same month
  }
  
  if (start.isSame(end, 'year')) {
    return `${start.format('DD MMM')} - ${end.format('DD MMM YYYY')}`; // Same year
  }
  
  return `${start.format('DD MMM YYYY')} - ${end.format('DD MMM YYYY')}`; // Different years
};