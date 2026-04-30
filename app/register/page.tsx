import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { PasswordToggleInput } from "@/components/auth/PasswordToggleInput";
import { RegisterSpecialtyFields } from "@/components/auth/RegisterSpecialtyFields";
import { RegisterLanguageFields } from "@/components/auth/RegisterLanguageFields";
import { RegisterAvatarUpload } from "@/components/auth/RegisterAvatarUpload";
import { RegisterDevErrorConsole } from "@/components/auth/RegisterDevErrorConsole";
import { RegisterFormValidation } from "@/components/auth/RegisterFormValidation";
import { validateLanguageSelection } from "@/lib/cyprus-languages";
import { CYPRUS_DISTRICTS, isCyprusDistrict } from "@/lib/cyprus-districts";
import {
  parseSpecialtyFromMasterField,
  validateSpecialtySubmission,
} from "@/lib/specialty-submission";
import { notifyFounderNewRegistration } from "@/lib/notify-founder-new-registration";

type PageProps = {
  searchParams?: { submitted?: string; error?: string; debug?: string };
};

const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function redirectWithError(errorCode: string, detail?: unknown): never {
  if (process.env.NODE_ENV !== "development" || !detail) {
    redirect(`/register?error=${encodeURIComponent(errorCode)}`);
  }
  const detailText =
    typeof detail === "string"
      ? detail
      : (() => {
          try {
            return JSON.stringify(detail);
          } catch {
            return String(detail);
          }
        })();
  redirect(
    `/register?error=${encodeURIComponent(errorCode)}&debug=${encodeURIComponent(
      detailText.slice(0, 1400)
    )}`
  );
}

function mapAuthErrorToCode(error: {
  message?: string | null;
  status?: number | string | null;
}): string {
  const msg = String(error.message ?? "").toLowerCase();
  const status = Number(error.status ?? 0);

  if (
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    msg.includes("user already")
  ) {
    return "auth_user_exists";
  }
  if (
    msg.includes("invalid email") ||
    msg.includes("email address is invalid") ||
    msg.includes("unable to validate email")
  ) {
    return "auth_invalid_email";
  }
  if (
    msg.includes("password") &&
    (msg.includes("weak") ||
      msg.includes("at least") ||
      msg.includes("minimum") ||
      msg.includes("length"))
  ) {
    return "auth_weak_password";
  }
  if (
    status === 0 ||
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("failed to fetch") ||
    msg.includes("timeout")
  ) {
    return "auth_network";
  }
  if (status === 429) {
    return "rate_limit";
  }
  return "auth";
}

