import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRole) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
}
const admin = createClient(supabaseUrl, serviceRole);

const nonce = `${Date.now()}`;

function isoDate(daysFromToday) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

async function createDoctor({ slugPrefix, name }) {
  const email = `${slugPrefix}-${nonce}@test-doccy.com.cy`;
  const slug = `${slugPrefix}-${nonce}`;
  const userRes = await admin.auth.admin.createUser({
    email,
    password: "StrongPass123!",
    email_confirm: true,
    user_metadata: { role: "doctor" },
  });
  if (userRes.error || !userRes.data.user?.id) {
    throw new Error(`Failed creating auth user: ${userRes.error?.message}`);
  }
  const authUserId = userRes.data.user.id;

  const doctorInsert = await admin
    .from("professionals")
    .insert({
      auth_user_id: authUserId,
      name,
      specialty: "Dentistry",
      specialties: ["Dentistry"],
      district: "Paphos",
      email,
      phone: "+35799123456",
      languages: ["English"],
      avatar_url: null,
      license_number: `LIC-DEMO-${nonce}-${slugPrefix}`,
      license_file_url: `licenses/demo/${nonce}-${slugPrefix}.pdf`,
      status: "verified",
      slug,
      is_specialty_approved: true,
      is_test_profile: true,
      is_registered: true,
      has_online_booking: true,
      finder_visible: true,
      is_archived: false,
      subscription_tier: "standard",
    })
    .select("id")
    .single();

  if (doctorInsert.error || !doctorInsert.data?.id) {
    await admin.auth.admin.deleteUser(authUserId);
    throw new Error(`Failed creating doctor row: ${doctorInsert.error?.message}`);
  }
  const doctorId = String(doctorInsert.data.id);

  const specialtyUpsert = await admin.from("doctor_specialties").upsert(
    {
      doctor_id: doctorId,
      specialty: "Dentistry",
      license_number: `LIC-DEMO-${nonce}-${slugPrefix}`,
      is_approved: true,
    },
    { onConflict: "doctor_id,specialty" },
  );
  if (specialtyUpsert.error) {
    throw new Error(`Failed creating doctor_specialties: ${specialtyUpsert.error.message}`);
  }

  return { doctorId, authUserId, slug, name };
}

async function seedWeekdaySettings(doctorId, { holidayModeEnabled, holidayStartDate, holidayEndDate }) {
  const day = { enabled: true, start_time: "09:00:00", end_time: "17:00:00" };
  const disabledDay = { enabled: false, start_time: "09:00:00", end_time: "17:00:00" };
  const settingsUpsert = await admin.from("doctor_settings").upsert(
    {
      doctor_id: doctorId,
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      start_time: "09:00:00",
      end_time: "17:00:00",
      weekly_schedule: {
        monday: day,
        tuesday: day,
        wednesday: day,
        thursday: day,
        friday: day,
        saturday: disabledDay,
        sunday: disabledDay,
      },
      break_start: null,
      break_end: null,
      holiday_mode_enabled: holidayModeEnabled,
      holiday_start_date: holidayStartDate,
      holiday_end_date: holidayEndDate,
      pause_online_bookings: false,
      slot_duration_minutes: 30,
      booking_horizon_days: 90,
      minimum_notice_hours: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "doctor_id" },
  );
  if (settingsUpsert.error) {
    throw new Error(`Failed preparing doctor settings: ${settingsUpsert.error.message}`);
  }
}

const noSlotsThisWeek = await createDoctor({
  slugPrefix: "finder-demo-next-avail",
  name: `Test Demo NextAvail ${nonce}`,
});
// On holiday through the whole first visible 5-day page (today-1 .. today+7),
// but has a normal Mon-Fri schedule after that -> "No availabilities this
// week" + "Next slots available <date>" on first load.
await seedWeekdaySettings(noSlotsThisWeek.doctorId, {
  holidayModeEnabled: true,
  holidayStartDate: isoDate(-1),
  holidayEndDate: isoDate(7),
});

const zeroAvailability = await createDoctor({
  slugPrefix: "finder-demo-view-full",
  name: `Test Demo ViewFull ${nonce}`,
});
// No doctor_settings row at all -> zero days anywhere in the 90-day window
// -> "View full availability" link instead of a calendar.

console.log(JSON.stringify({ noSlotsThisWeek, zeroAvailability }, null, 2));
