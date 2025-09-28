export type DataPoint = {
    date: string;
    deposits: number;
};

export type CumulativeDepositsDataPoint = {
    date: string;
    deposits: number;
};

/**
 * Calculate optimal X-axis ticks to prevent label overlap
 * @param data - Chart data points
 * @param maxWidth - Available chart width in pixels
 * @param maxTicks - Maximum number of ticks to show (default: 8)
 * @returns Array of date strings representing optimal tick positions
 */
export function calculateOptimalTicks(
    data: (DataPoint | CumulativeDepositsDataPoint)[],
    maxWidth: number = 800,
    maxTicks: number = 8
): string[] {
    if (!data || data.length === 0) return [];
    if (data.length === 1) return [data[0].date];

    const minSpacing = 80; // minimum pixels between labels

    // Calculate how many ticks can fit
    const maxTicksByWidth = Math.max(2, Math.floor(maxWidth / minSpacing));
    const optimalTickCount = Math.min(maxTicks, maxTicksByWidth, data.length);

    if (optimalTickCount <= 2) {
        // Just show first and last points
        return [data[0].date, data[data.length - 1].date];
    }

    const ticks: string[] = [];
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Always include first and last points
    ticks.push(sortedData[0].date);
    ticks.push(sortedData[sortedData.length - 1].date);

    if (optimalTickCount <= 2) {
        return ticks;
    }

    // Calculate spacing for intermediate ticks
    // Use optimalTickCount - 2 to account for first and last points
    const availableSlots = optimalTickCount - 2;
    const totalRange = sortedData.length - 1;

    for (let i = 1; i <= availableSlots; i++) {
        // Calculate position more precisely to avoid clustering at the end
        const ratio = i / (availableSlots + 1);
        const index = Math.floor(ratio * totalRange) + 1; // +1 to avoid the first point
        const safeIndex = Math.min(index, sortedData.length - 2); // Ensure we don't go beyond second-to-last
        ticks.push(sortedData[safeIndex].date);
    }

    // Remove duplicates and sort
    return [...new Set(ticks)].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}
