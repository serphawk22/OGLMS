import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateUniqueLoginCode } from "@/lib/loginCode";

// Force Node.js runtime — bcryptjs + Prisma pg adapter need native Node modules
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, password, name, role, organizationName, organizationId } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let newOrgId = organizationId;

    if (role === "INSTRUCTOR" && organizationName) {
      let baseSlug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
      if (!baseSlug) baseSlug = "org";
      let slug = baseSlug;
      let counter = 1;

      while (await prisma.organization.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const org = await prisma.organization.create({
        data: { name: organizationName, slug },
      });
      newOrgId = org.id;
    } else if (role === "STUDENT" && !organizationId) {
      return NextResponse.json(
        { error: "Students must provide an organization ID to join" },
        { status: 400 }
      );
    }

    let assignedRole = "STUDENT";
    if (role === "INSTRUCTOR") {
      assignedRole = organizationName ? "ADMIN" : "INSTRUCTOR";
    }

    // ── Generate a unique login code for this user ────────────────────────
    const loginCode = await generateUniqueLoginCode(assignedRole, prisma);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        loginCode,
        memberships: {
          create: {
            organizationId: newOrgId,
            role: assignedRole as "STUDENT" | "INSTRUCTOR" | "ADMIN",
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "Registration successful",
        loginCode: newUser.loginCode, // returned so the UI can display it to the user
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/auth/register] Error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
