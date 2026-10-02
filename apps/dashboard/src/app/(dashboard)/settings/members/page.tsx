import { getSession } from "@/lib/session";
import { getOrganizationMembers } from "@/actions/organization-members";
import { MembersClient } from "@/components/team/members-client";

export default async function MembersPage() {
    const session = await getSession();
    if (!session) return null;

    const data = await getOrganizationMembers();

    return (
        <div className="space-y-8 pb-16">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Members</h1>
                <p className="halo-page-description">
                    Manage team engineers, access roles, and seat capacity across your organization.
                </p>
            </div>

            <MembersClient
                initialMembers={data.members}
                currentCount={data.currentCount}
                maxAllowed={data.maxAllowed}
                currentPlan={data.planId}
            />
        </div>
    );
}
