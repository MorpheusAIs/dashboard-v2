"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { type DataPoint } from "@/lib/utils/chart-utils";

// Helper to get monthly ticks from a dataset
const getMonthlyTicks = (data: DataPoint[]): string[] => {
    if (!data || data.length === 0) return [];
    const ticks: string[] = [];
    const seenMonths = new Set<string>();
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedData.forEach(point => {
        try {
            const date = new Date(point.date);
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth();
            const monthKey = `${year}-${month}`;
            if (!seenMonths.has(monthKey)) {
                seenMonths.add(monthKey);
                ticks.push(point.date); 
            }
        } catch (e) {
            console.error("Error processing date for monthly tick:", point.date, e);
        }
    });
    return ticks;
};

export function useInteractiveChart(initialData: DataPoint[] = [], defaultRange: '7d' | '1m' | '3m' | 'max' = '1m') {
    const [data, setData] = useState<DataPoint[]>(initialData);
    const [originalData, setOriginalData] = useState<DataPoint[]>(initialData);
    const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
    const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<string | null>(null);
    const [endTime, setEndTime] = useState<string | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectedRange, setSelectedRange] = useState<'7d' | '1m' | '3m' | 'max'>(defaultRange);

    useEffect(() => {
        if (initialData?.length) {
            const sortedData = [...initialData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setData(sortedData);
            setOriginalData(sortedData);
            // The other useEffect will handle setting the initial time range
        }
    }, [initialData]);

    const zoomedData = useMemo(() => {
        if (!startTime || !endTime || !originalData.length) {
            return data.length > 1 ? data : (originalData.length > 1 ? originalData.slice(0, 2) : []);
        }
        const startMs = new Date(startTime).getTime();
        const endMs = new Date(endTime).getTime();
        if (isNaN(startMs) || isNaN(endMs)) {
            return data.length > 1 ? data : (originalData.length > 1 ? originalData.slice(0, 2) : []);
        }
        const dataPointsInRange = originalData.filter(p => {
            const pointMs = new Date(p.date).getTime();
            return pointMs >= startMs && pointMs <= endMs;
        });
        if (dataPointsInRange.length <= 1) {
            const startIndex = originalData.findIndex(p => new Date(p.date).getTime() >= startMs);
            if (startIndex !== -1 && originalData.length > 1) {
                return originalData.slice(startIndex, Math.min(startIndex + 2, originalData.length));
            }
            return originalData.slice(0, 2);
        }
        return dataPointsInRange;
    }, [startTime, endTime, originalData, data]);

    const monthlyTicks = useMemo(() => getMonthlyTicks(originalData), [originalData]);

    const handleMouseDown = useCallback((e: { activeLabel?: string } | null) => {
        if (e && e.activeLabel) {
            setRefAreaLeft(e.activeLabel);
            setIsSelecting(true);
        }
    }, []);

    const handleMouseMove = useCallback((e: { activeLabel?: string } | null) => {
        if (isSelecting && e && e.activeLabel) {
            setRefAreaRight(e.activeLabel);
        }
    }, [isSelecting]);

    const handleMouseUp = useCallback(() => {
        setIsSelecting(false);
        if (refAreaLeft && refAreaRight) {
            const start = new Date(refAreaLeft).getTime();
            const end = new Date(refAreaRight).getTime();
            if (Math.abs(end - start) > 1000) {
                const [left, right] = [refAreaLeft, refAreaRight].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                setStartTime(left);
                setEndTime(right);
                setSelectedRange('max'); // Custom range selection implies 'max' view
            }
        }
        setRefAreaLeft(null);
        setRefAreaRight(null);
    }, [refAreaLeft, refAreaRight]);

    const handleReset = useCallback(() => {
        if (originalData.length > 0) {
            setSelectedRange(defaultRange); // Reset to the specified default view
        }
    }, [originalData, defaultRange]);

    const handleWheelZoomLogic = useCallback((e: WheelEvent, chartRef: React.RefObject<HTMLDivElement>) => {
        if (!chartRef.current || !startTime || !endTime) return;
        e.preventDefault();

        const zoomFactor = 0.1;
        const direction = e.deltaY < 0 ? 1 : -1;
        const currentStartTime = new Date(startTime).getTime();
        const currentEndTime = new Date(endTime).getTime();
        const currentRange = currentEndTime - currentStartTime;

        if (direction === 1 && currentRange < 60 * 1000) return;
        
        const originalStartMs = new Date(originalData[0].date).getTime();
        const originalEndMs = new Date(originalData[originalData.length - 1].date).getTime();
        const originalRange = originalEndMs - originalStartMs;
        
        if (direction === -1 && currentRange >= originalRange) {
            handleReset();
            return;
        }

        const zoomAmount = currentRange * zoomFactor * direction;
        const chartRect = chartRef.current.getBoundingClientRect();
        const mouseXRelative = e.clientX - chartRect.left;
        const chartWidth = chartRect.width;
        const mousePercentage = Math.max(0, Math.min(1, mouseXRelative / chartWidth));

        let newStartTimeMs = currentStartTime + zoomAmount * mousePercentage;
        let newEndTimeMs = currentEndTime - zoomAmount * (1 - mousePercentage);

        newStartTimeMs = Math.max(originalStartMs, newStartTimeMs);
        newEndTimeMs = Math.min(originalEndMs, newEndTimeMs);

        if (newEndTimeMs <= newStartTimeMs) {
            if (direction === 1) newEndTimeMs = newStartTimeMs + 60000;
            else newStartTimeMs = newEndTimeMs - 60000;
            newStartTimeMs = Math.max(originalStartMs, newStartTimeMs);
            newEndTimeMs = Math.min(originalEndMs, newEndTimeMs);
            if (newEndTimeMs <= newStartTimeMs) {
                handleReset();
                return;
            }
        }

        setStartTime(new Date(newStartTimeMs).toISOString());
        setEndTime(new Date(newEndTimeMs).toISOString());
        setSelectedRange('max'); // Custom zoom implies 'max' view
    }, [originalData, startTime, endTime, handleReset]);
    
    useEffect(() => {
        if (!originalData || originalData.length === 0) return;

        const lastDataPoint = originalData[originalData.length - 1];
        const endDate = new Date(lastDataPoint.date);
        
        // Validate endDate
        if (isNaN(endDate.getTime())) {
            console.error("Invalid end date in chart data:", lastDataPoint.date);
            return;
        }
        
        let startDate: Date;

        if (selectedRange === '7d') {
            startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 7);
        } else if (selectedRange === '1m') {
            startDate = new Date(endDate);
            startDate.setMonth(endDate.getMonth() - 1);
        } else if (selectedRange === '3m') {
            startDate = new Date(endDate);
            startDate.setMonth(endDate.getMonth() - 3);
        } else { // This handles 'max'
            startDate = new Date(originalData[0].date);
        }

        // Validate startDate
        if (isNaN(startDate.getTime())) {
            console.error("Invalid start date in chart data:", originalData[0]?.date);
            return;
        }

        const firstDataPointDate = new Date(originalData[0].date);
        if (isNaN(firstDataPointDate.getTime())) {
            console.error("Invalid first data point date in chart data:", originalData[0].date);
            return;
        }
        
        if (startDate < firstDataPointDate) {
            startDate = firstDataPointDate;
        }

        // Final validation before setting
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.error("Final validation failed for chart dates:", { startDate, endDate });
            return;
        }

        setStartTime(startDate.toISOString());
        setEndTime(endDate.toISOString());

    }, [selectedRange, originalData]);

    const isZoomed = useMemo(() => {
        if (!originalData.length || !startTime || !endTime) return false;
        if (selectedRange !== 'max') return true;
        return startTime !== originalData[0].date || endTime !== originalData[originalData.length - 1].date;
    }, [startTime, endTime, originalData, selectedRange]);

    return {
        zoomedData,
        refAreaLeft,
        refAreaRight,
        selectedRange,
        setSelectedRange,
        isZoomed,
        monthlyTicks,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleReset,
        handleWheelZoomLogic,
    };
} 