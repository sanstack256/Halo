"use client";

import { useState, useTransition } from "react";
import { universalSearch, type SearchResultItem } from "@/actions/search";
import { Compass, FileWarning, FolderKanban, Loader2, Search, Sparkles, Terminal, Waypoints } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function UniversalSearchClient() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [isPending, startTransition] = useTransition();

    function handleSearch(q: string) {
        setQuery(q);
        if (!q.trim()) {
            setResults([]);
            setHasSearched(false);
            return;
        }

        startTransition(async () => {
            const res = await universalSearch(q);
            setResults(res);
            setHasSearched(true);
        });
    }

    function handleStartInvestigation() {
        if (!query.trim()) return;
        // Redirect to investigation with search query
        router.push(`/investigate?q=${encodeURIComponent(query.trim())}`);
    }

    return (
        <div className="space-y-6">
            {/* Search Input Bar */}
            <div className="relative">
                <div className="flex items-center gap-3 p-2.5 rounded-2xl border border-border-strong bg-surface-elevated shadow-lg focus-within:border-accent transition-colors">
                    <Search size={18} className="text-muted ml-2 flex-shrink-0" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && results.length === 0 && query.trim()) {
                                handleStartInvestigation();
                            }
                        }}
                        placeholder="Search issues, services, traces, logs, or describe an incident (e.g. '500 errors on checkout')..."
                        className="w-full bg-transparent text-sm text-white placeholder:text-muted outline-none"
                    />

                    {isPending && <Loader2 size={16} className="animate-spin text-muted mr-2 flex-shrink-0" />}

                    {query.trim() && (
                        <button
                            type="button"
                            onClick={handleStartInvestigation}
                            className="halo-btn halo-btn-sm halo-btn-primary flex-shrink-0 gap-1.5"
                            title="Trigger automated investigation"
                        >
                            <Compass size={13} />
                            Investigate
                        </button>
                    )}
                </div>
            </div>

            {/* Results */}
            {hasSearched && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted px-1">
                        <span>{results.length} result{results.length !== 1 ? "s" : ""} found</span>
                        {query.trim() && (
                            <button
                                type="button"
                                onClick={handleStartInvestigation}
                                className="text-accent hover:underline inline-flex items-center gap-1"
                            >
                                <Compass size={12} />
                                Start Root Cause Investigation on &ldquo;{query}&rdquo;
                            </button>
                        )}
                    </div>

                    {results.length === 0 ? (
                        <div className="halo-card p-8 text-center space-y-3">
                            <p className="text-sm text-secondary">
                                No exact keyword matches found for &ldquo;{query}&rdquo;.
                            </p>
                            <button
                                type="button"
                                onClick={handleStartInvestigation}
                                className="halo-btn halo-btn-primary mx-auto"
                            >
                                <Compass size={14} />
                                Trigger Investigation on this symptom
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {results.map((item) => {
                                const Icon =
                                    item.type === "project"
                                        ? FolderKanban
                                        : item.type === "issue"
                                          ? FileWarning
                                          : item.type === "trace"
                                            ? Waypoints
                                            : Terminal;

                                return (
                                    <Link
                                        key={item.id}
                                        href={item.href}
                                        className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border hover:border-accent/40 transition-colors block"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-border flex items-center justify-center flex-shrink-0 text-accent">
                                                <Icon size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                                                <p className="text-xs text-secondary truncate">{item.subtitle}</p>
                                            </div>
                                        </div>

                                        {item.meta && (
                                            <span className="text-xs font-mono text-muted bg-surface-elevated px-2 py-0.5 rounded border border-border flex-shrink-0">
                                                {item.meta}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
