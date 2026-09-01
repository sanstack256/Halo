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

/**
 * Builds SVG path string with disconnected segments across null/missing observations.
 */
function buildSegmentedPath(points: Array<{ x: number; y: number | null }>): string {
    let d = "";
    let inSegment = false;
    let segmentPoints: Array<{ x: number; y: number }> = [];

    for (const pt of points) {
        if (pt.y !== null && !isNaN(pt.y)) {
            segmentPoints.push({ x: pt.x, y: pt.y });
            inSegment = true;
        } else {
            if (inSegment && segmentPoints.length > 0) {
                if (segmentPoints.length === 1) {
                    const p = segmentPoints[0];
                    d += `M ${(p.x - 4).toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 4).toFixed(1)} ${p.y.toFixed(1)} `;
                } else {
                    d += `M ${segmentPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")} `;
                }
                segmentPoints = [];
                inSegment = false;
            }
        }
    }

    if (inSegment && segmentPoints.length > 0) {
        if (segmentPoints.length === 1) {
            const p = segmentPoints[0];
            d += `M ${(p.x - 4).toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 4).toFixed(1)} ${p.y.toFixed(1)} `;
        } else {
            d += `M ${segmentPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")} `;
        }
    }

    return d.trim();
}

/**
 * Builds SVG area fill path with disconnected segments across null/missing observations.
 */
