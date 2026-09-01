import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { PasswordToggleInput } from "@/components/auth/PasswordToggleInput";
import { RegisterSpecialtyFields } from "@/components/auth/RegisterSpecialtyFields";
import { RegisterLanguageFields } from "@/components/auth/RegisterLanguageFields";
import { RegisterAvatarUpload } from "@/components/auth/RegisterAvatarUpload";
import { RegisterDevErrorConsole } from "@/components/auth/RegisterDevErrorConsole";
import { RegisterFormValidation } from "@/components/auth/RegisterFormValidation";
import {
  RegisterFormSubmitFeedback,
  RegisterSubmitButton,
} from "@/components/auth/RegisterFormSubmitFeedback";
import {
  RegisterDemoAside,
  RegisterFaqSection,
  RegisterIntroSection,
  RegisterPromoBanner,
  RegisterSubmittedPanel,
  RegisterTrustBadges,
} from "@/components/register/RegisterMarketingSections";
import {
  registerFieldErrorClass,
  registerHelperClass,
  registerInputClass,
  registerLabelClass,
  registerSectionShell,
} from "@/lib/register-ui";
import { validateLanguageSelection } from "@/lib/cyprus-languages";
import {
  validateDoctorSpecialtyEntries,
  type DoctorSpecialtyEntryInput,
} from "@/lib/doctor-specialties";
import { notifyFounderNewRegistration } from "@/lib/notify-founder-new-registration";
import { matchesAutomatedDoctorRegistrationTestEmailForAdminBypass } from "@/lib/e2e-doctor-registration-test";
import { isTestDoctorRegistrationEmail } from "@/lib/doctor-test-profile";
import {
  persistLocalTestLoginPassword,
  shouldPersistLocalTestLoginPassword,
  TEST_LOGIN_PASSWORD_METADATA_KEY,
} from "@/lib/local-test-login-credentials";
import { MAX_FOUNDERS } from "@/lib/founders-club";
import {
  resolveRegisterClinicLocation,
  shouldAllowRegisterClinicE2eFallback,
} from "@/lib/register-clinic-location";
import { RegisterClinicAddressField } from "@/components/auth/RegisterClinicAddressField";
import { allocateUniqueDoctorSlug } from "@/lib/doctor-slug";
import { findDirectoryProfessionalToClaim } from "@/lib/claim-directory-professional";

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

/**
 * Playwright-only path: Supabase public `signUp` may reject synthetic integration domains
 * (`email_address_invalid`) while the Admin API still accepts the same address.
 * Never runs in production builds or on Vercel production; opt out with DOC_CY_E2E_REGISTRATION_RELAXED=0.
 */
