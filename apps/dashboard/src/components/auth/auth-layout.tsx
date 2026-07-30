import { ReactNode } from "react";

interface AuthLayoutProps {
    children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-black px-6">
            {children}
        </main>
    );
}