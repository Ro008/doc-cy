import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { isInternalDirectoryAuthenticated } from "@/lib/internal-directory-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isInternalDirectoryAuthenticated()) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ message: "Server not configured." }, { status: 503 });
  }

  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ message: "Missing doctor id." }, { status: 400 });
  }

  const { data: doc, error } = await supabase
    .from("doctors")
    .select("license_file_url")
    .eq("id", id)
    .maybeSingle();

  if (error || !doc) {
    return NextResponse.json({ message: "Doctor not found." }, { status: 404 });
  }

  const path = (doc as { license_file_url?: string | null }).license_file_url?.trim();
  if (!path) {
    return NextResponse.json({ message: "No license document on file." }, { status: 404 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from("doctor-verifications")
    .createSignedUrl(path, 3600);

  if (signErr || !signed?.signedUrl) {
    console.error("[internal/doctors/license] sign error", signErr);
    return NextResponse.json(
      { message: "Could not create link to document." },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}
