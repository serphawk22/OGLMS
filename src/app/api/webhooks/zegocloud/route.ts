import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// ZEGOCLOUD sends a callback_secret based signature in the Authorization header
// Format: MD5(CallbackSecret + Timestamp + Nonce)
function verifySignature(req: NextRequest, body: string): boolean {
  const callbackSecret = process.env.ZEGO_CALLBACK_SECRET;
  if (!callbackSecret) return false;

  const timestamp = req.headers.get("x-timestamp") || "";
  const nonce = req.headers.get("x-nonce") || "";
  const incomingSignature = req.headers.get("x-signature") || "";

  const expected = createHmac("md5", callbackSecret)
    .update(callbackSecret + timestamp + nonce)
    .digest("hex");

  return expected === incomingSignature;
}

// POST /api/webhooks/zegocloud
// Called by ZEGOCLOUD when a cloud recording session ends
export async function POST(req: NextRequest) {
  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Verify signature (skip in dev if secret is missing)
  if (process.env.NODE_ENV === "production" && !verifySignature(req, body)) {
    console.warn("[Webhook] Invalid ZEGOCLOUD signature");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ZEGOCLOUD recording callback shape (simplified):
  // { event: "stop_recording", room_id: "...", recording_url: "https://..." }
  const event = payload.event as string;
  const roomId = (payload.room_id || payload.roomID) as string;
  const recordingUrl = (payload.recording_url || payload.recordingUrl) as string | undefined;

  console.log("[Webhook] ZEGOCLOUD event:", event, "roomId:", roomId);

  if (!roomId) {
    return NextResponse.json({ error: "Missing roomId" }, { status: 400 });
  }

  try {
    if (event === "stop_recording" && recordingUrl) {
      await prisma.liveSession.updateMany({
        where: { roomId },
        data: { status: "COMPLETED", recordingUrl },
      });
    } else if (event === "room_closed" || event === "end_stream") {
      await prisma.liveSession.updateMany({
        where: { roomId },
        data: { status: "COMPLETED" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Webhook] DB update error:", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
