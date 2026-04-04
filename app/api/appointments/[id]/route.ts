import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type RouteContext = {
  params: { id: string };
};

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = params;

  if (!id) {
    return NextResponse.json(
      { message: "Appointment id is required." },
      { status: 400 }
    );
  }

  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { data: doctor, error: doctorError } = await supabase
    .from("doctors")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (doctorError || !doctor?.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { data: appt, error: apptError } = await supabase
    .from("appointments")
    .select("id, doctor_id, status")
    .eq("id", id)
    .maybeSingle();

  if (apptError || !appt) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  if (appt.doctor_id !== doctor.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const st = String((appt as { status?: string | null }).status ?? "")
    .trim()
    .toUpperCase();
  if (st === "NEEDS_RESCHEDULE") {
    return NextResponse.json(
      {
        message:
          "You cannot cancel this while the patient is choosing a proposed time. Wait until they confirm or the offer expires.",
      },
      { status: 400 }
    );
  }
  if (st === "REQUESTED") {
    return NextResponse.json(
      {
        message:
          "Decline pending requests with a reason so the patient is notified. Use Decline in the calendar modal.",
      },
      { status: 400 }
    );
  }
  if (st === "CONFIRMED") {
    return NextResponse.json(
      {
        message:
          "Cancel confirmed visits from the calendar with a reason so the patient receives an email.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { message: "This appointment cannot be removed with this action." },
    { status: 400 }
  );
}