async function handleRegister(formData: FormData) {
  "use server";

  const company = formData.get("company");
  if (typeof company === "string" && company.trim() !== "") {
    // Honeypot filled → likely bot; fail silently without creating anything
    redirect("/register");
  }

  const fullName = (formData.get("fullName") as string | null)?.trim() || "";
  const email = (formData.get("email") as string | null)?.trim() || "";
  const password = (formData.get("password") as string | null) || "";
  const phone = (formData.get("phone") as string | null)?.trim() || "";
  const specialtyRaw = (formData.get("specialty") as string | null) ?? "";
  const licenseNumber =
    (formData.get("licenseNumber") as string | null)?.trim() || "";
  const avatarFile = formData.get("avatarFile") as File | null;
  const professionalDisclaimer = formData.get("professionalDisclaimer");
  const district = (formData.get("district") as string | null)?.trim() || "";

  if (
    !fullName ||
    !email ||
    !password ||
    !phone ||
    !district ||
    !specialtyRaw.trim() ||
    !licenseNumber ||
    !avatarFile ||
    professionalDisclaimer !== "on"
  ) {
    redirectWithError("validation");
  }

  if (!emailRegex.test(email)) {
    redirectWithError("invalid_email_format");
  }
  if (!isCyprusDistrict(district)) {
    redirectWithError("district");
  }

  const specialtyFromMaster = parseSpecialtyFromMasterField(
    formData.get("specialtyFromMaster")
  );
  const specParsed = validateSpecialtySubmission(
    specialtyRaw.trim(),
    specialtyFromMaster
  );
  if (!specParsed.ok) {
    redirectWithError("specialty");
  }
  const specialty = specParsed.specialty;
  const isSpecialtyApproved = specParsed.is_specialty_approved;

  const languagesRaw = formData.getAll("language").map((x) => String(x).trim());
  const languagesParsed = validateLanguageSelection(languagesRaw);
  if (!languagesParsed.ok) {
    redirectWithError("languages");
  }
  const languages = languagesParsed.value;

  if (avatarFile.size <= 0 || avatarFile.size > 10 * 1024 * 1024) {
    redirectWithError("avatar_file");
  }
  // Tiny server-side guard after client crop/compression.
  // Reject anomalous payloads so avatar uploads stay lightweight and predictable.
  const croppedAvatarMaxBytes = 1024 * 1024; // 1 MB
  if (avatarFile.size > croppedAvatarMaxBytes) {
    redirectWithError("avatar_too_large");
  }

  const avatarType = avatarFile.type?.toLowerCase() ?? "";
  if (!avatarType.startsWith("image/")) {
    redirectWithError("avatar_file");
  }

  const service = createServiceRoleClient();
  if (!service) {
    console.error("[DocCy] SUPABASE_SERVICE_ROLE_KEY missing — cannot complete registration safely");
    redirectWithError("db", "SUPABASE_SERVICE_ROLE_KEY missing");
  }

  const licenseFileUrl = null;

  // Create user in Supabase Auth
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: "doctor",
      },
    },
  });

  if (signUpError || !signUpData.user) {
    console.error("[DocCy] Auth sign-up failed", signUpError);
    if ((signUpError as any)?.status === 429) {
      redirectWithError("rate_limit", signUpError);
    }

    redirectWithError(mapAuthErrorToCode(signUpError as any), signUpError);
  }

  const authUserId = signUpData.user.id;

  // Generate a simple slug from the doctor's name
  const baseSlug = fullName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);

  const slug = baseSlug || `doctor-${authUserId.slice(0, 8)}`;

  const avatarPath = `profiles/${authUserId}/avatar-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.jpg`;
  const { data: avatarUploadData, error: avatarUploadError } =
    await service.storage.from("avatars").upload(avatarPath, avatarFile, {
      contentType: avatarFile.type || "image/jpeg",
      upsert: false,
    });
  if (avatarUploadError || !avatarUploadData?.path) {
    console.error("[DocCy] Avatar upload failed", avatarUploadError);
    try {
      await service.auth.admin.deleteUser(authUserId);
    } catch (cleanupError) {
      console.error("[DocCy] Failed to cleanup files/user after avatar upload", cleanupError);
    }
    redirectWithError("avatar_upload", avatarUploadError);
  }
  const avatarFileUrl = avatarUploadData.path;

  const { data: regRows, error: insertError } = await service.rpc(
    "register_doctor_with_founder_lock",
    {
      p_auth_user_id: authUserId,
      p_name: fullName,
      p_specialty: specialty,
      p_email: email,
      p_phone: phone,
      p_languages: languages,
      p_license_number: licenseNumber,
      p_license_file_url: licenseFileUrl,
      p_slug: slug,
      p_is_specialty_approved: isSpecialtyApproved,
    }
  );

  let doctorId = regRows?.[0]?.doctor_id as string | undefined;

  if (insertError || !doctorId) {
    console.error("[DocCy] Failed to register doctor row (RPC)", insertError);

    // Fallback path when SQL RPC is unavailable/broken in the target environment.
    // Keeps registration functional while preserving founder-tier intent.
    const { count: founderCount, error: founderCountError } = await service
      .from("doctors")
      .select("id", { head: true, count: "exact" })
      .eq("subscription_tier", "founder")
      .eq("status", "verified");
    if (founderCountError) {
      console.error("[DocCy] Founder count fallback failed", founderCountError);
      try {
        await service.storage.from("avatars").remove([avatarFileUrl]);
        await service.auth.admin.deleteUser(authUserId);
      } catch (cleanupError) {
        console.error("[DocCy] Failed cleanup after founder-count fallback error", cleanupError);
      }
      redirectWithError("db", founderCountError);
    }

    const fallbackTier = (founderCount ?? 0) < 100 ? "founder" : "standard";
    const fallbackInsert = await service
      .from("doctors")
      .insert({
        auth_user_id: authUserId,
        name: fullName,
        specialty,
        email,
        phone,
        languages,
        license_number: licenseNumber,
        license_file_url: licenseFileUrl,
        status: "pending",
        slug,
        is_specialty_approved: isSpecialtyApproved,
        subscription_tier: fallbackTier,
        district,
        is_test_profile: false,
      })
      .select("id")
      .single();

    if (fallbackInsert.error || !fallbackInsert.data?.id) {
      console.error("[DocCy] Failed fallback doctor insert", fallbackInsert.error);
      try {
        await service.storage.from("avatars").remove([avatarFileUrl]);
        await service.auth.admin.deleteUser(authUserId);
      } catch (cleanupError) {
        console.error("[DocCy] Failed cleanup after fallback doctor insert error", cleanupError);
      }
      redirectWithError("db", fallbackInsert.error);
    }

    doctorId = fallbackInsert.data.id as string;
  }

  const queueFounderSignupNotify = () => {
    void notifyFounderNewRegistration({
      doctorId,
      fullName,
      email,
      phone,
      specialty,
      needsSpecialtyReview: !isSpecialtyApproved,
    }).catch((err) =>
      console.error("[DocCy] Founder registration notify failed", err)
    );
  };

  const { error: avatarSaveError } = await service
    .from("doctors")
    .update({ avatar_url: avatarFileUrl, district })
    .eq("id", doctorId);
  if (avatarSaveError) {
    const missingAvatarColumn =
      avatarSaveError.code === "PGRST204" &&
      String(avatarSaveError.message ?? "").includes("avatar_url");
    if (missingAvatarColumn) {
      // Backward compatibility: some environments may not have avatar_url migrated yet.
      // Keep registration successful and preserve uploaded avatar in storage.
      console.warn(
        "[DocCy] avatar_url column missing on doctors. Apply SQL migration to persist avatar path."
      );
      queueFounderSignupNotify();
      redirect("/register?submitted=1");
    }
    console.error("[DocCy] Failed to save avatar_url on doctor", avatarSaveError);
    try {
      await service.storage.from("avatars").remove([avatarFileUrl]);
      await service.from("doctors").delete().eq("id", doctorId);
      await service.auth.admin.deleteUser(authUserId);
    } catch (cleanupError) {
      console.error("[DocCy] Failed cleanup after avatar save error", cleanupError);
    }
    redirectWithError("avatar_save", avatarSaveError);
  }

  queueFounderSignupNotify();
  redirect("/register?submitted=1");
}

