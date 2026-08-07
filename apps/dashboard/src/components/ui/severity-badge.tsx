import {
    AlertCircle,
    AlertTriangle,
    Circle,
    Flame,
} from "lucide-react";

import { EventSeverity } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";

type Props = {
    severity: EventSeverity;
};

const styles = {
    INFO: {
        icon: Circle,
        className:
            "bg-[#5bb8ff]/10 text-[#7bc8ff] border-[#5bb8ff]/10",
    },

    WARNING: {
        icon: AlertTriangle,
        className:
            "bg-[#f59e0b]/10 text-[#fbbf24] border-[#f59e0b]/10",
    },

    ERROR: {
        icon: AlertCircle,
        className:
            "bg-[#ef4444]/10 text-[#ff8b8b] border-[#ef4444]/10",
    },

    FATAL: {
        icon: Flame,
        className:
            "bg-[#dc2626]/12 text-[#ff9b9b] border-[#dc2626]/12",
    },
} satisfies Record<
    EventSeverity,
    {
        icon: React.ElementType;
        className: string;
    }
>;

export function SeverityBadge({
    severity,
}: Props) {
    const { icon: Icon, className } =
        styles[severity];

    return (
        <Badge
            className={className}
        >
            <Icon className="mr-1.5 h-3.5 w-3.5" />
            {severity}
        </Badge>
    );
}