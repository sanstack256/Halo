"use client";

import { useState, useTransition } from "react";
import {
    saveProjectAiConfig,
    testProjectAiConnection,
    disconnectProjectAi,
} from "@/actions/project-ai";
import {
    AiProvider,
    AiConnectionStatus,
    type SafeAiConfig,
    type AiConnectionTestResult,
} from "@/lib/investigation/recommendation-engine/types";
import {
    Bot,
    Sparkles,
    Key,
    ShieldCheck,
    CheckCircle2,
    XCircle,
    Loader2,
    AlertTriangle,
    Eye,
    EyeOff,
    Cpu,
    ExternalLink,
    RefreshCw,
} from "lucide-react";
import { HaloSelect } from "@/components/ui/halo-select";

interface AiSettingsCardProps {
    projectId: string;
    initialConfig: SafeAiConfig;
}

const PROVIDER_OPTIONS = [
    { value: AiProvider.HALO_MANAGED, label: "Halo Managed AI (Default — Zero-Config Engine)" },
    { value: AiProvider.GEMINI, label: "Google Gemini (BYOK — Custom API Key)" },
    { value: AiProvider.OPENAI, label: "OpenAI (BYOK — Custom API Key)" },
] as const;

const GEMINI_MODEL_OPTIONS = [
    { value: "gemini-2.5-flash", label: "gemini-2.5-flash (Recommended — Low Latency & High Speed)" },
    { value: "gemini-1.5-pro", label: "gemini-1.5-pro (Complex Reasoning)" },
    { value: "gemini-1.5-flash", label: "gemini-1.5-flash (Fast Lightweight)" },
] as const;

const OPENAI_MODEL_OPTIONS = [
    { value: "gpt-4o", label: "gpt-4o (Recommended — Flagship Model)" },
    { value: "gpt-4o-mini", label: "gpt-4o-mini (Fast & Cost-Effective)" },
    { value: "o3-mini", label: "o3-mini (High-Reasoning Benchmark)" },
] as const;

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"];
const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "o3-mini"];

