/**
 * Formats a time period in seconds to a human-readable string with appropriate units
 * Follows the format: "X days", "X hours", or "X min"
 * 
 * @param seconds - Time period in seconds
 * @returns Formatted string with appropriate time unit
 */
export function formatTimePeriod(seconds: number | string): string {
  if (!seconds) return "-";
  
  // Convert to number if it's a string
  const secondsNum = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
  
  if (isNaN(secondsNum)) return "-";
  
  if (secondsNum >= 86400) {
    // If >= 24 hours, show in days
    const days = Math.floor(secondsNum / 86400);
    return `${days} day${days !== 1 ? 's' : ''}`;
  } else if (secondsNum >= 3600) {
    // If >= 60 minutes, show in hours
    const hours = Math.floor(secondsNum / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else if (secondsNum >= 60) {
    // Show in minutes
    const minutes = Math.floor(secondsNum / 60);
    return `${minutes} min`;
  } else {
    // Less than a minute, show in seconds
    return `${secondsNum} sec`;
  }
} 