"use client";

import * as React from "react";
import { toast } from "sonner";

type Props = {
  specialtyLabel: string | null;
  districtLabel: string | null;
  activeSpecialty: string;
  activeDistrict: string;
  activeSearchName: string;
};

function invitationErrorMessage(reason: string | undefined, status: number): string {
  if (status === 503 || reason === "service_role_not_configured") {
    return "This action is not available on this server (missing configuration).";
  }
  if (reason === "invalid_requested_name") {
    return "Please enter a doctor or clinic name (at least 2 characters).";
  }
  if (reason === "invalid_specialty") {
    return "Please enter their specialty (at least 2 characters).";
  }
  if (reason === "dedupe_lookup_failed") {
    return "We could not record your request. Please try again.";
  }
  if (reason === "table_missing") {
    return "This feature is not active yet: the database needs the latest DocCy migration (table finder_doctor_invitation_requests).";
  }
  if (reason === "insert_failed" || reason === "permission_denied") {
    return "We could not save your request. If you run DocCy, apply pending Supabase migrations and try again.";
  }
  return "Could not record your request. Please try again.";
}

export function FinderMissingDoctorCard({
  specialtyLabel,
  districtLabel,
  activeSpecialty,
  activeDistrict,
  activeSearchName,
}: Props) {
  const [requestedName, setRequestedName] = React.useState("");
  const [specialty, setSpecialty] = React.useState(activeSpecialty);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (activeSpecialty) {
      setSpecialty(activeSpecialty);
    }
  }, [activeSpecialty]);

  const headingPrimary = specialtyLabel
    ? `Can't find your doctor in ${specialtyLabel}?`
    : "Can't find your doctor?";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = requestedName.replace(/\s+/g, " ").trim();
    const trimmedSpecialty = specialty.replace(/\s+/g, " ").trim();
    if (pending) return;
    if (trimmedName.length < 2) {
      toast.error("Please enter a doctor or clinic name.");
      return;
    }
    if (trimmedSpecialty.length < 2) {
      toast.error("Please enter their specialty.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/finder/doctor-invitation-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedName: trimmedName,
          specialty: trimmedSpecialty,
          district: activeDistrict || undefined,
          searchName: activeSearchName || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reason?: string;
        duplicate?: boolean;
      };
      if (!res.ok || !data.ok) {
        toast.error(invitationErrorMessage(data.reason, res.status));
        return;
      }
      toast.success(
        "Thanks! We've saved your suggestion — it helps us know who to add to DocCy next.",
      );
      setRequestedName("");
      if (!activeSpecialty) {
        setSpecialty("");
      }
    } catch {
      toast.error("Could not record your request. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      data-testid="finder-missing-doctor-card"
      className="mx-auto w-full max-w-2xl rounded-2xl border border-ink-200 bg-white p-6 shadow-[0_1px_3px_rgba(26,43,60,0.06),0_8px_24px_rgba(18,184,192,0.08)] sm:p-8"
    >
      <div className="text-center">
        <h2 className="text-lg font-bold leading-snug tracking-tight text-ink-900 sm:text-xl">
          {headingPrimary}
          <span className="mt-1 block text-base font-semibold text-ink-700 sm:text-lg">
            Missing your preferred clinic?
          </span>
        </h2>
        {districtLabel ? (
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-400">
            {districtLabel}
          </p>
        ) : null}
        <p className="mt-4 text-sm leading-relaxed text-ink-600">
          Share the doctor or clinic you had in mind. Every suggestion helps us grow DocCy and add
          more professionals you can book online in Cyprus.
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-left text-xs font-semibold text-ink-700">
            Doctor or clinic name
          </span>
          <input
            type="text"
            value={requestedName}
            onChange={(event) => setRequestedName(event.target.value)}
            placeholder="e.g. Dr Maria Papadopoulos"
            maxLength={120}
            disabled={pending}
            required
            className="w-full rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400 transition focus:border-clinical-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-clinical-200 disabled:opacity-60"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-left text-xs font-semibold text-ink-700">
            Specialty
          </span>
          <input
            type="text"
            value={specialty}
            onChange={(event) => setSpecialty(event.target.value)}
            placeholder="e.g. Dermatology, Physiotherapy, Dentistry"
            maxLength={80}
            disabled={pending}
            required
            className="w-full rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400 transition focus:border-clinical-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-clinical-200 disabled:opacity-60"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center rounded-xl bg-clinical-500 px-5 py-3.5 text-base font-bold text-white shadow-[0_4px_14px_rgba(18,184,192,0.35)] transition hover:bg-clinical-400 hover:shadow-[0_6px_18px_rgba(18,184,192,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Submitting..." : "Suggest a professional"}
        </button>
      </form>
    </div>
  );
}
