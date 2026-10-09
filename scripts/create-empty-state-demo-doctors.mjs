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
      email,
      languages: ["English"],
      avatar_url: null,
      slug,
      is_test_profile: true,
      is_registered: true,
      pro_access_until: new Date(Date.now() + 180 * 86_400_000).toISOString(),
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

  const specialtyInsert = await admin.from("professional_specialties").insert({
    professional_id: doctorId,
    specialty: "Dentist",
    license_number: `LIC-DEMO-${nonce}-${slugPrefix}`,
  });
  if (specialtyInsert.error) {
    throw new Error(`Failed creating professional_specialties: ${specialtyInsert.error.message}`);
  }

  return { doctorId, authUserId, slug, name };
}

async function seedWeekdaySettings(doctorId, { holidayModeEnabled, holidayStartDate, holidayEndDate }) {
  const settingsUpsert = await admin.from("professional_settings").upsert(
    {
      professional_id: doctorId,
      holiday_mode_enabled: holidayModeEnabled,
      holiday_start_date: holidayStartDate,
      holiday_end_date: holidayEndDate,
      booking_horizon_days: 90,
      minimum_notice_hours: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "professional_id" },
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
// No clinic (the schedule lives on the clinic link, Point E6) -> zero days anywhere in the 90-day window
// -> "View full availability" link instead of a calendar.

console.log(JSON.stringify({ noSlotsThisWeek, zeroAvailability }, null, 2));