function buildSegmentedArea(
    points: Array<{ x: number; y: number | null }>,
    groundY: number
): string {
    let d = "";
    let inSegment = false;
    let segmentPoints: Array<{ x: number; y: number }> = [];

    for (const pt of points) {
        if (pt.y !== null && !isNaN(pt.y)) {
            segmentPoints.push({ x: pt.x, y: pt.y });
            inSegment = true;
        } else {
            if (inSegment && segmentPoints.length > 0) {
                const first = segmentPoints[0];
                const last = segmentPoints[segmentPoints.length - 1];
                const coords = segmentPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");
                d += `M ${first.x.toFixed(1)},${groundY.toFixed(1)} L ${coords} L ${last.x.toFixed(1)},${groundY.toFixed(1)} Z `;
                segmentPoints = [];
                inSegment = false;
            }
        }
    }

    if (inSegment && segmentPoints.length > 0) {
        const first = segmentPoints[0];
        const last = segmentPoints[segmentPoints.length - 1];
        const coords = segmentPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");
        d += `M ${first.x.toFixed(1)},${groundY.toFixed(1)} L ${coords} L ${last.x.toFixed(1)},${groundY.toFixed(1)} Z `;
    }

    return d.trim();
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

    // Layout Dimensions: Substantially increased vertical height for premium analytical clarity
    const height = 240;
    const paddingLeft = 48;
    const paddingRight = 28;
    const paddingTop = 20;
    const paddingBottom = 26;

    const usableWidth = Math.max(containerWidth - paddingLeft - paddingRight, 100);
    const usableHeight = height - paddingTop - paddingBottom;
    const groundY = paddingTop + usableHeight;

    // Time domain calculations from real timestamps
    const { timePoints, minTime, maxTime } = useMemo(() => {
        if (timeline.length === 0) {
            return { timePoints: [], minTime: 0, maxTime: 0 };
        }
        const parsed = timeline.map((p, idx) => ({
            ...p,
            timeMs: new Date(p.timestamp).getTime(),
            canonicalIndex: idx,
        }));
        const minT = parsed[0].timeMs;
        const maxT = parsed[parsed.length - 1].timeMs;
        return { timePoints: parsed, minTime: minT, maxTime: maxT };
    }, [timeline]);

    // Calculate exact X coordinate for any bucket index
    const getXForIndex = (idx: number) => {
        if (timePoints.length <= 1) {
            return paddingLeft + usableWidth / 2;
        }
        return paddingLeft + (idx / (timePoints.length - 1)) * usableWidth;
    };

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
                .filter((p) => p.comparison && p.comparison.hasObservation !== false)
                .map((p) => p.comparison?.errorCount)
                .filter((v): v is number => typeof v === "number");
            if (compErrs.length > 0) hasValidComparison = true;
            max = Math.max(...errs, ...compErrs, 1);
        } else if (activeSignal === "REQUESTS") {
            const reqs = timeline.map((p) => p.requestCount);
            const compReqs = timeline
                .filter((p) => p.comparison && p.comparison.hasObservation !== false)
                .map((p) => p.comparison?.requestCount)
                .filter((v): v is number => typeof v === "number");
            if (compReqs.length > 0) hasValidComparison = true;
            max = Math.max(...reqs, ...compReqs, 1);
        } else if (activeSignal === "LATENCY") {
            const lats = timeline
                .map((p) => (p.p95LatencyMs !== null ? p.p95LatencyMs : p.avgLatencyMs))
                .filter((v): v is number => typeof v === "number" && v > 0);
            const compLats = timeline
                .filter((p) => p.comparison && p.comparison.hasObservation !== false)
                .map((p) => p.comparison?.avgLatencyMs)
                .filter((v): v is number => typeof v === "number" && v > 0);
            if (compLats.length > 0) hasValidComparison = true;
            max = Math.max(...lats, ...compLats, 10);
        }

        return { yMax: max, comparisonAvailable: hasValidComparison };
    }, [timeline, activeSignal]);

    // Calculate exact Y coordinate with grounded baseline
    const getYForValue = (val: number | null | undefined): number | null => {
        if (val === null || val === undefined || isNaN(val)) {
            return null;
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
        },
        REQUESTS: {
            color: "#5bb8ff",
            gradId: "grad-requests",
            label: "Requests",
            unit: "reqs",
        },
        LATENCY: {
            color: "#f59e0b",
            gradId: "grad-latency",
            label: "Latency P95",
            unit: "ms",
        },
    }[activeSignal];

    // Canonical points mapping
    const pointsData = useMemo(() => {
        return timePoints.map((p, idx) => {
            const x = getXForIndex(idx);
            let val: number | null = 0;

            if (activeSignal === "ERRORS") {
                val = p.errorCount;
            } else if (activeSignal === "REQUESTS") {
                val = p.requestCount;
            } else if (activeSignal === "LATENCY") {
                val = p.p95LatencyMs !== null ? p.p95LatencyMs : p.avgLatencyMs;
            }

            const y = getYForValue(val);
            return { x, y, val, original: p, index: idx };
        });
    }, [timePoints, activeSignal, yMax, usableWidth, containerWidth]);

    // Comparison points mapping (preserving gaps where no telemetry was observed)
    const compPointsData = useMemo(() => {
        if (!comparisonAvailable) return [];
        return timePoints.map((p, idx) => {
            const x = getXForIndex(idx);
            if (!p.comparison || p.comparison.hasObservation === false) {
                return { x, y: null, val: null, index: idx };
            }

            let compVal: number | null = null;
            if (activeSignal === "ERRORS") {
                compVal = p.comparison.errorCount;
            } else if (activeSignal === "REQUESTS") {
                compVal = p.comparison.requestCount;
            } else if (activeSignal === "LATENCY") {
                compVal = p.comparison.avgLatencyMs;
            }

            const y = getYForValue(compVal);
            return { x, y, val: compVal, index: idx };
        });
    }, [timePoints, activeSignal, yMax, comparisonAvailable, usableWidth, containerWidth]);

    // Primary SVG Path Line & Area Strings with gap preservation
    const { linePath, areaPath } = useMemo(() => {
        const line = buildSegmentedPath(pointsData);
        const area = activeSignal !== "LATENCY" ? buildSegmentedArea(pointsData, groundY) : "";
        return { linePath: line, areaPath: area };
    }, [pointsData, groundY, activeSignal]);

    // Comparison Path String with gap preservation
    const compLinePath = useMemo(() => {
        if (!comparisonAvailable || compPointsData.length === 0) return "";
        return buildSegmentedPath(compPointsData);
    }, [compPointsData, comparisonAvailable]);

    // Handle Pointer Hover to snap to nearest canonical bucket
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

    // Active displayed bucket (hovered takes precedence, then selectedIndex)
    const activePointIdx = hoveredIndex !== null ? hoveredIndex : selectedIndex;
    const activeDataPoint = activePointIdx !== null && activePointIdx < pointsData.length ? pointsData[activePointIdx] : null;
    const activeCompPoint = activePointIdx !== null && activePointIdx < compPointsData.length ? compPointsData[activePointIdx] : null;

    // Smart 2D non-overlapping tooltip positioning: placed with clear clearance both horizontally and vertically
    const tooltipPosition = useMemo(() => {
        if (hoveredIndex === null || !pointsData[hoveredIndex]) return null;
        const pt = pointsData[hoveredIndex];
        const tooltipWidth = 190;
        const isRightHalf = pt.x > containerWidth * 0.52;

        const left = isRightHalf
            ? Math.max(12, pt.x - tooltipWidth - 20)
            : Math.min(containerWidth - tooltipWidth - 12, pt.x + 20);

        // If point has a high value near the top (pt.y <= 100px), position tooltip in lower half so it never covers the peak
        // If point is low or zero at ground level (pt.y > 100px), position tooltip in upper half
        const top = pt.y !== null && pt.y <= 100 ? 110 : 20;

        return { left, top };
    }, [hoveredIndex, pointsData, containerWidth]);

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
                className="cursor-crosshair overflow-visible block select-none"
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
                    y1={paddingTop + usableHeight * 0.33}
                    x2={paddingLeft + usableWidth}
                    y2={paddingTop + usableHeight * 0.33}
                    stroke="rgba(255, 255, 255, 0.04)"
                    strokeDasharray="3 3"
                />
                <line
                    x1={paddingLeft}
                    y1={paddingTop + usableHeight * 0.66}
                    x2={paddingLeft + usableWidth}
                    y2={paddingTop + usableHeight * 0.66}
                    stroke="rgba(255, 255, 255, 0.04)"
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
                    y={paddingTop + usableHeight * 0.5 + 3}
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

                {/* Comparison Baseline Series (Rendered with gaps where missing) */}
                {compLinePath && (
                    <path
                        d={compLinePath}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.42)"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Comparison Point Dots where observations exist */}
                {compPointsData.map((cpt) => {
                    if (cpt.y === null) return null;
                    return (
                        <circle
                            key={`comp-${cpt.index}`}
                            cx={cpt.x}
                            cy={cpt.y}
                            r={3}
                            fill="rgba(255, 255, 255, 0.55)"
                        />
                    );
                })}

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

                {/* Primary Telemetry Point Dots */}
                {pointsData.map((pt) => {
                    if (pt.y === null) return null;
                    const isSelected = selectedIndex === pt.index;
                    const isHovered = hoveredIndex === pt.index;

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
                        {activeDataPoint.y !== null && (
                            <circle
                                cx={activeDataPoint.x}
                                cy={activeDataPoint.y}
                                r="5"
                                fill="#ffffff"
                                stroke={signalConfig.color}
                                strokeWidth="2"
                            />
                        )}
                        {activeCompPoint && activeCompPoint.y !== null && (
                            <circle
                                cx={activeCompPoint.x}
                                cy={activeCompPoint.y}
                                r="4"
                                fill="#ffffff"
                                stroke="rgba(255, 255, 255, 0.85)"
                                strokeWidth="1.5"
                            />
                        )}
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
                className="flex justify-between text-[10px] font-mono text-text-muted pt-1.5 border-t border-border/40 select-none"
                style={{ paddingLeft: `${paddingLeft}px`, paddingRight: `${paddingRight}px` }}
            >
                <span>
                    {timeline[0]?.formattedTime} {timeline[0]?.timeZoneAbbr || "UTC"}
                </span>
                {timeline.length > 2 && (
                    <span>
                        {timeline[Math.floor(timeline.length / 2)]?.formattedTime} {timeline[0]?.timeZoneAbbr || "UTC"}
                    </span>
                )}
                <span>
                    {timeline[timeline.length - 1]?.formattedTime} {timeline[0]?.timeZoneAbbr || "UTC"}
                </span>
            </div>

            {/* Floating High-Precision Tooltip (2D offset to never overlap the active graph line) */}
            {hoveredIndex !== null && pointsData[hoveredIndex] && tooltipPosition && (
                <div
                    className="halo-chart-tooltip font-sans"
                    style={{
                        transform: `translate3d(${tooltipPosition.left}px, ${tooltipPosition.top}px, 0)`,
                    }}
                >
                    <div className="halo-chart-tooltip-header">
                        <span>
                            {pointsData[hoveredIndex].original.formattedTime} ({pointsData[hoveredIndex].original.timeZoneAbbr || "UTC"})
                        </span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-[#080b11] border border-border text-text-muted font-normal font-mono">
                            Interval {hoveredIndex + 1}/{pointsData.length}
                        </span>
                    </div>
                    <div className="halo-chart-tooltip-body">
                        <div className="halo-chart-tooltip-row">
                            <span className="halo-chart-tooltip-label">Errors</span>
                            <span
                                className={`halo-chart-tooltip-val ${
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
                        <div className="halo-chart-tooltip-row">
                            <span className="halo-chart-tooltip-label">Requests</span>
                            <span className="halo-chart-tooltip-val">
                                {pointsData[hoveredIndex].original.requestCount.toLocaleString()}
                            </span>
                        </div>
                        <div className="halo-chart-tooltip-row">
                            <span className="halo-chart-tooltip-label">Latency P95</span>
                            <span className="halo-chart-tooltip-val text-warning">
                                {pointsData[hoveredIndex].original.p95LatencyMs !== null
                                    ? `${pointsData[hoveredIndex].original.p95LatencyMs}ms`
                                    : pointsData[hoveredIndex].original.avgLatencyMs !== null
                                    ? `${pointsData[hoveredIndex].original.avgLatencyMs}ms`
                                    : "No observation"}
                            </span>
                        </div>

                        {/* Baseline Comparison */}
                        {pointsData[hoveredIndex].original.comparison !== undefined && (
                            <div className="halo-chart-tooltip-row pt-1 mt-0.5 border-t border-border/40">
                                <span className="halo-chart-tooltip-label">Previous Baseline</span>
                                <span className="halo-chart-tooltip-val text-text-muted">
                                    {pointsData[hoveredIndex].original.comparison?.hasObservation === false ? (
                                        "No observation"
                                    ) : activeSignal === "ERRORS" ? (
                                        `${pointsData[hoveredIndex].original.comparison?.errorCount} errs (${pointsData[hoveredIndex].original.comparison?.errorRate}%)`
                                    ) : activeSignal === "REQUESTS" ? (
                                        `${pointsData[hoveredIndex].original.comparison?.requestCount.toLocaleString()} reqs`
                                    ) : pointsData[hoveredIndex].original.comparison?.avgLatencyMs !== null ? (
                                        `${pointsData[hoveredIndex].original.comparison?.avgLatencyMs}ms`
                                    ) : (
                                        "No observation"
                                    )}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
