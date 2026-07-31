"use client";

import { usePathname } from "next/navigation";

const titles: Record<string, string> = {
  "/overview": "Overview",
  "/projects": "Projects",
  "/incidents": "Incidents",
  "/sdk": "SDK",
  "/settings": "Settings",
};


import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";


export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();

  const title = titles[pathname] ?? "Halo";

  async function handleLogout() {
  const { error } = await authClient.signOut();

  if (error) {
    console.error(error);
    return;
  }

  router.replace("/sign-in");
  router.refresh();
}

  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-8">
      <h1 className="text-lg font-semibold text-white">
        {title}
      </h1>

      <div className="flex items-center gap-4">
        <button className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white">
          Search
        </button>

        <button
          onClick={handleLogout}
          className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"
        >
          Logout
        </button>
      </div>
    </header>
  );
}