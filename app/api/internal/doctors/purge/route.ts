import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { denyUnlessInternalFounder } from "@/lib/internal-directory-auth";
import {
  PurgeRegisteredProfessionalError,
  purgeRegisteredProfessional,
} from "@/lib/purge-registered-professional";

type Body = {
  doctorId?: string;
  confirmName?: string;
};

export async function POST(req: NextRequest) {
  const denied = denyUnlessInternalFounder();
  if (denied) return denied;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json(
      { message: "Server is not configured for internal tools." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Invalid JSON." }, { status: 400 });
  }

  const doctorId = typeof body.doctorId === "string" ? body.doctorId.trim() : "";
  const confirmName =
    typeof body.confirmName === "string" ? body.confirmName.trim() : "";

  if (!doctorId) {
    return NextResponse.json({ message: "doctorId is required." }, { status: 400 });
  }

  try {
    const result = await purgeRegisteredProfessional(supabase, {
      professionalId: doctorId,
      confirmName,
    });
    if (result.warnings.length > 0) {
      console.warn(
        "[internal/doctors/purge] completed with warnings",
        result.professionalId,
        result.warnings,
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PurgeRegisteredProfessionalError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[internal/doctors/purge] unexpected failure", err);
    return NextResponse.json(
      { message: "Could not permanently delete this professional." },
      { status: 500 },
    );
  }
}
