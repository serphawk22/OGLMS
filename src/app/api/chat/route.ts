import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_secret");

export const runtime = "nodejs";

// ---------- Simple in-memory rate limiter ----------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15;
const WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

// ---------- Auth helper ----------
async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    return payload.userId as string;
  } catch {
    return null;
  }
}

// ---------- PDF text extraction — zero-dependency (uses built-in zlib) ----------
// Tries pdf-parse first (if installed), falls back to manual FlateDecode extraction.
async function extractPdfText(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");

  // 1. Try pdf-parse first (works if user ran: npm install pdf-parse)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const result = await pdfParse(buffer);
    if (result?.text?.trim()) {
      return result.text.trim().slice(0, 8000);
    }
  } catch {
    // pdf-parse not installed — fall through to manual extraction
  }

  // 2. Manual extraction using Node.js built-in zlib (no external packages needed)
  try {
    const { inflateSync, inflateRawSync } = await import("zlib");
    const raw = buffer.toString("binary");
    const texts: string[] = [];

    // Find all stream...endstream blocks
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let streamMatch: RegExpExecArray | null;

    while ((streamMatch = streamRegex.exec(raw)) !== null) {
      const streamBuf = Buffer.from(streamMatch[1], "binary");
      let content = "";

      // Try zlib inflate (FlateDecode — most common in modern PDFs)
      try {
        content = inflateSync(streamBuf).toString("utf-8");
      } catch {
        try {
          content = inflateRawSync(streamBuf).toString("utf-8");
        } catch {
          // Not a compressed stream — try reading as plain text directly
          content = streamBuf.toString("utf-8");
        }
      }

      // Extract text from BT...ET text-object blocks
      const btEtRegex = /BT([\s\S]*?)ET/g;
      let btMatch: RegExpExecArray | null;

      while ((btMatch = btEtRegex.exec(content)) !== null) {
        const block = btMatch[1];

        // (text) Tj  and  (text) '  and  (text) "
        const tjRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|'|")/g;
        let tjMatch: RegExpExecArray | null;
        while ((tjMatch = tjRegex.exec(block)) !== null) {
          const t = tjMatch[1]
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "")
            .replace(/\\t/g, "\t")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
            .replace(/\\\\/g, "\\")
            .replace(/\\(\d{3})/g, (_, oct) =>
              String.fromCharCode(parseInt(oct, 8))
            );
          if (t.trim()) texts.push(t);
        }

        // [(text) num (text)] TJ
        const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
        let tjArrMatch: RegExpExecArray | null;
        while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
          const inner = tjArrMatch[1];
          const strRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
          let strMatch: RegExpExecArray | null;
          while ((strMatch = strRegex.exec(inner)) !== null) {
            const t = strMatch[1].replace(/\\\(/g, "(").replace(/\\\)/g, ")");
            if (t.trim()) texts.push(t);
          }
        }
      }
    }

    const extracted = texts.join(" ").replace(/\s+/g, " ").trim();
    if (extracted.length > 20) {
      return extracted.slice(0, 8000);
    }

    // 3. Last resort: scan raw binary for printable ASCII runs (catches some uncompressed PDFs)
    const asciiRuns = raw.match(/[\x20-\x7E]{4,}/g) ?? [];
    const plainText = asciiRuns
      .filter((s) => /[a-zA-Z]/.test(s) && !s.startsWith("/") && !s.startsWith("<<"))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return plainText.length > 20
      ? plainText.slice(0, 8000)
      : "[Could not extract text from this PDF. It may be scanned/image-based.]";
  } catch (err) {
    console.error("[extractPdfText]", err);
    return "[PDF text extraction failed.]";
  }
}

// ---------- Build course context string from DB ----------
async function buildCourseContext(courseId: string): Promise<string> {
  try {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { id: "asc" },
          include: { lessons: { orderBy: { id: "asc" } } },
        },
        assignments: { orderBy: { createdAt: "desc" } },
        readingMaterials: { orderBy: { createdAt: "desc" } },
        quizzes: { include: { questions: true } },
      },
    });

    if (!course) return "";

    const modulesSummary = course.modules
      .map(
        (mod, i) =>
          `Module ${i + 1}: ${mod.title}\n` +
          mod.lessons
            .map(
              (l, j) =>
                `  Lesson ${j + 1}: ${l.title}` +
                (l.videoUrl ? ` [Video: ${l.videoUrl}]` : "") +
                (l.driveLink ? ` [Notes: ${l.driveLink}]` : "")
            )
            .join("\n")
      )
      .join("\n\n");

    const assignmentsSummary = course.assignments
      .map((a) => `- ${a.title}${a.description ? `: ${a.description}` : ""}`)
      .join("\n");

    const readingsSummary = course.readingMaterials
      .map((r) => `- ${r.title}: ${r.link}`)
      .join("\n");

    const quizzesSummary = course.quizzes
      .map(
        (q) =>
          `Quiz: ${q.title} (${q.questions.length} questions)\n` +
          q.questions
            .map((qu) => `  Q: ${qu.text}` + (qu.type === "MCQ" && qu.options.length ? `\n    Options: ${qu.options.join(", ")}` : ""))
            .join("\n")
      )
      .join("\n\n");

    return `Course: "${course.title}"\n\n=== MODULES ===\n${modulesSummary || "None"}\n\n=== ASSIGNMENTS ===\n${assignmentsSummary || "None"}\n\n=== READING MATERIALS ===\n${readingsSummary || "None"}\n\n=== QUIZZES ===\n${quizzesSummary || "None"}`;
  } catch {
    return "";
  }
}

