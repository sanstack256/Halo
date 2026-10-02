"use client";

import React, { useState } from "react";
import { type GeneratedPostmortem } from "@/lib/investigation/incident-memory/postmortem-generator";
import { X, Copy, Check, FileText, ShieldAlert, Sparkles, CheckCircle, HelpCircle } from "lucide-react";

interface PostmortemModalProps {
    isOpen: boolean;
    onClose: () => void;
    postmortem: GeneratedPostmortem | null;
    isLoading: boolean;
}

export function PostmortemModal({ isOpen, onClose, postmortem, isLoading }: PostmortemModalProps) {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = () => {
        if (!postmortem?.markdownReport) return;
        navigator.clipboard.writeText(postmortem.markdownReport);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/60">
                    <div className="flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-indigo-400" />
                        <div>
                            <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                                Evidence-Backed Postmortem
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 font-normal">
                                    Deterministic Telemetry
                                </span>
                            </h3>
                            <p className="text-xs text-zinc-400">
                                Synthesized from canonical investigation events, verified causal chains, and peer verdicts.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {postmortem && (
                            <button
                                onClick={handleCopy}
                                className="px-3 py-1.5 text-xs font-mono rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1.5 transition-colors"
                            >
                                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copied ? "Copied Markdown" : "Copy Markdown"}</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-850 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 text-sm text-zinc-300">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center space-y-3">
                            <Sparkles className="w-8 h-8 text-indigo-400 animate-spin" />
                            <span className="text-sm font-mono text-zinc-400">
                                Synthesizing evidence-backed postmortem...
                            </span>
                        </div>
                    ) : !postmortem ? (
                        <div className="py-12 text-center text-zinc-500 font-mono text-xs">
                            No postmortem available.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Executive Summary */}
                            <div className="space-y-1.5 bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/60">
                                <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold block">
                                    1. Executive Summary
                                </span>
                                <p className="text-zinc-300 leading-relaxed text-xs">
                                    {postmortem.summary}
                                </p>
                            </div>

                            {/* Impact & Blast Radius */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5 bg-zinc-900/30 p-3.5 rounded border border-zinc-850">
                                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
                                        Impacted Services ({postmortem.impact.affectedServices.length})
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                        {postmortem.impact.affectedServices.map((svc) => (
                                            <span key={svc} className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-200 border border-zinc-800">
                                                {svc}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1.5 bg-zinc-900/30 p-3.5 rounded border border-zinc-850">
                                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
                                        Detection & Latency
                                    </span>
                                    <p className="text-xs text-zinc-300 font-mono">
                                        First: {new Date(postmortem.detection.firstObserved).toLocaleTimeString()} ({postmortem.detection.triggerType})
                                    </p>
                                </div>
                            </div>

                            {/* Root Cause (Engine vs Human) */}
                            <div className="space-y-2 bg-zinc-900/40 p-4 rounded-lg border border-zinc-800/60">
                                <span className="text-xs font-mono uppercase tracking-wider text-purple-400 font-semibold block">
                                    Root Cause & Human Assessments
                                </span>
                                <div className="text-xs space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-zinc-400 font-mono">Engine Assessment:</span>
                                        <span className="font-semibold text-zinc-100">{postmortem.rootCause.description}</span>
                                    </div>
                                    {postmortem.rootCause.confidenceScore !== null && (
                                        <div className="text-zinc-400 font-mono text-[11px]">
                                            Engine Confidence: {postmortem.rootCause.confidenceScore}% (Requires &gt;= 70% to assert)
                                        </div>
                                    )}
                                </div>

                                {postmortem.rootCause.humanAssessments.length > 0 && (
                                    <div className="pt-2 border-t border-zinc-850 space-y-1">
                                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                                            Team Peer Positions (Explicit Attribution)
                                        </span>
                                        {postmortem.rootCause.humanAssessments.map((ha, idx) => (
                                            <div key={idx} className="text-xs font-mono text-zinc-300">
                                                • <span className="text-zinc-100 font-semibold">{ha.author}</span>:{" "}
                                                <span className="text-indigo-300">{ha.verdict}</span>
                                                {ha.reasoning ? ` ("${ha.reasoning}")` : ""}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* What We Know vs What Remains Uncertain */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-lg">
                                    <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
                                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                                        What We Know
                                    </span>
                                    <ul className="space-y-1 text-xs text-zinc-300">
                                        {postmortem.whatWeKnow.map((item, idx) => (
                                            <li key={idx} className="flex items-start gap-1.5">
                                                <span className="text-emerald-400">•</span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="space-y-2 bg-amber-950/20 border border-amber-500/20 p-4 rounded-lg">
                                    <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                                        <HelpCircle className="w-4 h-4 text-amber-400" />
                                        What Remains Uncertain
                                    </span>
                                    <ul className="space-y-1 text-xs text-zinc-300">
                                        {postmortem.whatRemainsUncertain.map((item, idx) => (
                                            <li key={idx} className="flex items-start gap-1.5">
                                                <span className="text-amber-400">•</span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Evidence Provenance */}
                            <div className="space-y-2">
                                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
                                    Verified Telemetry Evidence Links ({postmortem.evidenceProvenance.length})
                                </span>
                                <div className="space-y-1">
                                    {postmortem.evidenceProvenance.map((ep, idx) => (
                                        <div key={idx} className="p-2 bg-zinc-900/40 rounded border border-zinc-850 flex items-center justify-between text-xs font-mono">
                                            <div className="flex items-center gap-2">
                                                <span className="text-indigo-400 font-bold">{ep.service}</span>
                                                <span className="text-zinc-500">|</span>
                                                <span className="text-zinc-300">{ep.eventId}</span>
                                            </div>
                                            <span className="text-zinc-500 text-[11px]">{ep.note}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
