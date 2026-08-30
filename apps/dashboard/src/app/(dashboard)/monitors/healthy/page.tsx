import MonitorsPage from "../page";

export default async function HealthyMonitorsPage() {
    return MonitorsPage({
        searchParams: Promise.resolve({ status: "HEALTHY" }),
    });
}
