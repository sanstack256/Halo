import { getEvents } from "@/actions/event";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function EventsPage({
    params,
}: Props) {
    const { id } = await params;

    console.log("Project ID from URL:", id);

    const events = await getEvents(id);

    console.log("Events:", events);


    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">
                    Events
                </h1>

                <p className="text-muted-foreground">
                    Incoming SDK events.
                </p>
            </div>

            <div className="rounded-lg border">
                <table className="w-full">
                    <thead className="border-b">
                        <tr className="text-left">
                            <th className="p-4">Time</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Severity</th>
                            <th className="p-4">Title</th>
                        </tr>
                    </thead>

                    <tbody>
                        {events.map((event) => (
                            <tr
                                key={event.id}
                                className="border-b"
                            >
                                <td className="p-4">
                                    {new Date(
                                        event.timestamp
                                    ).toLocaleString()}
                                </td>

                                <td className="p-4">
                                    {event.type}
                                </td>

                                <td className="p-4">
                                    {event.severity}
                                </td>

                                <td className="p-4">
                                    {event.title}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}