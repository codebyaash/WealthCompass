"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookmarkPlus,
  CirclePause,
  CheckCheck,
  CheckCircle2,
  Pin,
  MessageCircleQuestion,
  Sparkles,
  TriangleAlert,
  Trash2,
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
import { MetricMini } from "@/components/wealth/metric-mini";
import type { ActiveView } from "@/components/wealth/app-sidebar";
import type { WealthGoal } from "@/lib/local-storage";
import {
  buildMentorComposerGuidance,
  buildMentorComposerMode,
  buildMentorRecommendedActions,
  buildMentorResumePrompts,
  buildMentorConversationSnapshot,
  buildMentorFollowUpPrompts,
  buildMentorReplyGuide,
  buildMentorFallbackReply,
  clearMentorConversation,
  completeMentorInsight,
  getMentorActionTarget,
  getMentorLaunchFollowThrough,
  getMentorInsightBucket,
  getMentorInsightRecovery,
  getMentorInsightWhyNow,
  loadMentorConversation,
  loadSavedMentorInsights,
  pinMentorInsight,
  removeMentorInsight,
  saveMentorInsight,
  saveMentorConversation,
  updateMentorInsightStatus,
  type SavedMentorInsight,
  type MentorActionView,
  type MentorChatContext,
  type MentorLaunchContext,
  type StoredMentorThread,
  type StoredMentorChatMessage,
} from "@/lib/mentor-chat";
import { formatMoney } from "@/lib/formatters";
import {
  getMentorAnswer,
  getSuggestedMentorQuestions,
  mentorQuestions,
  type MentorQuestionId,
} from "@/lib/mentor-rules";
import type { PortfolioAsset } from "@/lib/local-storage";
import type { RiskAnswers, RiskProfile } from "@/lib/wealth-rules";

