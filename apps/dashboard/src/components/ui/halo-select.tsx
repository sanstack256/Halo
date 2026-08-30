"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";

export interface HaloSelectOption {
    value: string;
    label: string;
}

interface HaloSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: HaloSelectOption[];
    placeholder?: string;
    className?: string;
    triggerClassName?: string;
    menuClassName?: string;
    ariaLabel?: string;
}

export function HaloSelect({
    value,
    onChange,
    options,
    placeholder = "Select...",
    className = "",
    triggerClassName = "",
    menuClassName = "",
    ariaLabel,
}: HaloSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Selected option label
    const selectedOption = options.find((opt) => opt.value === value);
    const displayLabel = selectedOption ? selectedOption.label : placeholder;

    // Check viewport space to flip upward if near bottom edge
    const checkPlacement = useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const menuEstimatedHeight = Math.min(options.length * 32 + 10, 240);

            if (spaceBelow < menuEstimatedHeight && spaceAbove > spaceBelow) {
                setOpenUpward(true);
            } else {
                setOpenUpward(false);
            }
        }
    }, [options.length]);

    // Handle outside click to close
    useEffect(() => {
        if (!isOpen) return;

        function handleClickOutside(event: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    const handleToggle = () => {
        if (!isOpen) {
            checkPlacement();
        }
        setIsOpen((prev) => !prev);
    };

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div
            ref={containerRef}
            className={`halo-select-container relative inline-block ${className}`}
        >
            {/* Attached Select Trigger */}
            <button
                type="button"
                onClick={handleToggle}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={ariaLabel || displayLabel}
                className={`halo-select-btn flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono select-none transition-colors cursor-pointer w-full whitespace-nowrap ${
                    isOpen
                        ? openUpward
                            ? "is-open-upward rounded-t-none border-t-transparent text-white"
                            : "is-open-downward rounded-b-none border-b-transparent text-white"
                        : "rounded-lg text-white"
                } ${triggerClassName}`}
            >
                <span className="truncate">{displayLabel}</span>
                <ChevronDown
                    size={13}
                    className={`shrink-0 text-zinc-400 transition-transform duration-150 ${
                        isOpen ? (openUpward ? "" : "rotate-180") : ""
                    }`}
                />
            </button>

            {/* Seamless Attached Dropdown Menu */}
            {isOpen && (
                <div
                    ref={menuRef}
                    role="listbox"
                    aria-label={ariaLabel || "Options"}
                    className={`halo-select-dropdown absolute left-0 right-0 z-50 overflow-y-auto max-h-64 ${
                        openUpward
                            ? "bottom-full mb-[-1px] rounded-t-lg rounded-b-none border-b-0"
                            : "top-full mt-[-1px] rounded-b-lg rounded-t-none border-t border-white/5"
                    } ${menuClassName}`}
                >
                    <div className="py-1">
                        {options.map((option) => {
                            const isSelected = option.value === value;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleSelect(option.value)}
                                    className={`halo-select-dropdown-item flex items-center justify-between w-full px-3 py-1.5 text-xs font-mono text-left cursor-pointer transition-colors ${
                                        isSelected
                                            ? "is-selected text-accent font-semibold"
                                            : "text-white hover:text-white hover:bg-white/5"
                                    }`}
                                >
                                    <span className="truncate">{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
