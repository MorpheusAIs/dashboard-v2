import { formatUnits } from "viem";

// --- Formatting Helpers ---

export function formatTimestamp(timestamp: bigint | number | undefined): string {
  if (timestamp === undefined || timestamp === null) {
    return "--- --, ----";
  }
  try {
    const tsNumber = Number(timestamp);

    if (isNaN(tsNumber)) {
        console.log("[formatTimestamp] Returning 'Invalid Number' due to NaN.");
        return "Invalid Number";
    }
    if (tsNumber === 0) {
        console.log("[formatTimestamp] Returning 'Never' due to zero.");
        return "Never";
    }

    // Explicitly check if it's likely a timestamp (seconds since epoch)
    // Assuming timestamps are generally > year 2000 (approx 946,684,800 seconds)
    if (tsNumber > 946684800) { 
        const date = new Date(tsNumber * 1000);
        if (isNaN(date.getTime())) {
            console.error("[formatTimestamp] Invalid Date object created from timestamp:", tsNumber);
            return "Invalid Date";
        }
        const formattedDate = date.toLocaleString('en-US', { 
            year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
        });
        return formattedDate;
    } else {
        // Treat as duration or unexpected small number
        // Heuristic check for duration vs timestamp
        const days = Math.floor(tsNumber / 86400);
        if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
        const hours = Math.floor(tsNumber / 3600);
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
        const minutes = Math.floor(tsNumber / 60);
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        return `${tsNumber} seconds`; // Handle very short durations
    }
  } catch (e) {
    console.error("[formatTimestamp] Error formatting timestamp/duration:", timestamp, e);
    return "Invalid Data";
  }
}

export function formatBigInt(value: bigint | undefined, decimals: number = 18, precision: number = 2): string {
  if (value === undefined) return "---";
  try {
    const formatted = formatUnits(value, decimals);
    const num = parseFloat(formatted);
    if (isNaN(num)) return "Error";
    // Format with commas and specified precision
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: precision, 
      maximumFractionDigits: precision 
    });
  } catch (e) {
    console.error("Error formatting bigint:", value, e);
    return "Error";
  }
}

// Add other formatters here if needed 