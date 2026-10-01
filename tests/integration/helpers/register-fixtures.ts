import type { SupabaseClient } from "@supabase/supabase-js";
import { seedProfessionalSpecialty } from "./test-doctor";

/**
 * DocCy clinics and a claimable listing for the register specs, so they don't
 * depend on Testing's real directory (CI runs on a synthetic seed with none of it).
 *
 * Every name and address carries `token`, a random word no real row contains, so a
 * clinic search for `token` finds only these:
 * - two clinics in the same Lefkotheou building (`lefkotheou`),
 * - a polyclinic elsewhere (`polykliniki`),
 * - four more clinics at their own addresses (`clinics`),
 * - an unregistered GeSY listing (female, one specialty) linked to the Lefkotheou
 *   Medical Centre and the polyclinic, hidden from the finder.
 * `remove()` deletes the listing (its links and specialty go with it), then the clinics.
 */
export type RegisterFixtures = {
  token: string;
  listing: { id: string; name: string };
  remove: () => Promise<void>;
};

type ClinicSeed = { name: string; address: string };

export async function seedRegisterFixtures(admin: SupabaseClient): Promise<RegisterFixtures> {
  // Letters only: the claim prefill copies the listing's name, and names refuse digits.
  const letters = Array.from({ length: 10 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join("");
  const token = `rfx${letters}`;
  const building = `10 ${token} Lefkotheou Avenue, Nicosia`;
  const seeds: ClinicSeed[] = [
    { name: `${token} Lefkotheou Medical Centre`, address: building },
    { name: `${token} Lefkotheou Diagnostics`, address: building },
    { name: `${token} Polykliniki`, address: `3 ${token} Street, Nicosia` },
    ...["Alpha", "Beta", "Gamma", "Delta"].map((label, i) => ({
      name: `${token} Clinic ${label}`,
      address: `${20 + i} ${token} Road, Nicosia`,
    })),
  ];

  const clinicIds: string[] = [];
  let listingId: string | null = null;
  const remove = async () => {
    if (listingId) await admin.from("professionals").delete().eq("id", listingId);
    if (clinicIds.length) await admin.from("clinics").delete().in("id", clinicIds);
  };

  try {
    const { data: clinics, error: clinicError } = await admin
      .from("clinics")
      .insert(
        seeds.map((seed, i) => ({
          name: seed.name,
          slug: `${token}-${i}`,
          district: "Nicosia",
          town: "Nicosia",
          address: seed.address,
          phone: "22123456",
          latitude: 35.1725 + i * 0.001,
          longitude: 33.365 + i * 0.001,
        })),
      )
      .select("id, name");
    if (clinicError || !clinics) throw new Error(`register fixtures clinics: ${clinicError?.message}`);
    const idByName = new Map((clinics as { id: string; name: string }[]).map((c) => [c.name, c.id]));
    clinicIds.push(...idByName.values());

    const name = `Anna Fixture${token}`;
    const { data: listing, error: listingError } = await admin
      .from("professionals")
      .insert({
        name,
        slug: `anna-fixture-${token}`,
        email: `${token}@integration.test`,
        district: "Nicosia",
        gender: "female",
        is_gesy: true,
        is_registered: false,
        is_archived: false,
        is_test_profile: true,
      })
      .select("id")
      .single();
    if (listingError || !listing) throw new Error(`register fixtures listing: ${listingError?.message}`);
    listingId = String(listing.id);

    await seedProfessionalSpecialty(admin, listingId, { specialty: "Physiotherapist" });
    const { error: linkError } = await admin.from("professional_clinics").insert(
      [seeds[0]!, seeds[2]!].map((seed, i) => ({
        professional_id: listingId,
        clinic_id: idByName.get(seed.name),
        is_primary: i === 0,
        sort_order: i,
      })),
    );
    if (linkError) throw new Error(`register fixtures links: ${linkError.message}`);

    return { token, listing: { id: listingId, name }, remove };
  } catch (error) {
    await remove();
    throw error;
  }
}
