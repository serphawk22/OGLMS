"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, BookOpen, Bell, FileText, Loader2 } from "lucide-react";

export default function StudentDashboard() {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerateSummary = async () => {
    setLoading(true);
    try {
      // Mock transcript for the daily video
      const transcript = "Today's lesson covers the deep dive into React Hooks. We will explore useState for local state management, useEffect for side effects and data fetching, and useMemo for performance optimization. It is critical to understand the dependency array to prevent infinite loops. By the end of this sprint, you must implement these hooks in your final project.";
      
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript }),
      });
      
      const data = await response.json();
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch summary:", error);
      setSummary("Error generating summary. Please check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Student Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-2 space-y-6">
            
            <Card className="border-slate-200 shadow-none">
              <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between py-4">
                <CardTitle className="flex items-center gap-2 text-lg m-0">
                  <PlayCircle className="w-5 h-5 text-blue-600"/>
                  Daily 5-Min Learning
                </CardTitle>
                <Button onClick={handleGenerateSummary} disabled={loading} variant="outline" size="sm" className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <FileText className="w-4 h-4 mr-2"/>}
                  {loading ? "Analyzing..." : "Generate Key Takeaways"}
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                <div className="aspect-video bg-slate-200 rounded-md flex items-center justify-center mb-4">
                  <span className="text-slate-500 font-medium">Video Player Placeholder</span>
                </div>
                <h3 className="font-semibold text-lg">Today's Standup: React Hooks Deep Dive</h3>
                <p className="text-sm text-slate-600 mt-1 mb-4">Watch this mandatory 5-minute bite before starting your modules.</p>
                
                {summary && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-md">
                    <h4 className="text-sm font-bold text-blue-900 mb-2 uppercase tracking-wider">AI Executive Summary</h4>
                    <div className="text-sm text-blue-800 whitespace-pre-line space-y-2">
                      {summary}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="w-5 h-5 text-slate-700"/>
                  My Courses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border border-slate-200 rounded-md">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">Full-Stack Web Development</h4>
                      <span className="text-sm font-bold text-blue-600">65%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full" style={{ width: '65%' }}></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          <div className="space-y-6">
            <Card className="border-slate-200 shadow-none">
              <CardHeader className="bg-slate-50 border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bell className="w-5 h-5 text-amber-500"/>
                  Announcements
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="border-l-2 border-amber-500 pl-3">
                  <p className="text-sm font-medium">Sprint Review Tomorrow</p>
                  <p className="text-xs text-slate-500 mt-1">Ensure all assignments are submitted by 9 AM.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
