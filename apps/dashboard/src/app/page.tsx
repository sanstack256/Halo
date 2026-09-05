import { Metadata } from "next";
import LandingPage from "@/components/landing/landing-page";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Halo — Autonomous Investigation Engine",
  description:
    "Understand what actually broke. Halo turns production telemetry into evidence-backed investigations — showing what happened, what the evidence supports, and what remains unknown.",
};

export default async function HomePage() {
  const session = await getSession().catch(() => null);
  const isAuthenticated = Boolean(session?.user);

  return <LandingPage isAuthenticated={isAuthenticated} />;
}