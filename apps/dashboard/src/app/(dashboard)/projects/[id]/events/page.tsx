import { getEvents } from "@/actions/event";
import { EventStreamView } from "@/components/events/event-stream-view";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function EventsPage({ params }: Props) {
    const { id } = await params;
    const events = await getEvents(id);

    return (
        <div className="space-y-8 pb-16">
            <EventStreamView projectId={id} events={events as any} />
        </div>
    );
}