import Link from "next/link";

export default function MonitorsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-6">
            {children}
        </div>
    );
}
