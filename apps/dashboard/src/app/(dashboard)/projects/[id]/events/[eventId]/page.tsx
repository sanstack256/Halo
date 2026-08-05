import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getEvent } from "@/actions/event";

type Props = {
    params: Promise<{
        id: string;
        eventId: string;
    }>;
};

export default async function EventPage({
    params,
}: Props) {
    const { eventId } = await params;

    const event = await getEvent(eventId);

    if (!event) {
        notFound();
    }

    return (
        <div className="space-y-8">

            <div className="rounded-xl border p-6 space-y-6">

                <div>

                    <h1 className="text-3xl font-bold">
                        {event.title}
                    </h1>

                    <div className="mt-3 flex items-center gap-3">

                        <Badge>
                            {event.type}
                        </Badge>

                        <Badge variant="outline">
                            {event.severity}
                        </Badge>

                    </div>

                </div>

                <div className="grid grid-cols-2 gap-6">

                    <div>

                        <p className="text-sm text-muted-foreground">
                            Timestamp
                        </p>

                        <p>
                            {event.timestamp.toLocaleString()}
                        </p>

                    </div>

                    <div>

                        <p className="text-sm text-muted-foreground">
                            Issue
                        </p>

                        <p>
                            {event.issue?.title ?? "-"}
                        </p>

                    </div>

                    <div>

                        <p className="text-sm text-muted-foreground">
                            SDK
                        </p>

                        <p>
                            {event.sdkName ?? "-"}{" "}
                            {event.sdkVersion ?? ""}
                        </p>

                    </div>

                    <div>

                        <p className="text-sm text-muted-foreground">
                            Release
                        </p>

                        <p>
                            {event.release ?? "-"}
                        </p>

                    </div>

                </div>

            </div>

            <div className="rounded-xl border">

                <div className="border-b p-4 font-semibold">
                    Message
                </div>

                <pre className="overflow-x-auto p-6 text-sm">
                    {event.message ?? "No message"}
                </pre>

            </div>

            <div className="rounded-xl border">

                <div className="border-b p-4 font-semibold">
                    Metadata
                </div>

                <pre className="overflow-x-auto p-6 text-sm">
                    {JSON.stringify(
                        event.metadata,
                        null,
                        2
                    )}
                </pre>

            </div>

        </div>
    );
}