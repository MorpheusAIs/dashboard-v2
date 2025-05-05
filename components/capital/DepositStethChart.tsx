'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Area, CartesianGrid, XAxis, YAxis, ComposedChart, ReferenceArea, ResponsiveContainer } from "recharts"
import {
    Card,
    CardContent,
} from "@/components/ui/card"
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent
} from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { NetworkEnvironment } from "@/config/networks"

// Interface for chart data points
export type DataPoint = {
    date: string;
    deposits: number; // Renamed from 'events'
};

// Props for the chart component
type DepositStethChartProps = {
    data?: DataPoint[];
    networkEnv?: NetworkEnvironment; // <-- Add networkEnv prop
};

// Chart configuration
const chartConfig = {
    // deposits: {
    //     // label: "Deposits",
    //     // color: "hsl(var(--chart-1))", // Keep the color for now
    // },
} satisfies ChartConfig

// --- Data Simulation (Adapted from example) ---
const seedRandom = (seed: number) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
};

// Function to simulate deposit data
export function simulateDepositData(start = '2024-01-01T00:00:00Z', end = '2024-07-24T00:00:00Z'): DataPoint[] {
    const simulatedData = [];
    let baseValue = 5000; // Starting deposit value
    const startTimeMs = new Date(start).getTime();
    const endTimeMs = new Date(end).getTime();
    const durationMs = endTimeMs - startTimeMs;

    // Simulate data points (e.g., every 6 hours)
    for (let currentDate = new Date(start); currentDate <= new Date(end); currentDate.setTime(currentDate.getTime() + 6 * 3600 * 1000)) {
        const seed = currentDate.getTime();
        const timeRatio = (currentDate.getTime() - startTimeMs) / durationMs;

        // Simulate some growth and volatility
        baseValue = Math.max(
            (baseValue +
                timeRatio * 20000 + // General upward trend
                (seedRandom(seed) - 0.5) * 2000 + // Daily noise
                (seedRandom(seed + 1) < 0.05 ? (seedRandom(seed + 2) - 0.5) * 5000 : 0) + // Occasional spikes/dips
                Math.sin(currentDate.getTime() / (3600000 * 24 * 7)) * 1000) * // Weekly seasonality
            (1 + (seedRandom(seed + 3) - 0.5) * 0.1), // Small percentage fluctuations
            1000 // Minimum deposit floor
        );
        
        simulatedData.push({
            date: currentDate.toISOString(),
            deposits: Math.max(Math.floor(baseValue), 1) // Renamed from 'events'
        });
    }
    // Ensure there's at least one data point if the loop didn't run
    if (simulatedData.length === 0) {
       simulatedData.push({ date: start, deposits: baseValue });
    }
    return simulatedData;
}
// --- End Data Simulation ---

// --- Helper Function for Monthly Ticks ---
const getMonthlyTicks = (data: DataPoint[]): string[] => {
    if (!data || data.length === 0) return [];

    const ticks: string[] = [];
    const seenMonths = new Set<string>(); // Format: YYYY-MM

    // Ensure data is sorted by date
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedData.forEach(point => {
        try {
            const date = new Date(point.date);
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth(); // 0-indexed
            const monthKey = `${year}-${month}`;

            // Add a tick for the first data point of each new month
            if (!seenMonths.has(monthKey)) {
                seenMonths.add(monthKey);
                // Use the actual date of the first point in that month as the tick value
                ticks.push(point.date); 
            }
        } catch (e) {
            console.error("Error processing date for monthly tick:", point.date, e);
        }
    });
    
    // Ensure the very first and last points are included as ticks if not already
    // This might duplicate the first month's tick if data starts mid-month, which is often fine.
    if (sortedData.length > 0) {
        if (ticks.length === 0 || ticks[0] !== sortedData[0].date) {
             // TBD: Decide if prepending first point is always desired
             // ticks.unshift(sortedData[0].date);
        }
        const lastPointDate = sortedData[sortedData.length - 1].date;
        if (ticks.length === 0 || ticks[ticks.length - 1] !== lastPointDate) {
             // Ensure last point is visually represented, maybe not as a tick label if too close?
             // TBD: Decide if appending last point is always desired
             // ticks.push(lastPointDate);
        }
    }


    return ticks;
};