export function AiSettingsCard({ projectId, initialConfig }: AiSettingsCardProps) {
    const [config, setConfig] = useState<SafeAiConfig>(initialConfig);
    const [selectedProvider, setSelectedProvider] = useState<AiProvider>(initialConfig.provider);
    const [model, setModel] = useState<string>(
        initialConfig.model ||
            (initialConfig.provider === AiProvider.OPENAI ? "gpt-4o" : "gemini-2.5-flash")
    );
    const [apiKey, setApiKey] = useState<string>("");
    const [isReplacingKey, setIsReplacingKey] = useState<boolean>(!initialConfig.hasKey);
    const [showKey, setShowKey] = useState<boolean>(false);

    const [isSaving, startSaving] = useTransition();
    const [isTesting, startTesting] = useTransition();
    const [testResult, setTestResult] = useState<AiConnectionTestResult | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const isDirty =
        selectedProvider !== config.provider ||
        Boolean(apiKey) ||
        (model && model !== config.model);

    const handleProviderChange = (newProvider: AiProvider) => {
        setSelectedProvider(newProvider);
        setMessage(null);
        setTestResult(null);
        if (newProvider === AiProvider.OPENAI && (!model || model.includes("gemini"))) {
            setModel("gpt-4o");
        } else if (newProvider === AiProvider.GEMINI && (!model || model.includes("gpt") || model.includes("o3"))) {
            setModel("gemini-2.5-flash");
        }
    };

    const handleTest = () => {
        setMessage(null);
        setTestResult(null);
        startTesting(async () => {
            const res = await testProjectAiConnection(
                projectId,
                selectedProvider,
                apiKey ? apiKey : undefined,
                model
            );
            setTestResult(res);
            if (res.success) {
                setConfig((prev) => ({
                    ...prev,
                    status: AiConnectionStatus.CONNECTED,
                    lastTestedAt: new Date(),
                }));
            } else {
                setConfig((prev) => ({
                    ...prev,
                    status: AiConnectionStatus.FAILED,
                    lastTestedAt: new Date(),
                }));
            }
        });
    };

    const handleSave = () => {
        setMessage(null);
        setTestResult(null);
        startSaving(async () => {
            try {
                const res = await saveProjectAiConfig(projectId, {
                    provider: selectedProvider,
                    apiKey: apiKey ? apiKey : undefined,
                    model: selectedProvider === AiProvider.HALO_MANAGED ? undefined : model,
                });

                if (res.success) {
                    setConfig({
                        provider: selectedProvider,
                        status: res.status,
                        model: selectedProvider === AiProvider.HALO_MANAGED ? null : model,
                        hasKey: selectedProvider === AiProvider.HALO_MANAGED ? false : Boolean(apiKey || config.hasKey),
                        maskedKey: apiKey ? `••••••••••••${apiKey.trim().slice(-4)}` : config.maskedKey,
                        lastTestedAt: new Date(),
                    });
                    setApiKey("");
                    setIsReplacingKey(false);
                    setMessage({
                        type: "success",
                        text: `${selectedProvider === AiProvider.HALO_MANAGED ? "Halo Managed AI" : selectedProvider} configuration saved and verified.`,
                    });
                } else {
                    setMessage({
                        type: "error",
                        text: res.errorMessage || "Failed to verify AI provider connection.",
                    });
                }
            } catch (err) {
                setMessage({
                    type: "error",
                    text: err instanceof Error ? err.message : "Failed to save AI configuration.",
                });
            }
        });
    };

    const handleRevertToHaloManaged = () => {
        setMessage(null);
        setTestResult(null);
        startSaving(async () => {
            try {
                await disconnectProjectAi(projectId);
                setSelectedProvider(AiProvider.HALO_MANAGED);
                setConfig({
                    provider: AiProvider.HALO_MANAGED,
                    status: AiConnectionStatus.CONNECTED,
                    model: null,
                    hasKey: false,
                    maskedKey: undefined,
                    lastTestedAt: new Date(),
                });
                setApiKey("");
                setIsReplacingKey(true);
                setMessage({
                    type: "success",
                    text: "Reverted to Halo Managed AI successfully.",
                });
            } catch (err) {
                setMessage({
                    type: "error",
                    text: err instanceof Error ? err.message : "Failed to revert AI provider.",
                });
            }
        });
    };

    return (
        <div className="halo-card p-6 space-y-6 border border-border/80 bg-surface/50 rounded-xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-surface-elevated border border-border">
                        <Sparkles size={20} className="text-primary" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-semibold text-white">
                                AI Recommendation & Patch Engine
                            </h2>
                            {config.status === AiConnectionStatus.CONNECTED && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 size={12} />
                                    Active
                                </span>
                            )}
                            {config.status === AiConnectionStatus.FAILED && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                                    <AlertTriangle size={12} />
                                    Error
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-secondary mt-0.5">
                            Powers automated root cause explanations, developer recommendations, and proposed patches bound to verified telemetry.
                        </p>
                    </div>
                </div>

                {config.provider !== AiProvider.HALO_MANAGED && (
                    <button
                        type="button"
                        onClick={handleRevertToHaloManaged}
                        disabled={isSaving}
                        className="halo-btn halo-btn-sm halo-btn-secondary self-start sm:self-auto text-xs text-muted hover:text-white"
                    >
                        <RefreshCw size={12} />
                        Revert to Halo Managed
                    </button>
                )}
            </div>

            {/* Notification message */}
            {message && (
                <div
                    className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                        message.type === "success"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                            : "bg-red-500/10 border-red-500/20 text-red-300"
                    }`}
                >
                    {message.type === "success" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {message.text}
                </div>
            )}

            {/* AI Service Provider & Model Dropdown */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-secondary uppercase tracking-wider">
                        AI Service Provider / Model
                    </label>
                    <span className="text-[11px] text-muted font-mono">
                        Active: {selectedProvider === AiProvider.HALO_MANAGED ? "Halo Managed AI (Default)" : selectedProvider}
                    </span>
                </div>
                <HaloSelect
                    value={selectedProvider}
                    onChange={(val) => handleProviderChange(val as AiProvider)}
                    options={PROVIDER_OPTIONS}
                    placeholder="Select AI Model / Service"
                    ariaLabel="Active AI Provider"
                    className="w-full"
                    triggerClassName="w-full py-2.5 px-3 text-xs bg-surface-elevated border border-border text-white rounded-lg flex items-center justify-between font-medium"
                />
            </div>

            {/* Provider Selection Cards */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-secondary uppercase tracking-wider">
                    Quick Select
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Halo Managed AI */}
                    <div
                        onClick={() => handleProviderChange(AiProvider.HALO_MANAGED)}
                        className={`cursor-pointer rounded-xl p-4 border transition-all ${
                            selectedProvider === AiProvider.HALO_MANAGED
                                ? "bg-primary/10 border-primary shadow-sm"
                                : "bg-surface-elevated/40 border-border hover:border-border/80 hover:bg-surface-elevated"
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Bot size={18} className={selectedProvider === AiProvider.HALO_MANAGED ? "text-primary" : "text-muted"} />
                                <span className="text-xs font-semibold text-white">Halo Managed AI</span>
                            </div>
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-white/10 text-white/80 font-mono">
                                Default
                            </span>
                        </div>
                        <p className="text-[11px] text-secondary leading-relaxed">
                            Zero setup required. Automated evidence synthesis hosted on Halo's high-speed inference pipeline.
                        </p>
                    </div>

                    {/* Google Gemini */}
                    <div
                        onClick={() => handleProviderChange(AiProvider.GEMINI)}
                        className={`cursor-pointer rounded-xl p-4 border transition-all ${
                            selectedProvider === AiProvider.GEMINI
                                ? "bg-primary/10 border-primary shadow-sm"
                                : "bg-surface-elevated/40 border-border hover:border-border/80 hover:bg-surface-elevated"
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Sparkles size={18} className={selectedProvider === AiProvider.GEMINI ? "text-amber-400" : "text-muted"} />
                                <span className="text-xs font-semibold text-white">Google Gemini</span>
                            </div>
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-300 font-mono">
                                BYOK
                            </span>
                        </div>
                        <p className="text-[11px] text-secondary leading-relaxed">
                            Bring your own Google AI Studio key. Supports gemini-2.5-flash with low latency and large context windows.
                        </p>
                    </div>

                    {/* OpenAI */}
                    <div
                        onClick={() => handleProviderChange(AiProvider.OPENAI)}
                        className={`cursor-pointer rounded-xl p-4 border transition-all ${
                            selectedProvider === AiProvider.OPENAI
                                ? "bg-primary/10 border-primary shadow-sm"
                                : "bg-surface-elevated/40 border-border hover:border-border/80 hover:bg-surface-elevated"
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Cpu size={18} className={selectedProvider === AiProvider.OPENAI ? "text-cyan-400" : "text-muted"} />
                                <span className="text-xs font-semibold text-white">OpenAI</span>
                            </div>
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-cyan-500/10 text-cyan-300 font-mono">
                                BYOK
                            </span>
                        </div>
                        <p className="text-[11px] text-secondary leading-relaxed">
                            Bring your own OpenAI API key. Compatible with gpt-4o and gpt-4o-mini with JSON schema enforcement.
                        </p>
                    </div>
                </div>
            </div>

            {/* Provider Configuration Details */}
            {selectedProvider === AiProvider.HALO_MANAGED ? (
                <div className="rounded-lg bg-surface-elevated/30 border border-border p-4 flex items-start gap-3 text-xs text-secondary">
                    <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="font-medium text-white">Managed Zero-Config Engine Active</p>
                        <p className="leading-relaxed">
                            Halo provides managed root-cause analysis and proposed patch generation with zero additional configuration.
                            All recommendations are strictly bound to verified runtime evidence and deterministic AST validation.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 pt-2 border-t border-border/60">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* API Key Input */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-secondary">
                                    {selectedProvider === AiProvider.GEMINI ? "Gemini API Key" : "OpenAI API Key"}
                                </label>
                                {config.hasKey && selectedProvider === config.provider && !isReplacingKey && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsReplacingKey(true);
                                            setApiKey("");
                                        }}
                                        className="text-[11px] text-primary hover:underline"
                                    >
                                        Change key
                                    </button>
                                )}
                            </div>

                            {config.hasKey && selectedProvider === config.provider && !isReplacingKey ? (
                                <div className="relative flex items-center">
                                    <Key size={13} className="absolute left-3 text-muted" />
                                    <input
                                        type="text"
                                        value={config.maskedKey || "••••••••••••••••"}
                                        readOnly
                                        className="w-full pl-8 pr-3 py-2 text-xs font-mono rounded-lg bg-surface-elevated/50 border border-border text-secondary focus:outline-none cursor-not-allowed"
                                    />
                                </div>
                            ) : (
                                <div className="relative flex items-center">
                                    <Key size={13} className="absolute left-3 text-muted" />
                                    <input
                                        type={showKey ? "text" : "password"}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder={
                                            selectedProvider === AiProvider.GEMINI
                                                ? "AIzaSy..."
                                                : "sk-proj-..."
                                        }
                                        className="w-full pl-8 pr-10 py-2 text-xs font-mono rounded-lg bg-surface-elevated border border-border text-white placeholder:text-muted focus:outline-none focus:border-primary"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowKey(!showKey)}
                                        className="absolute right-3 text-muted hover:text-white"
                                    >
                                        {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                </div>
                            )}

                            <p className="text-[11px] text-muted flex items-center gap-1">
                                <ShieldCheck size={11} className="text-emerald-400" />
                                Encrypted at rest using AES-256-GCM. Never logged or exposed to client.
                            </p>
                        </div>

                        {/* Model Selection Dropdown */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-secondary">
                                Model Identifier
                            </label>
                            <HaloSelect
                                value={model}
                                onChange={(val) => setModel(val)}
                                options={
                                    selectedProvider === AiProvider.GEMINI
                                        ? GEMINI_MODEL_OPTIONS
                                        : OPENAI_MODEL_OPTIONS
                                }
                                placeholder="Select a model"
                                ariaLabel="Select Model"
                                className="w-full"
                                triggerClassName="w-full py-2 px-3 text-xs font-mono bg-surface-elevated border border-border text-white rounded-lg flex items-center justify-between"
                            />
                            {/* Preset Pills */}
                            <div className="flex items-center gap-1.5 pt-1">
                                <span className="text-[10px] text-muted">Quick:</span>
                                {(selectedProvider === AiProvider.GEMINI ? GEMINI_MODELS : OPENAI_MODELS).map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setModel(m)}
                                        className={`px-2 py-0.5 text-[10px] rounded border font-mono transition-colors ${
                                            model === m
                                                ? "bg-primary/20 border-primary text-primary"
                                                : "bg-surface-elevated border-border text-secondary hover:text-white hover:border-border/80"
                                        }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Test Connection Output */}
                    {testResult && (
                        <div
                            className={`p-3 rounded-lg text-xs border flex items-start gap-2 ${
                                testResult.success
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                                    : "bg-red-500/10 border-red-500/20 text-red-300"
                            }`}
                        >
                            {testResult.success ? (
                                <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                            ) : (
                                <XCircle size={15} className="shrink-0 mt-0.5" />
                            )}
                            <div>
                                <p className="font-semibold">
                                    {testResult.success ? "Connection Verified" : "Connection Failed"}
                                </p>
                                <p className="text-[11px] mt-0.5 opacity-90">
                                    {testResult.success
                                        ? `Successfully reached ${testResult.provider} using model ${testResult.model}. Ready for live evidence synthesis.`
                                        : testResult.errorMessage}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-border/80">
                <div className="text-[11px] text-muted">
                    {config.lastTestedAt && (
                        <span>
                            Last tested: {new Date(config.lastTestedAt).toLocaleString()}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {selectedProvider !== AiProvider.HALO_MANAGED && (
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={isTesting || isSaving || (!apiKey && !config.hasKey)}
                            className="halo-btn halo-btn-secondary gap-1 text-xs"
                        >
                            {isTesting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                            Test Connection
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || isTesting || (selectedProvider !== AiProvider.HALO_MANAGED && !apiKey && !config.hasKey)}
                        className="halo-btn halo-btn-primary gap-1 text-xs"
                    >
                        {isSaving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        Save AI Configuration
                    </button>
                </div>
            </div>
        </div>
    );
}
