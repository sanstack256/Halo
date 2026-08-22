import Link from "next/link";

export default function IssuesLayout({
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
