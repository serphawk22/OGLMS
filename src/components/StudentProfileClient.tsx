"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, BookOpen, Clock, Flame, GraduationCap, MapPin,
  Edit, Settings, Trophy, Hexagon, Building, Star,
  CheckCircle2, Video, FileText, Award, AlertCircle, RefreshCw,
} from "lucide-react";
import Link from "next/link";

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface Achievement {
  name: string;
  icon: string;
  color: string;
  unlocked: boolean;
}

interface ActivityItem {
  id: string;
  title: string;
  time: string;
  type: string;
}

interface CourseItem {
  id: string;
  title: string;
  progress: number;
  completed: boolean;
}

interface ProfileData {
  user: { id: string; name: string; email: string; avatarSeed: string };
  org: { id: string; name: string };
  stats: {
    enrollmentCount: number;
    completedCourses: number;
    learningHours: number;
    xp: number;
    level: number;
    rank: string;
    streak: number;
  };
  achievements: Achievement[];
  recentActivity: ActivityItem[];
  courses: CourseItem[];
}

/* ─── Skeleton ──────────────────────────────────────────────────────────────── */
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-slate-200 animate-pulse rounded-lg ${className ?? ""}`} />
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Left column */}
      <div className="md:w-1/3 space-y-6">
        <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
            <Skeleton className="w-32 h-32 rounded-full" />
            <Skeleton className="w-40 h-6" />
            <Skeleton className="w-32 h-4" />
            <Skeleton className="w-28 h-8 rounded-full" />
            <div className="w-full grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
            <Skeleton className="w-full h-10 rounded-lg" />
          </CardContent>
        </Card>
        <Card className="border border-slate-200 shadow-sm rounded-xl bg-white">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="w-32 h-5" />
            <Skeleton className="w-full h-20 rounded-lg" />
          </CardContent>
        </Card>
      </div>
      {/* Right column */}
      <div className="md:w-2/3 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}

/* ─── Rank colour helper ─────────────────────────────────────────────────────── */
function rankColor(rank: string) {
  switch (rank) {
    case "Platinum": return "text-cyan-600";
    case "Gold":     return "text-amber-600";
    case "Silver":   return "text-slate-500";
    default:         return "text-orange-700";
  }
}

/* ─── Activity icon ──────────────────────────────────────────────────────────── */
function ActivityIcon({ type }: { type: string }) {
  const cls = "w-4 h-4";
  switch (type) {
    case "quiz":       return <CheckCircle2 className={`${cls} text-emerald-600`} />;
    case "assignment": return <FileText className={`${cls} text-blue-600`} />;
    case "badge":      return <Hexagon className={`${cls} text-purple-600`} />;
    case "live":       return <Video className={`${cls} text-red-600`} />;
    case "course":     return <Award className={`${cls} text-amber-600`} />;
    case "login":      return <Flame className={`${cls} text-orange-600`} />;
    default:           return <BookOpen className={`${cls} text-blue-600`} />;
  }
}

/* ─── Streak message ─────────────────────────────────────────────────────────── */
function streakMessage(days: number) {
  if (days === 0) return "Start your streak today!";
  if (days < 3)   return "Keep going! You're building momentum.";
  if (days < 7)   return "Great habit forming! Keep it up.";
  if (days < 14)  return "You're on fire! Keep it up.";
  return `${days} days strong — Unstoppable!`;
}



/* ─── Main Client Component ──────────────────────────────────────────────────── */
export function StudentProfileClient({ initialOrgName, initialUserName }: {
  initialOrgName: string;
  initialUserName: string;
}) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProfile = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/student/profile", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load profile" }));
        throw new Error(err.error ?? "Failed to load profile");
      }
      const json: ProfileData = await res.json();
      setData(json);
      setError(null);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile(false);

    // Poll every 30 seconds
    intervalRef.current = setInterval(() => fetchProfile(true), 30_000);

    // Expose global refresh hook for quiz/assignment submit triggers
    (window as any).__refreshProfile = () => fetchProfile(true);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      delete (window as any).__refreshProfile;
    };
  }, [fetchProfile]);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex flex-col md:flex-row gap-8">
        {/* Navbar area is server-rendered above, just render the body skeleton */}
        <ProfileSkeleton />
      </div>
    );
  }

  /* ── Error state ── */
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-slate-600 font-medium">{error ?? "Something went wrong."}</p>
        <Button
          onClick={() => fetchProfile(false)}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </Button>
      </div>
    );
  }

  const { user, org, stats, achievements, recentActivity } = data;
  const unlockedAchievements = achievements.filter((a) => a.unlocked);

  return (
    <div className="space-y-8">
      {/* ── Navigation Header ── */}
      <div className="flex items-center justify-between">
        <Link href="/student">
          <Button variant="ghost" className="text-slate-500 hover:bg-slate-200 hover:text-slate-900 px-0">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-800">My Profile</h2>
          {refreshing && (
            <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
          )}
          {lastUpdated && !refreshing && (
            <span className="text-xs text-slate-400">
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">

        {/* ─── LEFT COLUMN ──────────────────────────────────────────────────── */}
        <div className="md:w-1/3 space-y-6">

          {/* Profile Card */}
          <Card className="border border-zinc-200 shadow-sm rounded-xl overflow-hidden bg-white h-full">
            <CardContent className="p-8 flex flex-col items-center text-center">

              {/* Avatar */}
              <div className="relative group cursor-pointer mb-6">
                <div className="w-32 h-32 rounded-full ring-4 ring-zinc-50 shadow-md overflow-hidden bg-zinc-100">
                  <img
                    src={`https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(user.avatarSeed)}&backgroundColor=transparent`}
                    alt="Student Avatar"
                    className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="absolute bottom-0 right-0 bg-zinc-900 text-white p-2.5 rounded-full shadow-md border-2 border-white transform transition-transform group-hover:scale-110">
                  <Edit className="w-4 h-4" />
                </div>
              </div>

              <h1 className="text-2xl font-extrabold text-zinc-800 tracking-tight">{user.name}</h1>
              <p className="text-zinc-500 text-sm mt-1 mb-4">{user.email}</p>

              <div className="status-badge status-badge--info mb-4">
                <GraduationCap className="w-3.5 h-3.5" /> Enrolled Student
              </div>

              <div className="flex items-center gap-2 text-zinc-500 text-sm mb-4 font-medium">
                <Building className="w-4 h-4" /> {org.name}
              </div>

              {/* Level / Rank */}
              <div className="w-full grid grid-cols-2 gap-3 mt-4 mb-6">
                <div className="bg-zinc-50 rounded-lg p-4 text-center border border-zinc-100">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Level</p>
                  <p className="text-xl font-black text-zinc-800">{stats.level}</p>
                </div>
                <div className="bg-zinc-50 rounded-lg p-4 text-center border border-zinc-100">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Rank</p>
                  <p className={`text-xl font-black ${rankColor(stats.rank)}`}>{stats.rank}</p>
                </div>
              </div>

              <Button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm font-bold text-xs uppercase tracking-wider">
                <Settings className="w-4 h-4 mr-2" /> Account Settings
              </Button>
            </CardContent>
          </Card>

          {/* Streak Card */}
          <Card className="border border-zinc-200 shadow-sm rounded-xl bg-white h-full overflow-hidden">
            <CardHeader className="pb-3 border-b border-zinc-50 bg-zinc-50/50">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-600">
                <Flame className="w-3.5 h-3.5 text-orange-500" /> Current Streak
              </h3>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 bg-orange-50/50 p-4 rounded-lg border border-orange-100">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                  <Flame className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-black text-zinc-800">
                    {stats.streak} Day{stats.streak !== 1 ? "s" : ""}
                  </p>
                  <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">
                    {streakMessage(stats.streak)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ─── RIGHT COLUMN ─────────────────────────────────────────────────── */}
        <div className="md:w-2/3 space-y-6">

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  label: "Courses Completed",
                  value: stats.completedCourses,
                  sub: `of ${stats.enrollmentCount} enrolled`,
                  icon: BookOpen,
                  color: "text-blue-600",
                  bg: "bg-blue-50",
                },
                {
                  label: "Hours Learned",
                  value: stats.learningHours,
                  sub: "estimated from progress",
                  icon: Clock,
                  color: "text-indigo-600",
                  bg: "bg-indigo-50",
                },
              ].map((stat, i) => (
                <div key={i} className="stat-card">
                  <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center mb-3`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <p className="stat-card__value">{stat.value}</p>
                  <p className="stat-card__label !mb-0 mt-1">{stat.label}</p>
                  <p className="stat-card__sub">{stat.sub}</p>
                </div>
              ))}
            </div>

          {/* Achievements */}
          <Card className="border border-slate-200 shadow-sm rounded-xl bg-white">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-500" /> Achievements
                  <span className="text-sm font-normal text-slate-400 ml-1">
                    ({unlockedAchievements.length}/{achievements.length})
                  </span>
                </h3>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Star className="w-3 h-3" /> Earned
                </span>
              </div>

              {achievements.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Complete courses and quizzes to earn achievements!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {achievements.map((badge, i) => (
                    <div
                      key={i}
                      className={`flex flex-col items-center p-4 rounded-xl border transition-all group cursor-pointer relative
                        ${badge.unlocked
                          ? "border-slate-200 bg-[#f8f9fa] hover:border-blue-200 hover:bg-blue-50"
                          : "border-dashed border-slate-200 bg-slate-50 opacity-50 grayscale"
                        }`}
                    >
                      <div
                        className={`w-16 h-16 rounded-full bg-gradient-to-br ${badge.color} flex items-center justify-center shadow-sm mb-3 transform transition-transform ${badge.unlocked ? "group-hover:scale-110 group-hover:rotate-6" : ""}`}
                      >
                        <span className="text-2xl">{badge.icon}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-700 text-center">{badge.name}</p>
                      {!badge.unlocked && (
                        <p className="text-[10px] text-slate-400 mt-1">Locked</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border border-slate-200 shadow-sm rounded-xl bg-white">
            <CardContent className="p-8">
              <h3 className="text-xl font-bold text-slate-800 mb-6">Recent Activity</h3>

              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No recent activity yet. Start learning!
                </div>
              ) : (
                <div className="space-y-6">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#f8f9fa] border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                        <ActivityIcon type={activity.type} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{activity.title}</p>
                        <p className="text-sm text-slate-500 mt-1">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
