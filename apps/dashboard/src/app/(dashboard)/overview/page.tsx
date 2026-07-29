export default function OverviewPage() {
  return (
    <div className="p-8">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Projects</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">0</h2>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Incidents</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">0</h2>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Events / day</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">0</h2>
        </div>
      </div>
    </div>
  );
}