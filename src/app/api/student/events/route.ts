import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ensureTablesExist } from "@/lib/notifications";

export const runtime = "nodejs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

type RawEvent = {
  id: string;
  title: string;
  date: Date;
  type: string;
  courseId: string | null;
  courseTitle: string | null;
};

// GET /api/student/events
// Returns upcoming events for courses the student is enrolled in (next 60 days)
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secret);
    userId = payload.userId as string;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureTablesExist();

    // Get courseIds the student is enrolled in
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      select: { courseId: true },
    });
    const courseIds = enrollments.map((e) => e.courseId);

    const now = new Date();
    const sixtyDaysLater = new Date(now);
    sixtyDaysLater.setDate(sixtyDaysLater.getDate() + 60);

    let rawEvents: RawEvent[];

    if (courseIds.length === 0) {
      // No enrollments — only return org-wide events (courseId IS NULL)
      rawEvents = await prisma.$queryRaw<RawEvent[]>`
        SELECT e."id", e."title", e."date", e."type", e."courseId",
               c."title" AS "courseTitle"
        FROM "Event" e
        LEFT JOIN "Course" c ON c."id" = e."courseId"
        WHERE e."date" >= ${now}
          AND e."date" <= ${sixtyDaysLater}
          AND e."courseId" IS NULL
        ORDER BY e."date" ASC
      `;
    } else {
      // Build a safe IN list using Prisma.join
      const idList = Prisma.join(courseIds.map((id) => Prisma.sql`${id}`));
      rawEvents = await prisma.$queryRaw<RawEvent[]>`
        SELECT e."id", e."title", e."date", e."type", e."courseId",
               c."title" AS "courseTitle"
        FROM "Event" e
        LEFT JOIN "Course" c ON c."id" = e."courseId"
        WHERE e."date" >= ${now}
          AND e."date" <= ${sixtyDaysLater}
          AND (e."courseId" IN (${idList}) OR e."courseId" IS NULL)
        ORDER BY e."date" ASC
      `;
    }

    // Serialize dates and reshape for the client (match CalendarDropdown's expected shape)
    const events = rawEvents.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date instanceof Date ? e.date.toISOString() : e.date,
      type: e.type,
      courseId: e.courseId,
      course: e.courseTitle ? { title: e.courseTitle } : null,
    }));

    return NextResponse.json({ events });
  } catch (err) {
    console.error("[GET /api/student/events] Error:", err);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
