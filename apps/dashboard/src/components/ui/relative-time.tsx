import { formatDistanceToNow } from "date-fns";

type Props = {
    date: Date;
};

export function RelativeTime({ date }: Props) {
    return (
        <span className="text-muted">
            {formatDistanceToNow(date, {
                addSuffix: true,
            })}
        </span>
    );
}