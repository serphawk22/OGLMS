import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, BookPlus, UserPlus, BarChart3, BookOpen, GraduationCap, Zap } from "lucide-react";
import Link from "next/link";

interface ActivityEntry {
  id: string;
  message: string;
  type: string;
  createdAt: Date;
}

const TYPE_STYLES: Record<string, { bg: string; text: string; Icon: React.ElementType }> = {
  COURSE:     { bg: "bg-violet-100", text: "text-violet-600", Icon: BookOpen      },
  ASSIGNMENT: { bg: "bg-amber-100",  text: "text-amber-600",  Icon: BookPlus      },
  MODULE:     { bg: "bg-blue-100",   text: "text-blue-600",   Icon: Zap           },
  QUIZ:       { bg: "bg-pink-100",   text: "text-pink-600",   Icon: BarChart3     },
  LIVE:       { bg: "bg-red-100",    text: "text-red-600",    Icon: Activity      },
};

function timeAgo(date: Date) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AdminActivityFeed({ activities }: { activities: ActivityEntry[] }) {
  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Activity className="w-4 h-4 text-violet-500" /> Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-72 overflow-y-auto">
        {activities.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No recent activity</p>
        ) : activities.map((a) => {
          const style = TYPE_STYLES[a.type] ?? { bg: "bg-slate-100", text: "text-slate-600", Icon: Activity };
          const { bg, text, Icon } = style;
          return (
            <div key={a.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
              <div className={`p-1.5 rounded-lg ${bg} flex-shrink-0 mt-0.5`}>
                <Icon className={`w-3 h-3 ${text}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700 leading-snug">{a.message}</p>
                <p className="text-xs text-slate-400 mt-0.5">{timeAgo(a.createdAt)}</p>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${bg} ${text}`}>
                {a.type}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function AdminQuickActions({ orgId }: { orgId: string }) {
  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Zap className="w-4 h-4 text-amber-500" /> Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Link href="/instructor#directory">
          <Button variant="outline" className="w-full justify-start gap-2 border-slate-200 hover:bg-violet-50 hover:border-violet-200 text-slate-700">
            <UserPlus className="w-4 h-4 text-violet-500" /> Add Instructor
          </Button>
        </Link>
        <Link href="/instructor#courses">
          <Button variant="outline" className="w-full justify-start gap-2 border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 text-slate-700">
            <BookPlus className="w-4 h-4 text-emerald-500" /> Create Course
          </Button>
        </Link>
        <Link href="/instructor#admin-analytics">
          <Button variant="outline" className="w-full justify-start gap-2 border-slate-200 hover:bg-blue-50 hover:border-blue-200 text-slate-700">
            <BarChart3 className="w-4 h-4 text-blue-500" /> View Reports
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
