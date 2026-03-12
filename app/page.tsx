// app/page.tsx

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-sky-50 px-4">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
          Plataforma de citas médicas
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          DocCy: Gestión de citas médicas en Chipre
        </h1>
        <p className="mt-4 text-sm text-slate-600 sm:text-base">
          Ofrece a tus pacientes una forma moderna, clara y rápida de reservar
          cita con tu clínica o consulta en Chipre. Sin complicaciones.
        </p>
        <div className="mt-8 flex justify-center">
          <a
            href="/dashboard"
            className="inline-flex items-center rounded-full bg-sky-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Ir al Dashboard del Médico
          </a>
        </div>
      </div>
    </main>
  );
}

