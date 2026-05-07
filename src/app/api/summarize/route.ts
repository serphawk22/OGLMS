import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    // Graceful error handling if key is missing
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key is missing or not configured." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json(
        { error: "Text input is required in the request body." },
        { status: 400 }
      );
    }

    // Call GPT-4o-mini for a fast, structured summary
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a concise educational assistant for a high-performance coding bootcamp. Summarize the provided lesson text into exactly 3 short, actionable bullet points. Do not use emojis. Keep it professional and direct.",
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const summary = completion.choices[0]?.message?.content || "Could not generate summary at this time.";

    return NextResponse.json({ summary }, { status: 200 });

  } catch (error) {
    console.error("OpenAI API Route Error:", error);
    return NextResponse.json(
      { error: "An error occurred while generating the summary." },
      { status: 500 }
    );
  }
}
