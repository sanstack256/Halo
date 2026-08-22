import Link from "next/link";
import { Compass } from "lucide-react";

export default function SavedInvestigationsPage() {
    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Saved Investigations</h1>
                <p className="halo-page-description">
                    Bookmarked root cause reports and post-mortem analysis sessions.
                </p>
            </div>

            <div className="halo-empty-state">
                <Compass className="halo-empty-state-icon" />
                <h3 className="halo-empty-state-title">No saved investigations</h3>
                <p className="halo-empty-state-description">
                    Save key investigation reports to easily access root cause analysis and evidence timelines later.
                </p>
                <Link href="/investigate" className="halo-btn halo-btn-primary">
                    Start Investigation
                </Link>
            </div>
        </div>
    );
}
