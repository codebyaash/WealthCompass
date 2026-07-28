"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CirclePause,
  MessageCircleQuestion,
  TriangleAlert,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  loadSavedMentorInsights,
  type MentorLaunchRequest,
  type SavedMentorInsight,
} from "@/lib/mentor-chat";
import { mentorQuestions, type MentorQuestionId } from "@/lib/mentor-rules";

type MentorOpenCueProps = {
  cueLabel?: string;
  description?: string;
  mentorRevision: number;
  onOpenMentor: (request: MentorLaunchRequest) => void;
  questionIds: MentorQuestionId[];
  resumeLabel?: string;
  sourceLabel: string;
  stuckLabel?: string;
};

const mentorCueDismissalStorageKey = "wealthcompass:mentor-open-cue-dismissals:v1";
const mentorCueDismissalTtlMs = 12 * 60 * 60 * 1000;

function buildDismissalKey(sourceLabel: string, insightId: string) {
  return `${sourceLabel}::${insightId}`;
}

function loadDismissalMap() {
  if (typeof window === "undefined") return {};

  try {
    const rawValue = window.localStorage.getItem(mentorCueDismissalStorageKey);
    if (!rawValue) return {};

    const parsed = JSON.parse(rawValue) as Record<string, number>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveDismissalMap(nextMap: Record<string, number>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(mentorCueDismissalStorageKey, JSON.stringify(nextMap));
}

function getResumeLabel(
  insight: SavedMentorInsight,
  fallback = "Resume with AI mentor",
) {
  if (insight.status === "stuck") {
    switch (insight.questionId) {
      case "risk":
        return "Clear up risk score";
      case "allocation":
        return "Unblock allocation decision";
      case "sip":
        return "Fix funding confusion";
      case "first-investment":
        return "Choose the first move";
      case "emergency":
        return "Protect the foundation";
      case "debt":
        return "Settle debt vs investing";
      case "etf":
        return "Choose the product role";
      case "tax":
        return "Clarify tax rule";
      case "gold":
        return "Decide if gold belongs";
      case "crash":
        return "Set the crash plan";
      default:
        return "Unblock with AI mentor";
    }
  }

  switch (insight.questionId) {
    case "risk":
      return "Clarify risk score";
    case "allocation":
      return "Review allocation fit";
    case "sip":
      return "Decide funding order";
    case "first-investment":
      return "Choose the first step";
    case "emergency":
      return "Check the cash buffer";
    case "debt":
      return "Review debt tradeoff";
    case "etf":
      return "Choose product role";
    case "tax":
      return "Check tax basics";
    case "gold":
      return "Review gold role";
    case "crash":
      return "Plan for market drops";
    default:
      return fallback;
  }
}

function getOpenReason(insight: SavedMentorInsight, questionLabel: string | null) {
  if (insight.status === "stuck") {
    return "the next move still feels unclear and probably needs one calmer decision before you continue.";
  }

  switch (insight.questionId) {
    case "risk":
      return "your current risk fit still needs a clearer read before you lock in the next decision.";
    case "allocation":
      return "your portfolio mix likely still needs a cleaner role check before you add or change anything.";
    case "sip":
      return "your contribution pace still needs to connect more clearly to a real goal or funding order.";
    case "first-investment":
      return "the first move still deserves a simpler decision before you spread attention across too many options.";
    case "emergency":
      return "your cash foundation may still need a clearer boundary before investing decisions feel steady.";
    case "debt":
      return "the tradeoff between debt cleanup and investing still needs one explicit call.";
    case "etf":
      return "the product choice still needs to be tied back to the job it is supposed to do.";
    case "tax":
      return "the tax side still needs a practical rule of thumb before you move ahead.";
    case "gold":
      return "the diversifier question still needs a clearer purpose before it earns a place in the plan.";
    case "crash":
      return "your down-market response still needs a plan before volatility makes the decision for you.";
    default:
      return questionLabel
        ? `your thread around ${questionLabel.toLowerCase()} still looks worth settling before you move on.`
        : "there is still one unresolved mentor thread worth settling before you move on.";
  }
}

function compareInsights(left: SavedMentorInsight, right: SavedMentorInsight) {
  if (left.status === "stuck" && right.status !== "stuck") return -1;
  if (right.status === "stuck" && left.status !== "stuck") return 1;
  if (left.isPinned && !right.isPinned) return -1;
  if (right.isPinned && !left.isPinned) return 1;
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

export function MentorOpenCue({
  cueLabel = "Still open with AI mentor",
  description,
  mentorRevision,
  onOpenMentor,
  questionIds,
  resumeLabel,
  sourceLabel,
  stuckLabel = "Unblock this before moving on",
}: MentorOpenCueProps) {
  const [openInsights, setOpenInsights] = useState<SavedMentorInsight[]>([]);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const nextInsights = loadSavedMentorInsights()
      .filter(
        (insight) =>
          questionIds.includes(insight.questionId) &&
          !insight.completedAt &&
          insight.status !== "not-now",
      )
      .sort(compareInsights);
    setOpenInsights(nextInsights);
  }, [mentorRevision, questionIds]);

  const primaryInsight = openInsights[0] ?? null;
  const primaryQuestionLabel = useMemo(
    () =>
      primaryInsight
        ? mentorQuestions.find((question) => question.id === primaryInsight.questionId)?.label ??
          primaryInsight.title
        : null,
    [primaryInsight],
  );
  const openReason = useMemo(
    () =>
      primaryInsight
        ? getOpenReason(primaryInsight, primaryQuestionLabel)
        : null,
    [primaryInsight, primaryQuestionLabel],
  );
  const resolvedResumeLabel = useMemo(
    () =>
      primaryInsight ? getResumeLabel(primaryInsight, resumeLabel) : resumeLabel,
    [primaryInsight, resumeLabel],
  );
  const dismissalKey = primaryInsight
    ? buildDismissalKey(sourceLabel, primaryInsight.id)
    : null;

  useEffect(() => {
    if (!dismissalKey) {
      setIsDismissed(false);
      return;
    }

    const dismissalMap = loadDismissalMap();
    const dismissedAt = dismissalMap[dismissalKey];

    if (!dismissedAt) {
      setIsDismissed(false);
      return;
    }

    if (Date.now() - dismissedAt >= mentorCueDismissalTtlMs) {
      delete dismissalMap[dismissalKey];
      saveDismissalMap(dismissalMap);
      setIsDismissed(false);
      return;
    }

    setIsDismissed(true);
  }, [dismissalKey, mentorRevision]);

  if (!primaryInsight || isDismissed) return null;

  const mentorPrompt =
    primaryInsight.status === "stuck"
      ? `I still feel stuck on "${primaryInsight.title}". Last saved mentor takeaway: "${primaryInsight.content}". Help me unblock this from the ${sourceLabel.toLowerCase()} page with one practical next move.`
      : `Help me continue this open mentor thread: "${primaryInsight.title}". Last saved takeaway: "${primaryInsight.content}". What should I do next from the ${sourceLabel.toLowerCase()} page?`;
  const mentorContextLabel =
    primaryInsight.status === "stuck"
      ? `Blocked on ${primaryQuestionLabel?.toLowerCase() ?? "this topic"}`
      : `Continuing ${primaryQuestionLabel?.toLowerCase() ?? "this topic"}`;
  const mentorContextNote = openReason
    ? `I opened this from ${sourceLabel} because ${openReason}`
    : undefined;

  return (
    <Card className="wealth-panel-strong overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{cueLabel}</Badge>
          <Badge variant="outline">{openInsights.length} open</Badge>
          {primaryInsight.status === "stuck" ? (
            <Badge variant="outline">
              <TriangleAlert className="h-3 w-3" />
              Needs unblock
            </Badge>
          ) : primaryInsight.isPinned ? (
            <Badge variant="outline">
              <MessageCircleQuestion className="h-3 w-3" />
              In focus
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-2"
            onClick={() => {
              if (!dismissalKey) return;
              const dismissalMap = loadDismissalMap();
              dismissalMap[dismissalKey] = Date.now();
              saveDismissalMap(dismissalMap);
              setIsDismissed(true);
            }}
          >
            <X className="h-3.5 w-3.5" />
            Dismiss
          </Button>
        </div>
        <CardTitle className="text-base">{primaryInsight.title}</CardTitle>
        <CardDescription>
          {description ??
            (primaryQuestionLabel
              ? `You already opened a mentor thread around ${primaryQuestionLabel.toLowerCase()}.`
              : "You already have an open mentor thread worth revisiting here.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div
          className={`rounded-md border p-3 ${
            primaryInsight.status === "stuck"
              ? "border-amber-500/30 bg-amber-500/10"
              : "border-primary/20 bg-primary/5"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Mentor cue verdict</p>
            <Badge variant={primaryInsight.status === "stuck" ? "outline" : "secondary"}>
              {primaryInsight.status === "stuck" ? "Needs unblock" : "Resume context"}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground">
            {primaryInsight.status === "stuck"
              ? "This open thread is more valuable than a new question because it is already carrying a blocked decision."
              : "This thread already holds useful context, so resuming it is usually the fastest way back to a calmer next move."}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {primaryInsight.status === "stuck"
              ? "Use the mentor here to remove the next source of friction, then return to the page and act before the doubt spreads."
              : "Reusing the existing lane keeps the advice personal and avoids rebuilding the same context from scratch."}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Why this surfaced
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {primaryInsight.status === "stuck"
                ? "This thread still looks blocked, so reopening it is likely more useful than starting a fresh question."
                : "This thread already has context, so continuing it is usually faster than opening a new lane."}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Best use
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              Ask for one practical next move that fits the page you were already using.
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Best outcome
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              Re-enter the workspace with one clearer action instead of carrying the doubt forward.
            </p>
          </div>
        </div>
        <div className="rounded-md border border-border/70 bg-muted/20 p-3">
          {openReason ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Still open because
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">{openReason}</p>
            </>
          ) : null}
          <p
            className={`text-xs font-medium uppercase tracking-wide text-muted-foreground ${
              openReason ? "mt-4" : ""
            }`}
          >
            Last saved takeaway
          </p>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-foreground">
            {primaryInsight.content}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() =>
              onOpenMentor({
                contextLabel: mentorContextLabel,
                contextNote: mentorContextNote,
                prompt: mentorPrompt,
                questionId: primaryInsight.questionId,
                sourceLabel,
              })
            }
          >
            {resolvedResumeLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          {primaryInsight.status === "stuck" ? (
            <Badge variant="secondary" className="h-8 px-3">
              <CirclePause className="h-3 w-3" />
              {stuckLabel}
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
