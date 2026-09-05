import Image from "next/image";
import Link from "next/link";
import { PricingGrid } from "./pricing-grid";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Pricing — Halo",
    description:
        "Transparent, developer-friendly pricing for Halo. Start free, upgrade when you need more power.",
};

export default function PricingPage() {
    return (
        <div className="min-h-screen" style={{ background: "#08090a" }}>
            {/* Nav */}
            <header className="flex items-center justify-between px-8 py-5 border-b border-white/5">
                <Link href="/" className="flex items-center gap-2.5 text-white font-bold text-lg">
                    <Image
                        src="/halo-logo.png"
                        alt="Halo"
                        width={28}
                        height={28}
                        priority
                        className="object-contain"
                    />
                    Halo
                </Link>
                <div className="flex items-center gap-3">
                    <Link
                        href="/sign-in"
                        className="text-sm text-white/50 hover:text-white transition-colors"
                    >
                        Sign in
                    </Link>
                    <Link
                        href="/sign-up"
                        className="text-sm font-semibold px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white transition-colors"
                    >
                        Get started
                    </Link>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-20">
                {/* Hero */}
                <div className="text-center space-y-4 mb-16">
                    <h1 className="text-5xl font-extrabold text-white tracking-tight">
                        Simple, honest pricing
                    </h1>
                    <p className="text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
                        Start free. Scale as you grow. Every plan includes the core Halo
                        investigation engine.
                    </p>
                </div>

                <PricingGrid />
            </main>
        </div>
    );
}
