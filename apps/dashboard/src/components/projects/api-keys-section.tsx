import CreateApiKeyDialog from "./create-api-key-dialog";
import { formatDistanceToNow } from "date-fns";

type ApiKey = {
    id: string;
    name: string;
    prefix: string;
    createdAt: Date;
    lastUsedAt: Date | null;
};

type Props = {
    projectId: string;
    apiKeys: ApiKey[];
};

export default function ApiKeysSection({
    projectId,
    apiKeys,
}: Props) {
    return (
        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-800 p-6">
                <div>
                    <h2 className="text-xl font-semibold text-white">
                        API Keys
                    </h2>

                    <p className="mt-1 text-sm text-zinc-500">
                        Manage the keys used by your applications.
                    </p>
                </div>

                <CreateApiKeyDialog projectId={projectId} />
            </div>

            {apiKeys.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">
                    No API keys yet.
                </div>
            ) : (
                <div className="divide-y divide-zinc-800">
                    {apiKeys.map((key) => (
                        <div
                            key={key.id}
                            className="flex items-center justify-between p-6"
                        >
                            <div>
                                <h3 className="font-medium text-white">
                                    {key.name}
                                </h3>

                                <p className="mt-1 font-mono text-sm text-zinc-500">
                                    {key.prefix}••••••••••••
                                </p>
                            </div>

                            <div className="text-right text-sm text-zinc-500">
                                <div>
                                    Created{" "}
                                    {formatDistanceToNow(key.createdAt, {
                                        addSuffix: true,
                                    })}
                                </div>

                                <div>
                                    Last Used{" "}
                                    {key.lastUsedAt
                                        ? formatDistanceToNow(key.lastUsedAt, {
                                            addSuffix: true,
                                        })
                                        : "Never"}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}