export default function RegisterPage({ searchParams }: PageProps) {
  const submitted = searchParams?.submitted === "1";
  const errorCode = searchParams?.error;
  const debugDetail = searchParams?.debug ?? null;

  let errorMessage: string | null = null;
  if (errorCode === "rate_limit") {
    errorMessage =
      "Too many signup attempts. Please wait a minute before trying again.";
  } else if (errorCode === "auth_user_exists") {
    errorMessage =
      "An account with this email already exists. Try logging in or use another email alias.";
  } else if (errorCode === "auth_invalid_email" || errorCode === "invalid_email_format") {
    errorMessage =
      "Please enter a valid email address. Gmail aliases with '+' are allowed (e.g. rociosirvent+test@gmail.com).";
  } else if (errorCode === "auth_network") {
    errorMessage =
      "Network issue while creating your account. Please check your connection and try again.";
  } else if (errorCode === "auth_weak_password") {
    errorMessage =
      "Your password is too weak. Use at least 8 characters with a stronger combination.";
  } else if (errorCode === "auth") {
    errorMessage =
      "We couldn’t create your account. Please double‑check your email and try again.";
  } else if (errorCode === "db") {
    errorMessage =
      "We saved your login but couldn’t finish setting up your profile. Please try again in a moment.";
  } else if (errorCode === "upload") {
    errorMessage =
      "We couldn’t process your registration right now. Please try again in a moment.";
  } else if (errorCode === "validation") {
    errorMessage =
      "Please fill in all required fields and accept the professional disclaimer.";
  } else if (errorCode === "file") {
    errorMessage =
      "Please check your registration details and try again.";
  } else if (errorCode === "avatar_file") {
    errorMessage =
      "Please upload a profile photo image under 10 MB and confirm your crop.";
  } else if (errorCode === "avatar_upload") {
    errorMessage =
      "We couldn't upload your profile photo. Please try again with another image.";
  } else if (errorCode === "avatar_too_large") {
    errorMessage =
      "Your profile photo is still too large after processing. Please choose another image and crop again.";
  } else if (errorCode === "avatar_save") {
    errorMessage =
      "Your account was created, but we couldn't save your profile photo. Please retry registration.";
  } else if (errorCode === "specialty") {
    errorMessage =
      "Choose a specialty from the list, or use Other and describe yours clearly (max 120 characters).";
  } else if (errorCode === "languages") {
    errorMessage =
      "Select at least one spoken language from the list (you can choose several).";
  } else if (errorCode === "district") {
    errorMessage = "Please select your district in Cyprus.";
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-10%] mx-auto h-80 max-w-xl rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-y-0 left-[-10%] h-full w-64 bg-sky-500/5 blur-3xl" />
        <div className="absolute inset-y-0 right-[-15%] h-full w-72 bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="mb-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-emerald-200/80">
            Doc<span className="text-emerald-400">Cy</span> · Professional signup
          </p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Create your professional profile
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300 sm:text-base">
            Join Doc<span className="text-emerald-400">Cy</span> and modernise
            your clinic&apos;s patient experience with smart scheduling and
            automated notifications.
          </p>
        </header>

        <section className="rounded-3xl border border-emerald-100/10 bg-slate-900/60 p-5 shadow-2xl shadow-slate-950/50 backdrop-blur-xl sm:p-6">
          {submitted ? (
            <div className="space-y-4 text-sm text-slate-200">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium tracking-[0.25em] text-emerald-200">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                APPLICATION RECEIVED
              </div>
              <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
                Thank you — your profile is under review
              </h2>
              <p className="text-sm text-slate-300">
                Our team will verify your professional credentials and activate your
                Doc<span className="text-emerald-400">Cy</span> profile within{" "}
                <span className="font-medium text-emerald-200">24 hours</span>.
              </p>
              <p className="text-sm text-slate-300">
                Once approved, you&apos;ll receive an email with a secure link
                to your dashboard, where you can configure working hours,
                appointment types, and your public profile.
              </p>
            </div>
          ) : (
            <form id="register-form" action={handleRegister} noValidate className="space-y-6">
              <RegisterFormValidation formId="register-form" />
              {process.env.NODE_ENV === "development" && errorCode && debugDetail ? (
                <RegisterDevErrorConsole
                  errorCode={errorCode}
                  errorDetail={decodeURIComponent(debugDetail)}
                />
              ) : null}
              {errorMessage && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100">
                  {errorMessage}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="group sm:col-span-2" data-validate-field="1" data-invalid="0">
                  <label className="block text-sm font-medium text-slate-200">
                    Full name
                    <input
                      name="fullName"
                      required
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </label>
                  <p className="field-hint mt-1 hidden text-xs text-red-300 group-data-[invalid=1]:block">
                    Please enter your full name.
                  </p>
                </div>
                <RegisterSpecialtyFields />
                <RegisterLanguageFields />
                <div className="group" data-validate-field="1" data-invalid="0">
                  <label className="block text-sm font-medium text-slate-200">
                    Email
                    <input
                      type="email"
                      name="email"
                      required
                      pattern="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
                      title="Use a valid email. '+' aliases are supported (e.g. rociosirvent+test@gmail.com)."
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </label>
                  <p className="field-hint mt-1 hidden text-xs text-red-300 group-data-[invalid=1]:block">
                    Please enter a valid email address.
                  </p>
                </div>
                <div className="group" data-validate-field="1" data-invalid="0">
                  <label className="block text-sm font-medium text-slate-200">
                    Password
                    <PasswordToggleInput
                      name="password"
                      required
                      minLength={8}
                      className="w-full"
                    />
                  </label>
                  <p className="field-hint mt-1 hidden text-xs text-red-300 group-data-[invalid=1]:block">
                    Please enter a password with at least 8 characters.
                  </p>
                </div>
                <div className="group" data-validate-field="1" data-invalid="0">
                  <label className="block text-sm font-medium text-slate-200">
                    WhatsApp Number (with country code, e.g., +357...)
                    <input
                      type="tel"
                      name="phone"
                      required
                      placeholder="+357..."
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </label>
                  <p className="field-hint mt-1 hidden text-xs text-red-300 group-data-[invalid=1]:block">
                    Please enter your WhatsApp number with country code.
                  </p>
                </div>
                <div className="group" data-validate-field="1" data-invalid="0">
                  <label className="block text-sm font-medium text-slate-200">
                    District
                    <select
                      name="district"
                      required
                      defaultValue=""
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                    >
                      <option value="" disabled>
                        Select district
                      </option>
                      {CYPRUS_DISTRICTS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="field-hint mt-1 hidden text-xs text-red-300 group-data-[invalid=1]:block">
                    Please select your district.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <RegisterAvatarUpload />
                </div>
                <div className="group" data-validate-field="1" data-invalid="0">
                  <label className="block text-sm font-medium text-slate-200">
                    Professional registration or certification number
                    <input
                      name="licenseNumber"
                      required
                      autoComplete="off"
                      className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </label>
                  <p className="field-hint mt-1 hidden text-xs text-red-300 group-data-[invalid=1]:block">
                    Please enter your professional registration or certification number.
                  </p>
                </div>
              </div>

              <div className="group" data-validate-field="1" data-invalid="0">
                <label className="flex cursor-pointer gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/40 p-4 text-left transition hover:border-slate-600">
                  <input
                    type="checkbox"
                    name="professionalDisclaimer"
                    value="on"
                    required
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400/50"
                  />
                  <span className="text-xs leading-relaxed text-slate-300">
                    I confirm I am a qualified health or wellness professional. I accept that
                    DocCy is a technology provider and assumes no liability for the authenticity
                    of professional credentials.
                  </span>
                </label>
                <p className="field-hint mt-1 hidden text-xs text-red-300 group-data-[invalid=1]:block">
                  Please confirm the professional disclaimer to continue.
                </p>
              </div>

              {/* Honeypot field for bots */}
              <div className="hidden" aria-hidden="true">
                <label>
                  Company
                  <input name="company" autoComplete="off" />
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-slate-400">
                  We use your registration or certification details only to verify that you are a
                  health or wellness professional in Cyprus.
                </p>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Submit application
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