// The Chart Component
export function DepositStethChart({ 
    data: initialData, 
    networkEnv // <-- Destructure networkEnv
}: DepositStethChartProps) {
    const [data, setData] = useState<DataPoint[]>(initialData || []);
    const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
    const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<string | null>(null);
    const [endTime, setEndTime] = useState<string | null>(null);
    const [originalData, setOriginalData] = useState<DataPoint[]>(initialData || []);
    const [isSelecting, setIsSelecting] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null); // Ref for the direct parent div
    const [chartHeight, setChartHeight] = useState(410); // Default height
    const [selectedRange, setSelectedRange] = useState<'7d' | '1m' | '3m' | 'max'>('1m'); // Set default to '1m'
    const [isSimulating, setIsSimulating] = useState(false); // State for simulation

    // Threshold for switching height (adjust as needed)
    const SIDEBAR_COLLAPSE_WIDTH_THRESHOLD = 800;

    useEffect(() => {
        if (initialData?.length) {
            const sortedData = [...initialData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setData(sortedData);
            setOriginalData(sortedData);
            setStartTime(sortedData[0].date);
            setEndTime(sortedData[sortedData.length - 1].date);
        }
    }, [initialData]);

    const zoomedData = useMemo(() => {
        if (!startTime || !endTime || !originalData.length) {
            // Return the full dataset if no zoom is active or original data is missing
            return data.length > 1 ? data : (originalData.length > 1 ? originalData.slice(0, 2) : []); 
        }
    
        // Ensure startTime and endTime are valid date strings
        const startMs = new Date(startTime).getTime();
        const endMs = new Date(endTime).getTime();
        if (isNaN(startMs) || isNaN(endMs)) {
             return data.length > 1 ? data : (originalData.length > 1 ? originalData.slice(0, 2) : []);
        }

        const dataPointsInRange = originalData.filter(
            (dataPoint) => {
                 const pointMs = new Date(dataPoint.date).getTime();
                 return pointMs >= startMs && pointMs <= endMs;
            }
        );

        // Ensure we have at least two data points for the chart
        if (dataPointsInRange.length <= 1) {
             // Try to find the closest points in original data if the range is too narrow
             const startIndex = originalData.findIndex(p => p.date >= startTime);
             if (startIndex !== -1 && originalData.length > 1) {
                 return originalData.slice(startIndex, Math.min(startIndex + 2, originalData.length));
             }
             // Fallback to first two points of original data
             return originalData.slice(0, 2);
        }

        return dataPointsInRange;
    }, [startTime, endTime, originalData, data]);

    // Calculate explicit monthly ticks based on the *original* full dataset
    const monthlyTicks = useMemo(() => getMonthlyTicks(originalData), [originalData]);

    const handleMouseDown = (e: { activeLabel?: string }) => {
        // Ensure interaction happens within the chart plot area
        if (e.activeLabel && chartRef.current) { 
            console.log("handleMouseDown - setting refAreaLeft:", e.activeLabel);
            setRefAreaLeft(e.activeLabel);
            setIsSelecting(true);
        }
    };

    const handleMouseMove = (e: { activeLabel?: string }) => {
        if (isSelecting && e.activeLabel && chartRef.current) {
             // Check boundaries if needed, but generally recharts handles this
             console.log("handleMouseMove - setting refAreaRight:", e.activeLabel);
            setRefAreaRight(e.activeLabel);
        }
    };

    const handleMouseUp = () => {
        setIsSelecting(false); // Always stop selecting on mouse up
        if (refAreaLeft && refAreaRight) {
            const start = new Date(refAreaLeft).getTime();
            const end = new Date(refAreaRight).getTime();

            // Ensure we have a valid range (at least a small interval)
            if (Math.abs(end - start) > 1000) { // e.g., require at least 1 second difference
                 const [left, right] = [refAreaLeft, refAreaRight].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                 setStartTime(left);
                 setEndTime(right);
            } else {
                 // If range is too small, maybe reset or do nothing
                 console.warn("Selected zoom range is too small.");
            }
        }
        // Reset selection area irrespective of whether zoom was applied
        setRefAreaLeft(null);
        setRefAreaRight(null);
    };

    const handleReset = () => {
        // Remove direct setting of startTime and endTime
        // if (originalData.length > 0) {
        //     setStartTime(originalData[0].date);
        //     setEndTime(originalData[originalData.length - 1].date);
        // } else {
        //     setStartTime(null);
        //     setEndTime(null);
        // }
         // Ensure selection refs are cleared on reset
        setRefAreaLeft(null);
        setRefAreaRight(null);
        setIsSelecting(false);
        setSelectedRange('1m'); // Set selected range back to default ('1m')
    };

    // Effect to update startTime and endTime based on selectedRange and originalData
    useEffect(() => {
        if (!originalData || originalData.length === 0) return;

        const lastDataPoint = originalData[originalData.length - 1];
        const endDate = new Date(lastDataPoint.date);
        let startDate = new Date(originalData[0].date);

        if (selectedRange === '7d') {
            startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 7);
        } else if (selectedRange === '1m') {
            startDate = new Date(endDate);
            startDate.setMonth(endDate.getMonth() - 1);
        } else if (selectedRange === '3m') {
            startDate = new Date(endDate);
            startDate.setMonth(endDate.getMonth() - 3);
        } 
        // For 'max', startDate is already set to the beginning of originalData

        // Ensure calculated startDate isn't before the actual start of data
        const firstDataPointDate = new Date(originalData[0].date);
        if (startDate < firstDataPointDate) {
            startDate = firstDataPointDate;
        }

        setStartTime(startDate.toISOString());
        setEndTime(endDate.toISOString());

    }, [selectedRange, originalData]);

    // Basic Wheel Zoom (adjust factor and logic as needed)
    // Moved the core logic into a useCallback for stable reference in useEffect
    const handleWheelZoomLogic = useCallback((e: WheelEvent) => {
        if (!originalData.length || !chartRef.current || !startTime || !endTime) return;

        // Prevent default page scroll
        e.preventDefault();

        const zoomFactor = 0.1; // How much to zoom in/out per wheel step
        const direction = e.deltaY < 0 ? 1 : -1; // 1 for zoom in, -1 for zoom out

        const currentStartTime = new Date(startTime).getTime();
        const currentEndTime = new Date(endTime).getTime();
        const currentRange = currentEndTime - currentStartTime;

        // Prevent zooming in too far (e.g., less than 1 minute range)
        if (direction === 1 && currentRange < 60 * 1000) {
            console.log("Zoom limit reached (min)");
            return;
        }
        // Prevent zooming out beyond original data range (optional, handleReset covers this)
        const originalRange = new Date(originalData[originalData.length-1].date).getTime() - new Date(originalData[0].date).getTime();
         if (direction === -1 && currentRange >= originalRange ) {
             console.log("Zoom limit reached (max), resetting.");
             handleReset();
             return;
         }

        const zoomAmount = currentRange * zoomFactor * direction;
    
        // Determine zoom focus point based on mouse position
        const chartRect = chartRef.current.getBoundingClientRect();
        // Ensure clientX is relative to the chart container for accuracy
        const mouseXRelative = e.clientX - chartRect.left; 
        const chartWidth = chartRect.width;
        // Clamp mousePercentage between 0 and 1 to avoid issues at edges
        const mousePercentage = Math.max(0, Math.min(1, mouseXRelative / chartWidth)); 
    
        // Calculate new start and end times based on focus point
        let newStartTimeMs = currentStartTime + zoomAmount * mousePercentage;
        let newEndTimeMs = currentEndTime - zoomAmount * (1 - mousePercentage);

        // Clamp new times within original data boundaries
        const originalStartMs = new Date(originalData[0].date).getTime();
        const originalEndMs = new Date(originalData[originalData.length - 1].date).getTime();
        newStartTimeMs = Math.max(originalStartMs, newStartTimeMs);
        newEndTimeMs = Math.min(originalEndMs, newEndTimeMs);

        // Ensure new end time is after new start time
        if (newEndTimeMs <= newStartTimeMs) {
            // If range collapses, reset or adjust slightly
             console.warn("Zoom range collapsed, potentially resetting.");
            // Option: Reset zoom
             // handleReset(); 
             // Option: Prevent collapse (might feel jerky) - adjust one boundary slightly
             if (direction === 1) newEndTimeMs = newStartTimeMs + 60000; // Keep 1 min range on zoom in
             else newStartTimeMs = newEndTimeMs - 60000; // Keep 1 min range on zoom out
             
             // Re-clamp after adjustment
             newStartTimeMs = Math.max(originalStartMs, newStartTimeMs);
             newEndTimeMs = Math.min(originalEndMs, newEndTimeMs);
             if (newEndTimeMs <= newStartTimeMs) { // Still collapsed? Reset.
                 handleReset();
                 return;
             }

        }

        setStartTime(new Date(newStartTimeMs).toISOString());
        setEndTime(new Date(newEndTimeMs).toISOString());
    }, [originalData, startTime, endTime, handleReset]); // Added handleReset dependency

    // Effect to manually attach the wheel listener with passive: false
    useEffect(() => {
        const chartElement = chartRef.current;
        if (!chartElement) return;

        // Type assertion for listener compatibility
        const listener = handleWheelZoomLogic as EventListener;

        chartElement.addEventListener('wheel', listener, { passive: false });

        // Cleanup function to remove the listener
        return () => {
            chartElement.removeEventListener('wheel', listener);
        };
    }, [handleWheelZoomLogic]); // Re-attach if the logic function changes

    // Effect to observe parent container width and set chart height
    useEffect(() => {
        const containerElement = containerRef.current;
        if (!containerElement) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                // Set height based on width threshold
                setChartHeight(width < SIDEBAR_COLLAPSE_WIDTH_THRESHOLD ? 460 : 410);
            }
        });

        resizeObserver.observe(containerElement);

        // Initial check
        const initialWidth = containerElement.getBoundingClientRect().width;
        setChartHeight(initialWidth < SIDEBAR_COLLAPSE_WIDTH_THRESHOLD ? 450 : 410);

        return () => {
            resizeObserver.disconnect();
        };
    }, []); // Empty dependency array to run only once for setup/cleanup

    // Effect to generate simulated data on testnet
    useEffect(() => {
        if (networkEnv === 'testnet') {
            console.log("Detected testnet, generating simulated chart data.");
            setIsSimulating(true);
            const simulated = simulateDepositData(); // Generate data
            setData(simulated); // Set chart data state
            setOriginalData(simulated); // Set original data state
            setIsSimulating(false);
            // Ensure loading/error states are reset for testnet
            // We might not need the parent component's chartLoading/chartError here
            // setChartLoading(false); // Assuming parent handles this based on skipped query
            // setChartError(null);
        } else {
            // Reset data if switching back from testnet to mainnet (will be repopulated by prop)
            setData(initialData || []);
            setOriginalData(initialData || []);
        }
    }, [networkEnv, initialData]); // Rerun if networkEnv changes or initialData changes (for mainnet)

    const formatXAxis = (tickItem: string) => {
        try {
            const date = new Date(tickItem);
            if (isNaN(date.getTime())) { 
                console.log("formatXAxis: Invalid date");
                return tickItem; 
            }

            // Determine date range of the *currently visible* data (zoomedData)
            let rangeMs = Infinity;
            if (zoomedData && zoomedData.length >= 2) {
                const firstDate = new Date(zoomedData[0].date).getTime();
                const lastDate = new Date(zoomedData[zoomedData.length - 1].date).getTime();
                if (!isNaN(firstDate) && !isNaN(lastDate)) {
                     rangeMs = Math.abs(lastDate - firstDate);
                }
            }
             // Fallback to full range if zoomed data is insufficient
             else if (startTime && endTime) {
                 const startMs = new Date(startTime).getTime();
                 const endMs = new Date(endTime).getTime();
                 if (!isNaN(startMs) && !isNaN(endMs)) {
                      rangeMs = Math.abs(endMs - startMs);
                 }
             }

            const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
           
            let formattedTick: string;
            if (rangeMs > sixtyDaysMs) { 
                formattedTick = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            } else {
                formattedTick = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            }
            return formattedTick;
        } catch (e) {
             console.error("Error formatting X axis tick:", tickItem, e);
             return tickItem; 
        }
    };
    
    const formatYAxis = (value: number) => {
        if (typeof value !== 'number' || isNaN(value)) return '0'; // Handle non-numeric input
        if (value >= 1_000_000) {
            // Use toFixed(1) for millions if value is not a whole million
            const formatted = (value / 1_000_000);
            return `${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)}M`;
        }
        if (value >= 1_000) {
             // Show whole numbers for thousands
            return `${(value / 1_000).toFixed(0)}k`;
        }
        // Show numbers below 1000 as is
        return value.toFixed(0); 
    };

    // Determine if reset button should be enabled
     const isZoomed = useMemo(() => {
         if (!originalData.length || !startTime || !endTime) return false;
         // Also consider range selection for reset enablement
         if (selectedRange !== 'max') return true; 
         return startTime !== originalData[0].date || endTime !== originalData[originalData.length - 1].date;
     }, [startTime, endTime, originalData, selectedRange]);

    return (
        // Remove fixed height from Card, allow flex parent to control height
        <Card className="w-full h-full bg-transparent border-none shadow-none p-0"> 
            <CardContent className="p-2 sm:p-4 h-full"> 
                <ChartContainer
                    config={chartConfig}
                    className="w-full h-full"
                >
                     {/* Use flex-col on wrapper to make inner div grow */}
                    <div 
                        className="h-full flex flex-col" 
                        ref={chartRef} 
                        style={{ touchAction: 'pan-y' }} 
                    >
                         {/* Container for Title and Reset Button */}
                         <div className="absolute top-2 left-0 right-0 z-10 px-1 sm:px-0 flex justify-between items-center">
                            {/* Title */}
                            <h3 className="text-lg font-semibold text-white ml-4">Total stETH Deposits</h3>{/* Added ml-4 for spacing*/}
                            {/* Controls Container (Toggle Group + Reset Button) */}
                            <div className="flex items-center space-x-2 mr-2 sm:mr-4"> {/* Added container and spacing */} 
                                {/* Toggle Group */} 
                                <ToggleGroup 
                                    type="single"
                                    value={selectedRange}
                                    onValueChange={(value: '7d' | '1m' | '3m' | 'max') => {
                                        if (value) setSelectedRange(value); // Only set if a value is selected
                                    }}
                                >
                                    <ToggleGroupItem value="7d" className="text-xs px-2" aria-label="7 days">7d</ToggleGroupItem>
                                    <ToggleGroupItem value="1m" className="text-xs px-2" aria-label="1 month">1m</ToggleGroupItem>
                                    <ToggleGroupItem value="3m" className="text-xs px-2" aria-label="3 months">3m</ToggleGroupItem>
                                    <ToggleGroupItem value="max" className="text-xs px-2" aria-label="Maximum">Max</ToggleGroupItem>
                                </ToggleGroup>
                                {/* Reset Button */}
                                <button 
                                    onClick={handleReset} 
                                    disabled={!isZoomed && selectedRange === '1m'} // Disable if not zoomed AND range is already max
                                    className="text-xs sm:text-sm px-3 py-1 h-auto copy-button-secondary" 
                                >
                                    Reset
                                </button>
                            </div>
                         </div>
                         {/* Ensure ResponsiveContainer takes remaining height, add padding-top */}
                         {/* Note: Adjust pt-10 if title/button height changes significantly */}
                         <div ref={containerRef} className="flex-grow min-h-0 pt-10"> 
                            {/* Pass calculated height to ResponsiveContainer */}
                            <ResponsiveContainer width="100%" height={chartHeight}>
                                <ComposedChart
                                    data={zoomedData}
                                    margin={{
                                        top: 5,  // Reduced top margin
                                        right: 5, // Reduced right margin
                                        left: -10, // Adjusted left margin for YAxis labels
                                        bottom: 0,
                                    }}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp} // Stop selection if mouse leaves chart
                                >
                                    <defs>
                                        {/* Use hardcoded hex color */}
                                        <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#34d399" stopOpacity={0.5} /> 
                                            <stop offset="95%" stopColor="#34d399" stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.3}/>
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={formatXAxis}
                                        ticks={monthlyTicks}
                                        interval={0}
                                        // Add back a small minTickGap
                                        minTickGap={20} 
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        style={{ fontSize: '11px', userSelect: 'none' }}
                                    />
                                    <YAxis
                                        // Visible Y Axis (left side)
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={formatYAxis}
                                        allowDecimals={false} 
                                        // Set domain explicitly starting from 0, add tick count
                                        domain={[0, (dataMax: number) => (dataMax || 0) * 1.05]} 
                                        tickCount={5} // Suggest number of ticks
                                        style={{ fontSize: '11px', userSelect: 'none' }}
                                        width={50} 
                                        tickMargin={5}
                                    />
                                    <ChartTooltip
                                        cursor={false} 
                                        content={
                                            <ChartTooltipContent
                                                className="w-[180px] sm:w-[220px] font-mono text-xs sm:text-sm"
                                                nameKey="deposits" 
                                                labelFormatter={(value: string | number) => {
                                                    try {
                                                        const dateValue = typeof value === 'number' ? value : String(value);
                                                        return new Date(dateValue).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'});
                                                    } catch {
                                                        return String(value); 
                                                    }
                                                }}
                                                // Updated formatter signature (removed unused args)
                                                formatter={(value: number | string | (string | number)[]) => { 
                                                    if (typeof value === 'number') {
                                                       return value.toLocaleString(); // Format numbers
                                                    } 
                                                    // Handle potential array values or other types if necessary, otherwise return as string
                                                    return String(value); 
                                                }}
                                            />
                                        }
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="deposits"
                                        // Use hardcoded hex color for stroke
                                        stroke="#34d399" 
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorDeposits)"
                                        isAnimationActive={false}
                                        dot={false}
                                    />
                                    {/* ReferenceArea for zoom selection - Remove isSelecting from condition */}
                                    {refAreaLeft && refAreaRight && (
                                        <ReferenceArea
                                            x1={refAreaLeft}
                                            x2={refAreaRight}
                                            // Use a distinct temporary color and match example opacity
                                            stroke="#FF0000" // Bright Red
                                            strokeOpacity={0.3}
                                            fill="#FF0000" // Bright Red
                                            fillOpacity={0.05}
                                            // Removed ifOverflow="visible"
                                        />
                                    )}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </ChartContainer>
            </CardContent>
        </Card>
    )
} 
