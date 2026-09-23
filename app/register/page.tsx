import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase-service";
import { PasswordToggleInput } from "@/components/auth/PasswordToggleInput";
import { RegisterSpecialtyFields } from "@/components/auth/RegisterSpecialtyFields";
import { RegisterLanguageFields } from "@/components/auth/RegisterLanguageFields";
import { RegisterAvatarUpload } from "@/components/auth/RegisterAvatarUpload";
import { RegisterDevErrorConsole } from "@/components/auth/RegisterDevErrorConsole";
import { RegisterFormValidation } from "@/components/auth/RegisterFormValidation";
import { RegisterFormSubmitFeedback } from "@/components/auth/RegisterFormSubmitFeedback";
import { RegisterWizard, RegisterWizardStep } from "@/components/auth/RegisterWizard";
import {
  REGISTER_SETUP_CALL_ID,
  RegisterFaqSection,
  RegisterIntroSection,
  RegisterNextSteps,
  RegisterPlanTicket,
  RegisterSetupCallCard,
  RegisterSubmittedPanel,
} from "@/components/register/RegisterMarketingSections";
import { RegisterShowcase } from "@/components/register/RegisterShowcase";
import { DocCyWordmark } from "@/components/brand/DocCyWordmark";
import { getFoundersAvailability, type FoundersAvailability } from "@/lib/founders-club";
import { registerPlanTicket } from "@/lib/register-plan-ticket";
import {
  registerFieldErrorClass,
  registerHelperClass,
  registerInputClass,
  registerLabelClass,
} from "@/lib/register-ui";
import { validateLanguageSelection } from "@/lib/cyprus-languages";
import {
  validateDoctorSpecialtyEntries,
  type DoctorSpecialtyEntryInput,
} from "@/lib/doctor-specialties";
import { loadSpecialtyCatalogueNames } from "@/lib/specialty-catalogue";
import { sendDoctorRegistrationReceivedEmail } from "@/lib/send-doctor-registration-received-email";
import { generateRegisterEmailConfirmUrl } from "@/lib/register-email-confirm";
import { matchesAutomatedDoctorRegistrationTestEmailForAdminBypass } from "@/lib/e2e-doctor-registration-test";
import {
  persistLocalTestLoginPassword,
  shouldPersistLocalTestLoginPassword,
  TEST_LOGIN_PASSWORD_METADATA_KEY,
} from "@/lib/local-test-login-credentials";
import {
  readRegisterClinicsFromFormData,
  shouldAllowRegisterClinicE2eFallback,
} from "@/lib/register-clinic-location";
import { RegisterClinicAddressField } from "@/components/auth/RegisterClinicAddressField";
import { RegisterChoiceField } from "@/components/auth/RegisterChoiceField";
import { allocateUniqueDoctorSlug } from "@/lib/doctor-slug";
import {
  joinProfessionalFullName,
  splitProfessionalFullName,
} from "@/lib/doctor-display-name";
import { MAX_DOCTOR_LOCATIONS } from "@/lib/doctor-locations";
import { clinicLocationFromParts } from "@/lib/clinic-location";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_ERROR,
  PASSWORD_POLICY_HELPER,
  PASSWORD_POLICY_HTML_PATTERN,
  PASSWORD_POLICY_TITLE,
  isStrongPassword,
} from "@/lib/password-policy";
import {
  isProfessionalUuid,
  loadUnregisteredProfessionalForRegisterClaim,
  REGISTER_CLAIM_QUERY,
  resolveSignupDirectoryClaim,
  type RegisterClaimPrefill,
} from "@/lib/claim-directory-professional";
import { isNextRedirectError } from "@/lib/next-redirect-error";
import { withTimeout } from "@/lib/promise-timeout";
import { createClient } from "@supabase/supabase-js";

type PageProps = {
  searchParams?: {
    submitted?: string;
    error?: string;
    debug?: string;
    claim?: string;
    claimed?: string;
    email?: string;
  };
};

const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const REGISTER_AUTH_TIMEOUT_MS = 20_000;
const REGISTER_UPLOAD_TIMEOUT_MS = 20_000;
const REGISTER_DB_TIMEOUT_MS = 20_000;
const REGISTER_NOTIFY_TIMEOUT_MS = 12_000;
const REGISTER_FOUNDERS_TIMEOUT_MS = 5_000;

