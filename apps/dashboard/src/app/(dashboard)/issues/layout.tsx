import React from "react";
import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";
import { prisma } from "@/lib/prisma";
import { IssuesFilterBar } from "@/components/issues/issues-filter-bar";

export default async function IssuesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();
    let projects: Array<{ id: string; name: string }> = [];
    let services: string[] = [];
    let environments: string[] = [];

    if (session) {
        const organization = await getOrganization(session.user.id);
        if (organization) {
            const orgProjects = await prisma.project.findMany({
                where: { organizationId: organization.id },
                select: {
                    id: true,
                    name: true,
                    environments: { select: { name: true } },
                },
                orderBy: { name: "asc" },
            });

            projects = orgProjects.map((p) => ({ id: p.id, name: p.name }));

            const envSet = new Set<string>();
            for (const p of orgProjects) {
                for (const e of p.environments) {
                    envSet.add(e.name);
                }
            }
            environments = Array.from(envSet).sort();

            const projectIds = orgProjects.map((p) => p.id);
            const rawServices = await prisma.event.groupBy({
                by: ["service"],
                where: {
                    projectId: { in: projectIds },
                    service: { not: null },
                },
            });
            services = rawServices
                .map((s) => s.service)
                .filter((s): s is string => Boolean(s))
                .sort();
        }
    }

    return (
        <div className="space-y-6 pb-16">
            {/* Global Issues Intelligence Header */}
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-widest text-accent font-semibold">
                        Issues Intelligence
                    </span>
                    <span className="text-zinc-600 font-mono text-xs">•</span>
                    <span className="text-[11px] font-mono text-zinc-500">
                        SIGNAL → EVIDENCE → CAUSE → FIX
                    </span>
                </div>
            </div>

            {/* Shared Filter Bar */}
            <IssuesFilterBar
                projects={projects}
                services={services}
                environments={environments}
            />

            {/* Page View Body */}
            <div>{children}</div>
        </div>
    );
}
