"use client";

import { useState, useEffect, RefObject } from 'react';

const SIDEBAR_COLLAPSE_WIDTH_THRESHOLD = 800; // Threshold for switching height

export function useResponsiveChart(containerRef: RefObject<HTMLDivElement | null>) {
    const [chartHeight, setChartHeight] = useState(310); // Default height

    useEffect(() => {
        const containerElement = containerRef.current;
        if (!containerElement) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                // Set height based on width threshold
                setChartHeight(width < SIDEBAR_COLLAPSE_WIDTH_THRESHOLD ? 380 : 310);
            }
        });

        resizeObserver.observe(containerElement);

        // Initial check
        const initialWidth = containerElement.getBoundingClientRect().width;
        setChartHeight(initialWidth < SIDEBAR_COLLAPSE_WIDTH_THRESHOLD ? 450 : 410);

        return () => {
            resizeObserver.disconnect();
        };
    }, [containerRef]); // Rerun if the ref itself changes

    return chartHeight;
} 