import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PurgeRegisteredProfessionalError,
  purgeRegisteredProfessional,
} from "../../lib/purge-registered-professional";

type FakeRow = {
  id: string;
  name: string;
  auth_user_id: string | null;
  is_registered: boolean;
  license_file_url: string | null;
  avatar_url: string | null;
  email: string | null;
  registration_email: string | null;
};

function createFakeAdmin(row: FakeRow | null) {
  const deleted: Array<{ table: string; column: string; id: string }> = [];
  let deletedAuth: string | null = null;
  let professionalsDeleted = false;

  const from = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      delete: () => ({
        eq: async (column: string, id: string) => {
          deleted.push({ table, column, id: String(id) });
          if (table === "professionals") professionalsDeleted = true;
          return { error: null };
        },
      }),
      maybeSingle: async () => {
        if (table !== "professionals") {
          return { data: null, error: null };
        }
        return { data: row, error: null };
      },
    };
    return chain;
  };

  return {
    admin: {
      from,
      auth: {
        admin: {
          deleteUser: async (id: string) => {
            deletedAuth = id;
            return { error: null };
          },
        },
      },
      storage: {
        from: () => ({
          list: async () => ({ data: [], error: null }),
          remove: async () => ({ error: null }),
        }),
      },
    } as never,
    deleted,
    getDeletedAuth: () => deletedAuth,
    getProfessionalsDeleted: () => professionalsDeleted,
  };
}

describe("purgeRegisteredProfessional", () => {
  it("rejects when confirmation name does not match", async () => {
    const { admin } = createFakeAdmin({
      id: "p1",
      name: "Oscar Wilde",
      auth_user_id: "auth-1",
      is_registered: true,
      license_file_url: null,
      avatar_url: null,
      email: null,
      registration_email: "o@example.com",
    });

    await assert.rejects(
      () =>
        purgeRegisteredProfessional(admin, {
          professionalId: "p1",
          confirmName: "Wrong Name",
        }),
      (err: unknown) =>
        err instanceof PurgeRegisteredProfessionalError && err.status === 400,
    );
  });

  it("rejects unregistered directory rows", async () => {
    const { admin } = createFakeAdmin({
      id: "p1",
      name: "Finder Only",
      auth_user_id: null,
      is_registered: false,
      license_file_url: null,
      avatar_url: null,
      email: null,
      registration_email: null,
    });

    await assert.rejects(
      () =>
        purgeRegisteredProfessional(admin, {
          professionalId: "p1",
          confirmName: "Finder Only",
        }),
      (err: unknown) =>
        err instanceof PurgeRegisteredProfessionalError && err.status === 400,
    );
  });

  it("deletes child rows, professional, and auth user on confirm", async () => {
    const fake = createFakeAdmin({
      id: "p1",
      name: "Oscar Wilde",
      auth_user_id: "auth-1",
      is_registered: true,
      license_file_url: "licenses/x.pdf",
      avatar_url: "profiles/p1/avatar.jpg",
      email: null,
      registration_email: "o@example.com",
    });

    const result = await purgeRegisteredProfessional(fake.admin, {
      professionalId: "p1",
      confirmName: "oscar wilde",
    });

    assert.equal(result.ok, true);
    assert.equal(result.authUserId, "auth-1");
    assert.equal(fake.getProfessionalsDeleted(), true);
    assert.equal(fake.getDeletedAuth(), "auth-1");
    assert.ok(
      fake.deleted.some((d) => d.table === "appointments" && d.column === "doctor_id"),
    );
    assert.ok(
      fake.deleted.some(
        (d) => d.table === "professional_clinics" && d.column === "professional_id",
      ),
    );
  });
});
