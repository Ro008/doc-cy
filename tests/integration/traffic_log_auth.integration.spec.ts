import { expect, test } from "@playwright/test";
import { POST } from "@/app/api/traffic/log/route";
import {
  TRAFFIC_LOG_SIGNATURE_HEADER,
  TRAFFIC_LOG_TIMESTAMP_HEADER,
  signTrafficLogRequest,
  verifyTrafficLogRequest,
} from "@/lib/traffic-log";

const SECRET = "traffic-log-test-secret";

function withTrafficLogSecret() {
  const previousSecret = process.env.DOC_CY_TRAFFIC_LOG_SECRET;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.DOC_CY_TRAFFIC_LOG_SECRET = SECRET;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  return () => {
    if (previousSecret === undefined) delete process.env.DOC_CY_TRAFFIC_LOG_SECRET;
    else process.env.DOC_CY_TRAFFIC_LOG_SECRET = previousSecret;

    if (previousSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousSupabaseUrl;

    if (previousServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRole;
  };
}

function jsonRequest(body: string, signed?: {timestamp: string; signature: string}) {
  const headers = new Headers({"Content-Type": "application/json"});
  if (signed) {
    headers.set(TRAFFIC_LOG_TIMESTAMP_HEADER, signed.timestamp);
    headers.set(TRAFFIC_LOG_SIGNATURE_HEADER, signed.signature);
  }
  return new Request("https://www.mydoccy.com/api/traffic/log", {
    method: "POST",
    headers,
    body,
  });
}

test.describe("traffic log ingestion authentication", () => {
  test("rejects unsigned public requests before service-role setup", async () => {
    const restoreEnv = withTrafficLogSecret();
    try {
      const response = await POST(
        jsonRequest(
          JSON.stringify({
            session_id: "attacker-session",
            page_path: "/",
            created_at: "2026-05-02T22:00:00.000Z",
          })
        )
      );

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({reason: "unauthorized"});
    } finally {
      restoreEnv();
    }
  });

  test("accepts only signatures for the exact request body and timestamp", async () => {
    const restoreEnv = withTrafficLogSecret();
    try {
      const body = JSON.stringify({
        session_id: "middleware-session",
        page_path: "/finder",
        created_at: "2026-05-02T22:00:00.000Z",
      });
      const signed = await signTrafficLogRequest(body, "1777768800000");

      expect(signed).not.toBeNull();
      expect(
        await verifyTrafficLogRequest(
          jsonRequest(body, signed!).headers,
          body,
          1777768800000
        )
      ).toBe(true);
      expect(
        await verifyTrafficLogRequest(
          jsonRequest(body, signed!).headers,
          body.replace("/finder", "/internal/directory"),
          1777768800000
        )
      ).toBe(false);

      const currentSignature = await signTrafficLogRequest(body);
      expect(currentSignature).not.toBeNull();

      const response = await POST(jsonRequest(body, currentSignature!));
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        reason: "service_role_not_configured",
      });
    } finally {
      restoreEnv();
    }
  });
});
