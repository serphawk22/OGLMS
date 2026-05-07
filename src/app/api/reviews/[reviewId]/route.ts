import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

async function getStudentId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    return (payload.userId as string) ?? null;
  } catch {
    return null;
  }
}

/* ── PATCH /api/reviews/[reviewId] — edit own review ── */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const studentId = await getStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reviewId } = await params;

  let body: { rating?: number; comment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { rating, comment } = body;
  if (!rating && !comment?.trim()) {
    return NextResponse.json({ error: "Provide rating or comment to update" }, { status: 400 });
  }
  if (rating && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
  }

  try {
    const existing = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!existing) return NextResponse.json({ error: "Review not found" }, { status: 404 });
    if (existing.studentId !== studentId) {
      return NextResponse.json({ error: "Forbidden — not your review" }, { status: 403 });
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(rating !== undefined && { rating }),
        ...(comment?.trim() && { comment: comment.trim() }),
      },
      include: { student: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ review: updated });
  } catch (err) {
    console.error("[PATCH /api/reviews/:id]", err);
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
  }
}

/* ── DELETE /api/reviews/[reviewId] — delete own review ── */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const studentId = await getStudentId();
  if (!studentId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reviewId } = await params;

  try {
    const existing = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!existing) return NextResponse.json({ error: "Review not found" }, { status: 404 });
    if (existing.studentId !== studentId) {
      return NextResponse.json({ error: "Forbidden — not your review" }, { status: 403 });
    }

    await prisma.review.delete({ where: { id: reviewId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/reviews/:id]", err);
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
