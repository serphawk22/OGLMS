"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  HelpCircle,
  Loader2,
  Send,
  Trophy,
  BookOpen,
  ChevronRight,
  AlertCircle,
  FileText,
} from "lucide-react";

interface Question {
  id: string;
  text: string;
  options: string[];
  correctOption: number | null;
  points: number;
  type: string; // "MCQ" | "ESSAY"
}

interface Quiz {
  id: string;
  title: string;
  retryEnabled: boolean;
  questions: Question[];
}

interface ExistingSubmission {
  obtainedMarks: number;
  totalMarks: number;
  answers: Record<string, number | string>;
  submittedAt: string;
}

interface QuizTakerProps {
  quiz: Quiz;
  existingSubmission: ExistingSubmission | null;
}

type QuizState = "idle" | "taking" | "submitted";

export function QuizTaker({ quiz, existingSubmission }: QuizTakerProps) {
  const [state, setState] = useState<QuizState>(
    existingSubmission ? "submitted" : "idle"
  );
  // answers: MCQ → number (option index), ESSAY → string
  const [answers, setAnswers] = useState<Record<string, number | string>>(
    existingSubmission?.answers ?? {}
  );
  const [result, setResult] = useState<ExistingSubmission | null>(
    existingSubmission
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mcqQuestions = quiz.questions.filter((q) => q.type === "MCQ" && q.correctOption !== null);
  const essayQuestions = quiz.questions.filter((q) => q.type === "ESSAY");
  const totalMcqPoints = mcqQuestions.reduce((sum, q) => sum + q.points, 0);

  const handleMcqAnswer = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleEssayAnswer = (questionId: string, text: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.id, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed.");
      setResult({
        obtainedMarks: data.obtainedMarks,
        totalMarks: data.totalMarks,
        answers,
        submittedAt: data.submission.submittedAt,
      });
      setState("submitted");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  // ─── RESULT / SCORE CARD ──────────────────────────────────────────────────
  if (state === "submitted" && result) {
    const pct =
      result.totalMarks > 0
        ? Math.round((result.obtainedMarks / result.totalMarks) * 100)
        : 0;
    const passed = pct >= 60;
    const color = pct >= 80 ? "emerald" : pct >= 60 ? "amber" : "red";
    const colorMap = {
      emerald: {
        bg: "bg-emerald-50",
        border: "border-emerald-300",
        text: "text-emerald-700",
        badge: "bg-emerald-100 text-emerald-800",
        bar: "bg-emerald-500",
      },
      amber: {
        bg: "bg-amber-50",
        border: "border-amber-300",
        text: "text-amber-700",
        badge: "bg-amber-100 text-amber-800",
        bar: "bg-amber-500",
      },
      red: {
        bg: "bg-red-50",
        border: "border-red-300",
        text: "text-red-700",
        badge: "bg-red-100 text-red-800",
        bar: "bg-red-500",
      },
    };
    const c = colorMap[color];

    return (
      <div className={`rounded-2xl border-2 ${c.border} ${c.bg} overflow-hidden`}>
        {/* Score Header */}
        <div className={`p-6 border-b ${c.border} flex items-center justify-between flex-wrap gap-4`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${c.badge}`}>
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Quiz Result
              </p>
              <h4 className="text-xl font-black text-slate-900">{quiz.title}</h4>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-4xl font-black ${c.text}`}>
              {result.obtainedMarks}
              <span className="text-xl font-medium text-slate-400">
                /{result.totalMarks}
              </span>
            </p>
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${c.badge}`}>
              {pct}% · {passed ? "Passed ✓" : "Not Passed"}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-slate-200">
          <div
            className={`h-2 transition-all duration-700 ${c.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Per-question breakdown — MCQ only */}
        {mcqQuestions.length > 0 && (
          <div className="p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
              MCQ Breakdown
            </p>
            {mcqQuestions.map((q, i) => {
              const studentAns = result.answers[q.id];
              const isCorrect =
                typeof studentAns === "number" &&
                studentAns === q.correctOption;
              const wasAnswered = studentAns !== undefined && studentAns !== "";

              return (
                <div
                  key={q.id}
                  className={`flex items-start gap-3 rounded-xl p-3 ${
                    isCorrect
                      ? "bg-emerald-50 border border-emerald-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  {isCorrect ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      Q{i + 1}. {q.text}
                    </p>
                    <div className="mt-1 text-xs space-y-0.5">
                      {wasAnswered ? (
                        <p className={isCorrect ? "text-emerald-700" : "text-red-600"}>
                          Your answer:{" "}
                          <span className="font-bold">
                            {typeof studentAns === "number"
                              ? q.options[studentAns]
                              : String(studentAns)}
                          </span>
                        </p>
                      ) : (
                        <p className="text-slate-400 italic">Not answered</p>
                      )}
                      {!isCorrect && q.correctOption !== null && (
                        <p className="text-emerald-700">
                          Correct answer:{" "}
                          <span className="font-bold">
                            {q.options[q.correctOption]}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-500 shrink-0">
                    {isCorrect ? `+${q.points}` : "0"}/{q.points}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Essay questions in result — show student's response */}
        {essayQuestions.length > 0 && (
          <div className="px-4 pb-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
              Essay Responses (Not Auto-graded)
            </p>
            {essayQuestions.map((q, i) => {
              const studentAns = result.answers[q.id];
              return (
                <div
                  key={q.id}
                  className="rounded-xl p-3 bg-blue-50 border border-blue-200"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">
                        Q{mcqQuestions.length + i + 1}. {q.text}
                      </p>
                      <p className="mt-1 text-xs text-slate-600 bg-white rounded-lg p-2 border border-blue-100">
                        {studentAns
                          ? String(studentAns)
                          : <span className="italic text-slate-400">No answer provided</span>}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-4 pb-4 pt-0">
          <p className="text-[11px] text-slate-400">
            Submitted on{" "}
            {new Date(result.submittedAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          {quiz.retryEnabled && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => {
                setAnswers({});
                setResult(null);
                setState("taking");
              }}
            >
              Retry Quiz
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ─── QUIZ TAKING STATE ────────────────────────────────────────────────────
  if (state === "taking") {
    const answeredMcq = mcqQuestions.filter(
      (q) => answers[q.id] !== undefined
    ).length;
    const allMcqAnswered = answeredMcq === mcqQuestions.length;

    return (
      <div className="space-y-5">
        {/* Progress */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium">
            {answeredMcq}/{mcqQuestions.length} MCQ answered
          </span>
          <span className="font-medium">
            {quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""} total
          </span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full">
          <div
            className="h-1.5 bg-emerald-500 rounded-full transition-all duration-300"
            style={{
              width: mcqQuestions.length > 0
                ? `${(answeredMcq / mcqQuestions.length) * 100}%`
                : "0%",
            }}
          />
        </div>

        {/* Questions */}
        {quiz.questions.map((q, i) => (
          <div
            key={q.id}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-black text-emerald-700 shrink-0">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 leading-snug">
                  {q.text}
                </p>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  {q.type === "MCQ" ? `MCQ · ${q.points} pt${q.points !== 1 ? "s" : ""}` : "Essay · Not graded"}
                </span>
              </div>
            </div>

            {/* MCQ options */}
            {q.type === "MCQ" && q.options.length > 0 && (
              <div className="space-y-2 ml-10">
                {q.options.map((option, optIdx) => {
                  const selected = answers[q.id] === optIdx;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleMcqAnswer(q.id, optIdx)}
                      className={`w-full text-left rounded-lg px-4 py-2.5 text-sm border transition-all duration-150 font-medium ${
                        selected
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50"
                      }`}
                    >
                      <span className={`mr-2 font-bold ${selected ? "text-white/80" : "text-slate-400"}`}>
                        {String.fromCharCode(65 + optIdx)}.
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Essay textarea */}
            {q.type === "ESSAY" && (
              <div className="ml-10">
                <textarea
                  value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                  onChange={(e) => handleEssayAnswer(q.id, e.target.value)}
                  rows={4}
                  placeholder="Write your answer here..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-slate-700"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Essay responses are saved but not auto-graded.
                </p>
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm font-medium bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!allMcqAnswered && mcqQuestions.length > 0 && (
          <p className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Answer all {mcqQuestions.length} MCQ question{mcqQuestions.length !== 1 ? "s" : ""} before submitting.
          </p>
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleSubmit}
            disabled={loading || (!allMcqAnswered && mcqQuestions.length > 0)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-1 sm:flex-none"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {loading ? "Submitting…" : "Submit Quiz"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setState("idle")}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ─── IDLE STATE ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-emerald-700" />
        </div>
        <div>
          <p className="font-bold text-slate-800">{quiz.title}</p>
          <p className="text-xs text-slate-500">
            {quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""}
            {mcqQuestions.length > 0 && ` · ${totalMcqPoints} total pts (MCQ)`}
            {essayQuestions.length > 0 && ` · ${essayQuestions.length} essay`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
        <span>
          Read all questions carefully. MCQs are auto-graded; essays are saved for instructor review.
        </span>
      </div>

      <Button
        onClick={() => setState("taking")}
        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold w-full sm:w-auto"
      >
        Start Quiz <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}
