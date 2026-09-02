/**
 * Verify (and optionally repair) production smoke doctors used by nightly CI:
 * - TEST_BOOKING_DOCTOR_SLUG: bookable weekly schedule
 * - TEST_DOCTOR_EMAIL / TEST_DOCTOR_PASSWORD: Supabase auth + doctors.auth_user_id link
 *
 * Usage:
 *   node scripts/ensure-prod-smoke-doctors.mjs --env-file .env.production.local --check
 *   DOC_CY_CONFIRM_PROD=YES node scripts/ensure-prod-smoke-doctors.mjs --env-file .env.production.local --apply
 *   DOC_CY_CONFIRM_PROD=YES node scripts/ensure-prod-smoke-doctors.mjs --env-file .env.production.local --apply --repair-auth
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const PROD_REF = "oiwlztcduxojadbcxkil";

function parseArgs(argv) {
  const out = {
    envFile: "",
    check: false,
    apply: false,
    repairAuth: false,
    bookingOnly: false,
    bookingSlug: "",
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--env-file" && argv[i + 1]) {
      out.envFile = argv[++i];
    } else if (a === "--booking-slug" && argv[i + 1]) {
      out.bookingSlug = argv[++i].trim();
    } else if (a === "--check") {
      out.check = true;
    } else if (a === "--apply") {
      out.apply = true;
    } else if (a === "--repair-auth") {
      out.repairAuth = true;
    } else if (a === "--booking-only") {
      out.bookingOnly = true;
    }
  }
  if (!out.check && !out.apply) {
    out.check = true;
  }
  return out;
}

function normalizeSecret(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/^['"]+|['"]+$/g, "");
}

function loadEnvFile(explicit) {
  const candidates = explicit
    ? [explicit]
    : [
        process.env.PLAYWRIGHT_ENV_FILE?.trim(),
        ".env.production.local",
        ".env.local",
      ].filter(Boolean);

  for (const file of candidates) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true });
      return file;
    }
  }
  return null;
}

function bookableSettingsPayload(doctorId) {
  const day = {
    enabled: true,
    start_time: "09:00:00",
    end_time: "18:00:00",
  };
  return {
    doctor_id: doctorId,
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    start_time: "09:00:00",
    end_time: "18:00:00",
    weekly_schedule: {
      monday: day,
      tuesday: day,
      wednesday: day,
      thursday: day,
      friday: day,
      saturday: { enabled: false, start_time: "09:00:00", end_time: "18:00:00" },
      sunday: { enabled: false, start_time: "09:00:00", end_time: "18:00:00" },
    },
    break_start: null,
    break_end: null,
    holiday_mode_enabled: false,
    holiday_start_date: null,
    holiday_end_date: null,
    pause_online_bookings: false,
    slot_duration_minutes: 30,
    booking_horizon_days: 90,
    minimum_notice_hours: 1,
    updated_at: new Date().toISOString(),
  };
}

function settingsLookBookable(settings) {
  if (!settings) return { ok: false, reason: "missing doctor_settings row" };
  if (settings.pause_online_bookings) {
    return { ok: false, reason: "pause_online_bookings is true" };
  }
  if (settings.holiday_mode_enabled) {
    const today = new Date().toISOString().slice(0, 10);
    const start = settings.holiday_start_date ?? "";
    const end = settings.holiday_end_date ?? "";
    if (start && end && today >= start && today <= end) {
      return { ok: false, reason: `holiday mode active (${start}..${end})` };
    }
  }
  const horizon = Number(settings.booking_horizon_days ?? 0);
  if (horizon < 7) {
    return { ok: false, reason: `booking_horizon_days too low (${horizon})` };
  }
  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const weekly = settings.weekly_schedule ?? {};
  const anyWeekday =
    weekdays.some((key) => weekly[key]?.enabled === true) ||
    weekdays.some((key) => settings[key] === true);
  if (!anyWeekday) {
    return { ok: false, reason: "no enabled weekday in schedule" };
  }
  return { ok: true, reason: "schedule looks bookable" };
}

async function findAuthUserIdByEmail(admin, email) {
  let page = 1;
  while (page <= 30) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const user =
      data.users.find((u) => u.email?.trim().toLowerCase() === email) ?? null;
    if (user) return user.id;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function deleteAuthByEmail(admin, email) {
  const userId = await findAuthUserIdByEmail(admin, email);
  if (!userId) return { deleted: false, userId: null };
  const del = await admin.auth.admin.deleteUser(userId);
  if (del.error) {
    return { deleted: false, userId, error: del.error.message };
  }
  return { deleted: true, userId };
}

async function main() {
  const args = parseArgs(process.argv);
  const loaded = loadEnvFile(args.envFile);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const bookingSlug = args.bookingSlug || normalizeSecret(process.env.TEST_BOOKING_DOCTOR_SLUG);
  const doctorEmail = normalizeSecret(process.env.TEST_DOCTOR_EMAIL);
  const doctorPassword = normalizeSecret(process.env.TEST_DOCTOR_PASSWORD);

  if (!url || !serviceRole || !anon) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    if (loaded) console.error(`Loaded: ${loaded}`);
    process.exit(1);
  }

  const isProd = url.includes(PROD_REF);
  if (isProd && process.env.DOC_CY_CONFIRM_PROD !== "YES") {
    console.error("Refusing production changes without DOC_CY_CONFIRM_PROD=YES");
    process.exit(1);
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const pub = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let exitCode = 0;
  console.log(`Mode: ${args.apply ? "apply" : "check"}${args.repairAuth ? " + repair-auth" : ""}`);
  console.log(`Supabase: ${url}`);
  if (loaded) console.log(`Env file: ${loaded}`);

  if (!bookingSlug) {
    console.error("Missing TEST_BOOKING_DOCTOR_SLUG (or pass --booking-slug).");
    exitCode = 1;
  } else {
    const doctorRes = await admin
      .from("professionals")
      .select("id, slug, email, status, auth_user_id, is_test_profile")
      .eq("slug", bookingSlug)
      .maybeSingle();

    if (doctorRes.error || !doctorRes.data) {
      console.error(`[booking] Doctor not found for slug: ${bookingSlug}`);
      exitCode = 1;
    } else {
      const d = doctorRes.data;
      const rawEmail = String(d.email ?? "");
      const cleanEmail = rawEmail.trim().toLowerCase();
      if (rawEmail && rawEmail !== cleanEmail) {
        console.warn(
          `[booking] doctors.email has stray whitespace/newlines (len ${rawEmail.length} → ${cleanEmail.length}).`,
        );
        if (args.apply) {
          await admin.from("professionals").update({ email: cleanEmail }).eq("id", d.id);
          console.log("[booking] Trimmed doctors.email.");
        } else {
          exitCode = 1;
        }
      }
      console.log(
        `[booking] ${d.slug} status=${d.status} test_profile=${d.is_test_profile} id=${d.id}`,
      );
      if (d.status !== "verified") {
        console.error("[booking] Doctor is not verified — fix in /internal/directory.");
        exitCode = 1;
      }

      const settingsRes = await admin
        .from("doctor_settings")
        .select(
          "doctor_id, pause_online_bookings, holiday_mode_enabled, holiday_start_date, holiday_end_date, booking_horizon_days, weekly_schedule, monday, tuesday, wednesday, thursday, friday",
        )
        .eq("doctor_id", d.id)
        .maybeSingle();

      const bookable = settingsLookBookable(settingsRes.data);
      if (bookable.ok) {
        console.log(`[booking] OK — ${bookable.reason}`);
      } else {
        console.warn(`[booking] NOT bookable — ${bookable.reason}`);
        if (args.apply) {
          const payload = bookableSettingsPayload(d.id);
          const upsert = await admin.from("doctor_settings").upsert(payload, {
            onConflict: "doctor_id",
          });
          if (upsert.error) {
            console.error("[booking] Upsert failed:", upsert.error.message);
            exitCode = 1;
          } else {
            console.log("[booking] Applied smoke-friendly doctor_settings.");
          }
        } else {
          exitCode = 1;
        }
      }
    }
  }

  if (args.bookingOnly) {
    console.log("[auth] Skipped (--booking-only).");
  } else if (!doctorEmail || !doctorPassword) {
    console.error("Missing TEST_DOCTOR_EMAIL or TEST_DOCTOR_PASSWORD.");
    exitCode = 1;
  } else {
    const signIn = await pub.auth.signInWithPassword({
      email: doctorEmail,
      password: doctorPassword,
    });
    if (signIn.error) {
      console.error(`[auth] signInWithPassword failed: ${signIn.error.message}`);
      if (args.apply && args.repairAuth) {
        const doctorByEmail = await admin
          .from("professionals")
          .select("id, slug, auth_user_id")
          .ilike("email", doctorEmail)
          .maybeSingle();
        const slugForRepair = doctorByEmail.data?.slug ?? bookingSlug;
        if (!slugForRepair) {
          console.error("[auth] Cannot repair — no doctor slug for this email.");
          exitCode = 1;
        } else {
          console.log(`[auth] Repairing via slug ${slugForRepair} (delegates to repair-doctor-auth logic)...`);
          const doctorRow = await admin
            .from("professionals")
            .select("id")
            .eq("slug", slugForRepair)
            .maybeSingle();
          if (!doctorRow.data?.id) {
            console.error("[auth] Doctor row missing for repair.");
            exitCode = 1;
          } else {
            await admin.from("professionals").update({ auth_user_id: null }).eq("id", doctorRow.data.id);
            const cleanup = await deleteAuthByEmail(admin, doctorEmail);
            if (cleanup.error) {
              console.error("[auth] deleteUser failed:", cleanup.error);
              exitCode = 1;
            } else {
              const created = await admin.auth.admin.createUser({
                email: doctorEmail,
                password: doctorPassword,
                email_confirm: true,
                user_metadata: { role: "doctor" },
              });
              if (created.error || !created.data.user?.id) {
                console.error("[auth] createUser failed:", created.error?.message);
                exitCode = 1;
              } else {
                const uid = created.data.user.id;
                await admin.from("professionals").update({ auth_user_id: uid }).eq("id", doctorRow.data.id);
                const verify = await pub.auth.signInWithPassword({
                  email: doctorEmail,
                  password: doctorPassword,
                });
                if (verify.error) {
                  console.error("[auth] Post-repair sign-in failed:", verify.error.message);
                  exitCode = 1;
                } else {
                  console.log("[auth] Repair OK — auth_user_id relinked.");
                }
              }
            }
          }
        }
      } else if (!args.repairAuth) {
        console.error(
          "[auth] Re-run with --apply --repair-auth to recreate auth user (destructive; updates GitHub secret password must match).",
        );
        exitCode = 1;
      }
    } else {
      const authUserId = signIn.data.user?.id ?? "";
      console.log(`[auth] OK — signInWithPassword succeeded (user ${authUserId}).`);
      await pub.auth.signOut().catch(() => {});

      const doctorLink = await admin
        .from("professionals")
        .select("id, slug, auth_user_id")
        .ilike("email", doctorEmail)
        .maybeSingle();
      if (doctorLink.data?.auth_user_id) {
        const authRow = await admin.auth.admin.getUserById(doctorLink.data.auth_user_id);
        const authEmail = (authRow.data.user?.email ?? "").trim().toLowerCase();
        if (authEmail && authEmail !== doctorEmail) {
          console.warn(
            `[auth] TEST_DOCTOR_EMAIL (${doctorEmail}) does not match auth user (${authEmail}). ` +
              "Update GitHub secret TEST_DOCTOR_EMAIL to the auth email (overwrite; GitHub does not show old values).",
          );
          exitCode = 1;
        }
      }

      if (doctorLink.data) {
        if (!doctorLink.data.auth_user_id) {
          console.warn("[auth] doctors.auth_user_id is null — linking...");
          if (args.apply) {
            await admin
              .from("professionals")
              .update({ auth_user_id: authUserId })
              .eq("id", doctorLink.data.id);
            console.log("[auth] Linked auth_user_id on doctors row.");
          } else {
            exitCode = 1;
          }
        } else if (doctorLink.data.auth_user_id !== authUserId) {
          console.warn(
            `[auth] auth_user_id mismatch (doctors=${doctorLink.data.auth_user_id} auth=${authUserId}).`,
          );
          if (args.apply) {
            await admin
              .from("professionals")
              .update({ auth_user_id: authUserId })
              .eq("id", doctorLink.data.id);
            console.log("[auth] Fixed auth_user_id mismatch.");
          } else {
            exitCode = 1;
          }
        } else {
          console.log(`[auth] doctors row linked (${doctorLink.data.slug}).`);
        }
      } else {
        console.warn("[auth] No doctors row for TEST_DOCTOR_EMAIL.");
      }
    }
  }

  if (exitCode === 0) {
    console.log("\nAll prod smoke doctor checks passed.");
    console.log("Sync GitHub secrets: TEST_BOOKING_DOCTOR_SLUG, TEST_DOCTOR_EMAIL, TEST_DOCTOR_PASSWORD.");
  } else {
    console.error("\nProd smoke doctor checks failed. Fix issues above or run with --apply.");
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
