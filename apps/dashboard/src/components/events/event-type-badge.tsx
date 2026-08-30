import React from "react";

interface Props {
    type: string;
    className?: string;
}

export function EventTypeBadge({ type, className = "" }: Props) {
    return (
        <span className={`halo-event-type-text ${className}`}>
            {type}
        </span>
    );
}
