import { formatDistanceToNow } from "date-fns";

type Props = {
    date: Date | string | number;
};

export function RelativeTime({ date }: Props) {
    try {
        const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
        if (!d || isNaN(d.getTime())) {
            return <span className="text-muted">recently</span>;
        }
        return (
            <span className="text-muted">
                {formatDistanceToNow(d, {
                    addSuffix: true,
                })}
            </span>
        );
    } catch {
        return <span className="text-muted">recently</span>;
    }
}