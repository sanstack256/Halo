import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";
import { getUserOrgEntitlements } from "@/lib/entitlements";
import { UsageBar } from "@/components/ui/usage-bar";
import { prisma } from "@/lib/prisma";

export default async function UsagePage() {
    const session = await getSession();
    if (!session) return null;
    const org = await getOrganization(session.user.id);
    if (!org) return null;

    const { plan } = await getUserOrgEntitlements(session.user.id);

    // Count real events in the last 30 days
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [projectCount, eventCount] = await Promise.all([
        prisma.project.count({ where: { organizationId: org.id } }),
        prisma.event.count({
            where: {
                project: { organizationId: org.id },
                timestamp: { gte: since },
            },
        }),
    ]);

    const limits = plan.limits;

    return (
        <div className="space-y-8 pb-16">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Usage</h1>
                <p className="halo-page-description">
                    Your organization&apos;s current resource usage against plan limits.
                </p>
            </div>

            <div className="halo-card p-6 space-y-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3">
                    This Month
                </h2>

                <div className="space-y-6">
                    <UsageBar
                        label="Telemetry Events"
                        current={eventCount}
                        max={limits.maxEventsPerMonth}
                        unit="events"
                    />
                    <UsageBar
                        label="Projects"
                        current={projectCount}
                        max={limits.maxProjects}
                        unit="projects"
                    />
                </div>
            </div>

            <div className="halo-card p-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3 mb-4">
                    Plan Limits
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: "Retention", value: `${limits.retentionDays} days` },
                        { label: "Max Projects", value: limits.maxProjects >= 999 ? "Unlimited" : limits.maxProjects },
                        { label: "Max Members", value: limits.maxMembers >= 999 ? "Unlimited" : limits.maxMembers },
                        {
                            label: "AI Investigations/mo",
                            value: limits.maxAiInvestigationsPerMonth === null ? "Unlimited" : limits.maxAiInvestigationsPerMonth,
                        },
                    ].map(({ label, value }) => (
                        <div key={label} className="p-3 rounded-lg bg-surface border border-border text-center">
                            <p className="text-sm font-semibold text-white">{value}</p>
                            <p className="text-xs text-muted mt-0.5">{label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
