import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PlatformHealthView } from "@/components/admin/platform-health-view";
import { planHasCapability } from "@/lib/capabilities";

export default async function SystemHealthPage() {
    const session = await getSession();
    if (!session?.user?.id) return null;

    // Get user's primary organization membership
    const membership = await prisma.organizationMember.findFirst({
        where: { userId: session.user.id },
        include: { organization: true },
        orderBy: { createdAt: "asc" },
    });

    const org = membership?.organization;
    const isOrgAdmin = membership?.role === "OWNER" || membership?.role === "ADMIN";
    const hasHardeningCapability = org
        ? planHasCapability(org.plan as any, "TEAM_PRODUCTION_HARDENING")
        : false;

    return (
        <div className="space-y-6 pb-16">
            <PlatformHealthView
                organizationId={org?.id}
                canRunIntegrityAudit={isOrgAdmin && hasHardeningCapability}
            />
        </div>
    );
}
