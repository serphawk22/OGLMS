"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Mail, Lock, Building, Key, Loader2, AlertCircle, CheckCircle, Copy, Check } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"STUDENT" | "INSTRUCTOR">("STUDENT");
  const [instructorMode, setInstructorMode] = useState<"CREATE" | "JOIN">("CREATE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

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

      if (data.loginCode) {
        setGeneratedCode(data.loginCode);
      } else {
        router.push("/login");
      }
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

  const handleCopyCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch { /* ignore */ }
  };

  // ── Registration success screen ──────────────────────────────────────────
  if (generatedCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4 relative">
        <nav className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20 bg-white/60 backdrop-blur-md border-b border-gray-200">
          <Logo />
        </nav>
        <Card className="w-full max-w-md shadow-sm border-slate-200 mt-16">
          <CardContent className="pt-8 pb-8 space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Account Created!</h2>
              <p className="text-slate-500 text-sm mt-1">Save your login code — you&apos;ll need it every time you sign in.</p>
            </div>

            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Your Login Code</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl font-black tracking-widest text-slate-900 font-mono">
                  {generatedCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
                  title="Copy code"
                  suppressHydrationWarning
                >
                  {codeCopied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500">This code is unique to your account. Keep it safe.</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800 font-medium">
                ⚠️ This code will NOT be shown again. Please save it before continuing.
              </p>
            </div>

            <Button
              onClick={() => router.push("/login")}
              className="w-full bg-slate-900 text-white hover:bg-slate-800"
            >
              Continue to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Nav */}
      <nav className="border-b border-zinc-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Logo />
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
              suppressHydrationWarning
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
              suppressHydrationWarning
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
                    suppressHydrationWarning
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
                    suppressHydrationWarning
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

            {/* Info: a login code will be generated */}
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 mt-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-800">
                A unique <strong>Login Code</strong> will be generated for your account after registration.
                You&apos;ll need it every time you sign in.
              </p>
            </div>

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
