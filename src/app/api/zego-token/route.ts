import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId   = searchParams.get("roomId")   ?? "";
  const userId   = searchParams.get("userId")   ?? "";
  const userName = searchParams.get("userName") ?? "User";

  if (!roomId || !userId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const appId        = parseInt(process.env.NEXT_PUBLIC_ZEGO_APP_ID ?? "0", 10);
  const serverSecret = process.env.ZEGO_SERVER_SECRET ?? "";

  if (!appId || !serverSecret) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  // For testing/prototype: return the secret to the client so it can use generateKitTokenForTest.
  // In true production, you would generate a Token04 here using Zego's official ServerAssistant.
  return NextResponse.json({ serverSecret, appId, roomId, userId, userName });
}
