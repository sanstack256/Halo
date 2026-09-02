import { formatDistanceToNow } from "date-fns";

import CreateApiKeyDialog from "./create-api-key-dialog";

import { Badge } from "@/components/ui/badge";

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
        <section
            className="
                overflow-hidden
                rounded-xl
                border
                border-border
                bg-surface
            "
        >

            {/* Header */}

            <div
                className="
                    flex
                    items-center
                    justify-between
                    border-b
                    border-border
                    px-7
                    py-6
                "
            >

                <div>

                    <h2 className="text-lg font-semibold text-primary">
                        API Keys
                    </h2>

                    <p className="mt-1 text-sm text-secondary">
                        Manage the keys used by your applications.
                    </p>

                </div>

                <CreateApiKeyDialog
                    projectId={projectId}
                />

            </div>

            {/* Keys */}

            {apiKeys.length === 0 ? (

                <div className="px-7 py-16 text-center">

                    <p className="text-sm text-secondary">
                        No API keys yet.
                    </p>

                    <p className="mt-1 text-xs text-muted">
                        Create an API key to start sending events.
                    </p>

                </div>

            ) : (

                <div>

                    {apiKeys.map((key, index) => (

                        <div
                            key={key.id}
                            className={`
                                flex
                                items-center
                                justify-between
                                gap-8
                                px-7
                                py-5
                                ${
                                    index !== apiKeys.length - 1
                                        ? "border-b border-border"
                                        : ""
                                }
                            `}
                        >

                            {/* Key identity */}

                            <div className="min-w-0">

                                <div className="flex items-center gap-3">

                                    <h3 className="truncate text-sm font-medium text-primary">
                                        {key.name}
                                    </h3>

                                    <Badge>
                                        Production
                                    </Badge>

                                </div>

                                <p className="mt-1 font-mono text-xs text-muted">
                                    {key.prefix}
                                    {"•".repeat(12)}
                                </p>

                            </div>

                            {/* Usage */}

                            <div className="shrink-0 text-right text-xs text-muted">

                                <p>
                                    Created{" "}
                                    {formatDistanceToNow(
                                        key.createdAt,
                                        {
                                            addSuffix: true,
                                        },
                                    )}
                                </p>

                                <p className="mt-1">
                                    Last used{" "}
                                    {key.lastUsedAt
                                        ? formatDistanceToNow(
                                              key.lastUsedAt,
                                              {
                                                  addSuffix: true,
                                              },
                                          )
                                        : "never"}
                                </p>

                            </div>

                        </div>

                    ))}

                </div>

            )}

        </section>
    );
}