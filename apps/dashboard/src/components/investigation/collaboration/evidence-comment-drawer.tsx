"use client";

import React, { useState } from "react";
import { X, MessageSquare, Send, Trash2, Edit2, Check, Clock, User, Link2 } from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import {
    addInvestigationComment,
    editInvestigationComment,
    deleteInvestigationComment,
} from "@/actions/collaboration";
import type { InvestigationCommentTargetType } from "@/generated/prisma/client";

interface CommentItem {
    id: string;
    investigationId: string;
    authorId: string;
    authorName: string;
    authorEmail: string;
    targetType: InvestigationCommentTargetType;
    targetId: string | null;
    evidenceId: string | null;
    metadata: any;
    content: string;
    createdAt: string;
    updatedAt: string;
}

interface TargetProps {
    type: "INVESTIGATION" | "HYPOTHESIS" | "EVIDENCE" | "CAUSAL_EDGE" | "TOPOLOGY_NODE" | "REPLAY";
    id?: string;
    title?: string;
    evidenceId?: string;
}

interface Props {
    investigationId: string;
    target: TargetProps;
    comments: CommentItem[];
    onClose: () => void;
}

export function EvidenceCommentDrawer({
    investigationId,
    target,
    comments,
    onClose,
}: Props) {
    const [newComment, setNewComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [error, setError] = useState<string | null>(null);

    async function handleAddComment(e: React.FormEvent) {
        e.preventDefault();
        if (!newComment.trim()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            await addInvestigationComment({
                investigationId,
                targetType: target.type as InvestigationCommentTargetType,
                targetId: target.id,
                evidenceId: target.evidenceId,
                content: newComment.trim(),
                idempotencyKey: `comment_${investigationId}_${target.type}_${Date.now()}`,
            });
            setNewComment("");
        } catch (err: any) {
            setError(err.message || "Failed to post comment.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleEdit(commentId: string) {
        if (!editContent.trim()) return;
        try {
            await editInvestigationComment({
                commentId,
                content: editContent.trim(),
            });
            setEditingCommentId(null);
            setEditContent("");
        } catch (err: any) {
            setError(err.message || "Failed to update comment.");
        }
    }

    async function handleDelete(commentId: string) {
        if (!confirm("Are you sure you want to remove this investigation annotation?")) return;
        try {
            await deleteInvestigationComment(commentId);
        } catch (err: any) {
            setError(err.message || "Failed to delete comment.");
        }
    }

    return (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-850">
                <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-indigo-400" />
                    <div>
                        <div className="text-sm font-semibold text-zinc-200">
                            {target.title || `${target.type} Discussion`}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-500">
                            Scope: {target.type} {target.id ? `· ${target.id}` : ""}
                        </div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-900 transition"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Error banner */}
            {error && (
                <div className="m-4 p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">
                    {error}
                </div>
            )}

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {comments.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500 text-xs border border-dashed border-zinc-850 rounded-xl">
                        No comments or annotations for this context yet.
                        <div className="text-[11px] text-zinc-600 mt-1">
                            Add technical notes, evidence citations, or reproduction steps below.
                        </div>
                    </div>
                ) : (
                    comments.map((c) => (
                        <div
                            key={c.id}
                            className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2 group"
                        >
                            <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-zinc-200">{c.authorName}</span>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                        <RelativeTime date={new Date(c.createdAt)} />
                                    </span>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                    <button
                                        onClick={() => {
                                            setEditingCommentId(c.id);
                                            setEditContent(c.content);
                                        }}
                                        className="p-1 text-zinc-400 hover:text-zinc-200 rounded"
                                        title="Edit comment"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(c.id)}
                                        className="p-1 text-zinc-400 hover:text-rose-400 rounded"
                                        title="Delete comment"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>

                            {editingCommentId === c.id ? (
                                <div className="space-y-2 pt-1">
                                    <textarea
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        rows={2}
                                        className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => setEditingCommentId(null)}
                                            className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => handleEdit(c.id)}
                                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded font-medium"
                                        >
                                            Save
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                    {c.content}
                                </p>
                            )}

                            {c.evidenceId && (
                                <div className="flex items-center gap-1 pt-1 text-[10px] font-mono text-indigo-400">
                                    <Link2 size={11} />
                                    <span>Anchored Evidence: {c.evidenceId}</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* New Comment Input */}
            <form onSubmit={handleAddComment} className="p-4 border-t border-zinc-850 bg-zinc-950 space-y-2">
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={`Add annotation for ${target.title || target.type}...`}
                    rows={3}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition"
                />

                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">
                        Markdown supported · Contextually linked
                    </span>
                    <button
                        type="submit"
                        disabled={isSubmitting || !newComment.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition"
                    >
                        <Send size={12} />
                        <span>{isSubmitting ? "Posting..." : "Annotate"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
