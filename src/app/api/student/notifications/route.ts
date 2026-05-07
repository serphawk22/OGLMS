import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { ensureTablesExist } from "@/lib/notifications";

export const runtime = "nodejs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

type RawNotification = {
  id: string;
  userId: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
};

async function getAuthUser(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.userId as string;
  } catch {
    return null;
  }
}

// GET /api/student/notifications — fetch latest notifications for the logged-in student
export async function GET() {
  const userId = await getAuthUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureTablesExist();

    const notifications = await prisma.$queryRaw<RawNotification[]>`
      SELECT "id", "userId", "message", "type", "isRead", "createdAt"
      FROM "Notification"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC
      LIMIT 20
    `;

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    // Serialize dates to ISO strings for the client
    const serialized = notifications.map((n) => ({
      ...n,
      createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
    }));

    return NextResponse.json({ notifications: serialized, unreadCount });
  } catch (err) {
    console.error("[GET /api/student/notifications] Error:", err);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

// PATCH /api/student/notifications — mark one or all as read
// Body: { id: string } to mark one, or { all: true } to mark all
export async function PATCH(req: NextRequest) {
  const userId = await getAuthUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureTablesExist();
    const body = await req.json();

    if (body.all === true) {
      await prisma.$executeRaw`
        UPDATE "Notification"
        SET "isRead" = true
        WHERE "userId" = ${userId} AND "isRead" = false
      `;
      return NextResponse.json({ success: true, message: "All marked as read" });
    }

    if (body.id) {
      // Verify the notification belongs to this user before updating
      const rows = await prisma.$queryRaw<{ userId: string }[]>`
        SELECT "userId" FROM "Notification" WHERE "id" = ${body.id} LIMIT 1
      `;
      if (rows.length === 0 || rows[0].userId !== userId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      await prisma.$executeRaw`
        UPDATE "Notification" SET "isRead" = true WHERE "id" = ${body.id}
      `;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Missing id or all flag" }, { status: 400 });
  } catch (err) {
    console.error("[PATCH /api/student/notifications] Error:", err);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
