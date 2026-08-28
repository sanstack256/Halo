"use client";

import { useState, useTransition } from "react";
import {
    updateProjectGitHubConfig,
    disconnectProjectGitHub,
    testGitHubConnection,
    type SafeGitHubConfig,
    type GitHubConnectionTestResult,
} from "@/actions/project-github";
import { GitBranch, GitFork, ShieldCheck, CheckCircle2, XCircle, Loader2, AlertTriangle, Key, ExternalLink } from "lucide-react";

interface GitHubSettingsCardProps {
    projectId: string;
    initialConfig: SafeGitHubConfig;
}

export function GitHubSettingsCard({ projectId, initialConfig }: GitHubSettingsCardProps) {
    const [config, setConfig] = useState<SafeGitHubConfig>(initialConfig);
    const [owner, setOwner] = useState(initialConfig.owner ?? "");
    const [repo, setRepo] = useState(initialConfig.repo ?? "");
    const [defaultBranch, setDefaultBranch] = useState(initialConfig.defaultBranch ?? "main");
    const [token, setToken] = useState("");
    const [showTokenInput, setShowTokenInput] = useState(false);

    const [isSaving, startSaving] = useTransition();
    const [isTesting, startTesting] = useTransition();
    const [testResult, setTestResult] = useState<GitHubConnectionTestResult | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleSave = () => {
        setMessage(null);
        startSaving(async () => {
            try {
                await updateProjectGitHubConfig(projectId, {
                    owner,
                    repo,
                    defaultBranch,
                    token: token ? token : undefined,
                });
                setConfig({
                    configured: true,
                    owner,
                    repo,
                    defaultBranch,
                    hasCustomToken: Boolean(token) || config.hasCustomToken,
                });
                setToken("");
                setShowTokenInput(false);
                setMessage({ type: "success", text: "GitHub repository configuration saved." });
            } catch (err) {
                setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save configuration." });
            }
        });
    };

    const handleTest = () => {
        setTestResult(null);
        startTesting(async () => {
            const res = await testGitHubConnection(projectId);
            setTestResult(res);
        });
    };

    const handleDisconnect = () => {
        setMessage(null);
        startSaving(async () => {
            try {
                await disconnectProjectGitHub(projectId);
                setConfig({ configured: false });
                setOwner("");
                setRepo("");
                setDefaultBranch("main");
                setToken("");
                setTestResult(null);
                setMessage({ type: "success", text: "GitHub repository disconnected." });
            } catch (err) {
                setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to disconnect." });
            }
        });
    };

    return (
        <div className="halo-card p-6 space-y-6 border border-border/80 bg-surface/50 rounded-xl">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-surface-elevated border border-border">
                        <GitFork size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-white">Source Control (GitHub)</h2>
                        <p className="text-xs text-secondary">
                            Link a GitHub repository to enable commit-aware AST source reconstruction and highlight exact failing lines in investigations.
                        </p>
                    </div>
                </div>

                {config.configured && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Connected
                    </span>
                )}
            </div>

            {message && (
                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    message.type === "success"
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                }`}>
                    {message.type === "success" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-secondary">Repository Owner / Organization</label>
                    <input
                        type="text"
                        value={owner}
                        onChange={(e) => setOwner(e.target.value)}
                        placeholder="e.g. acme-corp"
                        className="w-full px-3 py-2 text-xs rounded-lg bg-surface-elevated border border-border text-white placeholder:text-muted focus:outline-none focus:border-primary"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-secondary">Repository Name</label>
                    <input
                        type="text"
                        value={repo}
                        onChange={(e) => setRepo(e.target.value)}
                        placeholder="e.g. web-app"
                        className="w-full px-3 py-2 text-xs rounded-lg bg-surface-elevated border border-border text-white placeholder:text-muted focus:outline-none focus:border-primary"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-secondary">Default Branch (Fallback)</label>
                    <div className="relative">
                        <GitBranch size={13} className="absolute left-3 top-2.5 text-muted" />
                        <input
                            type="text"
                            value={defaultBranch}
                            onChange={(e) => setDefaultBranch(e.target.value)}
                            placeholder="main"
                            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-surface-elevated border border-border text-white placeholder:text-muted focus:outline-none focus:border-primary"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-secondary">Personal Access Token (Private Repos)</label>
                        {config.hasCustomToken && !showTokenInput && (
                            <button
                                type="button"
                                onClick={() => setShowTokenInput(true)}
                                className="text-[11px] text-primary hover:underline"
                            >
                                Replace token
                            </button>
                        )}
                    </div>
                    {config.hasCustomToken && !showTokenInput ? (
                        <div className="px-3 py-2 text-xs rounded-lg bg-surface-elevated border border-border text-secondary flex items-center justify-between">
                            <span className="font-mono">••••••••••••••••••••••••</span>
                            <span className="text-[10px] text-emerald-400 font-medium">Configured</span>
                        </div>
                    ) : (
                        <div className="relative">
                            <Key size={13} className="absolute left-3 top-2.5 text-muted" />
                            <input
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="github_pat_... (stored securely server-side)"
                                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-surface-elevated border border-border text-white placeholder:text-muted focus:outline-none focus:border-primary"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || !owner || !repo}
                        className="px-4 py-1.5 text-xs font-medium rounded-lg bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                        {isSaving && <Loader2 size={13} className="animate-spin" />}
                        Save Configuration
                    </button>

                    {config.configured && (
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={isTesting}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-elevated border border-border text-white hover:bg-surface-elevated/80 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                            {isTesting ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                            Test Connection
                        </button>
                    )}
                </div>

                {config.configured && (
                    <button
                        type="button"
                        onClick={handleDisconnect}
                        disabled={isSaving}
                        className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-50 transition-colors"
                    >
                        Disconnect Repository
                    </button>
                )}
            </div>

            {testResult && (
                <div className={`p-3.5 rounded-lg text-xs space-y-1.5 ${
                    testResult.success
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                        : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
                }`}>
                    <div className="flex items-center gap-2 font-medium">
                        {testResult.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                        {testResult.success ? "GitHub Connection Verified" : "GitHub Connection Failed"}
                    </div>
                    {testResult.success ? (
                        <p className="text-[11px] text-emerald-400/80">
                            Successfully accessed <span className="font-semibold">{testResult.repositoryFullName}</span> ({testResult.isPrivate ? "Private" : "Public"}). Default branch: <span className="font-mono">{testResult.defaultBranch}</span>.
                        </p>
                    ) : (
                        <p className="text-[11px] text-rose-400/90">{testResult.errorMessage}</p>
                    )}
                </div>
            )}
        </div>
    );
}
