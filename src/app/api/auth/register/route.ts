import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, password, name, role, organizationName, organizationId } = await req.json();

    if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return NextResponse.json({ error: "User already exists" }, { status: 400 });

    const hashedPassword = await bcrypt.hash(password, 10);
    let newOrgId = organizationId;

    if (role === "INSTRUCTOR" && organizationName) {
      const org = await prisma.organization.create({
        data: {
          name: organizationName,
          slug: organizationName.toLowerCase().replace(/\s+/g, '-'),
        }
      });
      newOrgId = org.id;
    } else if (role === "STUDENT" && !organizationId) {
       return NextResponse.json({ error: "Students must provide an organization ID to join" }, { status: 400 });
    }

    let assignedRole = "STUDENT";
    if (role === "INSTRUCTOR") {
      assignedRole = organizationName ? "ADMIN" : "INSTRUCTOR"; 
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        memberships: {
          create: {
            organizationId: newOrgId,
            role: assignedRole as "STUDENT" | "INSTRUCTOR" | "ADMIN"
          }
        }
      }
    });

    return NextResponse.json({ message: "Registration successful" }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