// Chat models are now always available (schema is synced via prisma db push)
function chatModelsAvailable(): boolean {
  return typeof prisma.chat?.findFirst === "function";
}

// ---------- API Route ----------
export async function POST(req: NextRequest) {
  // Rate limit
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before asking again." },
      { status: 429 }
    );
  }

  // Auth
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    courseId,
    chatId: existingChatId,
    message,
    fileBase64,
    fileType,
  } = body as {
    courseId: string;
    chatId?: string;
    message: string;
    fileBase64?: string;
    fileType?: string;
  };

  if (!courseId || !message?.trim()) {
    return NextResponse.json({ error: "courseId and message are required." }, { status: 400 });
  }

  const dbAvailable = chatModelsAvailable();

  // ---- Get or create Chat session ----
  let chatId = existingChatId ?? null;
  if (dbAvailable && !chatId) {
    try {
      const newChat = await prisma.chat.create({
        data: { userId, courseId },
      });
      chatId = newChat.id;
    } catch {
      chatId = null; // stateless fallback
    }
  }

  // ---- Fetch previous messages for conversation context ----
  let prevMessages: { role: string; content: string }[] = [];
  if (dbAvailable && chatId) {
    try {
      prevMessages = await prisma.chatMessage.findMany({
        where: { chatId },
        orderBy: { createdAt: "asc" },
        take: 20,
      });
    } catch {
      prevMessages = [];
    }
  }

  // ---- Course context ----
  const courseContext = await buildCourseContext(courseId);

  // ---- Handle file (in-memory, nothing saved to disk or DB) ----
  let extractedFileText = "";
  let isImageFile = false;

  if (fileBase64 && fileType) {
    if (fileType === "application/pdf") {
      extractedFileText = await extractPdfText(fileBase64);
    } else if (fileType.startsWith("text/")) {
      extractedFileText = Buffer.from(fileBase64, "base64").toString("utf-8").slice(0, 6000);
    } else if (fileType.startsWith("image/")) {
      isImageFile = true;
    }
  }

  // ---- Save user message to DB (text only, no file) ----
  if (dbAvailable && chatId) {
    try {
      await prisma.chatMessage.create({
        data: { chatId, role: "user", content: message },
      });
    } catch { /* non-critical */ }
  }

  // ---- Build system prompt ----
  const systemPrompt = courseContext
    ? `You are an expert AI teaching assistant for the following course. Answer questions helpfully, concisely (2-5 sentences), and accurately based on the course content below. If the user uploads an image or file, analyze it and relate it to the course material when relevant.

${courseContext}`
    : `You are a helpful AI teaching assistant. Answer the student's questions clearly and concisely.`;

  type OpenAIMessage = {
    role: "system" | "user" | "assistant";
    content: string | { type: string; text?: string; image_url?: { url: string } }[];
  };

  const conversationHistory: OpenAIMessage[] = prevMessages.slice(-10).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Build the final user message (potentially multi-modal for images)
  let finalUserMessage: OpenAIMessage;
  if (isImageFile && fileBase64 && fileType) {
    finalUserMessage = {
      role: "user",
      content: [
        { type: "text", text: message },
        { type: "image_url", image_url: { url: `data:${fileType};base64,${fileBase64}` } },
      ],
    };
  } else if (extractedFileText) {
    finalUserMessage = {
      role: "user",
      content: `${message}\n\n[Attached file content]:\n${extractedFileText}`,
    };
  } else {
    finalUserMessage = { role: "user", content: message };
  }

  // ---- Call OpenAI ----
  try {
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      finalUserMessage,
    ];

    const completion = await openai.chat.completions.create({
      model: isImageFile ? "gpt-4o" : "gpt-4o-mini",
      messages,
      max_tokens: 600,
      temperature: 0.5,
    });

    const reply =
      completion.choices[0]?.message?.content ??
      "Sorry, I couldn't generate a response. Please try again.";

    // ---- Save assistant reply to DB ----
    if (dbAvailable && chatId) {
      try {
        await prisma.chatMessage.create({
          data: { chatId, role: "assistant", content: reply },
        });
        // Touch updatedAt so sidebar sorts correctly
        await prisma.chat.update({
          where: { id: chatId },
          data: { updatedAt: new Date() },
        });
      } catch { /* non-critical */ }
    }

    return NextResponse.json({ reply, chatId });
  } catch (err: unknown) {
    console.error("[POST /api/chat] OpenAI error:", err);
    return NextResponse.json(
      { error: "Failed to get AI response. Please check your OpenAI API key and try again." },
      { status: 500 }
    );
  }
}
