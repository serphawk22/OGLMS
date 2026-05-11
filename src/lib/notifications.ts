/**
 * lib/notifications.ts
 *
 * Uses raw SQL ($executeRaw / $queryRaw) so this works even when the Prisma
 * generated client is stale (i.e. `prisma generate` has not been re-run yet
 * after the Notification / Event models were added to schema.prisma).
 *
 * The `ensureTablesExist` helper auto-creates the two tables on first call so
 * `prisma db push` is not required before the server starts.
 */
import { prisma } from "@/lib/prisma";

type NotifType = "COURSE" | "ASSIGNMENT" | "MODULE";
type EventType = "ASSIGNMENT_DEADLINE" | "MODULE_PUBLISH" | "COURSE_PUBLISHED";

// ── simple cuid-like ID generator ──────────────────────────────────────────
function makeId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

// ── one-time table bootstrap ────────────────────────────────────────────────
// Use a Promise (not a boolean) so that concurrent calls all await the SAME
// initialisation and never fire the DDL a second time within the process.
let initPromise: Promise<void> | null = null;

async function _runInit(): Promise<void> {
  try {
    // Notification table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Notification" (
        "id"        TEXT         NOT NULL,
        "userId"    TEXT         NOT NULL,
        "message"   TEXT         NOT NULL,
        "type"      TEXT         NOT NULL,
        "isRead"    BOOLEAN      NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
      )
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId")
    `;

    // Event table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Event" (
        "id"       TEXT         NOT NULL,
        "title"    TEXT         NOT NULL,
        "date"     TIMESTAMP(3) NOT NULL,
        "type"     TEXT         NOT NULL,
        "courseId" TEXT,
        CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
      )
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Event_courseId_idx" ON "Event"("courseId")
    `;

    console.log("[db-init] Notification + Event tables verified ✓");
  } catch (err) {
    // Tables probably already exist — log and continue.
    // Reset so it can retry next cold-start (but not on every warm request).
    console.warn("[db-init] ensureTablesExist warning (usually harmless):", err);
  }
}

export async function ensureTablesExist(): Promise<void> {
  if (!initPromise) initPromise = _runInit();
  return initPromise;
}


// ── public API ──────────────────────────────────────────────────────────────

/**
 * Creates a single notification for one user.
 */
export async function createNotification({
  userId,
  message,
  type,
}: {
  userId: string;
  message: string;
  type: NotifType;
}): Promise<void> {
  try {
    await ensureTablesExist();
    const id = makeId();
    await prisma.$executeRaw`
      INSERT INTO "Notification" ("id", "userId", "message", "type", "isRead", "createdAt")
      VALUES (${id}, ${userId}, ${message}, ${type}, false, NOW())
    `;
  } catch (err) {
    console.error("[createNotification] Failed:", err);
  }
}

/**
 * Creates notifications for ALL students currently enrolled in a course.
 */
export async function notifyEnrolledStudents({
  courseId,
  message,
  type,
}: {
  courseId: string;
  message: string;
  type: NotifType;
}): Promise<void> {
  try {
    await ensureTablesExist();

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      select: { userId: true },
    });

    if (enrollments.length === 0) return;

    // Insert one row per enrolled student
    for (const e of enrollments) {
      const id = makeId();
      await prisma.$executeRaw`
        INSERT INTO "Notification" ("id", "userId", "message", "type", "isRead", "createdAt")
        VALUES (${id}, ${e.userId}, ${message}, ${type}, false, NOW())
      `;
    }

    console.log(
      `[notifyEnrolledStudents] Sent "${type}" notification to ${enrollments.length} students for course ${courseId}`
    );
  } catch (err) {
    console.error("[notifyEnrolledStudents] Failed:", err);
  }
}

/**
 * Creates a calendar event. Pass courseId to scope it to a specific course.
 */
export async function createEvent({
  title,
  date,
  type,
  courseId,
}: {
  title: string;
  date: Date;
  type: EventType;
  courseId?: string;
}): Promise<void> {
  try {
    await ensureTablesExist();
    const id = makeId();
    const courseIdVal = courseId ?? null;
    await prisma.$executeRaw`
      INSERT INTO "Event" ("id", "title", "date", "type", "courseId")
      VALUES (${id}, ${title}, ${date}, ${type}, ${courseIdVal})
    `;
    console.log(`[createEvent] Created "${type}" event: "${title}" on ${date.toISOString()}`);
  } catch (err) {
    console.error("[createEvent] Failed:", err);
  }
}
