import { NextRequest, NextResponse } from "next/server";

import {
  addProfessionalService,
  removeProfessionalService,
  updateProfessionalService,
} from "@/lib/professional-services-server";
import { signedInProfessionalId } from "@/lib/professional-route-session";
import { serviceFromBody } from "@/lib/settings-services";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * Settings → Services & prices (user, 2026-10-10). She adds, changes and removes
 * services as she pleases, no founder; each one is recorded (`professional_service_add`
 * / `_update` / `_remove` make the change and its request_log row together).
 * - POST { name, price: amount | null, priceFrom? } → 201 { service: { id, name, price } } ·
 *   400 not usable (with `errors` per field) · 409 already 20, or the name is on her list
 * - PUT { id, name, price, priceFrom? } → 200 { service, changed } · 400 · 404 not hers ·
 *   409 the name is on her list
 * - DELETE ?id=… → 200 · 400 no id · 404 not hers
 * All: 401 signed out · 403 not a professional.
 */
export async function POST(req: NextRequest) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;

  const check = serviceFromBody(await req.json().catch(() => null));
  if (check.ok === false) {
    const message = Object.values(check.errors)[0] ?? "Check the service.";
    return NextResponse.json({ message, errors: check.errors }, { status: 400 });
  }
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await addProfessionalService(service, { professionalId: pro.id, service: check.service });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ service: result.service }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;

  const body = await req.json().catch(() => null);
  const serviceId = typeof body?.id === "string" ? body.id.trim() : "";
  if (!serviceId) return NextResponse.json({ message: "Missing id." }, { status: 400 });
  const check = serviceFromBody(body);
  if (check.ok === false) {
    const message = Object.values(check.errors)[0] ?? "Check the service.";
    return NextResponse.json({ message, errors: check.errors }, { status: 400 });
  }
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await updateProfessionalService(service, {
    professionalId: pro.id,
    serviceId,
    service: check.service,
  });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ service: result.service, changed: result.changed });
}

export async function DELETE(req: NextRequest) {
  const pro = await signedInProfessionalId();
  if (pro instanceof NextResponse) return pro;

  const serviceId = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!serviceId) return NextResponse.json({ message: "Missing id." }, { status: 400 });
  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Temporarily unavailable." }, { status: 503 });

  const result = await removeProfessionalService(service, { professionalId: pro.id, serviceId });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ ok: true });
}