function shouldUseAdminAuthForAutomatedRegistration(email: string): boolean {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return false;
  }
  if (process.env.DOC_CY_E2E_REGISTRATION_RELAXED === "0") return false;
  return matchesAutomatedDoctorRegistrationTestEmailForAdminBypass(email);
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
  const avatarFile = formData.get("avatarFile") as File | null;
  const professionalDisclaimer = formData.get("professionalDisclaimer");
  const clinicResolved = resolveRegisterClinicLocation({
    clinicAddress: formData.get("clinicAddress"),
    clinicLatitude: formData.get("clinicLatitude"),
    clinicLongitude: formData.get("clinicLongitude"),
    clinicPlaceId: formData.get("clinicPlaceId"),
    district: formData.get("district"),
    town: formData.get("town"),
    allowE2eFallback: shouldAllowRegisterClinicE2eFallback(email),
  });

  let specialtyInputs: DoctorSpecialtyEntryInput[] = [];
  const specialtiesJsonRaw = formData.get("specialtiesJson");
  if (typeof specialtiesJsonRaw === "string" && specialtiesJsonRaw.trim()) {
    try {
      const parsed = JSON.parse(specialtiesJsonRaw) as unknown;
      if (Array.isArray(parsed)) {
        specialtyInputs = parsed.map((row) => ({
          specialty: String((row as { specialty?: unknown })?.specialty ?? ""),
          fromMaster: Boolean((row as { fromMaster?: unknown })?.fromMaster),
          licenseNumber: String(
            (row as { licenseNumber?: unknown })?.licenseNumber ?? "",
          ),
        }));
      }
    } catch {
      specialtyInputs = [];
    }
  }
  if (specialtyInputs.length === 0) {
    // Legacy single-field fallback (older clients / smoke tests).
    specialtyInputs = [
      {
        specialty: String(formData.get("specialty") ?? ""),
        fromMaster: String(formData.get("specialtyFromMaster") ?? "") === "1",
        licenseNumber: String(formData.get("licenseNumber") ?? ""),
      },
    ];
  }

  const specialtiesParsed = validateDoctorSpecialtyEntries(specialtyInputs);
  if (!specialtiesParsed.ok) {
    redirectWithError("specialty");
  }
  const specialtyEntries = specialtiesParsed.entries;
  const specialty = specialtyEntries[0]!.specialty;
  const licenseNumber = specialtyEntries[0]!.licenseNumber;
  const isSpecialtyApproved = specialtyEntries.every((e) => e.isApproved);

  if (
    !fullName ||
    !email ||
    !password ||
    !phone ||
    !avatarFile ||
    professionalDisclaimer !== "on"
  ) {
    redirectWithError("validation");
  }

  if (clinicResolved.ok === false) {
    redirectWithError(clinicResolved.code);
  }

  const {
    clinicAddress,
    district,
    town,
    latitude: clinicLatitude,
    longitude: clinicLongitude,
    clinicPlaceId,
  } = clinicResolved.value;

  if (!emailRegex.test(email)) {
    redirectWithError("invalid_email_format");
  }

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

  let authUserId: string;

  const doctorAuthMetadata = {
    full_name: fullName,
    role: "doctor",
    ...(shouldPersistLocalTestLoginPassword()
      ? { [TEST_LOGIN_PASSWORD_METADATA_KEY]: password }
      : {}),
  };

  if (shouldUseAdminAuthForAutomatedRegistration(email)) {
    const { data: adminData, error: adminError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: doctorAuthMetadata,
    });
    if (adminError || !adminData.user) {
      console.error("[DocCy] Auth admin create (E2E registration) failed", adminError);
      if ((adminError as { status?: number })?.status === 429) {
        redirectWithError("rate_limit", adminError);
      }
      redirectWithError(mapAuthErrorToCode(adminError as { message?: string | null; status?: number }), adminError);
    }
    authUserId = adminData.user.id;
  } else {
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

  authUserId = signUpData.user.id;
    await persistLocalTestLoginPassword(service, authUserId, password, {
      full_name: fullName,
      role: "doctor",
    });
  }

  const claim = isTestDoctorRegistrationEmail(email)
    ? null
    : await findDirectoryProfessionalToClaim(service, {
        name: fullName,
        email,
        district,
        specialties: specialtyEntries.map((entry) => entry.specialty),
      });
  if (claim) {
    console.info("[DocCy] claiming directory professional on signup", {
      professionalId: claim.id,
      reason: claim.reason,
    });
  }

  const slug =
    claim?.slug ||
    (await allocateUniqueDoctorSlug(service, {
      name: fullName,
      district,
      authUserId,
    }));

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
      ...(claim?.id ? { p_claim_professional_id: claim.id } : {}),
    }
  );

  let doctorId = regRows?.[0]?.doctor_id as string | undefined;

  if (insertError || !doctorId) {
    console.error("[DocCy] Failed to register doctor row (RPC)", insertError);

    // Fallback path when SQL RPC is unavailable/broken in the target environment.
    // Match register_doctor_with_founder_lock: only non-test founders consume the real founder slots.
    const { count: founderCount, error: founderCountError } = await service
      .from("professionals")
      .select("id", { head: true, count: "exact" })
      .eq("subscription_tier", "founder")
      .eq("is_test_profile", false)
      .eq("is_registered", true);
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

    const fallbackTier = (founderCount ?? 0) < MAX_FOUNDERS ? "founder" : "standard";
    const fallbackPayload = {
      auth_user_id: authUserId,
      name: fullName,
      specialty,
      email,
      phone,
      languages,
      license_number: licenseNumber,
      license_file_url: licenseFileUrl,
      status: "pending" as const,
      slug,
      is_specialty_approved: isSpecialtyApproved,
      subscription_tier: fallbackTier,
      district,
      town,
      clinic_address: clinicAddress,
      latitude: clinicLatitude,
      longitude: clinicLongitude,
      clinic_place_id: clinicPlaceId,
      is_test_profile: isTestDoctorRegistrationEmail(email),
      is_registered: true,
      has_online_booking: true,
      finder_visible: true,
      is_archived: false,
    };

    if (claim?.id) {
      const fallbackClaim = await service
        .from("professionals")
        .update(fallbackPayload)
        .eq("id", claim.id)
        .eq("is_registered", false)
        .eq("is_archived", false)
        .select("id")
        .maybeSingle();
      if (!fallbackClaim.error && fallbackClaim.data?.id) {
        doctorId = fallbackClaim.data.id as string;
      }
    }

    if (!doctorId) {
      const fallbackInsert = await service
        .from("professionals")
        .insert(fallbackPayload)
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
  }

  {
    const specialtyRows = specialtyEntries.map((entry) => ({
      doctor_id: doctorId,
      specialty: entry.specialty,
      license_number: entry.licenseNumber,
      is_approved: entry.isApproved,
    }));
    const { error: specialtyInsertError } = await service
      .from("doctor_specialties")
      .upsert(specialtyRows, { onConflict: "doctor_id,specialty" });
    if (specialtyInsertError) {
      // Table may not exist yet on older environments — keep registration alive.
      console.error(
        "[DocCy] doctor_specialties insert failed (registration continues)",
        specialtyInsertError,
      );
    }
  }

  const queueFounderSignupNotify = () => {
    void notifyFounderNewRegistration({
      doctorId,
      fullName,
      email,
      phone,
      specialty,
      needsSpecialtyReview: !isSpecialtyApproved,
      claimedDirectory: Boolean(claim?.id && doctorId === claim.id),
    }).catch((err) =>
      console.error("[DocCy] Founder registration notify failed", err)
    );
  };

  const profileUpdateBase = {
    avatar_url: avatarFileUrl,
    district,
    town,
    clinic_address: clinicAddress,
    latitude: clinicLatitude,
    longitude: clinicLongitude,
    clinic_place_id: clinicPlaceId,
  };

  const { error: avatarSaveError } = await service
    .from("professionals")
    .update(profileUpdateBase)
    .eq("id", doctorId);

  const syncPrimaryBookingLocation = async () => {
    const locationFields = {
      district,
      town,
      clinic_address: clinicAddress,
      latitude: clinicLatitude,
      longitude: clinicLongitude,
      clinic_place_id: clinicPlaceId,
    };
    const existing = await service
      .from("doctor_locations")
      .select("id")
      .eq("doctor_id", doctorId)
      .eq("is_primary", true)
      .maybeSingle();
    if (existing.data?.id) {
      await service.from("doctor_locations").update(locationFields).eq("id", existing.data.id);
      return;
    }
    await service.from("doctor_locations").insert({
      doctor_id: doctorId,
      is_primary: true,
      sort_order: 0,
      ...locationFields,
    });
  };
  if (avatarSaveError) {
    const missingAvatarColumn =
      avatarSaveError.code === "PGRST204" &&
      String(avatarSaveError.message ?? "").includes("avatar_url");
    const missingTownColumn =
      (avatarSaveError.code === "42703" || avatarSaveError.code === "PGRST204") &&
      /town/i.test(String(avatarSaveError.message ?? ""));
    const missingClinicColumns =
      (avatarSaveError.code === "42703" || avatarSaveError.code === "PGRST204") &&
      /(latitude|longitude|clinic_place_id|clinic_address)/i.test(
        String(avatarSaveError.message ?? ""),
      );
    if (missingTownColumn && !missingClinicColumns) {
      const { town: _town, ...withoutTown } = profileUpdateBase;
      const { error: withoutTownError } = await service
        .from("professionals")
        .update(withoutTown)
        .eq("id", doctorId);
      if (!withoutTownError) {
        await syncPrimaryBookingLocation();
        queueFounderSignupNotify();
        redirect("/register?submitted=1");
      }
    }
    if (missingAvatarColumn) {
      // Backward compatibility: some environments may not have avatar_url migrated yet.
      // Keep registration successful and preserve uploaded avatar in storage.
      console.warn(
        "[DocCy] avatar_url column missing on doctors. Apply SQL migration to persist avatar path."
      );
      await syncPrimaryBookingLocation();
      queueFounderSignupNotify();
      redirect("/register?submitted=1");
    }
    if (missingClinicColumns) {
      const { error: legacyProfileError } = await service
        .from("professionals")
        .update({
          avatar_url: avatarFileUrl,
          district,
          clinic_address: clinicAddress,
        })
        .eq("id", doctorId);
      if (legacyProfileError) {
        console.error("[DocCy] Failed legacy profile save on doctor", legacyProfileError);
      } else {
        await syncPrimaryBookingLocation();
        queueFounderSignupNotify();
        redirect("/register?submitted=1");
      }
    }
    console.error("[DocCy] Failed to save avatar_url on doctor", avatarSaveError);
    try {
      await service.storage.from("avatars").remove([avatarFileUrl]);
      const claimedThisRow = Boolean(claim?.id && doctorId === claim.id);
      if (!claimedThisRow) {
        await service.from("professionals").delete().eq("id", doctorId);
        await service.auth.admin.deleteUser(authUserId);
      }
    } catch (cleanupError) {
      console.error("[DocCy] Failed cleanup after avatar save error", cleanupError);
    }
    redirectWithError("avatar_save", avatarSaveError);
  }

  await syncPrimaryBookingLocation();
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
  } else if (errorCode === "clinic_address") {
    errorMessage = "Please search for your clinic and pick it from the Google Maps suggestions.";
  } else if (errorCode === "district") {
    errorMessage = "We could not determine your clinic district. Try another Google Maps result.";
  }

  return (
    <main className="min-h-screen bg-ink-50 text-ink-900">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-clinical-100/40 to-transparent" />
        <div className="absolute right-[-10%] top-24 h-64 w-64 rounded-full bg-wellness-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-[-5%] h-72 w-72 rounded-full bg-clinical-200/25 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:gap-10 lg:py-12 lg:px-8">
        <RegisterPromoBanner />
        <RegisterIntroSection />

        {submitted ? (
          <RegisterSubmittedPanel />
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
            <section className={registerSectionShell}>
              <h2 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
                Complete your professional application
              </h2>

              <form
                id="register-form"
                action={handleRegister}
                noValidate
                className="mt-6 space-y-6"
              >
                <RegisterFormValidation formId="register-form" />
                {process.env.NODE_ENV === "development" && errorCode && debugDetail ? (
                  <RegisterDevErrorConsole
                    errorCode={errorCode}
                    errorDetail={decodeURIComponent(debugDetail)}
                  />
                ) : null}
                {errorMessage ? (
                  <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                <RegisterFormSubmitFeedback
                  formId="register-form"
                  clearSubmitting={Boolean(errorCode)}
                >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="group sm:col-span-2" data-validate-field="1" data-invalid="0">
                    <label htmlFor="register-full-name" className={registerLabelClass}>
                      Full Name<span className="text-red-600">*</span>
                      <input
                        id="register-full-name"
                        name="fullName"
                        required
                        className={registerInputClass}
                      />
                    </label>
                    <p className={registerFieldErrorClass}>Please enter your full name.</p>
                  </div>

                  <RegisterSpecialtyFields />
                  <RegisterLanguageFields />

                  <RegisterClinicAddressField />

                  <div className="group" data-validate-field="1" data-invalid="0">
                    <label className={registerLabelClass}>
                      Email Address<span className="text-red-600">*</span>
                      <input
                        type="email"
                        name="email"
                        required
                        pattern="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
                        title="Use a valid email. '+' aliases are supported (e.g. rociosirvent+test@gmail.com)."
                        className={registerInputClass}
                      />
                    </label>
                    <p className={registerFieldErrorClass}>Please enter a valid email address.</p>
                  </div>

                  <div className="group" data-validate-field="1" data-invalid="0">
                    <label className={registerLabelClass}>
                      Create Password<span className="text-red-600">*</span>
                      <PasswordToggleInput
                        name="password"
                        required
                        minLength={8}
                        tone="light"
                        className="w-full"
                      />
                    </label>
                    <p className={registerFieldErrorClass}>
                      Please enter a password with at least 8 characters.
                    </p>
                  </div>

                  <div className="group" data-validate-field="1" data-invalid="0">
                    <label className={registerLabelClass}>
                      WhatsApp Number<span className="text-red-600">*</span>
                      <input
                        type="tel"
                        name="phone"
                        required
                        placeholder="e.g., +357 99XXXXXX"
                        className={registerInputClass}
                      />
                    </label>
                    <p className={registerHelperClass}>
                      Used for instant booking notifications and direct patient updates.
                    </p>
                    <p className={registerFieldErrorClass}>
                      Please enter your WhatsApp number with country code.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <RegisterAvatarUpload tone="light" />
                  </div>
                </div>

                <div className="group" data-validate-field="1" data-invalid="0">
                  <label className="flex cursor-pointer gap-3 rounded-xl border border-ink-200 bg-ink-50/80 p-4 text-left transition hover:border-clinical-300">
                    <input
                      type="checkbox"
                      name="professionalDisclaimer"
                      value="on"
                      required
                      className="mt-1 h-4 w-4 shrink-0 rounded border-ink-300 bg-white text-clinical-500 focus:ring-clinical-400/50"
                    />
                    <span className="text-xs leading-relaxed text-ink-600">
                      I confirm I am a qualified health or wellness professional. I accept that
                      DocCy is a technology provider and assumes no liability for the authenticity
                      of professional credentials.
                    </span>
                  </label>
                  <p className={registerFieldErrorClass}>
                    Please confirm the professional disclaimer to continue.
                  </p>
                </div>

                <div className="hidden" aria-hidden="true">
                  <label>
                    Company
                    <input
                      name="company"
                      tabIndex={-1}
                      autoComplete="new-password"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-3 border-t border-ink-200/80 pt-5 sm:flex-row sm:items-center sm:justify-end">
                  <RegisterSubmitButton>
                    Submit My Application &amp; Claim 6 Months Free
                  </RegisterSubmitButton>
                </div>
                </RegisterFormSubmitFeedback>
              </form>
            </section>

            <RegisterDemoAside />
          </div>
        )}

        {!submitted ? (
          <>
            <RegisterTrustBadges />
            <RegisterFaqSection />
          </>
        ) : null}
      </div>
    </main>
  );
}

