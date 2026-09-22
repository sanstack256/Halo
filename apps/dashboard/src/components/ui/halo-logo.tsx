import React from "react";
import Image from "next/image";

interface HaloLogoProps {
    size?: number;
    className?: string;
    alt?: string;
}

export function HaloLogo({ size = 16, className = "", alt = "Halo" }: HaloLogoProps) {
    return (
        <Image
            src="/halo-logo.png"
            alt={alt}
            width={size}
            height={size}
            className={`object-contain inline-block shrink-0 ${className}`}
        />
    );
}
