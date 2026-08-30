import { notFound } from "next/navigation";
import { getEvent } from "@/actions/event";
import { EventDetailView } from "@/components/events/event-detail-view";

type Props = {
    params: Promise<{
        id: string;
        eventId: string;
    }>;
};

export default async function EventPage({ params }: Props) {
    const { id, eventId } = await params;
    const event = await getEvent(eventId);

    if (!event) {
        notFound();
    }

    return (
        <div className="max-w-6xl mx-auto">
            <EventDetailView projectId={id} event={event} />
        </div>
    );
}