"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, Pencil, Check, Loader2 } from "lucide-react";

interface ExpertiseEditorProps {
  initialSkills: string[];
}

export function ExpertiseEditor({ initialSkills }: ExpertiseEditorProps) {
  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [editing, setEditing] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSkill = () => {
    const trimmed = newSkill.trim();
    if (!trimmed || skills.includes(trimmed) || skills.length >= 15) return;
    setSkills([...skills, trimmed]);
    setNewSkill("");
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/instructor/expertise", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expertise: skills }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      setSkills(json.expertise);
      setEditing(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSkills(initialSkills);
    setNewSkill("");
    setError(null);
    setEditing(false);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {skills.length === 0 && !editing && (
          <p className="text-sm text-slate-400 italic">No skills added yet.</p>
        )}
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-200"
          >
            {skill}
            {editing && (
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                className="text-slate-400 hover:text-red-500 transition-colors ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
      </div>

      {editing && (
        <div className="space-y-3 mt-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSkill()}
              placeholder="Add a skill…"
              maxLength={40}
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addSkill}
              disabled={!newSkill.trim() || skills.length >= 15}
              className="border-slate-200 text-slate-700"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!editing && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
          className="mt-1 text-xs text-slate-500 hover:text-blue-600 px-0"
        >
          <Pencil className="w-3 h-3 mr-1" /> Edit Skills
        </Button>
      )}
    </div>
  );
}
