import { Suspense } from "react";
import { InternalGateForm } from "./InternalGateForm";

export default function InternalGatePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-400">
          Loading…
        </main>
      }
    >
      <InternalGateForm />
    </Suspense>
  );
}
