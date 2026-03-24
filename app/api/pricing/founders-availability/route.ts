import { NextResponse } from "next/server";
import { getFoundersAvailability } from "@/lib/founders-club";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const data = await getFoundersAvailability();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
