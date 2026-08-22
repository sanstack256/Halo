import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";
import { getOrgEntitlements } from "@/lib/entitlements";
import { OrganizationSettingsForm } from "./organization-settings-form";

export default async function OrganizationSettingsPage() {
    const session = await getSession();
    if (!session) return null;

    const organization = await getOrganization(session.user.id);
    if (!organization) return null;

    const { planId, plan } = await getOrgEntitlements(organization.id);

    return (
        <div className="space-y-8 pb-16">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Organization Settings</h1>
                <p className="halo-page-description">
                    Manage organization name, slug, and subscription details.
                </p>
            </div>

            <OrganizationSettingsForm
                organization={{
                    id: organization.id,
                    name: organization.name,
                    slug: organization.slug,
                    planId,
                    planName: plan.name,
                    planTagline: plan.tagline,
                    maxProjects: plan.limits.maxProjects,
                    maxMembers: plan.limits.maxMembers,
                    maxEventsPerMonth: plan.limits.maxEventsPerMonth,
                    retentionDays: plan.limits.retentionDays,
                }}
            />
        </div>
    );
}
