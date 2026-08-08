type User = {
    id?: string;
    email?: string;
    username?: string;
};

type Props = {
    user: User;
};

export default function User({
    user,
}: Props) {
    return (
        <section>

            <h2 className="mb-5 text-lg font-semibold">
                User
            </h2>

            <div className="overflow-hidden rounded-xl border border-border bg-surface">

                {user.id && (
                    <Row
                        label="ID"
                        value={user.id}
                    />
                )}

                {user.email && (
                    <Row
                        label="Email"
                        value={user.email}
                    />
                )}

                {user.username && (
                    <Row
                        label="Username"
                        value={user.username}
                        isLast
                    />
                )}

            </div>

        </section>
    );
}

function Row({
    label,
    value,
    isLast = false,
}: {
    label: string;
    value: string;
    isLast?: boolean;
}) {
    return (
        <div
            className={`
                flex items-center justify-between
                px-6 py-4
                ${!isLast ? "border-b border-border" : ""}
            `}
        >

            <span className="font-medium">
                {label}
            </span>

            <span className="font-mono text-sm text-secondary">
                {value}
            </span>

        </div>
    );
}