/** Price ticket data; on a slow or failed count, show standard pricing rather than oversell. */
async function loadRegisterFoundersAvailability(): Promise<
  Pick<FoundersAvailability, "offerAvailable" | "spotsRemaining">
> {
  try {
    return await withTimeout(
      getFoundersAvailability(),
      REGISTER_FOUNDERS_TIMEOUT_MS,
      "founders availability",
    );
  } catch (err) {
    console.error("[DocCy] register page: founders availability failed", err);
    return { offerAvailable: false, spotsRemaining: 0 };
  }
}

function createRegisterAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function redirectWithError(
  errorCode: string,
  detail?: unknown,
  claimId?: string | null,
): never {
  const params = new URLSearchParams();
  params.set("error", errorCode);
  const claim = String(claimId ?? "").trim();
  if (isProfessionalUuid(claim)) params.set(REGISTER_CLAIM_QUERY, claim);
  if (process.env.NODE_ENV === "development" && detail) {
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
    params.set("debug", detailText.slice(0, 1400));
  }
  redirect(`/register?${params.toString()}`);
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

  try {
    await runRegister(formData);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("[DocCy] Registration failed unexpectedly", error);
    const message = error instanceof Error ? error.message : String(error);
    if (/timed out/i.test(message) && /sign-up|Auth/i.test(message)) {
      redirectWithError("auth_network", error);
    }
    if (/timed out/i.test(message) && /Avatar/i.test(message)) {
      redirectWithError("avatar_upload", error);
    }
    redirectWithError("db", error);
  }
}

