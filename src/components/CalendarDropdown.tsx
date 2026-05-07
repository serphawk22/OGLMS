"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CalendarDays, BookOpen, ClipboardList, Layers } from "lucide-react";

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  type: string;
  course?: { title: string } | null;
};

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ASSIGNMENT_DEADLINE: {
    label: "Assignment",
    color: "border-l-amber-400 bg-amber-50",
    icon: <ClipboardList className="w-3.5 h-3.5 text-amber-500" />,
  },
  MODULE_PUBLISH: {
    label: "New Module",
    color: "border-l-purple-400 bg-purple-50",
    icon: <Layers className="w-3.5 h-3.5 text-purple-500" />,
  },
  COURSE_PUBLISHED: {
    label: "Course",
    color: "border-l-blue-400 bg-blue-50",
    icon: <BookOpen className="w-3.5 h-3.5 text-blue-500" />,
  },
};

function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Group events by date string (YYYY-MM-DD)
function groupByDate(events: CalendarEvent[]) {
  const groups: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    const key = new Date(e.date).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }
  return groups;
}

export function CalendarDropdown() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/student/events", { cache: "no-store" });
      if (res.status === 401) return; // Not a student — silently ignore
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } catch {
      // Swallow silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetchEvents();
  }, [mounted, fetchEvents]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const grouped = groupByDate(events);
  const dateKeys = Object.keys(grouped);

  // Count events in the next 7 days as a "badge"
  const upcomingSoon = events.filter((e) => {
    const diff = new Date(e.date).getTime() - Date.now();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="relative" ref={panelRef}>
      {/* Calendar icon button */}
      <button
        id="calendar-btn"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) fetchEvents();
        }}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="Calendar"
      >
        <CalendarDays className="w-5 h-5 text-slate-600" />
        {upcomingSoon > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {upcomingSoon}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-500" />
              Upcoming Events
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Next 60 days</p>
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading && (
              <div className="p-6 text-center text-sm text-slate-400">Loading...</div>
            )}
            {!loading && dateKeys.length === 0 && (
              <div className="p-8 text-center">
                <CalendarDays className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No upcoming events</p>
                <p className="text-xs text-slate-300 mt-1">Check back later!</p>
              </div>
            )}
            {dateKeys.map((dateKey) => (
              <div key={dateKey} className="px-4 py-3">
                {/* Date group header */}
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  {formatDateHeader(grouped[dateKey][0].date)}
                </p>
                <div className="space-y-2">
                  {grouped[dateKey].map((event) => {
                    const cfg = TYPE_CONFIG[event.type] ?? {
                      label: event.type,
                      color: "border-l-slate-300 bg-slate-50",
                      icon: <CalendarDays className="w-3.5 h-3.5 text-slate-400" />,
                    };
                    return (
                      <div
                        key={event.id}
                        className={`flex items-start gap-2.5 border-l-4 rounded-r-lg px-3 py-2 ${cfg.color}`}
                      >
                        <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 leading-snug truncate">
                            {event.title}
                          </p>
                          {event.course && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {event.course.title}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-medium text-slate-400">
                              {formatTime(event.date)}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/70 font-medium text-slate-600 border border-slate-200">
                              {cfg.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
