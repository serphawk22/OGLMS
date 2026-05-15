import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, Clock, Radio, CheckCircle } from "lucide-react";

interface LiveSessionEntry {
  id: string;
  title: string;
  status: string;
  scheduledAt: Date;
  course: { title: string; creator: { name: string | null } | null };
}

interface RecordedEntry {
  id: string;
  title: string;
  createdAt: Date;
  course: { title: string };
  instructor: { name: string | null };
}

interface LiveClassData {
  upcoming: LiveSessionEntry[];
  ongoing: LiveSessionEntry[];
  recorded: RecordedEntry[];
}

function SessionCard({ session, badge }: { session: LiveSessionEntry; badge: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{session.title}</p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{session.course.title}</p>
        <p className="text-xs text-slate-400 mt-0.5">By {session.course.creator?.name || "Unknown"}</p>
      </div>
      <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
        {badge}
        <span className="text-[10px] text-slate-400">
          {new Date(session.scheduledAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

export function AdminLiveMonitor({ data }: { data: LiveClassData }) {
  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Video className="w-4 h-4 text-blue-500" /> Live Class Monitoring
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Upcoming */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Upcoming ({data.upcoming.length})
            </span>
          </div>
          <div className="space-y-2">
            {data.upcoming.length === 0 ? (
              <p className="text-xs text-slate-400 px-1">No upcoming sessions</p>
            ) : data.upcoming.slice(0, 5).map((s) => (
              <SessionCard key={s.id} session={s} badge={
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">UPCOMING</span>
              } />
            ))}
          </div>
        </div>
        {/* Ongoing */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ongoing ({data.ongoing.length})
            </span>
          </div>
          <div className="space-y-2">
            {data.ongoing.length === 0 ? (
              <p className="text-xs text-slate-400 px-1">No ongoing sessions</p>
            ) : data.ongoing.slice(0, 5).map((s) => (
              <SessionCard key={s.id} session={s} badge={
                <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold animate-pulse">LIVE</span>
              } />
            ))}
          </div>
        </div>
        {/* Recorded */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Recorded ({data.recorded.length})
            </span>
          </div>
          <div className="space-y-2">
            {data.recorded.length === 0 ? (
              <p className="text-xs text-slate-400 px-1">No recordings yet</p>
            ) : data.recorded.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{r.course.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">By {r.instructor.name || "Unknown"}</p>
                </div>
                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold ml-2 flex-shrink-0">RECORDED</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