export function MentorPanel({
  answers,
  assets,
  goals,
  launchContext,
  onNavigate,
  onMentorStateChange,
  profile,
}: {
  answers: RiskAnswers;
  assets: PortfolioAsset[];
  goals: WealthGoal[];
  launchContext?: MentorLaunchContext | null;
  onNavigate: (
    view: ActiveView,
    focusTarget?: string,
    returnState?: Record<string, unknown>,
  ) => void;
  onMentorStateChange?: () => void;
  profile: RiskProfile;
}) {
  const defaultChatStatus =
    "Ask anything about your plan, risk, allocation, SIP discipline, or goal funding.";
  const [activeQuestionId, setActiveQuestionId] = useState<MentorQuestionId>(
    mentorQuestions[0].id,
  );
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<StoredMentorChatMessage[]>([]);
  const [chatStatus, setChatStatus] = useState(defaultChatStatus);
  const [conversationThreads, setConversationThreads] = useState<
    Partial<Record<MentorQuestionId, StoredMentorThread>>
  >({});
  const [savedInsights, setSavedInsights] = useState<SavedMentorInsight[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [editingTopicNoteId, setEditingTopicNoteId] = useState<MentorQuestionId | null>(null);
  const [topicNoteDraft, setTopicNoteDraft] = useState("");
  const [activeLaunchContextLabel, setActiveLaunchContextLabel] = useState<string | null>(null);
  const [activeLaunchContextNote, setActiveLaunchContextNote] = useState<string | null>(null);
  const [activeLaunchReturnState, setActiveLaunchReturnState] = useState<Record<string, unknown> | null>(null);
  const [activeLaunchSourceLabel, setActiveLaunchSourceLabel] = useState<string | null>(null);
  const chatMessageIdRef = useRef(0);
  const appliedLaunchNonceRef = useRef<number | null>(null);
  const activeThreadLaunchSource =
    conversationThreads[activeQuestionId]?.launchSourceLabel?.trim() || null;
  const activeThreadLaunchContextLabel =
    conversationThreads[activeQuestionId]?.launchContextLabel?.trim() || null;
  const activeThreadLaunchContextNote =
    conversationThreads[activeQuestionId]?.launchContextNote?.trim() || null;
  const activeThreadLaunchReturnState =
    conversationThreads[activeQuestionId]?.launchReturnState ?? null;
  const activeThreadNote = conversationThreads[activeQuestionId]?.note?.trim() || null;
  const activeQuestion =
    mentorQuestions.find((question) => question.id === activeQuestionId) ??
    mentorQuestions[0];
  const answer = getMentorAnswer({
    answers,
    assets,
    formatMoney,
    profile,
    questionId: activeQuestion.id,
  });
  const suggestedQuestions = getSuggestedMentorQuestions({
    answers,
    assets,
  });
  const topSuggestedQuestion =
    mentorQuestions.find((question) => question.id === suggestedQuestions[0]) ??
    mentorQuestions[0];
  const hasOpenInsightForActiveTopic = savedInsights.some(
    (insight) =>
      insight.questionId === activeQuestionId &&
      !insight.completedAt &&
      insight.status !== "not-now",
  );
  const mentorConversationMode: MentorChatContext["conversationMode"] =
    hasOpenInsightForActiveTopic
      ? "resume-mode"
      : chatMessages.length > 0
        ? "live-thread"
        : activeLaunchSourceLabel
          ? "guided-start"
          : "fresh-question";
  const mentorChatContext = useMemo<MentorChatContext>(
    () => ({
      activeQuestionId: activeQuestion.id,
      answers,
      assets,
      conversationMode: mentorConversationMode,
      goals,
      launchContextLabel: activeLaunchContextLabel ?? undefined,
      launchSourceLabel: activeLaunchSourceLabel ?? undefined,
      profile,
    }),
    [
      activeLaunchContextLabel,
      activeLaunchSourceLabel,
      activeQuestion.id,
      answers,
      assets,
      goals,
      mentorConversationMode,
      profile,
    ],
  );
  const starterPrompts = useMemo(() => {
    const followUpLabels = answer.followUps
      .map((questionId) => mentorQuestions.find((question) => question.id === questionId)?.label)
      .filter((value): value is string => Boolean(value));
    const normalizedLaunchSource = activeLaunchSourceLabel?.trim().toLowerCase() ?? "";
    const contextualPrompts = (() => {
      if (normalizedLaunchSource.includes("onboarding")) {
        return [
          "Which answer here matters most for my starting plan?",
          "Does this look like a knowledge gap or a real risk mismatch?",
          "What should I submit only after I feel clear about it?",
        ];
      }

      if (normalizedLaunchSource.includes("portfolio import review")) {
        return [
          "What in this import looks safe to trust right away?",
          "Which warning here needs a manual check before I import?",
          "What should I verify before I merge this into my portfolio?",
        ];
      }

      if (normalizedLaunchSource.includes("portfolio")) {
        return [
          "What part of this portfolio setup matters most right now?",
          "Should I improve coverage first or clean up allocation first?",
          "What is the next portfolio action that would reduce confusion fastest?",
        ];
      }

      if (normalizedLaunchSource.includes("goals")) {
        return [
          "Which goal should I fund first and why?",
          "What looks unrealistic in this plan right now?",
          "How do I know if my monthly split is too stretched?",
        ];
      }

      if (normalizedLaunchSource.includes("academy")) {
        return [
          "What confusion should I clear up before I choose between these categories?",
          "Which category better fits my current goal and experience?",
          "What product role am I mixing up here?",
        ];
      }

      if (normalizedLaunchSource.includes("dashboard")) {
        return [
          "What deserves my attention first today?",
          "Which page should I go back to after this chat?",
          "What single move would improve my plan the most right now?",
        ];
      }

      return [];
    })();

    return [
      ...contextualPrompts,
      `Help me understand ${activeQuestion.label.toLowerCase()}`,
      topSuggestedQuestion.label,
      ...followUpLabels.slice(0, 2),
    ].filter((value, index, collection) => collection.indexOf(value) === index);
  }, [activeLaunchSourceLabel, activeQuestion.label, answer.followUps, topSuggestedQuestion.label]);
  const starterPromptCaption = activeLaunchSourceLabel
    ? `Suggested follow-ups for ${activeLaunchSourceLabel}`
    : "Suggested follow-ups for the current topic";
  const mentorReadinessLabel =
    assets.length === 0
      ? "Foundation coaching"
      : answer.focusLabel === "Concentration risk"
        ? "Portfolio coaching"
        : "Decision coaching";
  const currentActionTarget = getMentorActionTarget(activeQuestion.id);
  const recommendedActions = useMemo(
    () =>
      buildMentorRecommendedActions({
        answers,
        assets,
        contextLabel: activeLaunchContextLabel ?? undefined,
        goals,
        profile,
        questionId: activeQuestionId,
        sourceLabel: activeLaunchSourceLabel ?? undefined,
      }),
    [
      activeLaunchContextLabel,
      activeLaunchSourceLabel,
      activeQuestionId,
      answers,
      assets,
      goals,
      profile,
    ],
  );
  const replyGuide = useMemo(
    () =>
      buildMentorReplyGuide({
        answers,
        assets,
        profile,
        questionId: activeQuestionId,
      }),
    [activeQuestionId, answers, assets, profile],
  );
  const conversationSnapshot = useMemo(
    () =>
      buildMentorConversationSnapshot({
        contextLabel: activeLaunchContextLabel ?? undefined,
        launchSourceLabel: activeLaunchSourceLabel ?? undefined,
        messages: chatMessages,
        note: activeThreadNote ?? undefined,
        questionId: activeQuestionId,
        status: chatStatus,
      }),
    [
      activeLaunchContextLabel,
      activeLaunchSourceLabel,
      activeQuestionId,
      activeThreadNote,
      chatMessages,
      chatStatus,
    ],
  );
  const composerGuidance = useMemo(
    () =>
      buildMentorComposerGuidance({
        answers,
        launchSourceLabel: activeLaunchSourceLabel ?? undefined,
        questionId: activeQuestionId,
      }),
    [activeLaunchSourceLabel, activeQuestionId, answers],
  );
  const resumePrompts = useMemo(
    () =>
      buildMentorResumePrompts({
        questionId: activeQuestionId,
        savedInsights,
      }),
    [activeQuestionId, savedInsights],
  );
  const composerMode = useMemo(
    () =>
      buildMentorComposerMode({
        hasDraftedMessages: chatMessages.length > 0,
        hasResumePrompts: resumePrompts.length > 0,
        launchSourceLabel: activeLaunchSourceLabel ?? undefined,
      }),
    [activeLaunchSourceLabel, chatMessages.length, resumePrompts.length],
  );
  const lastAssistantMessage = [...chatMessages]
    .reverse()
    .find((message) => message.role === "assistant");
  const conversationTakeaway = lastAssistantMessage?.content
    ? lastAssistantMessage.content.split("\n").find((line) => line.trim())?.trim() ??
      lastAssistantMessage.content.trim()
    : answer.summary;
  const conversationActionLabel =
    lastAssistantMessage?.actionLabel ?? currentActionTarget.label;
  const conversationActionView =
    lastAssistantMessage?.actionView ?? currentActionTarget.view;
  const conversationStatusLabel =
    chatMessages.length === 0
      ? "Waiting for your first question"
      : lastAssistantMessage?.source === "ai"
        ? "Live AI guidance"
        : "Built-in coaching";
  const launchFollowThrough =
    activeLaunchSourceLabel || activeLaunchContextLabel
      ? getMentorLaunchFollowThrough({
          contextLabel: activeLaunchContextLabel ?? undefined,
          questionId: activeQuestionId,
          sourceLabel: activeLaunchSourceLabel ?? undefined,
        })
      : null;
  const conversationHeaderSummary = [
    activeLaunchContextLabel
      ? {
          label: "Current context",
          value: activeLaunchContextLabel,
        }
      : null,
    activeLaunchSourceLabel
      ? {
          label: "Started from",
          value: activeLaunchSourceLabel,
        }
      : null,
    activeThreadNote
      ? {
          label: "Saved note",
          value: activeThreadNote,
        }
      : null,
    {
      label: "Current takeaway",
      value: conversationTakeaway,
    },
  ].filter(
    (
      item,
    ): item is {
      label: string;
      value: string;
    } => Boolean(item),
  );
  const launchContextHighlights = [
    activeLaunchSourceLabel
      ? {
          label: "You came from",
          value: activeLaunchSourceLabel,
        }
      : null,
    activeLaunchContextLabel
      ? {
          label: "Decision in progress",
          value: activeLaunchContextLabel,
        }
      : null,
    activeLaunchReturnState
      ? {
          label: "Return will restore",
          value: "Your in-progress inputs and page state are being carried back with you.",
        }
      : null,
    launchFollowThrough
      ? {
          label: "Best next step after chat",
          value: launchFollowThrough.label,
        }
      : null,
  ].filter(
    (
      item,
    ): item is {
      label: string;
      value: string;
    } => Boolean(item),
  );
  const proactiveMentorPrompt = useMemo(() => {
    if (activeThreadNote) {
      return {
        caption: "Based on your saved note",
        prompt: `Use my saved note for this topic: "${activeThreadNote}". Help me turn it into one concrete next step for this week.`,
        title: "Turn your note into a next step",
      };
    }

    if (activeLaunchSourceLabel) {
      return {
        caption: `Because you arrived from ${activeLaunchSourceLabel}`,
        prompt: `I opened this from ${activeLaunchSourceLabel}. What is the most useful question I should answer next before I move on?`,
        title: "Anchor the handoff to one decision",
      };
    }

    if (profile.intentGap === "knowledge-gap" && profile.potentialBand) {
      return {
        caption: `Your potential band could move toward ${profile.potentialBand}`,
        prompt:
          "Am I holding back mainly because I still need knowledge, or because this level of risk genuinely does not fit me?",
        title: "Separate knowledge gap from true risk discomfort",
      };
    }

    if (activeQuestionId === "allocation" && assets.length > 0) {
      return {
        caption: "Your portfolio is already tracked",
        prompt:
          "Based on my current holdings, what should I review first in my allocation before adding anything new?",
        title: "Review the portfolio before adding more",
      };
    }

    if (activeQuestionId === "sip" && goals.length === 0) {
      return {
        caption: "You have investing intent but no saved goal yet",
        prompt:
          "How should I decide whether my SIP amount matches a real goal instead of just sounding disciplined?",
        title: "Tie SIP discipline to a real goal",
      };
    }

    if (answers.emergencyMonths < 3) {
      return {
        caption: "Your foundation still needs protection",
        prompt:
          "What is the simplest investing plan I can follow while I am still building my emergency fund?",
        title: "Protect the base while you keep moving",
      };
    }

    return {
      caption: "A strong next question for this topic",
      prompt: `What is the next most useful decision I should make after "${activeQuestion.title}" based on my current situation?`,
      title: "Ask for the next decision, not more theory",
    };
  }, [
    activeLaunchSourceLabel,
    activeQuestion.title,
    activeQuestionId,
    activeThreadNote,
    answers.emergencyMonths,
    assets.length,
    goals.length,
    profile.intentGap,
    profile.potentialBand,
  ]);
  const suggestedFollowUpQuestions = answer.followUps
    .map((questionId) => mentorQuestions.find((question) => question.id === questionId))
    .filter((question): question is (typeof mentorQuestions)[number] => Boolean(question));
  const suggestedFollowUpPrompts = useMemo(
    () =>
      buildMentorFollowUpPrompts({
        activeQuestionId,
        followUpQuestionIds: answer.followUps,
        launchSourceLabel: activeLaunchSourceLabel ?? undefined,
      }),
    [activeLaunchSourceLabel, activeQuestionId, answer.followUps],
  );
  const groupedSavedInsights = useMemo(
    () => ({
      "do-now": savedInsights.filter(
        (insight) => insight.bucket === "do-now" && !insight.completedAt,
      ),
      "learn-next": savedInsights.filter(
        (insight) => insight.bucket === "learn-next" && !insight.completedAt,
      ),
      "review-later": savedInsights.filter(
        (insight) => insight.bucket === "review-later" && !insight.completedAt,
      ),
    }),
    [savedInsights],
  );
  const completedInsights = useMemo(
    () => savedInsights.filter((insight) => Boolean(insight.completedAt)),
    [savedInsights],
  );
  const deferredInsights = useMemo(
    () => savedInsights.filter((insight) => insight.status === "not-now"),
    [savedInsights],
  );
  const stuckInsights = useMemo(
    () => savedInsights.filter((insight) => insight.status === "stuck"),
    [savedInsights],
  );
  const pinnedInsight =
    savedInsights.find((insight) => insight.isPinned) ??
    groupedSavedInsights["do-now"][0] ??
    null;
  const pinnedInsightWhyNow = pinnedInsight
    ? getMentorInsightWhyNow({
        answers,
        profile,
        questionId: pinnedInsight.questionId,
      })
    : null;
  const pinnedInsightRecovery = pinnedInsight
    ? getMentorInsightRecovery({
        answers,
        profile,
        questionId: pinnedInsight.questionId,
      })
    : null;
  const topicThreadSummary = useMemo(
    () =>
      mentorQuestions.map((question) => {
        const thread = conversationThreads[question.id];
        const messageCount = thread?.messages.length ?? 0;
        const lastMessage = thread?.messages.at(-1);
        const hasAssistantReply = thread?.messages.some(
          (message) => message.role === "assistant",
        );
        const lastAssistantReply = [...(thread?.messages ?? [])]
          .reverse()
          .find((message) => message.role === "assistant");
        const lastTakeaway = lastAssistantReply?.content
          ? lastAssistantReply.content.split("\n").find((line) => line.trim())?.trim() ??
            lastAssistantReply.content.trim()
          : null;
        const openInsight = savedInsights.find(
          (insight) =>
            insight.questionId === question.id &&
            !insight.completedAt &&
            insight.status !== "not-now",
        );
        const lastUpdatedLabel = thread?.updatedAt
          ? new Date(thread.updatedAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })
          : null;
        const freshnessLabel = !thread || messageCount === 0
          ? "Fresh"
          : lastMessage?.role === "user" && !hasAssistantReply
            ? "Waiting reply"
            : openInsight?.status === "stuck"
              ? "Needs unblock"
              : openInsight
                ? "Needs action"
                : "Up to date";
        const freshnessTone =
          freshnessLabel === "Needs action" || freshnessLabel === "Needs unblock"
            ? "secondary"
            : "outline";

        return {
          freshnessLabel,
          freshnessTone,
          hasAssistantReply,
          hasHistory:
            messageCount > 0 ||
            Boolean(thread?.note?.trim()) ||
            Boolean(thread?.launchContextLabel?.trim()) ||
            Boolean(thread?.launchContextNote?.trim()) ||
            Boolean(thread?.launchSourceLabel?.trim()) ||
            Boolean(thread?.status.trim()),
          id: question.id,
          isActive: question.id === activeQuestionId,
          lastTakeaway,
          launchContextLabel: thread?.launchContextLabel?.trim() || null,
          launchSourceLabel: thread?.launchSourceLabel?.trim() || null,
          lastUpdatedLabel,
          messageCount,
          note: thread?.note?.trim() ? thread.note.trim() : null,
          openInsightId: openInsight?.id,
          statusLabel:
            messageCount === 0
              ? thread?.launchSourceLabel?.trim()
                ? "Context captured"
                : "Fresh lane"
              : hasAssistantReply
                ? `${messageCount} message${messageCount === 1 ? "" : "s"} saved`
                : "Question drafted",
        };
      }),
    [activeQuestionId, conversationThreads, savedInsights],
  );

  function createChatMessageId(prefix: "assistant" | "user") {
    chatMessageIdRef.current += 1;
    return `${prefix}-${chatMessageIdRef.current}`;
  }

  const loadSavedInsightsIntoState = useCallback(() => {
    setSavedInsights(loadSavedMentorInsights());
  }, []);

  const syncSavedInsights = useCallback(() => {
    loadSavedInsightsIntoState();
    onMentorStateChange?.();
  }, [loadSavedInsightsIntoState, onMentorStateChange]);

  function persistConversationSnapshot(
    nextThreads: Partial<Record<MentorQuestionId, StoredMentorThread>>,
    nextActiveQuestionId: MentorQuestionId,
  ) {
    const meaningfulThreads = Object.fromEntries(
      Object.entries(nextThreads).filter(([, thread]) => {
        if (!thread) return false;
        return (
          thread.messages.length > 0 ||
          Boolean(thread.status.trim()) ||
          Boolean(thread.note?.trim()) ||
          Boolean(thread.launchSourceLabel?.trim())
        );
      }),
    ) as Partial<Record<MentorQuestionId, StoredMentorThread>>;

    if (Object.keys(meaningfulThreads).length === 0) {
      clearMentorConversation();
      return;
    }

    const activeThread = meaningfulThreads[nextActiveQuestionId] ?? {
      launchContextLabel: undefined,
      launchContextNote: undefined,
      launchReturnState: undefined,
      launchSourceLabel: undefined,
      messages: [],
      note: undefined,
      status: defaultChatStatus,
      updatedAt: undefined,
    };

    saveMentorConversation({
      activeQuestionId: nextActiveQuestionId,
      messages: activeThread.messages,
      status: activeThread.status,
      threads: meaningfulThreads,
    });
  }

  useEffect(() => {
    const savedConversation = loadMentorConversation();
    loadSavedInsightsIntoState();
    if (!savedConversation) return;

    const savedThreads =
      savedConversation.threads ??
      ({
        [savedConversation.activeQuestionId]: {
          launchContextLabel: undefined,
          launchContextNote: undefined,
          launchReturnState: undefined,
          launchSourceLabel: undefined,
          messages: savedConversation.messages,
          note: undefined,
          status: savedConversation.status,
          updatedAt: undefined,
        },
      } satisfies Partial<Record<MentorQuestionId, StoredMentorThread>>);

    setConversationThreads(savedThreads);
    setActiveQuestionId(savedConversation.activeQuestionId);
    setChatMessages(savedConversation.messages);
    setChatStatus(savedConversation.status || defaultChatStatus);

    const highestMessageId = savedConversation.messages.reduce((maxId, message) => {
      const parsedId = Number(message.id.split("-").pop());
      return Number.isFinite(parsedId) ? Math.max(maxId, parsedId) : maxId;
    }, 0);
    chatMessageIdRef.current = highestMessageId;
  }, [defaultChatStatus, loadSavedInsightsIntoState]);

  useEffect(() => {
    const activeThread = conversationThreads[activeQuestionId];
    setChatMessages(activeThread?.messages ?? []);
    setChatStatus(activeThread?.status || defaultChatStatus);
  }, [activeQuestionId, conversationThreads, defaultChatStatus]);

  useEffect(() => {
    setActiveLaunchSourceLabel(activeThreadLaunchSource);
    setActiveLaunchContextLabel(activeThreadLaunchContextLabel);
    setActiveLaunchContextNote(activeThreadLaunchContextNote);
    setActiveLaunchReturnState(activeThreadLaunchReturnState);
  }, [
    activeQuestionId,
    activeThreadLaunchContextLabel,
    activeThreadLaunchContextNote,
    activeThreadLaunchReturnState,
    activeThreadLaunchSource,
  ]);

  useEffect(() => {
    if (!launchContext) return;
    if (appliedLaunchNonceRef.current === launchContext.nonce) return;
    appliedLaunchNonceRef.current = launchContext.nonce;

    const nextThreads = {
      ...conversationThreads,
      [launchContext.questionId]: {
        launchContextLabel:
          launchContext.contextLabel?.trim() ||
          conversationThreads[launchContext.questionId]?.launchContextLabel,
        launchContextNote:
          launchContext.contextNote?.trim() ||
          conversationThreads[launchContext.questionId]?.launchContextNote,
        launchReturnState:
          launchContext.returnState ??
          conversationThreads[launchContext.questionId]?.launchReturnState,
        launchSourceLabel:
          launchContext.sourceLabel?.trim() ||
          conversationThreads[launchContext.questionId]?.launchSourceLabel,
        messages: conversationThreads[launchContext.questionId]?.messages ?? [],
        note: conversationThreads[launchContext.questionId]?.note,
        status:
          conversationThreads[launchContext.questionId]?.status ?? defaultChatStatus,
        updatedAt: conversationThreads[launchContext.questionId]?.updatedAt,
      },
    };
    setConversationThreads(nextThreads);
    persistConversationSnapshot(nextThreads, launchContext.questionId);
    setActiveQuestionId(launchContext.questionId);
    setChatDraft(launchContext.prompt);
    setEditingTopicNoteId(null);
    setTopicNoteDraft("");
    setActiveLaunchContextLabel(launchContext.contextLabel?.trim() ?? null);
    setActiveLaunchContextNote(launchContext.contextNote?.trim() ?? null);
    setActiveLaunchReturnState(launchContext.returnState ?? null);
    setActiveLaunchSourceLabel(launchContext.sourceLabel ?? null);
  }, [conversationThreads, defaultChatStatus, launchContext]);

  function handleSaveInsight(message: StoredMentorChatMessage) {
    const insightTitle = mentorQuestions.find((question) => question.id === activeQuestionId)?.title;

    saveMentorInsight({
      actionLabel: message.actionLabel,
      actionView: message.actionView,
      bucket: getMentorInsightBucket(activeQuestionId),
      content: message.content,
      createdAt: new Date().toISOString(),
      id: message.id,
      questionId: activeQuestionId,
      title: insightTitle ?? activeQuestion.title,
    });
    syncSavedInsights();
  }

  const insightBucketMeta: Array<{
    description: string;
    key: keyof typeof groupedSavedInsights;
    title: string;
  }> = [
    {
      description: "Clear next actions you can apply inside your plan right away.",
      key: "do-now",
      title: "Do now",
    },
    {
      description: "Concepts worth understanding before your next move.",
      key: "learn-next",
      title: "Learn next",
    },
    {
      description: "Ideas to revisit when markets, risk, or confidence shift.",
      key: "review-later",
      title: "Review later",
    },
  ];

  function handleRemoveInsight(insightId: string) {
    removeMentorInsight(insightId);
    syncSavedInsights();
  }

  function handlePinInsight(insightId: string) {
    pinMentorInsight(insightId);
    syncSavedInsights();
  }

  function handleUpdateInsightStatus(
    insightId: string,
    status: "active" | "done" | "not-now" | "stuck",
  ) {
    updateMentorInsightStatus(insightId, status);
    syncSavedInsights();
  }

  function handleResolveTopicLane(questionId: MentorQuestionId) {
    const matchingInsights = savedInsights.filter(
      (insight) =>
        insight.questionId === questionId &&
        !insight.completedAt &&
        insight.status !== "not-now",
    );

    if (matchingInsights.length === 0) return;

    matchingInsights.forEach((insight) => {
      updateMentorInsightStatus(insight.id, "not-now");
    });
    syncSavedInsights();
  }

  function handleCompleteInsight(insightId: string) {
    completeMentorInsight(insightId);
    syncSavedInsights();
  }

  async function handleRecoverInsight(insight: SavedMentorInsight) {
    const recovery = getMentorInsightRecovery({
      answers,
      profile,
      questionId: insight.questionId,
    });

    setActiveQuestionId(insight.questionId);
    handleUpdateInsightStatus(insight.id, "active");

    await handleSendChatMessage(
      `I am feeling stuck about "${insight.title}". ${recovery.detail} Help me turn this into one practical next step for my current situation.`,
    );
  }

  function handleResumeTopicTakeaway(questionId: MentorQuestionId, takeaway: string) {
    setActiveQuestionId(questionId);
    setActiveLaunchContextLabel(
      conversationThreads[questionId]?.launchContextLabel?.trim() ?? null,
    );
    setActiveLaunchContextNote(
      conversationThreads[questionId]?.launchContextNote?.trim() ?? null,
    );
    setActiveLaunchReturnState(
      conversationThreads[questionId]?.launchReturnState ?? null,
    );
    setActiveLaunchSourceLabel(conversationThreads[questionId]?.launchSourceLabel ?? null);
    setChatDraft(
      `Help me continue from the last takeaway: "${takeaway}". What should I do next from here?`,
    );
  }

  function handleStartTopicNoteEdit(questionId: MentorQuestionId) {
    setEditingTopicNoteId(questionId);
    setTopicNoteDraft(conversationThreads[questionId]?.note ?? "");
  }

  function handleCancelTopicNoteEdit() {
    setEditingTopicNoteId(null);
    setTopicNoteDraft("");
  }

  function handleSaveTopicNote(questionId: MentorQuestionId) {
    const currentThread = conversationThreads[questionId];
    const trimmedNote = topicNoteDraft.trim();

    const nextThreads = {
      ...conversationThreads,
      [questionId]: {
        launchContextLabel: currentThread?.launchContextLabel,
        launchContextNote: currentThread?.launchContextNote,
        launchReturnState: currentThread?.launchReturnState,
        launchSourceLabel: currentThread?.launchSourceLabel,
        messages: currentThread?.messages ?? [],
        note: trimmedNote || undefined,
        status: currentThread?.status ?? "",
        updatedAt: currentThread?.updatedAt,
      },
    };

    setConversationThreads(nextThreads);
    persistConversationSnapshot(nextThreads, activeQuestionId);
    handleCancelTopicNoteEdit();
  }

  async function handleSendChatMessage(prefilled?: string) {
    const content = (prefilled ?? chatDraft).trim();
    if (!content || isSendingChat) return;

    const userMessage = {
      content,
      id: createChatMessageId("user"),
      role: "user" as const,
    };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatDraft("");
    setIsSendingChat(true);
    setChatStatus("Mentor is thinking through your current context...");
    const pendingThreads = {
      ...conversationThreads,
      [activeQuestionId]: {
        launchContextLabel: conversationThreads[activeQuestionId]?.launchContextLabel,
        launchContextNote: conversationThreads[activeQuestionId]?.launchContextNote,
        launchReturnState: conversationThreads[activeQuestionId]?.launchReturnState,
        launchSourceLabel: conversationThreads[activeQuestionId]?.launchSourceLabel,
        messages: nextMessages,
        note: conversationThreads[activeQuestionId]?.note,
        status: "Mentor is thinking through your current context...",
        updatedAt: new Date().toISOString(),
      },
    };
    setConversationThreads(pendingThreads);
    persistConversationSnapshot(pendingThreads, activeQuestionId);

    try {
      const response = await fetch("/api/mentor-chat", {
        body: JSON.stringify({
          context: mentorChatContext,
          messages: nextMessages.map((message) => ({
            content: message.content,
            role: message.role,
          })),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Mentor chat route unavailable.");
      }

      const payload = (await response.json()) as {
        actionLabel?: string;
        actionView?: MentorActionView;
        message: string;
        note?: string;
        source: "ai" | "fallback";
      };

      const nextAssistantMessage = {
        actionLabel: payload.actionLabel,
        actionView: payload.actionView,
        content: payload.message,
        id: createChatMessageId("assistant"),
        note: payload.note,
        role: "assistant" as const,
        source: payload.source,
      };
      const nextStatus =
        payload.source === "ai"
          ? "Live AI mentor is active for this conversation."
          : payload.note ?? "Using the built-in mentor coach for this conversation.";
      const nextThreadMessages = [...nextMessages, nextAssistantMessage];
      const nextThreads = {
        ...pendingThreads,
        [activeQuestionId]: {
          launchContextLabel: conversationThreads[activeQuestionId]?.launchContextLabel,
          launchContextNote: conversationThreads[activeQuestionId]?.launchContextNote,
          launchReturnState: conversationThreads[activeQuestionId]?.launchReturnState,
          launchSourceLabel: conversationThreads[activeQuestionId]?.launchSourceLabel,
          messages: nextThreadMessages,
          note: conversationThreads[activeQuestionId]?.note,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        },
      };

      setChatMessages(nextThreadMessages);
      setChatStatus(nextStatus);
      setConversationThreads(nextThreads);
      persistConversationSnapshot(nextThreads, activeQuestionId);
    } catch {
      const fallback = buildMentorFallbackReply({
        context: mentorChatContext,
        message: content,
      });

      const nextAssistantMessage = {
        actionLabel: fallback.actionLabel,
        actionView: fallback.actionView,
        content: fallback.reply,
        id: createChatMessageId("assistant"),
        note: fallback.note,
        role: "assistant" as const,
        source: "fallback" as const,
      };
      const nextThreadMessages = [...nextMessages, nextAssistantMessage];
      const nextThreads = {
        ...pendingThreads,
        [activeQuestionId]: {
          launchContextLabel: conversationThreads[activeQuestionId]?.launchContextLabel,
          launchContextNote: conversationThreads[activeQuestionId]?.launchContextNote,
          launchReturnState: conversationThreads[activeQuestionId]?.launchReturnState,
          launchSourceLabel: conversationThreads[activeQuestionId]?.launchSourceLabel,
          messages: nextThreadMessages,
          note: conversationThreads[activeQuestionId]?.note,
          status: fallback.note,
          updatedAt: new Date().toISOString(),
        },
      };

      setChatMessages(nextThreadMessages);
      setChatStatus(fallback.note);
      setConversationThreads(nextThreads);
      persistConversationSnapshot(nextThreads, activeQuestionId);
    } finally {
      setIsSendingChat(false);
    }
  }

  return (
    <div className="grid gap-5">
      <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm">
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-7">
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Mentor coaching desk</Badge>
              <Badge variant="outline">{mentorReadinessLabel}</Badge>
              <Badge variant="outline">{profile.band}</Badge>
              <Badge variant="outline">{profile.confidence}</Badge>
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Get one clearer investing decision at a time.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                This mentor is strongest when you bring one real doubt, read the personalized context, and leave with one practical next move. The goal is clarity and momentum, not more mental clutter.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Best next question
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {topSuggestedQuestion.label}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Focus today
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {answer.focusLabel}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Coaching track
                </p>
                <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                  {answer.actionTrack.title}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 content-start">
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Coaching read
              </p>
              <p className="mt-3 text-base font-semibold text-foreground">
                {answer.summary}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {answer.actionTrack.description}
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best next move
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                {answer.actionTrack.nextMove}
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate(currentActionTarget.view)}
                >
                  {currentActionTarget.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>AI mentor</CardTitle>
          <CardDescription>
            Guided explanations tuned to your profile, portfolio, and current setup stage.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 rounded-md border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{profile.band}</Badge>
              <Badge variant="outline">{profile.confidence}</Badge>
              <Badge variant="outline">{answer.actionTrack.title}</Badge>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-4">
                <div>
                  <p className="text-lg font-semibold tracking-tight text-foreground">
                    Ask the next question that makes your plan clearer, not more complicated.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    This mentor works best when you use it to remove one doubt at a time, then turn the answer into a simple next move.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      1. Start with what matters
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      Pick the question that matches your real decision, not the most advanced topic.
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      2. Read the checkpoints
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      Use the portfolio and profile cues to understand why the answer is personalized.
                    </p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      3. Act on one step
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      A good mentor answer should end in one calmer decision, not ten new tasks.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="rounded-md border border-border/70 bg-background p-4">
                  <p className="text-sm font-medium">Best next question</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {topSuggestedQuestion.label}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Start here if you want the shortest path to the most relevant answer right now.
                  </p>
                </div>
                {activeLaunchContextLabel || activeLaunchContextNote ? (
                  <div className="rounded-md border border-border/70 bg-background p-4">
                    <p className="text-sm font-medium">What you brought in</p>
                    {activeLaunchContextLabel ? (
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {activeLaunchContextLabel}
                      </p>
                    ) : null}
                    {activeLaunchContextNote ? (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {activeLaunchContextNote}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="rounded-md border border-border/70 bg-background p-4">
                  <p className="text-sm font-medium">Coaching track</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {answer.actionTrack.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-4">
            <p className="text-sm font-medium">Recommended now</p>
            <div className="mt-3 grid gap-2">
              {suggestedQuestions.map((questionId) => {
                const question = mentorQuestions.find((item) => item.id === questionId);
                if (!question) return null;

                return (
                  <Button
                    key={question.id}
                    type="button"
                    variant={activeQuestion.id === question.id ? "default" : "secondary"}
                    className="h-auto min-h-11 justify-start whitespace-normal text-left leading-5"
                    onClick={() => setActiveQuestionId(question.id)}
                  >
                    <MessageCircleQuestion className="h-4 w-4 shrink-0" />
                    {question.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Topic threads</p>
              <Badge variant="outline">
                {topicThreadSummary.filter((topic) => topic.hasHistory).length} active lanes
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Each topic keeps its own conversation thread, so you can return to allocation, tax, or SIP questions without mixing the coaching history together.
            </p>
            <div className="mt-3 grid gap-2">
              {topicThreadSummary.map((topic) => {
                const question = mentorQuestions.find((item) => item.id === topic.id);
                if (!question) return null;

                return (
                  <div
                    key={topic.id}
                    role="button"
                    tabIndex={0}
                    className={`rounded-md border px-3 py-3 text-left transition ${
                      topic.isActive
                        ? "border-primary/40 bg-primary/5"
                        : topic.hasHistory
                          ? "border-border/70 bg-background hover:bg-muted/20"
                          : "border-border/50 bg-background/80 hover:bg-muted/10"
                    }`}
                    onClick={() => setActiveQuestionId(topic.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveQuestionId(topic.id);
                      }
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{question.title}</p>
                      <div className="flex flex-wrap gap-2">
                        {topic.isActive ? <Badge variant="secondary">Open</Badge> : null}
                        <Badge variant={topic.freshnessTone}>
                          {topic.freshnessLabel}
                        </Badge>
                        {topic.hasAssistantReply ? (
                          <Badge variant="outline">Coached</Badge>
                        ) : topic.hasHistory ? (
                          <Badge variant="outline">Drafted</Badge>
                        ) : (
                          <Badge variant="outline">Fresh</Badge>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {topic.statusLabel}
                    </p>
                    {topic.lastUpdatedLabel ? (
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        Last active {topic.lastUpdatedLabel}
                      </p>
                    ) : null}
                    {topic.launchSourceLabel ? (
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        Started from {topic.launchSourceLabel}
                      </p>
                    ) : null}
                    {topic.launchContextLabel ? (
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        Context: {topic.launchContextLabel}
                      </p>
                    ) : null}
                    {topic.note ? (
                      <div className="mt-3 rounded-md border border-border/60 bg-background/80 p-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Saved note
                        </p>
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-foreground">
                          {topic.note}
                        </p>
                      </div>
                    ) : null}
                    {topic.lastTakeaway ? (
                      <div className="mt-3 rounded-md border border-border/60 bg-muted/20 p-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Last takeaway
                        </p>
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-foreground">
                          {topic.lastTakeaway}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleResumeTopicTakeaway(topic.id, topic.lastTakeaway ?? "");
                            }}
                          >
                            Resume from takeaway
                          </Button>
                          {topic.openInsightId ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleResolveTopicLane(topic.id);
                              }}
                            >
                              Resolved for now
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-3 rounded-md border border-dashed border-border/60 bg-muted/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Topic note
                        </p>
                        {editingTopicNoteId === topic.id ? null : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleStartTopicNoteEdit(topic.id);
                            }}
                          >
                            {topic.note ? "Edit note" : "Add note"}
                          </Button>
                        )}
                      </div>
                      {editingTopicNoteId === topic.id ? (
                        <div
                          className="mt-3 grid gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <textarea
                            value={topicNoteDraft}
                            onChange={(event) => setTopicNoteDraft(event.target.value)}
                            placeholder="Save one personal reminder for this topic."
                            className="min-h-20 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs leading-5 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={handleCancelTopicNoteEdit}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-8"
                              onClick={() => handleSaveTopicNote(topic.id)}
                            >
                              Save note
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {topic.note
                            ? "This stays with the topic lane, so you can come back without re-explaining your thought."
                            : "Park one reminder, question, or action here without starting a new message."}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Question library</p>
          {mentorQuestions.map((question) => (
            <Button
              key={question.id}
              type="button"
              variant={activeQuestion.id === question.id ? "default" : "outline"}
              className="h-auto min-h-11 justify-start whitespace-normal text-left leading-5"
              onClick={() => setActiveQuestionId(question.id)}
            >
              <MessageCircleQuestion className="h-4 w-4 shrink-0" />
              {question.label}
            </Button>
          ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{profile.personality}</Badge>
            <Badge variant="outline">{profile.band}</Badge>
            <Badge variant="outline">{answer.focusLabel}</Badge>
            <Badge variant="outline">{answer.actionTrack.title}</Badge>
          </div>
          <CardTitle>{activeQuestion.title}</CardTitle>
          <CardDescription>{answer.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-4 md:grid-cols-[1fr_0.95fr]">
            <div>
              <p className="text-sm font-medium">What this answer is optimizing for</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {answer.summary} The point is not just to explain the topic, but to connect it to your current profile, portfolio shape, and setup stage.
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best next move
              </p>
              <p className="mt-2 text-sm leading-6">{answer.actionTrack.nextMove}</p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate(currentActionTarget.view)}
                >
                  {currentActionTarget.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {answer.checkpoints.map((checkpoint) => (
              <MetricMini
                key={checkpoint.label}
                label={checkpoint.label}
                value={checkpoint.value}
              />
            ))}
          </div>
          <div className="rounded-md border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Plain-language answer
            </div>
            <p className="mt-3 text-sm leading-6 text-foreground">{answer.explanation}</p>
          </div>
          <div className="rounded-md border border-border/70 bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{answer.actionTrack.title}</p>
              <Badge variant="outline">Coach track</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {answer.actionTrack.description}
            </p>
            <div className="mt-3 rounded-md border border-border/70 bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best next move
              </p>
              <p className="mt-2 text-sm leading-6">{answer.actionTrack.nextMove}</p>
            </div>
          </div>
          <div className="grid gap-3 rounded-md border border-border/70 bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Decision steps</p>
              <Badge variant="outline">{answer.focusLabel}</Badge>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Use these in order. They are meant to reduce confusion and turn the answer into one practical decision.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {answer.steps.map((step, index) => (
                <div key={step} className="rounded-md border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <CheckCircle2 className="mt-3 h-4 w-4 text-primary" />
                  <p className="mt-3 text-sm leading-6">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-border/70 bg-background p-4">
            <p className="text-sm font-medium">Personal note</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {answer.personalNote}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Keep going with</p>
              <Badge variant="outline">Next questions</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {answer.followUps.map((questionId) => {
                const question = mentorQuestions.find((item) => item.id === questionId);
                if (!question) return null;

                return (
                  <Button
                    key={question.id}
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={() => setActiveQuestionId(question.id)}
                  >
                    {question.label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>AI mentor conversation</CardTitle>
            <Badge variant="outline">{mentorReadinessLabel}</Badge>
            {activeLaunchSourceLabel ? (
              <Badge variant="secondary">Opened from {activeLaunchSourceLabel}</Badge>
            ) : null}
            {activeLaunchContextLabel ? (
              <Badge variant="outline">{activeLaunchContextLabel}</Badge>
            ) : null}
          </div>
          <CardDescription>
            Ask follow-up questions in plain language. The AI mentor uses your current profile, holdings, goals, and active coaching topic to keep the conversation personal.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 rounded-md border border-border/70 bg-background p-4 md:grid-cols-4">
            <div className="rounded-md border border-border/70 bg-muted/20 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Thread stage
              </p>
              <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                {conversationSnapshot.stageLabel}
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-3 md:col-span-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Decision we are working through
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {conversationSnapshot.decisionFocus}
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Best next step
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {conversationSnapshot.nextStep}
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-4 md:grid-cols-3">
            {conversationHeaderSummary.map((item) => (
              <div
                key={item.label}
                className="rounded-md border border-border/70 bg-background p-3"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-foreground">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
          {activeLaunchSourceLabel ? (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">
                    Mentor handoff
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    You opened this conversation from {activeLaunchSourceLabel}. The drafted question and topic were carried over so you can keep going without restating the same context.
                  </p>
                  {activeLaunchContextNote ? (
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {activeLaunchContextNote}
                    </p>
                  ) : null}
                  {launchContextHighlights.length > 0 ? (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {launchContextHighlights.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-md border border-primary/20 bg-background/80 p-3"
                        >
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {item.label}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-foreground">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {launchFollowThrough ? (
                    <div className="mt-3 rounded-md border border-primary/20 bg-background/70 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Best follow-through
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {launchFollowThrough.reason}
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Why this is useful now
                          </p>
                          <p className="mt-2 text-sm leading-6 text-foreground">
                            You are already in the middle of a live decision, so this is the moment to turn explanation into action instead of reopening the same confusion later.
                          </p>
                        </div>
                        <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            What happens on return
                          </p>
                          <p className="mt-2 text-sm leading-6 text-foreground">
                            {activeLaunchReturnState
                              ? "The page will reopen with your in-progress state restored, so you can continue from the exact point where you paused."
                              : "You will go back to the right page section so the next action is easy to take immediately."}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            onNavigate(
                              launchFollowThrough.view as ActiveView,
                              launchFollowThrough.focusTarget,
                              activeLaunchReturnState ?? undefined,
                            )
                          }
                        >
                          {launchFollowThrough.label}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                        {launchFollowThrough.view !== currentActionTarget.view ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onNavigate(currentActionTarget.view)}
                          >
                            {currentActionTarget.label}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    setActiveLaunchSourceLabel(null);
                    setActiveLaunchContextLabel(null);
                    setActiveLaunchContextNote(null);
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Current topic
              </p>
              <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                {activeQuestion.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {conversationStatusLabel}
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Latest takeaway
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {conversationTakeaway}
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Topic note
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => handleStartTopicNoteEdit(activeQuestionId)}
                >
                  {activeThreadNote ? "Edit note" : "Add note"}
                </Button>
              </div>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {activeThreadNote ??
                  "Save one short reminder, concern, or decision cue for this topic while you chat."}
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recommended next move
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {conversationActionLabel}
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate(conversationActionView as ActiveView)}
                >
                  {conversationActionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {recommendedActions.length > 0 ? (
            <div className="rounded-md border border-border/70 bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Best ways to use this answer now</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    These are the cleanest next moves based on your topic, current plan, and where this conversation started.
                  </p>
                </div>
                <Badge variant="outline">{recommendedActions.length} moves</Badge>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {recommendedActions.map((action) => (
                  <div
                    key={`${action.view}:${action.label}:${action.focusTarget ?? "base"}`}
                    className="rounded-md border border-border/70 bg-muted/20 p-3"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {action.title}
                    </p>
                    <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                      {action.label}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {action.description}
                    </p>
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onNavigate(
                            action.view as ActiveView,
                            action.focusTarget,
                            activeLaunchReturnState ?? undefined,
                          )
                        }
                      >
                        {action.label}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-4 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-sm font-medium">Conversation posture</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Ask one concrete question at a time: how much risk is sensible, whether a SIP amount feels enough, what to do before adding a new category, or how your goals should affect portfolio choices.
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-background p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Current status
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">{chatStatus}</p>
            </div>
          </div>

          <div className="rounded-md border border-border/70 bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">You may want to ask about</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {proactiveMentorPrompt.caption}
                </p>
              </div>
              <Badge variant="outline">AI mentor nudge</Badge>
            </div>
            <div className="mt-3 rounded-md border border-border/70 bg-muted/20 p-3">
              <p className="text-sm font-medium text-foreground">
                {proactiveMentorPrompt.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {proactiveMentorPrompt.prompt}
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleSendChatMessage(proactiveMentorPrompt.prompt)}
                  disabled={isSendingChat}
                >
                  Ask this
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="w-full">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {starterPromptCaption}
              </p>
            </div>
            {starterPrompts.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleSendChatMessage(prompt)}
                disabled={isSendingChat}
              >
                {prompt}
              </Button>
            ))}
          </div>

          <div className="rounded-md border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Today focus</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Keep one actionable takeaway visible so the conversation turns into a real next step.
                </p>
              </div>
              <Badge variant="outline">
                {pinnedInsight ? "Active focus" : "No focus yet"}
              </Badge>
            </div>
            {pinnedInsight ? (
              <div className="mt-3 rounded-md border border-border/70 bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Do now</Badge>
                  <Badge variant="outline">{pinnedInsight.title}</Badge>
                </div>
                <p className="mt-3 line-clamp-4 text-sm leading-6 text-foreground">
                  {pinnedInsight.content}
                </p>
                {pinnedInsightWhyNow ? (
                  <div className="mt-3 rounded-md border border-border/70 bg-muted/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Why this matters now
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {pinnedInsightWhyNow}
                    </p>
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateInsightStatus(pinnedInsight.id, "stuck")}
                  >
                    <TriangleAlert className="h-3.5 w-3.5" />
                    Stuck
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateInsightStatus(pinnedInsight.id, "not-now")}
                  >
                    <CirclePause className="h-3.5 w-3.5" />
                    Not now
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCompleteInsight(pinnedInsight.id)}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark done
                  </Button>
                  {pinnedInsight.actionView && pinnedInsight.actionLabel ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate(pinnedInsight.actionView as ActiveView)}
                    >
                      {pinnedInsight.actionLabel}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
                {pinnedInsightRecovery ? (
                  <div className="mt-3 rounded-md border border-border/70 bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      If this feels stuck
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {pinnedInsightRecovery.detail}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleRecoverInsight(pinnedInsight)}
                        disabled={isSendingChat}
                      >
                        Talk this through
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-dashed border-border/70 bg-background p-4 text-sm leading-6 text-muted-foreground">
                Save a practical mentor reply and pin it from the `Do now` bucket to keep one decision in focus today.
              </div>
            )}
          </div>

          <div className="rounded-md border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Saved takeaways</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Keep the mentor answers you want to revisit before your next decision.
                </p>
              </div>
              <Badge variant="outline">{savedInsights.length} saved</Badge>
            </div>
            {savedInsights.length === 0 ? (
              <div className="mt-3 rounded-md border border-dashed border-border/70 bg-background p-4 text-sm leading-6 text-muted-foreground">
                Save a mentor reply to build a small library of practical reminders and next moves.
              </div>
            ) : (
              <div className="mt-3 grid gap-4">
                {insightBucketMeta.map((bucket) => (
                  <div
                    key={bucket.key}
                    className="rounded-md border border-border/70 bg-background p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{bucket.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {bucket.description}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {groupedSavedInsights[bucket.key].length}
                      </Badge>
                    </div>
                    {groupedSavedInsights[bucket.key].length === 0 ? (
                      <div className="mt-3 rounded-md border border-dashed border-border/70 bg-muted/10 p-3 text-xs leading-5 text-muted-foreground">
                        Nothing saved here yet.
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-3">
                        {groupedSavedInsights[bucket.key].map((insight) => (
                          <div
                            key={insight.id}
                            className="rounded-md border border-border/70 bg-muted/10 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {insight.title}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Saved{" "}
                                  {new Date(insight.createdAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                  })}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRemoveInsight(insight.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="mt-3 line-clamp-4 text-sm leading-6 text-foreground">
                              {insight.content}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {bucket.key === "do-now" ? (
                                <>
                                  <Button
                                    type="button"
                                    variant={insight.isPinned ? "secondary" : "outline"}
                                    size="sm"
                                    onClick={() => handlePinInsight(insight.id)}
                                  >
                                    <Pin className="h-3.5 w-3.5" />
                                    {insight.isPinned ? "Today focus" : "Set as focus"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCompleteInsight(insight.id)}
                                  >
                                    <CheckCheck className="h-3.5 w-3.5" />
                                    Mark done
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUpdateInsightStatus(insight.id, "stuck")}
                                  >
                                    <TriangleAlert className="h-3.5 w-3.5" />
                                    Stuck
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUpdateInsightStatus(insight.id, "not-now")}
                                  >
                                    <CirclePause className="h-3.5 w-3.5" />
                                    Not now
                                  </Button>
                                </>
                              ) : null}
                              {insight.actionView && insight.actionLabel ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onNavigate(insight.actionView as ActiveView)}
                                >
                                  {insight.actionLabel}
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {completedInsights.length > 0 ? (
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Completed takeaways</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Finished mentor actions stay here as proof of progress, without cluttering your live focus list.
                  </p>
                </div>
                <Badge variant="outline">{completedInsights.length}</Badge>
              </div>
              <div className="mt-3 grid gap-3">
                {completedInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className="rounded-md border border-border/70 bg-background p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{insight.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Completed{" "}
                          {insight.completedAt
                            ? new Date(insight.completedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })
                            : "recently"}
                        </p>
                      </div>
                      <Badge variant="secondary">Done</Badge>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {insight.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {stuckInsights.length > 0 ? (
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Stuck right now</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    These are the next moves that need more clarity or confidence before action.
                  </p>
                </div>
                <Badge variant="outline">{stuckInsights.length}</Badge>
              </div>
              <div className="mt-3 grid gap-3">
                {stuckInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className="rounded-md border border-border/70 bg-background p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{insight.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Needs another pass before action
                        </p>
                      </div>
                      <Badge variant="outline">Stuck</Badge>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {insight.content}
                    </p>
                    <div className="mt-3 rounded-md border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Recovery move
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {
                          getMentorInsightRecovery({
                            answers,
                            profile,
                            questionId: insight.questionId,
                          }).detail
                        }
                      </p>
                    </div>
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateInsightStatus(insight.id, "active")}
                        >
                          <Pin className="h-3.5 w-3.5" />
                          Bring back to focus
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleRecoverInsight(insight)}
                          disabled={isSendingChat}
                        >
                          Talk this through
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {deferredInsights.length > 0 ? (
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Not now</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    These are still useful, but they are parked for a better moment.
                  </p>
                </div>
                <Badge variant="outline">{deferredInsights.length}</Badge>
              </div>
              <div className="mt-3 grid gap-3">
                {deferredInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className="rounded-md border border-border/70 bg-background p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{insight.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Deliberately deferred
                        </p>
                      </div>
                      <Badge variant="outline">Deferred</Badge>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {insight.content}
                    </p>
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateInsightStatus(insight.id, "active")}
                      >
                        <Pin className="h-3.5 w-3.5" />
                        Bring back to focus
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 rounded-md border border-border/70 bg-background p-4">
            {chatMessages.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 bg-muted/10 p-6 text-sm leading-6 text-muted-foreground">
                Start with a natural question like “Should I increase my SIP now?”, “Does my allocation look too concentrated?”, or “What should I understand before buying gold?”
              </div>
            ) : (
              chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-md border p-4 ${
                    message.role === "user"
                      ? "ml-auto max-w-[85%] border-primary/30 bg-primary/5"
                      : "mr-auto max-w-[92%] border-border/70 bg-muted/15"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={message.role === "user" ? "secondary" : "outline"}>
                      {message.role === "user"
                        ? "You"
                        : message.source === "ai"
                          ? "AI mentor"
                          : "Built-in mentor"}
                    </Badge>
                    {message.note ? (
                      <span className="text-xs text-muted-foreground">{message.note}</span>
                    ) : null}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {message.content}
                  </p>
                  {message.role === "assistant" && message.id === lastAssistantMessage?.id ? (
                    <div className="mt-4 grid gap-3">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-md border border-border/70 bg-background p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Why this fits you
                          </p>
                          <p className="mt-2 text-xs leading-5 text-foreground">
                            {replyGuide.whyItFits}
                          </p>
                        </div>
                        <div className="rounded-md border border-border/70 bg-background p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Do this now
                          </p>
                          <p className="mt-2 text-xs leading-5 text-foreground">
                            {replyGuide.nextMove}
                          </p>
                        </div>
                        <div className="rounded-md border border-border/70 bg-background p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Avoid this trap
                          </p>
                          <p className="mt-2 text-xs leading-5 text-foreground">
                            {replyGuide.avoidTrap}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Suggested follow-ups
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {suggestedFollowUpQuestions.map((question) => (
                            <Button
                              key={question.id}
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8"
                              disabled={isSendingChat}
                              onClick={() => {
                                setActiveQuestionId(question.id);
                                void handleSendChatMessage(question.label);
                              }}
                            >
                              {question.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      {suggestedFollowUpPrompts.length > 0 ? (
                        <div className="rounded-md border border-border/70 bg-background p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Ask next
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {suggestedFollowUpPrompts.map((item) => (
                              <Button
                                key={`${message.id}-${item.questionId}-${item.prompt}`}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-auto whitespace-normal px-3 py-2 text-left leading-5"
                                disabled={isSendingChat}
                                onClick={() => {
                                  setActiveQuestionId(item.questionId);
                                  void handleSendChatMessage(item.prompt);
                                }}
                              >
                                {item.prompt}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {message.role === "assistant" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={savedInsights.some((insight) => insight.id === message.id)}
                        onClick={() => handleSaveInsight(message)}
                      >
                        <BookmarkPlus className="h-3.5 w-3.5" />
                        {savedInsights.some((insight) => insight.id === message.id)
                          ? "Saved"
                          : "Save insight"}
                      </Button>
                    </div>
                  ) : null}
                  {message.role === "assistant" && message.actionView && message.actionLabel ? (
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigate(message.actionView as ActiveView)}
                      >
                        {message.actionLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {composerMode.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {composerMode.description}
                </p>
              </div>
              <Badge variant={composerMode.tone === "resume" ? "secondary" : "outline"}>
                {composerMode.badgeLabel}
              </Badge>
            </div>
            <label className="grid gap-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">Ask the AI mentor</span>
                <span className="text-xs text-muted-foreground">
                  {composerGuidance.helperLabel}
                </span>
              </div>
              <textarea
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                placeholder={composerGuidance.placeholder}
                className="min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            {composerGuidance.prompts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {composerGuidance.prompts.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setChatDraft(prompt)}
                    disabled={isSendingChat}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            ) : null}
            {resumePrompts.length > 0 ? (
              <div className="grid gap-2 rounded-md border border-border/70 bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Continue an open mentor thread
                </p>
                <div className="flex flex-wrap gap-2">
                  {resumePrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setChatDraft(prompt)}
                      disabled={isSendingChat}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setChatDraft("");
                  setChatMessages([]);
                  setChatStatus(defaultChatStatus);
                  const nextThreads = { ...conversationThreads };
                  delete nextThreads[activeQuestionId];
                  setConversationThreads(nextThreads);
                  persistConversationSnapshot(nextThreads, activeQuestionId);
                }}
                disabled={isSendingChat}
              >
                Reset this topic
              </Button>
              <Button
                type="button"
                onClick={() => void handleSendChatMessage()}
                disabled={!chatDraft.trim() || isSendingChat}
              >
                {isSendingChat ? "Thinking..." : "Send to AI mentor"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
