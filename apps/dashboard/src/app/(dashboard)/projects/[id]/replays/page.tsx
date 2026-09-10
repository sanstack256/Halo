import { getProjectReplaysPaginated } from "@/actions/replay";
import { ReplayListView } from "@/components/replay/replay-list-view";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function ReplaysPage({ params }: Props) {
    const { id } = await params;
    const result = await getProjectReplaysPaginated(id, {
        page: 1,
        pageSize: 25,
    });

    return (
        <div className="space-y-8 pb-16">
            <ReplayListView
                projectId={id}
                initialReplays={result.replays as any}
                total={result.total}
                initialPage={result.page}
                pageSize={result.pageSize}
            />
        </div>
    );
}
