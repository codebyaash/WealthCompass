import { NextResponse } from "next/server";
import {
  buildMentorFallbackReply,
  buildMentorSystemPrompt,
  type MentorChatContext,
  type MentorChatMessage,
} from "@/lib/mentor-chat";

type MentorChatRequest = {
  context: MentorChatContext;
  messages: MentorChatMessage[];
};

export async function POST(request: Request) {
  let payload: MentorChatRequest;

  try {
    payload = (await request.json()) as MentorChatRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid mentor chat request body." },
      { status: 400 },
    );
  }

  const latestUserMessage = [...(payload.messages ?? [])]
    .reverse()
    .find((message) => message.role === "user" && message.content.trim().length > 0);

  if (!payload.context || !latestUserMessage) {
    return NextResponse.json(
      { error: "Mentor chat needs context and at least one user message." },
      { status: 400 },
    );
  }

  const fallback = buildMentorFallbackReply({
    context: payload.context,
    message: latestUserMessage.content,
  });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      actionLabel: fallback.actionLabel,
      actionView: fallback.actionView,
      followUps: fallback.suggestedFollowUps,
      message: fallback.reply,
      note: fallback.note,
      questionId: fallback.questionId,
      source: "fallback" as const,
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      body: JSON.stringify({
        messages: [
          {
            content: buildMentorSystemPrompt(payload.context),
            role: "system",
          },
          ...payload.messages.slice(-8).map((message) => ({
            content: message.content,
            role: message.role,
          })),
        ],
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        temperature: 0.6,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("OpenAI returned an empty mentor answer.");
    }

    return NextResponse.json({
      actionLabel: fallback.actionLabel,
      actionView: fallback.actionView,
      followUps: fallback.suggestedFollowUps,
      message: content,
      note: "Live AI mentor reply generated from your current WealthCompass context.",
      questionId: fallback.questionId,
      source: "ai" as const,
    });
  } catch {
    return NextResponse.json({
      actionLabel: fallback.actionLabel,
      actionView: fallback.actionView,
      followUps: fallback.suggestedFollowUps,
      message: fallback.reply,
      note: "Live AI was unavailable, so the built-in mentor coach stepped in.",
      questionId: fallback.questionId,
      source: "fallback" as const,
    });
  }
}
