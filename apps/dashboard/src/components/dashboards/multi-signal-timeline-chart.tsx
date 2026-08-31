"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import type { TimeBucketPoint, TimelineEventMarker } from "@/lib/analytics/types";

export type SignalType = "ERRORS" | "REQUESTS" | "LATENCY";

interface MultiSignalTimelineChartProps {
    timeline: TimeBucketPoint[];
    markers?: TimelineEventMarker[];
    activeSignal: SignalType;
    selectedIndex: number | null;
    onSelectIndex: (index: number | null) => void;
}

export function MultiSignalTimelineChart({
    timeline,
    markers = [],
    activeSignal,
    selectedIndex,
    onSelectIndex,
}: MultiSignalTimelineChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(840);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    // Responsive width observer
    useEffect(() => {
        if (!containerRef.current) return;
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.clientWidth);
            }
        };

        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Layout Dimensions
    const height = 140;
    const paddingLeft = 44;
    const paddingRight = 24;
    const paddingTop = 16;
    const paddingBottom = 22;

    const usableWidth = Math.max(containerWidth - paddingLeft - paddingRight, 100);
    const usableHeight = height - paddingTop - paddingBottom;
    const groundY = paddingTop + usableHeight;

    // Time domain calculations from real timestamps
    const { timePoints, minTime, maxTime } = useMemo(() => {
        if (timeline.length === 0) {
            return { timePoints: [], minTime: 0, maxTime: 0 };
        }
        const parsed = timeline.map((p) => ({
            ...p,
            timeMs: new Date(p.timestamp).getTime(),
        }));
        const minT = parsed[0].timeMs;
        const maxT = parsed[parsed.length - 1].timeMs;
        return { timePoints: parsed, minTime: minT, maxTime: maxT };
    }, [timeline]);

    // Calculate exact X coordinate for any timestamp
    const getXForTime = (timeMs: number) => {
        if (minTime === maxTime || timePoints.length <= 1) {
            return paddingLeft + usableWidth / 2;
        }
        const ratio = (timeMs - minTime) / (maxTime - minTime);
        return paddingLeft + Math.max(0, Math.min(1, ratio)) * usableWidth;
    };

    // Calculate Y domain max for current signal
    const { yMax, comparisonAvailable } = useMemo(() => {
        let max = 1;
        let hasValidComparison = false;

        if (activeSignal === "ERRORS") {
            const errs = timeline.map((p) => p.errorCount);
            const compErrs = timeline
                .map((p) => p.comparison?.errorCount)
                .filter((v): v is number => typeof v === "number");
            if (compErrs.length > 0) hasValidComparison = true;
            max = Math.max(...errs, ...compErrs, 1);
        } else if (activeSignal === "REQUESTS") {
            const reqs = timeline.map((p) => p.requestCount);
            const compReqs = timeline
                .map((p) => p.comparison?.requestCount)
                .filter((v): v is number => typeof v === "number");
            if (compReqs.length > 0) hasValidComparison = true;
            max = Math.max(...reqs, ...compReqs, 1);
        } else if (activeSignal === "LATENCY") {
            const lats = timeline.map((p) => p.p95LatencyMs || p.avgLatencyMs || 0);
            const compLats = timeline
                .map((p) => p.comparison?.avgLatencyMs)
                .filter((v): v is number => typeof v === "number");
            if (compLats.length > 0) hasValidComparison = true;
            max = Math.max(...lats, ...compLats, 10);
        }

        return { yMax: max, comparisonAvailable: hasValidComparison };
    }, [timeline, activeSignal]);

    // Calculate exact Y coordinate with grounded baseline
    const getYForValue = (val: number | null | undefined) => {
        if (val === null || val === undefined || isNaN(val)) {
            return groundY;
        }
        const ratio = Math.max(0, Math.min(1, val / yMax));
        return paddingTop + usableHeight - ratio * usableHeight;
    };

    // Signal Colors & Definitions
    const signalConfig = {
        ERRORS: {
            color: "#ef4444",
            gradId: "grad-errors",
            label: "Errors",
            unit: "errs",
            formatVal: (p: TimeBucketPoint) => `${p.errorCount}`,
        },
        REQUESTS: {
            color: "#5bb8ff",
            gradId: "grad-requests",
            label: "Requests",
            unit: "reqs",
            formatVal: (p: TimeBucketPoint) => `${p.requestCount}`,
        },
        LATENCY: {
            color: "#f59e0b",
            gradId: "grad-latency",
            label: "Latency P95",
            unit: "ms",
            formatVal: (p: TimeBucketPoint) =>
                p.p95LatencyMs !== null
                    ? `${p.p95LatencyMs}ms`
                    : p.avgLatencyMs !== null
                    ? `${p.avgLatencyMs}ms`
                    : "—",
        },
    }[activeSignal];

    // Build Plot Points (X, Y)
    const pointsData = useMemo(() => {
        return timePoints.map((p, idx) => {
            const x = getXForTime(p.timeMs);
            let val = 0;
            if (activeSignal === "ERRORS") val = p.errorCount;
            else if (activeSignal === "REQUESTS") val = p.requestCount;
            else if (activeSignal === "LATENCY") val = p.p95LatencyMs || p.avgLatencyMs || 0;

            const y = getYForValue(val);
            return { x, y, val, original: p, index: idx };
        });
    }, [timePoints, activeSignal, yMax, usableWidth, containerWidth]);

    // Build SVG Path Line & Area Strings
    const { linePath, areaPath } = useMemo(() => {
        if (pointsData.length === 0) return { linePath: "", areaPath: "" };
        if (pointsData.length === 1) {
            const pt = pointsData[0];
            return {
                linePath: `M ${pt.x - 10} ${pt.y} L ${pt.x + 10} ${pt.y}`,
                areaPath: `M ${pt.x - 10} ${groundY} L ${pt.x - 10} ${pt.y} L ${pt.x + 10} ${pt.y} L ${pt.x + 10} ${groundY} Z`,
            };
        }

        const pathCoords = pointsData.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
        const line = `M ${pathCoords.join(" L ")}`;
        const firstPt = pointsData[0];
        const lastPt = pointsData[pointsData.length - 1];
        const area = `M ${firstPt.x.toFixed(1)},${groundY} L ${pathCoords.join(" L ")} L ${lastPt.x.toFixed(1)},${groundY} Z`;

        return { linePath: line, areaPath: area };
    }, [pointsData, groundY]);

    // Build Comparison Series (Only if comparison telemetry actually exists)
    const compPoints = useMemo(() => {
        if (!comparisonAvailable) return [];
        return timePoints
            .map((p) => {
                if (!p.comparison) return null;
                const x = getXForTime(p.timeMs);
                let compVal = 0;
                if (activeSignal === "ERRORS") compVal = p.comparison.errorCount;
                else if (activeSignal === "REQUESTS") compVal = p.comparison.requestCount;
                else if (activeSignal === "LATENCY") compVal = p.comparison.avgLatencyMs || 0;

                const y = getYForValue(compVal);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .filter((pt): pt is string => pt !== null);
    }, [timePoints, activeSignal, yMax, comparisonAvailable, usableWidth, containerWidth]);

    // Handle Pointer Hover to snap to nearest REAL telemetry point
    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (pointsData.length === 0 || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;

        let closestIdx = 0;
        let minDistance = Infinity;

        for (let i = 0; i < pointsData.length; i++) {
            const dist = Math.abs(pointsData[i].x - mouseX);
            if (dist < minDistance) {
                minDistance = dist;
                closestIdx = i;
            }
        }

        setHoveredIndex(closestIdx);
    };

    const handleMouseLeave = () => {
        setHoveredIndex(null);
    };

    // Active displayed point
    const activePointIdx = hoveredIndex !== null ? hoveredIndex : selectedIndex;
    const activeDataPoint = activePointIdx !== null ? pointsData[activePointIdx] : null;

    return (
        <div ref={containerRef} className="halo-chart-surface">
            {/* SVG Plot Surface */}
            <svg
                width={containerWidth}
                height={height}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={() => {
                    if (hoveredIndex !== null) {
                        onSelectIndex(hoveredIndex === selectedIndex ? null : hoveredIndex);
                    }
                }}
                className="cursor-crosshair overflow-visible block"
            >
                <defs>
                    <linearGradient id="grad-errors" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="grad-requests" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5bb8ff" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#5bb8ff" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="grad-latency" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                </defs>

                {/* Horizontal Value Reference Gridlines */}
                <line
                    x1={paddingLeft}
                    y1={paddingTop}
                    x2={paddingLeft + usableWidth}
                    y2={paddingTop}
                    stroke="rgba(255, 255, 255, 0.05)"
                    strokeDasharray="3 3"
                />
                <line
                    x1={paddingLeft}
                    y1={paddingTop + usableHeight / 2}
                    x2={paddingLeft + usableWidth}
                    y2={paddingTop + usableHeight / 2}
                    stroke="rgba(255, 255, 255, 0.05)"
                    strokeDasharray="3 3"
                />

                {/* Grounded Zero Baseline */}
                <line
                    x1={paddingLeft}
                    y1={groundY}
                    x2={paddingLeft + usableWidth}
                    y2={groundY}
                    stroke="rgba(255, 255, 255, 0.16)"
                    strokeWidth="1"
                />

                {/* Y-Axis Value Labels (Left Aligned) */}
                <text
                    x={paddingLeft - 8}
                    y={paddingTop + 3}
                    textAnchor="end"
                    fill="var(--text-muted)"
                    fontSize="9.5"
                    fontFamily="monospace"
                >
                    {yMax}
                </text>
                <text
                    x={paddingLeft - 8}
                    y={paddingTop + usableHeight / 2 + 3}
                    textAnchor="end"
                    fill="var(--text-muted)"
                    fontSize="9.5"
                    fontFamily="monospace"
                >
                    {Math.round(yMax / 2)}
                </text>
                <text
                    x={paddingLeft - 8}
                    y={groundY + 3}
                    textAnchor="end"
                    fill="var(--text-muted)"
                    fontSize="9.5"
                    fontFamily="monospace"
                >
                    0
                </text>

                {/* Selected Interval Background Highlight Band */}
                {selectedIndex !== null && pointsData[selectedIndex] && (
                    <rect
                        x={pointsData[selectedIndex].x - (usableWidth / Math.max(pointsData.length, 1)) / 2}
                        y={paddingTop}
                        width={usableWidth / Math.max(pointsData.length, 1)}
                        height={usableHeight}
                        fill="rgba(91, 184, 255, 0.08)"
                        stroke="rgba(91, 184, 255, 0.25)"
                        strokeWidth="1"
                        rx={4}
                    />
                )}

                {/* Comparison Series Line (Only when real comparison data exists) */}
                {compPoints.length > 1 && (
                    <polyline
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.3)"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        points={compPoints.join(" ")}
                    />
                )}

                {/* Primary Signal Area Fill */}
                {areaPath && (
                    <path
                        d={areaPath}
                        fill={`url(#${signalConfig.gradId})`}
                    />
                )}

                {/* Primary Signal Line */}
                {linePath && (
                    <path
                        d={linePath}
                        fill="none"
                        stroke={signalConfig.color}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Telemetry Point Dots for Sparse / Key Observations */}
                {pointsData.map((pt) => {
                    const isSelected = selectedIndex === pt.index;
                    const isHovered = hoveredIndex === pt.index;
                    const hasError = pt.original.errorCount > 0;

                    return (
                        <circle
                            key={pt.index}
                            cx={pt.x}
                            cy={pt.y}
                            r={isSelected ? 4.5 : isHovered ? 4 : pointsData.length <= 12 ? 3 : 2}
                            fill={isSelected || isHovered ? "#ffffff" : signalConfig.color}
                            stroke={signalConfig.color}
                            strokeWidth={isSelected || isHovered ? 2 : 1}
                            className="transition-all"
                        />
                    );
                })}

                {/* Mathematically Vertical Hover Crosshair Guide */}
                {activeDataPoint && (
                    <>
                        <line
                            x1={activeDataPoint.x}
                            y1={paddingTop}
                            x2={activeDataPoint.x}
                            y2={groundY}
                            stroke="rgba(91, 184, 255, 0.8)"
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                        />
                        <circle
                            cx={activeDataPoint.x}
                            cy={activeDataPoint.y}
                            r="5"
                            fill="#ffffff"
                            stroke={signalConfig.color}
                            strokeWidth="2"
                        />
                    </>
                )}

                {/* Real Annotations / Event Markers (If available) */}
                {markers.map((marker) => {
                    const markerTime = new Date(marker.timestamp).getTime();
                    if (markerTime < minTime || markerTime > maxTime) return null;
                    const markerX = getXForTime(markerTime);

                    return (
                        <g key={marker.id} transform={`translate(${markerX}, ${paddingTop - 6})`}>
                            <circle r="4" fill="#a855f7" stroke="#ffffff" strokeWidth="1" />
                        </g>
                    );
                })}
            </svg>

            {/* X-Axis Time Domain Labels */}
            <div
                className="flex justify-between text-[10px] font-mono text-text-muted pt-1.5 border-t border-border/40"
                style={{ paddingLeft: `${paddingLeft}px`, paddingRight: `${paddingRight}px` }}
            >
                <span>{timeline[0]?.formattedTime} UTC</span>
                {timeline.length > 2 && (
                    <span>{timeline[Math.floor(timeline.length / 2)]?.formattedTime} UTC</span>
                )}
                <span>{timeline[timeline.length - 1]?.formattedTime} UTC</span>
            </div>

            {/* Floating High-Precision Tooltip */}
            {hoveredIndex !== null && pointsData[hoveredIndex] && (
                <div
                    className="halo-chart-tooltip font-sans"
                    style={{
                        left: `${Math.min(
                            Math.max(pointsData[hoveredIndex].x - 70, 10),
                            containerWidth - 160
                        )}px`,
                        top: "10px",
                    }}
                >
                    <div className="text-[11px] font-mono font-bold text-text border-b border-border/60 pb-1 mb-1.5 flex items-center justify-between">
                        <span>{pointsData[hoveredIndex].original.formattedTime} UTC</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-[#080b11] border border-border text-text-muted font-normal">
                            Snapshot
                        </span>
                    </div>
                    <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-text-muted text-[11px]">Errors</span>
                            <span
                                className={`font-mono font-semibold ${
                                    pointsData[hoveredIndex].original.errorCount > 0
                                        ? "text-error"
                                        : "text-text"
                                }`}
                            >
                                {pointsData[hoveredIndex].original.errorCount}{" "}
                                <span className="text-[10px] text-text-muted font-normal">
                                    ({pointsData[hoveredIndex].original.errorRate}%)
                                </span>
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-text-muted text-[11px]">Requests</span>
                            <span className="font-mono font-semibold text-text">
                                {pointsData[hoveredIndex].original.requestCount}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-text-muted text-[11px]">Latency P95</span>
                            <span className="font-mono font-semibold text-warning">
                                {pointsData[hoveredIndex].original.p95LatencyMs !== null
                                    ? `${pointsData[hoveredIndex].original.p95LatencyMs}ms`
                                    : pointsData[hoveredIndex].original.avgLatencyMs !== null
                                    ? `${pointsData[hoveredIndex].original.avgLatencyMs}ms`
                                    : "—"}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
