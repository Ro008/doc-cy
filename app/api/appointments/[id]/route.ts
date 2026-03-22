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
    .select("id, doctor_id")
    .eq("id", id)
    .maybeSingle();

  if (apptError || !appt) {
    return NextResponse.json({ message: "Appointment not found." }, { status: 404 });
  }

  if (appt.doctor_id !== doctor.id) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { error } = await supabase.from("appointments").delete().eq("id", id);

  if (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Error cancelling appointment." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { message: "Appointment cancelled successfully." },
    { status: 200 }
  );
}
