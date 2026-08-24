import { getAllOrgIssues } from "@/actions/issue";
import { IssuesListClient } from "./issues-list-client";

export default async function IssuesPage() {
    const issues = await getAllOrgIssues();

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Issues</h1>
                <p className="halo-page-description">
                    All tracked application errors, unhandled exceptions, and fatal crashes across your organization.
                </p>
            </div>

            <IssuesListClient issues={issues} />
        </div>
    );
}
