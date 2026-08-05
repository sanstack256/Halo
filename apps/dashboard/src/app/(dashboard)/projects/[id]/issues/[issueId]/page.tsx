import { notFound } from "next/navigation";
import { getIssue } from "@/actions/issue";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";


type Props = {
    params: Promise<{
        id: string;
        issueId: string;
    }>;
};

export default async function IssuePage({
    params,
}: Props) {

    const { issueId } = await params;

    const issue = await getIssue(issueId);

    if (!issue) {
        notFound();
    }

    return (
        <div className="space-y-8">

            <div className="rounded-xl border p-6 space-y-6">

                <div className="space-y-2">

                    <h1 className="text-3xl font-bold">
                        {issue.title}
                    </h1>

                    <div className="flex items-center gap-3">

                        <Badge>
                            {issue.status}
                        </Badge>

                        <Badge variant="outline">
                            {issue.severity}
                        </Badge>

                    </div>

                </div>

                <div className="grid grid-cols-3 gap-6">

                    <div>

                        <p className="text-sm text-muted-foreground">
                            Occurrences
                        </p>

                        <p className="text-xl font-semibold">
                            {issue.eventCount}
                        </p>

                    </div>

                    <div>

                        <p className="text-sm text-muted-foreground">
                            First Seen
                        </p>

                        <p>
                            {issue.firstSeen.toLocaleString()}
                        </p>

                    </div>

                    <div>

                        <p className="text-sm text-muted-foreground">
                            Last Seen
                        </p>

                        <p>
                            {issue.lastSeen.toLocaleString()}
                        </p>

                    </div>

                </div>

            </div>

            <div className="rounded-xl border overflow-hidden">

                <div className="border-b p-4">

                    <h2 className="font-semibold">
                        Timeline
                    </h2>

                </div>

                <div className="divide-y">

                    {issue.events.map((event) => (

                        <Link
                            key={event.id}
                            href={`/projects/${issue.projectId}/events/${event.id}`}
                            className="block p-5 space-y-4 hover:bg-muted/30 transition-colors"
                        >

                            <div className="flex items-center gap-3">

                                <Badge>
                                    {event.type}
                                </Badge>

                                <Badge variant="outline">
                                    {event.severity}
                                </Badge>

                            </div>

                            <div>

                                <h3 className="font-semibold">
                                    {event.title}
                                </h3>

                                {event.message && (
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        {event.message}
                                    </p>
                                )}

                            </div>

                            <div className="grid grid-cols-2 gap-6 text-sm">

                                <div>

                                    <p className="text-muted-foreground">
                                        SDK
                                    </p>

                                    <p>
                                        {event.sdkName ?? "-"}{" "}
                                        {event.sdkVersion ?? ""}
                                    </p>

                                </div>

                                <div>

                                    <p className="text-muted-foreground">
                                        Timestamp
                                    </p>

                                    <p>
                                        {event.timestamp.toLocaleString()}
                                    </p>

                                </div>

                            </div>

                        </Link>

                    ))}

                </div>


            </div>

        </div>

    );
}