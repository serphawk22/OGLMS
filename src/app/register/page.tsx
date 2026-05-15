"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { User, Mail, Lock, Building, Key, Loader2, AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"STUDENT" | "INSTRUCTOR">("STUDENT");
  const [instructorMode, setInstructorMode] = useState<"CREATE" | "JOIN">("CREATE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: role,
      organizationName: role === "INSTRUCTOR" && instructorMode === "CREATE" ? formData.get("organizationName") : undefined,
      organizationId: role === "STUDENT" || (role === "INSTRUCTOR" && instructorMode === "JOIN") ? formData.get("organizationId") : undefined,
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      router.push("/login");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Nav */}
      <nav className="border-b border-zinc-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
            >
              Register
            </Link>
          </div>
        </div>
      </nav>

      {/* Form */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Create an account
            </h1>
            <p className="text-sm text-zinc-500 mt-1.5">
              Join the learning platform
            </p>
          </div>

          {/* Role toggle */}
          <div className="flex gap-1 p-1 bg-zinc-100 rounded-lg mb-6" role="radiogroup" aria-label="Account type">
            <button
              type="button"
              role="radio"
              aria-checked={role === "STUDENT"}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                role === "STUDENT"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
              onClick={() => setRole("STUDENT")}
            >
              Student
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={role === "INSTRUCTOR"}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                role === "INSTRUCTOR"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
              onClick={() => setRole("INSTRUCTOR")}
            >
              Instructor
            </button>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div
                className="flex items-start gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="reg-name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  id="reg-name"
                  name="name"
                  required
                  className="pl-9 h-10 bg-white"
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  id="reg-email"
                  name="email"
                  type="email"
                  required
                  className="pl-9 h-10 bg-white"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  id="reg-password"
                  name="password"
                  type="password"
                  required
                  className="pl-9 h-10 bg-white"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Instructor: Create or Join */}
            {role === "INSTRUCTOR" ? (
              <div className="space-y-3">
                <div className="flex gap-1 p-1 bg-zinc-100 rounded-md">
                  <button
                    type="button"
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                      instructorMode === "CREATE"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500"
                    }`}
                    onClick={() => setInstructorMode("CREATE")}
                  >
                    Create Workspace
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                      instructorMode === "JOIN"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500"
                    }`}
                    onClick={() => setInstructorMode("JOIN")}
                  >
                    Join Existing
                  </button>
                </div>

                {instructorMode === "CREATE" ? (
                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-1.5">
                    <Label htmlFor="reg-org-name" className="text-zinc-700">
                      Organization Name
                    </Label>
                    <p className="text-xs text-zinc-500">
                      You will be the admin of this new workspace.
                    </p>
                    <div className="relative mt-1">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                      <Input
                        id="reg-org-name"
                        name="organizationName"
                        required
                        className="pl-9 h-10 bg-white"
                        placeholder="e.g. Masai School"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-1.5">
                    <Label htmlFor="reg-org-join" className="text-zinc-700">
                      Workspace Invite Code
                    </Label>
                    <p className="text-xs text-zinc-500">
                      Enter the ID provided by your admin.
                    </p>
                    <div className="relative mt-1">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                      <Input
                        id="reg-org-join"
                        name="organizationId"
                        required
                        className="pl-9 h-10 bg-white font-mono"
                        placeholder="e.g. cm2x..."
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-1.5">
                <Label htmlFor="reg-org-student" className="text-zinc-700">
                  Organization Invite Code
                </Label>
                <p className="text-xs text-zinc-500">
                  Ask your instructor for the workspace ID.
                </p>
                <div className="relative mt-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="reg-org-student"
                    name="organizationId"
                    required
                    className="pl-9 h-10 bg-white font-mono"
                    placeholder="e.g. cm2x..."
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10 bg-zinc-900 text-white hover:bg-zinc-800 mt-2"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Processing..." : "Register"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-zinc-900 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
