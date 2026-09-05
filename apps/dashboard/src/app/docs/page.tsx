import type { Metadata } from "next";
import { DocsClient } from "./docs-client";

export const metadata: Metadata = {
  title: "Documentation — Halo",
  description:
    "Comprehensive guides, API references, and telemetry patterns for investigating production issues with Halo.",
};

export default function DocsPage() {
  return <DocsClient />;
}
