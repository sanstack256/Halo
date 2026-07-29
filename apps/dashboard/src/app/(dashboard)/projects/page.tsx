export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-7xl p-8">
      <div>
        <h1 className="text-3xl font-semibold text-white">
          Projects
        </h1>

        <p className="mt-2 text-zinc-400">
          Create and manage the applications that send events to Halo.
        </p>
      </div>

      <div className="mt-16 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950 py-24">
        <div className="text-5xl">📦</div>

        <h2 className="mt-6 text-xl font-semibold text-white">
          No projects yet
        </h2>

        <p className="mt-2 max-w-md text-center text-zinc-500">
          Create your first project to start monitoring your application.
        </p>

        <button className="mt-8 rounded-xl bg-sky-400 px-5 py-3 text-sm font-semibold text-black transition hover:bg-sky-300">
          New Project
        </button>
      </div>
    </div>
  );
}