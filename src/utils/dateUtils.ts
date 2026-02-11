/**
 * Utility functions for Indian Standard Time (IST) formatting
 */

// IST is UTC+5:30
const IST_OFFSET = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds

/**
 * Convert UTC date to Indian Standard Time
 */
export const toIST = (date: Date | string): Date => {
  const utcDate = typeof date === 'string' ? new Date(date) : date;
  return new Date(utcDate.getTime() + IST_OFFSET);
};

/**
 * Format date in Indian Standard Time with various formats
 */
export const formatIST = {
  /**
   * Format date as "DD/MM/YYYY HH:mm:ss IST"
   */
  full: (date: Date | string): string => {
    const istDate = toIST(date);
    return istDate.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }) + ' IST';
  },

  /**
   * Format date as "DD/MM/YYYY HH:mm IST"
   */
  dateTime: (date: Date | string): string => {
    const istDate = toIST(date);
    return istDate.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }) + ' IST';
  },

  /**
   * Format date as "DD/MM/YYYY"
   */
  date: (date: Date | string): string => {
    const istDate = toIST(date);
    return istDate.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  },

  /**
   * Format time as "HH:mm IST"
   */
  time: (date: Date | string): string => {
    const istDate = toIST(date);
    return istDate.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }) + ' IST';
  },

  /**
   * Format date as relative time (e.g., "2 hours ago", "3 days ago")
   */
  relative: (date: Date | string): string => {
    const istDate = toIST(date);
    const now = new Date();
    const diffInMs = now.getTime() - istDate.getTime();
    
    const seconds = Math.floor(diffInMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
    return `${years} year${years > 1 ? 's' : ''} ago`;
  },

  /**
   * Format date for display in cards/tables (compact format)
   */
  compact: (date: Date | string): string => {
    const istDate = toIST(date);
    return istDate.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  },

  /**
   * Format date for order timestamps
   */
  orderTime: (date: Date | string): string => {
    const istDate = toIST(date);
    return istDate.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  },

  /**
   * Get current IST time
   */
  now: (): Date => {
    return toIST(new Date());
  },

  /**
   * Format date for notifications (shows relative time with IST)
   */
  notification: (date: Date | string): string => {
    const istDate = toIST(date);
    const relative = formatIST.relative(date);
    const exact = istDate.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `${relative} (${exact})`;
  }
};

/**
 * Get current IST timestamp as string
 */
export const getCurrentIST = (): string => {
  return formatIST.full(new Date());
};

/**
 * Check if a date is today in IST
 */
export const isTodayIST = (date: Date | string): boolean => {
  const istDate = toIST(date);
  const today = new Date();
  const todayIST = toIST(today);
  
  return istDate.toDateString() === todayIST.toDateString();
};

/**
 * Check if a date is yesterday in IST
 */
export const isYesterdayIST = (date: Date | string): boolean => {
  const istDate = toIST(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIST = toIST(yesterday);
  
  return istDate.toDateString() === yesterdayIST.toDateString();
};
