import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type CreateBody = {
  doctorId?: string;
  name?: string;
  price?: string | null;
};

type DeleteBody = {
  doctorId?: string;
  serviceId?: string;
};

async function isDoctorOwner(supabase: ReturnType<typeof createRouteHandlerClient>, doctorId: string, userId: string) {
  const { data: owned, error } = await supabase
    .from("doctors")
    .select("id")
    .eq("id", doctorId)
    .eq("auth_user_id", userId)
    .maybeSingle();
  return !error && Boolean(owned);
}

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const doctorId = typeof body.doctorId === "string" ? body.doctorId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const priceRaw = typeof body.price === "string" ? body.price.trim() : "";
  const price = priceRaw.length > 0 ? priceRaw : null;

  if (!doctorId) return NextResponse.json({ message: "Missing doctorId." }, { status: 400 });
  if (!name) return NextResponse.json({ message: "Service name is required." }, { status: 400 });
  if (name.length > 120) {
    return NextResponse.json({ message: "Service name must be 120 characters or less." }, { status: 400 });
  }
  if (price && price.length > 60) {
    return NextResponse.json({ message: "Price must be 60 characters or less." }, { status: 400 });
  }

  const owned = await isDoctorOwner(supabase, doctorId, user.id);
  if (!owned) return NextResponse.json({ message: "Forbidden." }, { status: 403 });

  const { data, error } = await supabase
    .from("doctor_services")
    .insert({ doctor_id: doctorId, name, price })
    .select("id, doctor_id, name, price, created_at")
    .single();

  if (error) {
    console.error("[doctor-services] create failed", error);
    return NextResponse.json({ message: "Failed to create service." }, { status: 500 });
  }

  return NextResponse.json({ service: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const doctorId = typeof body.doctorId === "string" ? body.doctorId.trim() : "";
  const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";

  if (!doctorId || !serviceId) {
    return NextResponse.json({ message: "doctorId and serviceId are required." }, { status: 400 });
  }

  const owned = await isDoctorOwner(supabase, doctorId, user.id);
  if (!owned) return NextResponse.json({ message: "Forbidden." }, { status: 403 });

  const { error } = await supabase
    .from("doctor_services")
    .delete()
    .eq("id", serviceId)
    .eq("doctor_id", doctorId);

  if (error) {
    console.error("[doctor-services] delete failed", error);
    return NextResponse.json({ message: "Failed to delete service." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
