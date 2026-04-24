import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServiceRoleClient } from "@/lib/supabase-service";

function extFromMime(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  return "jpg";
}
const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ message: "Invalid form data." }, { status: 400 });
  }

  const doctorId = String(form.get("doctorId") ?? "").trim();
  const file = form.get("avatarFile");

  if (!doctorId) {
    return NextResponse.json({ message: "Missing doctorId." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Missing avatar file." }, { status: 400 });
  }
  if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type.toLowerCase())) {
    return NextResponse.json({ message: "Use JPG, PNG, WEBP, or GIF." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ message: "Avatar must be under 10 MB." }, { status: 400 });
  }

  const service = createServiceRoleClient();
  if (!service) {
    return NextResponse.json(
      { message: "Server is not configured for avatar uploads." },
      { status: 503 }
    );
  }

  const { data: owned, error: ownErr } = await service
    .from("doctors")
    .select("id")
    .eq("id", doctorId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (ownErr || !owned) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const ext = extFromMime(file.type);
  const path = `profiles/${doctorId}/avatar-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const { data: uploadData, error: uploadErr } = await service.storage
    .from("avatars")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr || !uploadData?.path) {
    console.error("[DocCy][avatar] upload_failed", {
      doctorId,
      userId: user.id,
      error: uploadErr?.message ?? null,
      details: uploadErr?.toString?.() ?? null,
    });
    return NextResponse.json({ message: "Could not upload avatar." }, { status: 500 });
  }

  const { error: updateErr } = await service
    .from("doctors")
    .update({ avatar_url: uploadData.path })
    .eq("id", doctorId);

  if (updateErr) {
    await service.storage.from("avatars").remove([uploadData.path]).catch(() => undefined);
    console.error("[DocCy][avatar] db_update_failed", {
      doctorId,
      userId: user.id,
      error: updateErr.message,
      details: updateErr.details ?? null,
      hint: updateErr.hint ?? null,
      code: updateErr.code ?? null,
    });
    const rawMessage = `${updateErr.message ?? ""} ${updateErr.details ?? ""}`.toLowerCase();
    if (rawMessage.includes("avatar_url") || rawMessage.includes("column")) {
      return NextResponse.json(
        {
          message:
            "Avatar column is missing in doctors table. Run supabase/doctors_avatar_url.sql and try again.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ message: "Could not save avatar." }, { status: 500 });
  }

  const publicUrl = service.storage.from("avatars").getPublicUrl(uploadData.path).data.publicUrl;
  return NextResponse.json({ ok: true, avatarPath: uploadData.path, publicUrl });
}
