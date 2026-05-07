import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    return payload.userId as string;
  } catch {
    return null;
  }
}

// Typed wrapper that gracefully falls back if Chat model isn't in the generated client yet.
// Run `npx prisma generate` to get full type-safety.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as unknown as Record<string, any>;

// GET /api/chat/history?courseId=xxx  → list chats for this course
// GET /api/chat/history?chatId=xxx    → load messages for a chat
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");
  const chatId   = searchParams.get("chatId");

  // Return empty if Chat model not available in current Prisma build
  if (typeof db?.chat?.findFirst !== "function") {
    return NextResponse.json({ chats: [], messages: [] });
  }

  try {
    if (chatId) {
      const chat = await db.chat.findFirst({
        where: { id: chatId, userId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ messages: chat.messages });
    }

    if (courseId) {
      const chats = await db.chat.findMany({
        where: { userId, courseId },
        orderBy: { updatedAt: "desc" },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      });
      return NextResponse.json({ chats });
    }

    return NextResponse.json({ error: "Provide courseId or chatId" }, { status: 400 });
  } catch (err) {
    console.error("[GET /api/chat/history]", err);
    return NextResponse.json({ chats: [], messages: [] });
  }
}

// DELETE /api/chat/history?chatId=xxx  → delete a chat session
export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

  if (typeof db?.chat?.findFirst !== "function") {
    return NextResponse.json({ success: true });
  }

  try {
    const chat = await db.chat.findFirst({ where: { id: chatId, userId } });
    if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.chat.delete({ where: { id: chatId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/chat/history]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
