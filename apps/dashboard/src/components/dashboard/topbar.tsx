"use client";

import { usePathname } from "next/navigation";

const titles: Record<string, string> = {
  "/overview": "Overview",
  "/projects": "Projects",
  "/incidents": "Incidents",
  "/sdk": "SDK",
  "/settings": "Settings",
};

export default function Topbar() {
  const pathname = usePathname();

  const title = titles[pathname] ?? "Halo";

  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-8">
      <h1 className="text-lg font-semibold text-white">
        {title}
      </h1>

      <div className="flex items-center gap-4">
        <button className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white">
          Search
        </button>

        <div className="h-9 w-9 rounded-full bg-zinc-800" />
      </div>
    </header>
  );
}