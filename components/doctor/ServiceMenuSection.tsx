type DoctorService = {
  id: string;
  name: string;
  price: string | null;
};

export function ServiceMenuSection({ services }: { services: DoctorService[] }) {
  if (!services.length) return null;

  return (
    <section className="rounded-2xl border border-clinical-200 bg-white p-5 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_4px_16px_rgba(18,184,192,0.05)]">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-clinical-700">
        Services
      </h2>
      <div className="mt-3 flex items-baseline justify-between gap-4 border-b border-ink-200 pb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        <span>Treatment</span>
        <span className="shrink-0">Price (EUR)</span>
      </div>
      <div className="mt-2 space-y-2">
        {services.map((service) => (
          <div
            key={service.id}
            className="flex items-start justify-between gap-4 border-b border-ink-100 pb-2 last:border-b-0 last:pb-0"
          >
            <p className="text-sm font-medium text-ink-800">{service.name}</p>
            <p className="shrink-0 text-sm text-ink-600">{service.price || "—"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
