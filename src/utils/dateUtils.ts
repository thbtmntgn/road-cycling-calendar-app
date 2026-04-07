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

// Format date with relative prefix for headers — e.g. "Today, Wed 11 Mar" / "Fri 4 Apr"
export const formatDateWithRelativeLabel = (dateString: string): string => {
  const date = dayjs(dateString);
  const today = dayjs();
  const formatted = date.format('ddd D MMM');
  if (date.isSame(today, 'day')) return `Today, ${formatted}`;
  if (date.isSame(today.add(1, 'day'), 'day')) return `Tomorrow, ${formatted}`;
  if (date.isSame(today.subtract(1, 'day'), 'day')) return `Yesterday, ${formatted}`;
  return formatted;
};

// Convert a PCS startTime string to the device's local timezone.
// PCS format: "HH:MM" (local race time, no conversion possible) or
//             "HH:MM  (HH:MM CET)" (CET = UTC+1; convert to device TZ).
// Returns the local-time string "HH:MM", or the original if no CET annotation.
export const convertStartTimeToLocal = (startTime: string, date: string): string => {
  const cetMatch = startTime.match(/\((\d{2}):(\d{2})\s*CET\)/);
  if (!cetMatch) return startTime.trim();
  const cetHours = parseInt(cetMatch[1], 10);
  const cetMinutes = parseInt(cetMatch[2], 10);
  const [year, month, day] = date.split('-').map(Number);
  // CET = UTC+1, so subtract 1 hour to get UTC
  const utcDate = new Date(Date.UTC(year, month - 1, day, cetHours - 1, cetMinutes));
  const localHours = utcDate.getHours().toString().padStart(2, '0');
  const localMinutes = utcDate.getMinutes().toString().padStart(2, '0');
  return `${localHours}:${localMinutes}`;
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