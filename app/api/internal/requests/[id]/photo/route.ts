import { NextRequest, NextResponse } from "next/server";

import { requireAdminWrite } from "@/lib/admin-auth";
import { storeReplacementPhoto } from "@/lib/registration-requests";
import { createServiceRoleClient } from "@/lib/supabase-service";

/**
 * A founder's replacement photo for a pending registration (multipart field `file`).
 * Returns its path, which the reviewed details then use; approval copies it to the
 * public avatars bucket.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { response: denied } = await requireAdminWrite();
  if (denied) return denied;

  const service = createServiceRoleClient();
  if (!service) return NextResponse.json({ message: "Server is not configured." }, { status: 503 });

  let file: FormDataEntryValue | null = null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ message: "Send the photo as multipart form data." }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ message: "No photo was sent." }, { status: 400 });

  const result = await storeReplacementPhoto(service, { requestId: params.id, file });
  if (result.ok === false) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ path: result.path, url: result.url });
}
