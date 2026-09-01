"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { formatDeterministicDateTime } from "@/lib/date-format";

export interface TrajectoryPoint {
    timestamp: string;
    formattedTime: string;
    timeZoneAbbr?: string;
    availabilityPct: number | null;
    errorRate: number;
    incidentCount: number;
    releaseCount: number;
    monitorTriggerCount: number;
    hasObservation?: boolean;
}

interface ReliabilityTrajectoryChartProps {
    trajectory: TrajectoryPoint[];
    targetAvailabilityPct?: number;
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

export function ReliabilityTrajectoryChart({
    trajectory,
    targetAvailabilityPct = 99.9,
}: ReliabilityTrajectoryChartProps) {
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
    const paddingLeft = 52;
    const paddingRight = 48;
    const paddingTop = 20;
    const paddingBottom = 26;

    const usableWidth = Math.max(containerWidth - paddingLeft - paddingRight, 100);
    const usableHeight = height - paddingTop - paddingBottom;
    const groundY = paddingTop + usableHeight;

    // Time domain calculations from real timestamps
    const { timePoints, minTime, maxTime } = useMemo(() => {
        if (trajectory.length === 0) {
            return { timePoints: [], minTime: 0, maxTime: 0 };
        }
        const parsed = trajectory.map((p) => ({
            ...p,
            timeMs: new Date(p.timestamp).getTime(),
        }));
        const minT = parsed[0].timeMs;
        const maxT = parsed[parsed.length - 1].timeMs;
        return { timePoints: parsed, minTime: minT, maxTime: maxT };
    }, [trajectory]);

    // Calculate exact X coordinate for any bucket index
    const getXForIndex = (idx: number) => {
        if (timePoints.length <= 1) {
            return paddingLeft + usableWidth / 2;
        }
        return paddingLeft + (idx / (timePoints.length - 1)) * usableWidth;
    };

    // Calculate dynamic Y-domain bounds based on real data
    const { yMin, yMax } = useMemo(() => {
        if (trajectory.length === 0) return { yMin: 90, yMax: 100 };
        const avails = trajectory
            .map((t) => t.availabilityPct)
            .filter((v): v is number => typeof v === "number" && !isNaN(v));
        if (avails.length === 0) return { yMin: 90, yMax: 100 };
        const minObserved = Math.min(...avails, targetAvailabilityPct);
        const dynamicMin = Math.max(0, Math.floor(minObserved - 0.5));
        return { yMin: Math.min(dynamicMin, 95), yMax: 100 };
    }, [trajectory, targetAvailabilityPct]);

    // Calculate Y coordinate with dynamic range
    const getYForValue = (val: number | null | undefined): number | null => {
        if (val === null || val === undefined || isNaN(val)) return null;
        const span = yMax - yMin || 1;
        const ratio = Math.max(0, Math.min(1, (val - yMin) / span));
        return paddingTop + usableHeight - ratio * usableHeight;
    };

    // Build Plot Points (X, Y)
    const pointsData = useMemo(() => {
        return timePoints.map((p, idx) => {
            const x = getXForIndex(idx);
            const y = getYForValue(p.availabilityPct);
            return { x, y, original: p, index: idx };
        });
    }, [timePoints, yMin, yMax, usableWidth, containerWidth]);

    // Build SVG Path Line & Area Strings with gap preservation
    const { linePath, areaPath } = useMemo(() => {
        const line = buildSegmentedPath(pointsData);
        const area = buildSegmentedArea(pointsData, groundY);
        return { linePath: line, areaPath: area };
    }, [pointsData, groundY]);

    // Handle Pointer Hover snapping to nearest REAL data point
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

    const activePoint = hoveredIndex !== null ? pointsData[hoveredIndex] : null;
    const targetY = getYForValue(targetAvailabilityPct) ?? paddingTop;

    // Smart 2D non-overlapping tooltip positioning: placed with clear clearance both horizontally and vertically
    const tooltipPosition = useMemo(() => {
        if (hoveredIndex === null || !pointsData[hoveredIndex]) return null;
        const pt = pointsData[hoveredIndex];
        const tooltipWidth = 185;
        const isRightHalf = pt.x > containerWidth * 0.52;

        const left = isRightHalf
            ? Math.max(12, pt.x - tooltipWidth - 20)
            : Math.min(containerWidth - tooltipWidth - 12, pt.x + 20);

        // If the availability line is at the top (y <= 110px), position tooltip in lower half so it never overlaps the line/target
        // If availability is degraded (y > 110px), position tooltip in upper half
        const top = pt.y !== null && pt.y <= 110 ? 80 : 20;

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
                className="cursor-crosshair overflow-visible block select-none"
            >
                <defs>
                    <linearGradient id="grad-avail" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5bb8ff" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#5bb8ff" stopOpacity="0.0" />
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

                {/* Grounded Zero/Min Baseline */}
                <line
                    x1={paddingLeft}
                    y1={groundY}
                    x2={paddingLeft + usableWidth}
                    y2={groundY}
                    stroke="rgba(255, 255, 255, 0.16)"
                    strokeWidth="1"
                />

                {/* Y-Axis Percentage Labels */}
                <text
                    x={paddingLeft - 8}
                    y={paddingTop + 3}
                    textAnchor="end"
                    fill="var(--text-muted)"
                    fontSize="9.5"
                    fontFamily="monospace"
                >
                    {yMax}%
                </text>
                <text
                    x={paddingLeft - 8}
                    y={paddingTop + usableHeight * 0.5 + 3}
                    textAnchor="end"
                    fill="var(--text-muted)"
                    fontSize="9.5"
                    fontFamily="monospace"
                >
                    {((yMax + yMin) / 2).toFixed(1)}%
                </text>
                <text
                    x={paddingLeft - 8}
                    y={groundY + 3}
                    textAnchor="end"
                    fill="var(--text-muted)"
                    fontSize="9.5"
                    fontFamily="monospace"
                >
                    {yMin}%
                </text>

                {/* SLO Target Reference Line (Dashed Green) */}
                <line
                    x1={paddingLeft}
                    y1={targetY}
                    x2={paddingLeft + usableWidth}
                    y2={targetY}
                    stroke="#22c55e"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity="0.8"
                />
                {/* SLO Target Right Label */}
                <text
                    x={paddingLeft + usableWidth + 6}
                    y={targetY + 3.5}
                    fill="#22c55e"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fontWeight="600"
                >
                    {targetAvailabilityPct}% SLO
                </text>

                {/* Trajectory Area Fill */}
                {areaPath && (
                    <path
                        d={areaPath}
                        fill="url(#grad-avail)"
                    />
                )}

                {/* Trajectory Line */}
                {linePath && (
                    <path
                        d={linePath}
                        fill="none"
                        stroke="#5bb8ff"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Data Point Dots */}
                {pointsData.map((pt) => {
                    if (pt.y === null) return null;
                    const isHovered = hoveredIndex === pt.index;
                    const isBreach = pt.original.availabilityPct !== null && pt.original.availabilityPct < targetAvailabilityPct;

                    return (
                        <circle
                            key={pt.index}
                            cx={pt.x}
                            cy={pt.y}
                            r={isHovered ? 5 : isBreach ? 3.5 : 2.5}
                            fill={isHovered ? "#ffffff" : isBreach ? "#ef4444" : "#5bb8ff"}
                            stroke={isBreach ? "#ef4444" : "#5bb8ff"}
                            strokeWidth={isHovered ? 2 : 1}
                            className="transition-all"
                        />
                    );
                })}

                {/* Mathematically Vertical Hover Crosshair */}
                {activePoint && activePoint.y !== null && (
                    <>
                        <line
                            x1={activePoint.x}
                            y1={paddingTop}
                            x2={activePoint.x}
                            y2={groundY}
                            stroke="rgba(91, 184, 255, 0.8)"
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                        />
                        <circle
                            cx={activePoint.x}
                            cy={activePoint.y}
                            r="5.5"
                            fill="#ffffff"
                            stroke="#5bb8ff"
                            strokeWidth="2"
                        />
                    </>
                )}
            </svg>

            {/* X-Axis Time Domain Labels */}
            <div
                className="flex justify-between text-[10px] font-mono text-text-muted pt-1.5 border-t border-border/40 select-none"
                style={{ paddingLeft: `${paddingLeft}px`, paddingRight: `${paddingRight}px` }}
            >
                <span>
                    {trajectory[0]?.formattedTime} {trajectory[0]?.timeZoneAbbr || "UTC"}
                </span>
                {trajectory.length > 2 && (
                    <span>
                        {trajectory[Math.floor(trajectory.length / 2)]?.formattedTime} {trajectory[0]?.timeZoneAbbr || "UTC"}
                    </span>
                )}
                <span>
                    {trajectory[trajectory.length - 1]?.formattedTime} {trajectory[0]?.timeZoneAbbr || "UTC"}
                </span>
            </div>

            {/* Floating Tooltip (2D offset to never overlap the active trajectory line or SLO target) */}
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
                            <span className="halo-chart-tooltip-label">Availability</span>
                            <span
                                className={`halo-chart-tooltip-val ${
                                    pointsData[hoveredIndex].original.availabilityPct === null
                                        ? "text-text-muted font-normal"
                                        : pointsData[hoveredIndex].original.availabilityPct < targetAvailabilityPct
                                        ? "text-error"
                                        : "text-success"
                                }`}
                            >
                                {pointsData[hoveredIndex].original.availabilityPct !== null
                                    ? `${pointsData[hoveredIndex].original.availabilityPct}%`
                                    : "No observation"}
                            </span>
                        </div>
                        <div className="halo-chart-tooltip-row">
                            <span className="halo-chart-tooltip-label">SLO Target</span>
                            <span className="halo-chart-tooltip-val text-text-muted">
                                {targetAvailabilityPct}%
                            </span>
                        </div>
                        {pointsData[hoveredIndex].original.errorRate > 0 && (
                            <div className="halo-chart-tooltip-row">
                                <span className="halo-chart-tooltip-label">Error Rate</span>
                                <span className="halo-chart-tooltip-val text-error">
                                    {pointsData[hoveredIndex].original.errorRate}%
                                </span>
                            </div>
                        )}
                        {pointsData[hoveredIndex].original.incidentCount > 0 && (
                            <div className="halo-chart-tooltip-row">
                                <span className="halo-chart-tooltip-label">Incidents</span>
                                <span className="halo-chart-tooltip-val text-warning">
                                    {pointsData[hoveredIndex].original.incidentCount}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
