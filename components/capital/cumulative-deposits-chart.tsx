'use client'
import { useRef, useEffect, useCallback } from "react"
import { Area, CartesianGrid, XAxis, YAxis, ComposedChart, ReferenceArea, ResponsiveContainer } from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useInteractiveChart } from "@/app/hooks/useInteractiveChart"
import { useResponsiveChart } from "@/app/hooks/useResponsiveChart"

export type CumulativeDepositsDataPoint = {
    date: string;
    deposits: number;
};

type CumulativeDepositsChartProps = {
    data?: CumulativeDepositsDataPoint[];
    isLoading?: boolean;
};

export function CumulativeDepositsChart({
    data: initialData,
    isLoading = false
}: CumulativeDepositsChartProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const {
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
    } = useInteractiveChart(initialData, 'max');

    const chartHeight = useResponsiveChart(containerRef);

    useEffect(() => {
        const chartElement = chartRef.current;
        if (!chartElement) return;

        const onWheel = (e: WheelEvent) => handleWheelZoomLogic(e, chartRef);
        chartElement.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            chartElement.removeEventListener('wheel', onWheel);
        };
    }, [handleWheelZoomLogic]);

    const formatXAxis = useCallback((tickItem: string) => {
        try {
            const date = new Date(tickItem);
            if (isNaN(date.getTime())) return tickItem;

            let rangeMs = Infinity;
            if (zoomedData && zoomedData.length >= 2) {
                const firstDate = new Date(zoomedData[0].date).getTime();
                const lastDate = new Date(zoomedData[zoomedData.length - 1].date).getTime();
                if (!isNaN(firstDate) && !isNaN(lastDate)) {
                    rangeMs = Math.abs(lastDate - firstDate);
                }
            }

            const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

            if (rangeMs > sixtyDaysMs) {
                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            } else {
                return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            }
        } catch (e) {
            console.error("Error formatting X axis tick:", tickItem, e);
            return tickItem;
        }
    }, [zoomedData]);

    const formatYAxis = (value: number) => {
        if (typeof value !== 'number' || isNaN(value)) return '0';
        if (value >= 1_000_000) {
            const formatted = (value / 1_000_000);
            return `${formatted % 1 === 0 ? formatted.toFixed(0) : formatted.toFixed(1)}M`;
        }
        if (value >= 1_000) {
            return `${(value / 1_000).toFixed(0)}k`;
        }
        return value.toFixed(0);
    };

    return (
        <Card className="w-full h-full bg-transparent border-none shadow-none p-0">
            <CardContent className="p-2 sm:p-4 h-full">
                <ChartContainer
                    config={{}}
                    className="w-full h-full"
                >
                    <div
                        className="h-full flex flex-col"
                        ref={chartRef}
                        style={{ touchAction: 'pan-y' }}
                    >
                         <div className="absolute top-2 left-0 right-0 z-10 px-1 sm:px-0 flex justify-between items-center">
                            <div className="flex items-center space-x-3 ml-4">
                                <h3 className="text-md sm:text-lg font-semibold text-white">
                                    Cumulative Deposits
                                </h3>
                            </div>
                            <div className="flex items-center space-x-2 mr-2 sm:mr-4">
                                <ToggleGroup
                                    type="single"
                                    value={selectedRange}
                                    onValueChange={(value: '7d' | '1m' | '3m' | 'max') => {
                                        if (value) setSelectedRange(value);
                                    }}
                                >
                                    <ToggleGroupItem value="7d" className="text-xs px-2" aria-label="7 days">7d</ToggleGroupItem>
                                    <ToggleGroupItem value="1m" className="text-xs px-2" aria-label="1 month">1m</ToggleGroupItem>
                                    <ToggleGroupItem value="3m" className="text-xs px-2" aria-label="3 months">3m</ToggleGroupItem>
                                    <ToggleGroupItem value="max" className="text-xs px-2" aria-label="Maximum">Max</ToggleGroupItem>
                                </ToggleGroup>
                                <button
                                    onClick={handleReset}
                                    disabled={!isZoomed}
                                    className="text-xs sm:text-sm px-3 py-1 h-auto copy-button-secondary"
                                >
                                    Reset
                                </button>
                            </div>
                         </div>
                         <div ref={containerRef} className="flex-grow min-h-0 pt-10">
                            {!isLoading && (!initialData || initialData.length === 0) ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <p className="text-emerald-500 text-lg font-medium">
                                            Not enough data yet
                                        </p>
                                        <p className="text-gray-400 text-sm mt-2">
                                            Data will appear once there are cumulative deposits
                                        </p>
                                    </div>
                                </div>
                            ) : (
                            <ResponsiveContainer width="100%" height={chartHeight}>
                                <ComposedChart
                                    data={zoomedData}
                                    margin={{ top: 5, right: 5, left: -10, bottom: 0 }}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onMouseLeave={handleMouseUp}
                                >
                                    <defs>
                                        <linearGradient id="colorCumulativeDeposits" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.5} />
                                            <stop offset="95%" stopColor="#059669" stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.3}/>
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={formatXAxis}
                                        ticks={monthlyTicks}
                                        interval={0}
                                        minTickGap={20}
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        style={{ fontSize: '11px', userSelect: 'none' }}
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={formatYAxis}
                                        allowDecimals={false}
                                        domain={[0, (dataMax: number) => Math.max((dataMax || 0) * 1.05, 100)]}
                                        tickCount={5}
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
                                                labelFormatter={(value) => new Date(value as string).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'})}
                                                formatter={(value) => typeof value === 'number' ? value.toLocaleString() : String(value)}
                                            />
                                        }
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="deposits"
                                        stroke="#10B981"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorCumulativeDeposits)"
                                        isAnimationActive={false}
                                        dot={false}
                                    />
                                    {refAreaLeft && refAreaRight && (
                                        <ReferenceArea
                                            x1={refAreaLeft}
                                            x2={refAreaRight}
                                            stroke="#FF0000"
                                            strokeOpacity={0.3}
                                            fill="#FF0000"
                                            fillOpacity={0.05}
                                        />
                                    )}
                                </ComposedChart>
                            </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
