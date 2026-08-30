import MonitorsPage from "../page";

export default async function FiringMonitorsPage() {
    return MonitorsPage({
        searchParams: Promise.resolve({ status: "FIRING" }),
    });
}