async function runRegister(formData: FormData) {
  const company = formData.get("company");
  if (typeof company === "string" && company.trim() !== "") {
    // Honeypot filled → likely bot; fail silently without creating anything
    redirect("/register");
  }

  const claimFromForm = String(formData.get("claimProfessionalId") ?? "").trim();
  // Nested function (not a const arrow) so TypeScript treats `fail()` as never-returning
  // and narrows later reads such as `specialtiesParsed.entries`.
  function fail(errorCode: string, detail?: unknown): never {
    redirectWithError(errorCode, detail, claimFromForm);
  }

  const firstName = (formData.get("firstName") as string | null)?.trim() || "";
  const lastName = (formData.get("lastName") as string | null)?.trim() || "";
  const fullName =
    joinProfessionalFullName(firstName, lastName) ||
    (formData.get("fullName") as string | null)?.trim() ||
    "";
  const email = (formData.get("email") as string | null)?.trim() || "";
  const password = (formData.get("password") as string | null) || "";
  const phone = (formData.get("phone") as string | null)?.trim() || "";
  const avatarFile = formData.get("avatarFile") as File | null;
  const professionalDisclaimer = formData.get("professionalDisclaimer");
  const clinicsResolved = readRegisterClinicsFromFormData(
    formData,
    shouldAllowRegisterClinicE2eFallback(email),
    MAX_DOCTOR_LOCATIONS,
  );

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

  const catalogueService = createServiceRoleClient();
  if (!catalogueService) {
    fail("db", "SUPABASE_SERVICE_ROLE_KEY missing");
  }
  let specialtyCatalogue: string[];
  try {
    specialtyCatalogue = await loadSpecialtyCatalogueNames(catalogueService);
  } catch (err) {
    console.error("[DocCy] register: specialty catalogue failed", err);
    fail("db", err);
  }
  const specialtiesParsed = validateDoctorSpecialtyEntries(specialtyInputs, specialtyCatalogue);
  if (!specialtiesParsed.ok) {
    fail("specialty");
  }
  const specialtyEntries = specialtiesParsed.entries;

  if (
    !firstName ||
    !lastName ||
    !fullName ||
    !email ||
    !password ||
    !phone ||
    !avatarFile ||
    professionalDisclaimer !== "on"
  ) {
    fail("validation");
  }

  if (!isStrongPassword(password)) {
    fail("password_policy");
  }

  if (clinicsResolved.ok === false) {
    fail(clinicsResolved.code);
  }

  const {
    clinicAddress,
    district,
    town,
    latitude: clinicLatitude,
    longitude: clinicLongitude,
    clinicPlaceId,
  } = clinicsResolved.value[0]!;
  const extraClinics = clinicsResolved.value.slice(1);

  if (!emailRegex.test(email)) {
    fail("invalid_email_format");
  }

  const languagesRaw = formData.getAll("language").map((x) => String(x).trim());
  const languagesParsed = validateLanguageSelection(languagesRaw);
  if (!languagesParsed.ok) {
    fail("languages");
  }
  const languages = languagesParsed.value;

  if (avatarFile.size <= 0 || avatarFile.size > 10 * 1024 * 1024) {
    fail("avatar_file");
  }
  // Tiny server-side guard after client crop/compression.
  // Reject anomalous payloads so avatar uploads stay lightweight and predictable.
  const croppedAvatarMaxBytes = 1024 * 1024; // 1 MB
  if (avatarFile.size > croppedAvatarMaxBytes) {
    fail("avatar_too_large");
  }

  const avatarType = avatarFile.type?.toLowerCase() ?? "";
  if (!avatarType.startsWith("image/")) {
    fail("avatar_file");
  }

  const service = createServiceRoleClient();
  if (!service) {
    console.error("[DocCy] SUPABASE_SERVICE_ROLE_KEY missing — cannot complete registration safely");
    fail("db", "SUPABASE_SERVICE_ROLE_KEY missing");
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
    const { data: adminData, error: adminError } = await withTimeout(
      service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: doctorAuthMetadata,
      }),
      REGISTER_AUTH_TIMEOUT_MS,
      "Auth admin create",
    );
    if (adminError || !adminData.user) {
      console.error("[DocCy] Auth admin create (E2E registration) failed", adminError);
      if ((adminError as { status?: number })?.status === 429) {
        fail("rate_limit", adminError);
      }
      fail(mapAuthErrorToCode(adminError as { message?: string | null; status?: number }), adminError);
    }
    authUserId = adminData.user.id;
  } else {
    const authClient = createRegisterAuthClient();
    if (!authClient) {
      fail("auth_network", "Supabase auth client missing");
    }
    const { data: signUpData, error: signUpError } = await withTimeout(
      authClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: "doctor",
          },
        },
      }),
      REGISTER_AUTH_TIMEOUT_MS,
      "Auth sign-up",
    );

    if (signUpError || !signUpData.user) {
      console.error("[DocCy] Auth sign-up failed", signUpError);
      if ((signUpError as any)?.status === 429) {
        fail("rate_limit", signUpError);
      }

      fail(mapAuthErrorToCode(signUpError as any), signUpError);
    }

    authUserId = signUpData.user.id;
    await persistLocalTestLoginPassword(service, authUserId, password, {
      full_name: fullName,
      role: "doctor",
    });
  }

  const claim = await resolveSignupDirectoryClaim(service, {
    explicitClaimId: claimFromForm,
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

  // Claims never reuse the claimed listing's slug: that listing stays untouched
  // (and keeps its own slug/card) until a founder Verifies this registration.
  const slug = await allocateUniqueDoctorSlug(service, {
    name: fullName,
    district,
    authUserId,
  });

  const avatarPath = `profiles/${authUserId}/avatar-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.jpg`;
  const { data: avatarUploadData, error: avatarUploadError } = await withTimeout(
    service.storage.from("avatars").upload(avatarPath, avatarFile, {
      contentType: avatarFile.type || "image/jpeg",
      upsert: false,
    }),
    REGISTER_UPLOAD_TIMEOUT_MS,
    "Avatar upload",
  );
  if (avatarUploadError || !avatarUploadData?.path) {
    console.error("[DocCy] Avatar upload failed", avatarUploadError);
    try {
      await service.auth.admin.deleteUser(authUserId);
    } catch (cleanupError) {
      console.error("[DocCy] Failed to cleanup files/user after avatar upload", cleanupError);
    }
    fail("avatar_upload", avatarUploadError);
  }
  const avatarFileUrl = avatarUploadData.path;

  const { data: regRows, error: insertError } = await withTimeout(
    service.rpc("register_professional_with_founder_lock", {
      p_auth_user_id: authUserId,
      p_name: fullName,
      p_email: email,
      p_phone: phone,
      p_languages: languages,
      p_license_file_url: licenseFileUrl,
      p_slug: slug,
      // Written as professional_specialties rows in the same transaction.
      p_specialties: specialtyEntries.map((entry) => ({
        specialty: entry.specialty,
        license_number: entry.licenseNumber,
        is_approved: entry.isApproved,
      })),
      ...(claim?.id
        ? {
            p_claim_listing_id: claim.id,
            p_directory_claim_source: claim.reason,
          }
        : {}),
    }),
    REGISTER_DB_TIMEOUT_MS,
    "Register doctor RPC",
  );

  const doctorId = regRows?.[0]?.professional_id as string | undefined;

  const cleanupFailedRegistration = async () => {
    try {
      if (avatarFileUrl) {
        await service.storage.from("avatars").remove([avatarFileUrl]);
      }
      await service.auth.admin.deleteUser(authUserId);
    } catch (cleanupError) {
      console.error("[DocCy] Failed cleanup after registration error", cleanupError);
    }
  };

  if (insertError || !doctorId) {
    console.error("[DocCy] Failed to register professional row (RPC)", insertError);
    await cleanupFailedRegistration();
    fail("db", insertError);
  }

  const claimedThisListing = Boolean(claim?.reason === "card_link" && claim?.id);

  const finishRegistrationSuccess = async () => {
    await persistBookingLocations();
    await sendRegistrationEmails();
    redirect(claimedThisListing ? "/register?submitted=1&claimed=1" : "/register?submitted=1");
  };

  const sendRegistrationEmails = async () => {
    // Founder notify waits until the professional confirms email (`/auth/confirm-email`).
    try {
      const h = headers();
      const requestOrigin =
        h.get("origin")?.trim() ||
        (() => {
          const host = h.get("x-forwarded-host")?.trim() || h.get("host")?.trim() || "";
          const proto = h.get("x-forwarded-proto")?.trim() || "http";
          return host ? `${proto}://${host}` : "";
        })();
      const confirmUrl = await generateRegisterEmailConfirmUrl(
        service,
        email,
        requestOrigin || null,
      );
      await withTimeout(
        sendDoctorRegistrationReceivedEmail({
          doctorEmail: email,
          doctorName: fullName,
          confirmUrl,
        }),
        REGISTER_NOTIFY_TIMEOUT_MS,
        "Doctor registration received email",
      );
    } catch (err) {
      console.error("[DocCy] Doctor registration received email failed or timed out", err);
    }
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
  const persistBookingLocations = async () => {
    await syncPrimaryBookingLocation();
    if (extraClinics.length === 0) return;

    const existing = await service
      .from("doctor_locations")
      .select("id, clinic_address")
      .eq("doctor_id", doctorId);
    const seen = new Set(
      (existing.data ?? []).map((row) =>
        String((row as { clinic_address?: string | null }).clinic_address ?? "")
          .trim()
          .toLowerCase(),
      ),
    );
    let sortOrder = 1;
    for (const clinic of extraClinics) {
      const key = clinic.clinicAddress.trim().toLowerCase();
      if (seen.has(key)) continue;
      await service.from("doctor_locations").insert({
        doctor_id: doctorId,
        is_primary: false,
        sort_order: sortOrder,
        district: clinic.district,
        town: clinic.town,
        clinic_address: clinic.clinicAddress,
        latitude: clinic.latitude,
        longitude: clinic.longitude,
        clinic_place_id: clinic.clinicPlaceId,
      });
      seen.add(key);
      sortOrder += 1;
    }
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
        await finishRegistrationSuccess();
      }
    }
    if (missingAvatarColumn) {
      // Backward compatibility: some environments may not have avatar_url migrated yet.
      // Keep registration successful and preserve uploaded avatar in storage.
      console.warn(
        "[DocCy] avatar_url column missing on doctors. Apply SQL migration to persist avatar path."
      );
      await finishRegistrationSuccess();
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
        await finishRegistrationSuccess();
      }
    }
    console.error("[DocCy] Failed to save avatar_url on doctor", avatarSaveError);
    try {
      await service.storage.from("avatars").remove([avatarFileUrl]);
      // This registration row is always freshly inserted (never a claimed
      // listing in place), so it's always safe to delete on cleanup.
      await service.from("professionals").delete().eq("id", doctorId);
      await service.auth.admin.deleteUser(authUserId);
    } catch (cleanupError) {
      console.error("[DocCy] Failed cleanup after avatar save error", cleanupError);
    }
    fail("avatar_save", avatarSaveError);
  }

  await finishRegistrationSuccess();
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const submitted = searchParams?.submitted === "1";
  const claimedSubmit = searchParams?.claimed === "1";
  const errorCode = searchParams?.error;
  const debugDetail = searchParams?.debug ?? null;
  const claimId = String(searchParams?.claim ?? "").trim();

  const foundersAvailability = loadRegisterFoundersAvailability();
  let claimPrefill: RegisterClaimPrefill | null = null;
  let specialtyOptions: string[] = [];
  if (!submitted) {
    const service = createServiceRoleClient();
    if (service) {
      if (isProfessionalUuid(claimId)) {
        claimPrefill = await loadUnregisteredProfessionalForRegisterClaim(service, claimId);
      }
      try {
        specialtyOptions = await loadSpecialtyCatalogueNames(service);
      } catch (err) {
        console.error("[DocCy] register page: specialty catalogue failed", err);
      }
    }
  }

  let errorMessage: string | null = null;
  if (errorCode === "rate_limit") {
    errorMessage =
      "Too many signup attempts. Please wait a minute before trying again.";
  } else if (errorCode === "auth_user_exists") {
    errorMessage =
      "An account with this email already exists. Try logging in or reset your password.";
  } else if (errorCode === "auth_invalid_email" || errorCode === "invalid_email_format") {
    errorMessage =
      "Please enter a valid email address. Gmail aliases with '+' are allowed (e.g. rociosirvent+test@gmail.com).";
  } else if (errorCode === "auth_network") {
    errorMessage =
      "Network issue while creating your account. Please check your connection and try again.";
  } else if (errorCode === "auth_weak_password" || errorCode === "password_policy") {
    errorMessage = PASSWORD_POLICY_ERROR;
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
  } else if (errorCode === "email_confirm") {
    errorMessage =
      "That confirmation link is invalid or has expired. Check your inbox for a newer email, or register again if you never received one.";
  }
  const claimName = splitProfessionalFullName(claimPrefill?.name);
  const claimClinics = claimPrefill?.clinics ?? [];
  const clinicSlots =
    claimClinics.length > 0 ? claimClinics.slice(0, MAX_DOCTOR_LOCATIONS) : [null];

  const planTicket = registerPlanTicket(await foundersAvailability);

  return (
    <main className="min-h-screen bg-white text-ink-900">
      {/* Desktop: everything above the fold. The header lives in the left column so the
          sticky benefits panel can start at the top and fill exactly one viewport. */}
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4 px-4 pb-4 sm:px-8 lg:gap-3 lg:px-14 lg:pb-8">
          <header className="flex h-16 items-center justify-between lg:h-14">
            <a href="/" className="inline-flex rounded-md transition hover:opacity-90" aria-label="DocCy home">
              <DocCyWordmark size="lg" />
            </a>
            <p className="text-sm text-ink-600">
              <span className="hidden sm:inline">Already have an account? </span>
              <a
                href="/login"
                className="inline-flex min-h-[44px] items-center font-bold text-clinical-800 underline-offset-2 hover:text-clinical-900 hover:underline"
              >
                Sign in
              </a>
            </p>
          </header>
          <RegisterIntroSection
            claim={claimPrefill ? { firstName: claimPrefill.firstName } : null}
          />
          <RegisterPlanTicket ticket={planTicket} layout="stacked" className="lg:hidden" />

        {submitted ? (
          <RegisterSubmittedPanel
            claimed={claimedSubmit}
            emailConfirmed={searchParams?.email === "confirmed"}
            confirmError={errorCode === "email_confirm"}
          />
        ) : (
          <>
            <section aria-label="Application form">
              <form
                id="register-form"
                action={handleRegister}
                noValidate
                className="space-y-4 lg:space-y-3"
              >
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
                {claimPrefill ? (
                  <input type="hidden" name="claimProfessionalId" value={claimPrefill.id} />
                ) : null}
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

                <RegisterWizard
                  formId="register-form"
                  submitLabel={
                    claimPrefill
                      ? "Activate this listing & claim 6 months free"
                      : "Submit my application & claim 6 months free"
                  }
                >
                  <RegisterFormValidation formId="register-form" />

                  <RegisterWizardStep
                    step={1}
                    title="Account"
                    description="Your DocCy login. Patients never see this email or mobile."
                  >
                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
                      <div
                        className="group"
                        data-validate-field="1"
                        data-invalid="0"
                        data-field-key="firstName"
                        data-field-label="First name"
                      >
                        <label htmlFor="register-first-name" className={registerLabelClass}>
                          First name<span className="text-red-600">*</span>
                          <input
                            id="register-first-name"
                            name="firstName"
                            required
                            autoComplete="given-name"
                            defaultValue={claimName.firstName}
                            className={registerInputClass}
                          />
                        </label>
                        <p className={registerFieldErrorClass}>Please enter your first name.</p>
                      </div>
                      <div
                        className="group"
                        data-validate-field="1"
                        data-invalid="0"
                        data-field-key="lastName"
                        data-field-label="Last name"
                      >
                        <label htmlFor="register-last-name" className={registerLabelClass}>
                          Last name<span className="text-red-600">*</span>
                          <input
                            id="register-last-name"
                            name="lastName"
                            required
                            autoComplete="family-name"
                            defaultValue={claimName.lastName}
                            className={registerInputClass}
                          />
                        </label>
                        <p className={registerFieldErrorClass}>Please enter your last name.</p>
                      </div>
                    </div>
                    {/* UI only for now: handleRegister does not store gender or GeSY yet. */}
                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
                      <RegisterChoiceField
                        name="gender"
                        fieldKey="gender"
                        fieldLabel="Gender"
                        question="Gender"
                        options={[
                          { value: "male", label: "Male" },
                          { value: "female", label: "Female" },
                        ]}
                        errorMessage="Please select your gender."
                      />
                      <RegisterChoiceField
                        name="gesy"
                        fieldKey="gesy"
                        fieldLabel="GeSY"
                        question="Work with GeSY?"
                        options={[
                          { value: "yes", label: "Yes" },
                          { value: "no", label: "No" },
                        ]}
                        errorMessage="Please tell us whether you work with GeSY."
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
                      <div
                        className="group"
                        data-validate-field="1"
                        data-invalid="0"
                        data-field-key="email"
                        data-field-label="Email address"
                      >
                        <label className={registerLabelClass}>
                          Email Address<span className="text-red-600">*</span>
                          <input
                            type="email"
                            name="email"
                            required
                            autoComplete="email"
                            pattern="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
                            title="Use a valid email. '+' aliases are supported (e.g. rociosirvent+test@gmail.com)."
                            className={registerInputClass}
                          />
                        </label>
                        <p className={registerFieldErrorClass}>Please enter a valid email address.</p>
                      </div>
                      <div
                        className="group"
                        data-validate-field="1"
                        data-invalid="0"
                        data-field-key="phone"
                        data-field-label="Mobile number"
                      >
                        <label className={registerLabelClass}>
                          Mobile Number<span className="text-red-600">*</span>
                          <input
                            type="tel"
                            name="phone"
                            required
                            autoComplete="tel"
                            placeholder="e.g., +357 99XXXXXX"
                            className={registerInputClass}
                          />
                        </label>
                        <p className={registerFieldErrorClass}>
                          Please enter your mobile number with country code.
                        </p>
                      </div>
                    </div>
                    <div
                      className="group"
                      data-validate-field="1"
                      data-invalid="0"
                      data-field-key="password"
                      data-field-label="Password"
                    >
                      <label className={registerLabelClass}>
                        Create Password<span className="text-red-600">*</span>
                        <PasswordToggleInput
                          name="password"
                          required
                          minLength={PASSWORD_MIN_LENGTH}
                          maxLength={PASSWORD_MAX_LENGTH}
                          pattern={PASSWORD_POLICY_HTML_PATTERN}
                          title={PASSWORD_POLICY_TITLE}
                          autoComplete="new-password"
                          tone="light"
                          className="w-full"
                          allowCopy
                        />
                      </label>
                      <p className={registerHelperClass}>{PASSWORD_POLICY_HELPER}</p>
                      <p className={registerFieldErrorClass}>{PASSWORD_POLICY_ERROR}</p>
                    </div>

                  </RegisterWizardStep>

                  <RegisterWizardStep
                    step={2}
                    title="Profile"
                    description="A photo and the languages you consult in."
                  >
                    <RegisterAvatarUpload tone="light" />
                    <RegisterLanguageFields />
                  </RegisterWizardStep>

                  <RegisterWizardStep
                    step={3}
                    title="Practice"
                    description={
                      clinicSlots.length > 1
                        ? "Confirm each clinic already linked to this listing. You can still add more later in Settings."
                        : "Your specialty, license, and the clinic patients will visit. Extra clinics can be added later in Settings."
                    }
                  >
                    <RegisterSpecialtyFields
                      key={claimPrefill?.id ?? "new"}
                      initialSpecialties={claimPrefill?.specialties}
                      specialtyOptions={specialtyOptions}
                    />
                    {clinicSlots.map((clinic, index) => {
                      const initialLocation = clinic
                        ? clinicLocationFromParts({
                            address: clinic.address,
                            latitude: clinic.latitude,
                            longitude: clinic.longitude,
                            placeId: clinic.placeId,
                            district: clinic.district,
                            town: clinic.town,
                          })
                        : null;
                      return (
                        <RegisterClinicAddressField
                          key={`${claimPrefill?.id ?? "new"}-${index}`}
                          index={index}
                          initialLocation={initialLocation}
                          listingAddressHint={
                            clinic?.address ??
                            (index === 0 ? claimPrefill?.addressHint : null)
                          }
                          listingDistrict={
                            clinic?.district ??
                            (index === 0 ? claimPrefill?.district : null)
                          }
                          showAddLaterHint={clinicSlots.length === 1}
                          heading={
                            clinicSlots.length > 1
                              ? clinic?.name
                                ? `Clinic ${index + 1}: ${clinic.name}`
                                : `Clinic ${index + 1} address`
                              : undefined
                          }
                        />
                      );
                    })}
                    <div
                      className="group"
                      data-validate-field="1"
                      data-invalid="0"
                      data-field-key="disclaimer"
                      data-field-label="Professional disclaimer"
                      data-field-boxed="1"
                    >
                      <label className="flex cursor-pointer gap-3 rounded-xl border border-ink-200 bg-ink-50/80 px-3.5 py-3 text-left transition hover:border-clinical-300">
                        <input
                          type="checkbox"
                          name="professionalDisclaimer"
                          value="on"
                          required
                          className="mt-1 h-4 w-4 shrink-0 rounded border-ink-300 bg-white text-clinical-500 focus:ring-clinical-400/50"
                        />
                        <span className="text-xs leading-snug text-ink-600">
                          I confirm I am a qualified health or wellness professional. I accept that
                          DocCy is a technology provider and assumes no liability for the authenticity
                          of professional credentials.
                        </span>
                      </label>
                      <p className={registerFieldErrorClass}>
                        Please confirm the professional disclaimer to continue.
                      </p>
                    </div>
                  </RegisterWizardStep>
                </RegisterWizard>
                </RegisterFormSubmitFeedback>
              </form>
            </section>
            <a
              href={`#${REGISTER_SETUP_CALL_ID}`}
              className="inline-flex min-h-[44px] items-center justify-center self-center text-sm font-bold text-clinical-800 underline-offset-4 hover:underline lg:self-start"
            >
              Prefer we set you up on a 15-minute call?
            </a>
          </>
        )}
        </div>

        <aside
          aria-label="Why DocCy"
          className="relative mx-4 mt-2 flex flex-col gap-6 overflow-hidden rounded-[26px] bg-clinical-500 px-5 pb-5 pt-6 sm:mx-8 lg:sticky lg:top-4 lg:mx-0 lg:mb-4 lg:mr-4 lg:mt-4 lg:h-[calc(100svh-2rem)] lg:min-h-[600px] lg:self-start lg:rounded-[32px] lg:px-11 lg:pb-7 lg:pt-8"
        >
          <span aria-hidden className="pointer-events-none absolute -bottom-28 -right-24 h-64 w-64 rounded-full bg-clinical-400 lg:-bottom-40 lg:-right-36 lg:h-[460px] lg:w-[460px]" />
          <span aria-hidden className="pointer-events-none absolute bottom-20 right-16 hidden h-44 w-44 rounded-full border-2 border-clinical-300 lg:block" />
          <span aria-hidden className="pointer-events-none absolute -left-16 top-40 hidden h-36 w-36 rounded-full bg-clinical-600 lg:block" />
          <RegisterPlanTicket ticket={planTicket} layout="row" className="relative hidden lg:block" />
          <RegisterShowcase />
        </aside>
      </div>

      <RegisterNextSteps />

      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 pb-10 pt-8 sm:px-8 sm:pb-20 sm:pt-16 lg:flex-row lg:items-start lg:gap-16 lg:px-[120px]">
        <RegisterFaqSection />
        <RegisterSetupCallCard />
      </div>
    </main>
  );
}
