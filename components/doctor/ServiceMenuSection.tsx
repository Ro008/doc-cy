type DoctorService = {
  id: string;
  name: string;
  price: string | null;
};

export function ServiceMenuSection({ services }: { services: DoctorService[] }) {
  if (!services.length) return null;

  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-900/45 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#00FFD5]">
        Services
      </h2>
      <div className="mt-3 flex items-baseline justify-between gap-4 border-b border-slate-800/60 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Treatment</span>
        <span className="shrink-0">Price (EUR)</span>
      </div>
      <div className="mt-2 space-y-2">
        {services.map((service) => (
          <div
            key={service.id}
            className="flex items-start justify-between gap-4 border-b border-slate-800/70 pb-2 last:border-b-0 last:pb-0"
          >
            <p className="text-sm text-slate-100">{service.name}</p>
            <p className="shrink-0 text-sm text-slate-400">{service.price || "—"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
