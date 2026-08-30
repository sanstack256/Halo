import MonitorsPage from "../page";

export default async function SlosMonitorsPage() {
    return MonitorsPage({
        searchParams: Promise.resolve({ type: "METRIC" }),
    });
}
