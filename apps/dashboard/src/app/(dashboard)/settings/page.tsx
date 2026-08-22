import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AccountDetailsClient } from "./account-details-client";

export default async function AccountDetailsPage() {
    const session = await getSession();

    if (!session) {
        redirect("/sign-in");
    }

    const user = session.user;

    return (
        <div className="space-y-8 pb-16">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Account Details</h1>
                <p className="halo-page-description">
                    Manage your display name and personal account preferences.
                </p>
            </div>

            <AccountDetailsClient
                user={{
                    id: user.id,
                    name: user.name ?? "",
                    email: user.email ?? "",
                    image: user.image ?? null,
                }}
            />
        </div>
    );
}