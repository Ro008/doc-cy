import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", id);

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

