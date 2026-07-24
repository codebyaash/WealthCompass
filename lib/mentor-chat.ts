import type { PortfolioAsset, WealthGoal } from "./local-storage";
import {
  getMentorAnswer,
  mentorQuestions,
  type MentorQuestionId,
} from "./mentor-rules";
import { formatMoney } from "./formatters";
import type { RiskAnswers, RiskProfile } from "./wealth-rules";

export type MentorChatContext = {
  activeQuestionId?: MentorQuestionId;
  answers: RiskAnswers;
  assets: PortfolioAsset[];
  conversationMode?: "fresh-question" | "guided-start" | "live-thread" | "resume-mode";
  goals: WealthGoal[];
  launchContextLabel?: string;
  launchSourceLabel?: string;
  profile: RiskProfile;
};

export type MentorActionView =
  | "academy"
  | "dashboard"
  | "goals"
  | "mentor"
  | "onboarding"
  | "portfolio";

export type MentorLaunchRequest = {
  contextLabel?: string;
  contextNote?: string;
  prompt: string;
  questionId: MentorQuestionId;
  returnState?: Record<string, unknown>;
  sourceLabel?: string;
};

export type MentorLaunchContext = MentorLaunchRequest & {
  nonce: number;
};

export type MentorChatMessage = {
  content: string;
  role: "assistant" | "user";
};

export type StoredMentorChatMessage = MentorChatMessage & {
  actionLabel?: string;
  actionView?: MentorActionView;
  id: string;
  note?: string;
  source?: "ai" | "fallback";
};

export type StoredMentorConversation = {
  activeQuestionId: MentorQuestionId;
  messages: StoredMentorChatMessage[];
  status: string;
  threads?: Partial<Record<MentorQuestionId, StoredMentorThread>>;
};

export type StoredMentorThread = {
  launchContextLabel?: string;
  launchContextNote?: string;
  launchReturnState?: Record<string, unknown>;
  launchSourceLabel?: string;
  messages: StoredMentorChatMessage[];
  note?: string;
  status: string;
  updatedAt?: string;
};

export type SavedMentorInsight = {
  actionLabel?: string;
  actionView?: MentorActionView;
  bucket: "do-now" | "learn-next" | "review-later";
  completedAt?: string;
  content: string;
  createdAt: string;
  id: string;
  isPinned?: boolean;
  questionId: MentorQuestionId;
  status?: "active" | "done" | "not-now" | "stuck";
  title: string;
};

export type MentorChatFallback = {
  actionLabel: string;
  actionView: MentorActionView;
  note: string;
  questionId: MentorQuestionId;
  reply: string;
  suggestedFollowUps: MentorQuestionId[];
};

export type MentorRecommendedAction = {
  description: string;
  focusTarget?: string;
  label: string;
  title: string;
  view: MentorActionView;
};

export type MentorReplyGuide = {
  avoidTrap: string;
  nextMove: string;
  whyItFits: string;
};

export type MentorConversationSnapshot = {
  decisionFocus: string;
  latestTakeaway: string;
  nextStep: string;
  stageLabel: string;
};

export type MentorComposerGuidance = {
  helperLabel: string;
  placeholder: string;
  prompts: string[];
};

export type MentorComposerMode = {
  badgeLabel: string;
  description: string;
  title: string;
  tone: "fresh" | "resume";
};

export function buildMentorFollowUpPrompts({
  activeQuestionId,
  followUpQuestionIds,
  launchSourceLabel,
}: {
  activeQuestionId: MentorQuestionId;
  followUpQuestionIds: MentorQuestionId[];
  launchSourceLabel?: string;
}) {
  const sourceHint = launchSourceLabel?.trim();
  const activeQuestionTitle =
    mentorQuestions.find((question) => question.id === activeQuestionId)?.title ??
    "current decision";
  const prompts: Array<{
    prompt: string;
    questionId: MentorQuestionId;
    title: string;
  }> = [];

  for (const questionId of followUpQuestionIds) {
    const question = mentorQuestions.find((item) => item.id === questionId);
    if (!question) continue;

    const prompt = (() => {
      switch (questionId) {
        case "allocation":
          return "What part of my current allocation needs the closest review before I add anything else?";
        case "risk":
          return "Is this hesitation mostly a knowledge gap, or does it show a real mismatch with my risk comfort?";
        case "sip":
          return "How do I decide whether this SIP amount is realistic for my actual goals and monthly cash flow?";
        case "emergency":
          return "How much emergency cover would make this plan feel safer before I increase risk?";
        case "debt":
          return "How should I balance debt cleanup with investing so the month still feels manageable?";
        case "etf":
          return "What exact role should an ETF play in my plan before I buy one?";
        case "gold":
          return "Would gold solve a real portfolio gap for me right now, or just feel comforting?";
        case "tax":
          return "What simple tax records should I start keeping now so this stays easy later?";
        case "crash":
          return "What rule should I commit to now so I do not panic in the next market drop?";
        case "first-investment":
          return "What is the cleanest first investing step I can take without overcomplicating the plan?";
        default:
          return question.label;
      }
    })();

    const normalizedPrompt = sourceHint
      ? `${prompt} Keep it tied to what I opened from ${sourceHint}.`
      : prompt;

    if (prompts.some((item) => item.prompt === normalizedPrompt)) continue;

    prompts.push({
      prompt: normalizedPrompt,
      questionId,
      title: question.label,
    });
  }

  return prompts.slice(0, 3).map((value, index) =>
    index === 0 && value.questionId === activeQuestionId
      ? {
          ...value,
          prompt: `Stay with ${activeQuestionTitle.toLowerCase()}: ${value.prompt}`,
        }
      : value,
  );
}

export function buildMentorResumePrompts({
  questionId,
  savedInsights,
}: {
  questionId: MentorQuestionId;
  savedInsights: SavedMentorInsight[];
}) {
  const activeInsights = savedInsights.filter(
    (insight) =>
      insight.questionId === questionId &&
      !insight.completedAt &&
      insight.status !== "not-now",
  );
  const pinnedInsight = savedInsights.find(
    (insight) => insight.isPinned && !insight.completedAt,
  );
  const fallbackInsight =
    activeInsights[0] ??
    pinnedInsight ??
    savedInsights.find(
      (insight) => !insight.completedAt && insight.status !== "not-now",
    ) ??
    null;

  if (!fallbackInsight) return [];

  const prompts = [
    `Help me continue this takeaway: "${fallbackInsight.content}". What should I do next?`,
    fallbackInsight.status === "stuck"
      ? `I still feel stuck on "${fallbackInsight.title}". Help me unblock it with one practical move.`
      : `How do I turn "${fallbackInsight.title}" into one small action this week?`,
    fallbackInsight.actionLabel
      ? `Before I ${fallbackInsight.actionLabel.toLowerCase()}, what should I make sure I understand?`
      : null,
  ].filter((value): value is string => Boolean(value));

  return prompts.filter(
    (value, index, collection) => collection.indexOf(value) === index,
  ).slice(0, 3);
}

export function buildMentorComposerMode({
  hasDraftedMessages,
  hasResumePrompts,
  launchSourceLabel,
}: {
  hasDraftedMessages: boolean;
  hasResumePrompts: boolean;
  launchSourceLabel?: string;
}): MentorComposerMode {
  if (hasResumePrompts) {
    return {
      badgeLabel: "Resume mode",
      description:
        "There is already an open mentor thread or saved takeaway here, so the fastest path is usually to continue that decision instead of restarting it.",
      title: "Continue an existing thread",
      tone: "resume",
    };
  }

  if (hasDraftedMessages) {
    return {
      badgeLabel: "Live thread",
      description:
        "This topic already has conversation history, but you are free to ask a fresh follow-up if the direction has changed.",
      title: "Ask the next question in this thread",
      tone: "fresh",
    };
  }

  if (launchSourceLabel?.trim()) {
    return {
      badgeLabel: "Guided start",
      description:
        "You arrived here from another page with a live decision in motion, so start with the clearest question that helps you return confidently.",
      title: "Start from the handoff context",
      tone: "fresh",
    };
  }

  return {
    badgeLabel: "Fresh question",
    description:
      "Start a new question when you want a clean explanation or one practical next move without carrying an older thread.",
    title: "Start a new mentor question",
    tone: "fresh",
  };
}

export function getMentorActionTarget(questionId: MentorQuestionId): {
  label: string;
  view: MentorActionView;
} {
  switch (questionId) {
    case "allocation":
      return { label: "Open portfolio", view: "portfolio" };
    case "emergency":
    case "debt":
    case "risk":
      return { label: "Open onboarding", view: "onboarding" };
    case "sip":
    case "first-investment":
      return { label: "Open goals", view: "goals" };
    case "crash":
    case "etf":
    case "gold":
    case "tax":
    default:
      return { label: "Open academy", view: "academy" };
  }
}

export function getMentorLaunchFollowThrough({
  contextLabel,
  questionId,
  sourceLabel,
}: {
  contextLabel?: string;
  questionId: MentorQuestionId;
  sourceLabel?: string;
}): {
  focusTarget?: string;
  label: string;
  reason: string;
  view: MentorActionView;
} {
  const normalizedSource = sourceLabel?.trim().toLowerCase() ?? "";
  const normalizedContext = contextLabel?.trim().toLowerCase() ?? "";

  if (normalizedSource.includes("onboarding")) {
    return {
      focusTarget: normalizedSource.includes("assessment")
        ? "plan"
        : normalizedSource.includes("set your base")
          ? "profile"
          : normalizedSource.includes("map your behavior")
            ? "risk"
            : normalizedSource.includes("submit the assessment")
              ? "plan"
              : undefined,
      label: normalizedSource.includes("assessment")
        ? "Return to onboarding assessment"
        : "Return to onboarding",
      reason:
        "Go back while the question is still fresh so you can answer with more confidence instead of guessing.",
      view: "onboarding",
    };
  }

  if (normalizedSource.includes("goals")) {
    return {
      focusTarget:
        normalizedSource.includes("priorit") || normalizedSource.includes("fund")
          ? "goal-priorities"
          : normalizedSource.includes("first real goal")
            ? "goal-list"
            : undefined,
      label: normalizedSource.includes("priorit")
        ? "Return to goal priorities"
        : "Return to goals",
      reason:
        "Use the mentor answer to tighten one funding decision before the goal list turns abstract again.",
      view: "goals",
    };
  }

  if (normalizedSource.includes("portfolio")) {
    return {
      focusTarget:
        normalizedSource.includes("import") || normalizedSource.includes("review")
          ? "import-review"
          : normalizedSource.includes("operating")
            ? "manual-entry"
            : undefined,
      label: normalizedSource.includes("import")
        ? "Return to portfolio import review"
        : "Return to portfolio",
      reason:
        "Check the live portfolio or import lane now, while the reliability or allocation call is still concrete.",
      view: "portfolio",
    };
  }

  if (normalizedSource.includes("academy")) {
    return {
      focusTarget:
        normalizedSource.includes("category")
          ? "comparator"
          : normalizedSource.includes("learning")
            ? "track-plans"
            : normalizedSource.includes("shortlist")
              ? "use-cases"
              : undefined,
      label: normalizedSource.includes("category")
        ? "Return to category comparison"
        : "Return to academy",
      reason:
        "Take the clearer product-role answer back into the learning desk before the category choice gets fuzzy again.",
      view: "academy",
    };
  }

  if (normalizedSource.includes("dashboard")) {
    return {
      label: "Return to dashboard next action",
      reason:
        "Bring the mentor answer back to the operating view and decide what deserves attention first.",
      view: "dashboard",
    };
  }

  if (normalizedContext.includes("blocked on")) {
    return {
      label: "Return to the blocked decision",
      reason:
        "Go back to the decision that felt stuck and test whether the next step is finally simple enough to act on.",
      view: getMentorActionTarget(questionId).view,
    };
  }

  const fallbackTarget = getMentorActionTarget(questionId);
  return {
    label: fallbackTarget.label,
    reason:
      "Take the answer back to the workspace where this topic becomes actionable, not just understandable.",
    view: fallbackTarget.view,
  };
}

export function getMentorInsightWhyNow({
  answers,
  profile,
  questionId,
}: {
  answers: RiskAnswers;
  profile: RiskProfile;
  questionId: MentorQuestionId;
}) {
  switch (questionId) {
    case "emergency":
      return answers.emergencyMonths >= 6
        ? "Your base is healthier now, so this stays important mainly as a protection habit."
        : "A thinner emergency buffer can turn normal market swings into forced bad decisions.";
    case "debt":
      return answers.debtLevel === "heavy"
        ? "Heavy debt is competing directly with your investing progress and emotional comfort."
        : "Keeping debt manageable protects future investing consistency, not just monthly cash flow.";
    case "allocation":
      return profile.band === "Growth"
        ? "Your risk appetite can work for you only if the portfolio mix is intentional instead of accidental."
        : "Your next gains in confidence will come more from balance and fit than from chasing hotter categories.";
    case "sip":
      return answers.monthlyInvestment > 0
        ? "Consistency matters more than intensity right now, so small improvements here compound quietly."
        : "A repeatable SIP habit is often the cleanest bridge between good intent and real progress.";
    case "tax":
      return "Tax awareness becomes most useful before money compounds into avoidable cleanup later.";
    case "etf":
      return "Understanding the product role now helps you avoid picking wrappers before you know the job.";
    case "gold":
      return "Gold usually helps only when you know why it belongs in the mix, not just because it feels safe.";
    case "risk":
      return profile.potentialScore && profile.potentialScore > profile.score
        ? "Your behavior may be lagging your true capacity, so clarity here can unlock better long-term decisions."
        : "Risk fit matters now because the wrong level usually breaks consistency before returns ever matter.";
    case "crash":
      return "Your worst market-day behavior is often decided before the crash arrives, not during it.";
    case "first-investment":
    default:
      return "The first clear step matters because early confusion usually creates delay, not better decisions.";
  }
}

export function getMentorInsightRecovery({
  answers,
  profile,
  questionId,
}: {
  answers: RiskAnswers;
  profile: RiskProfile;
  questionId: MentorQuestionId;
}) {
  switch (questionId) {
    case "emergency":
      return {
        detail:
          answers.emergencyMonths < 3
            ? "Shrink the problem: decide one fixed monthly amount for the emergency bucket before touching the portfolio."
            : "You may not need a full reset here. Just confirm the cash buffer target and contribution pace once, then move on.",
        nextLabel: "Open onboarding",
      };
    case "debt":
      return {
        detail:
          answers.debtLevel === "heavy"
            ? "Use one comparison only: highest interest rate versus expected long-term investing return. That usually clears the decision fog."
            : "You probably do not need an all-or-nothing answer. Pick a split between debt cleanup and investing that you can actually repeat.",
        nextLabel: "Open onboarding",
      };
    case "allocation":
      return {
        detail:
          "Do not optimize the whole portfolio at once. Start by checking whether one category or one holding is carrying too much weight.",
        nextLabel: "Open portfolio",
      };
    case "sip":
      return {
        detail:
          answers.monthlyInvestment > 0
            ? "Treat this like a calibration problem, not a motivation problem. Adjust the SIP to the amount you can sustain for 12 months."
            : "Start with the smallest amount that feels almost too easy to miss. Consistency comes before size.",
        nextLabel: "Open goals",
      };
    case "tax":
      return {
        detail:
          "Pause the full tax maze. Learn just the difference between holding period, gains type, and whether the product sits in equity or debt treatment.",
        nextLabel: "Open academy",
      };
    case "etf":
      return {
        detail:
          "If the product choice feels blurry, go back one step and decide the job first: core growth, diversification, income, or parking money.",
        nextLabel: "Open academy",
      };
    case "gold":
      return {
        detail:
          "You do not need a strong view on gold to move forward. First decide whether you need a diversifier at all, then decide the size later.",
        nextLabel: "Open academy",
      };
    case "risk":
      return {
        detail:
          profile.potentialScore && profile.potentialScore > profile.score
            ? "The blocker may be confidence more than capacity. Compare your current risk behavior with your post-learning answers and close only that gap."
            : "Use one stress test only: how much temporary decline could you hold without changing the plan impulsively?",
        nextLabel: "Open onboarding",
      };
    case "crash":
      return {
        detail:
          "Write the crash rule before you need it: what you will stop checking, what you will keep funding, and what would actually justify a change.",
        nextLabel: "Open academy",
      };
    case "first-investment":
    default:
      return {
        detail:
          "If the first move still feels heavy, reduce it to one decision: choose the starter route, not the forever portfolio.",
        nextLabel: "Open goals",
      };
  }
}

export function buildMentorRecommendedActions({
  answers,
  assets,
  contextLabel,
  goals,
  profile,
  questionId,
  sourceLabel,
}: {
  answers: RiskAnswers;
  assets: PortfolioAsset[];
  contextLabel?: string;
  goals: WealthGoal[];
  profile: RiskProfile;
  questionId: MentorQuestionId;
  sourceLabel?: string;
}): MentorRecommendedAction[] {
  const actions: MentorRecommendedAction[] = [];
  const launchFollowThrough =
    sourceLabel || contextLabel
      ? getMentorLaunchFollowThrough({
          contextLabel,
          questionId,
          sourceLabel,
        })
      : null;

  if (launchFollowThrough) {
    actions.push({
      description: launchFollowThrough.reason,
      focusTarget: launchFollowThrough.focusTarget,
      label: launchFollowThrough.label,
      title: "Finish the decision you paused",
      view: launchFollowThrough.view,
    });
  }

  const actionTarget = getMentorActionTarget(questionId);
  const baseActionDescription = (() => {
    switch (questionId) {
      case "allocation":
        return assets.length > 0
          ? "Review the actual holdings mix now, while the advice is still concrete enough to adjust."
          : "Set up the portfolio view so allocation advice turns into a visible mix instead of a vague idea.";
      case "emergency":
      case "debt":
      case "risk":
        return "Use onboarding to turn this answer into a cleaner risk and foundation decision.";
      case "sip":
      case "first-investment":
        return goals.length > 0
          ? "Translate the answer into a monthly funding move inside your goal plan."
          : "Create or refine a real goal so this advice becomes something you can fund consistently.";
      case "tax":
      case "etf":
      case "gold":
      case "crash":
      default:
        return "Carry this into the learning desk and clear the next confusion before you add more complexity.";
    }
  })();

  if (!launchFollowThrough || launchFollowThrough.view !== actionTarget.view) {
    actions.push({
      description: baseActionDescription,
      label: actionTarget.label,
      title: "Turn the answer into action",
      view: actionTarget.view,
    });
  }

  if (questionId !== "risk" && profile.intentGap === "knowledge-gap" && profile.potentialBand) {
    actions.push({
      description: `Your current score may be softer than your potential ${profile.potentialBand} fit. Recheck what feels unclear versus what truly feels uncomfortable.`,
      focusTarget: "plan",
      label: "Revisit risk fit",
      title: "Check whether this is confidence or capacity",
      view: "onboarding",
    });
  }

  if (questionId !== "emergency" && answers.emergencyMonths < 3) {
    actions.push({
      description:
        "A thin cash buffer can distort every other decision. Protect the base before you stretch the plan.",
      focusTarget: "risk",
      label: "Recheck your foundation",
      title: "Stabilize the plan first",
      view: "onboarding",
    });
  }

  if (
    questionId !== "allocation" &&
    assets.length > 0 &&
    ((profile.band === "Growth" && assets.length < 3) || assets.length === 1)
  ) {
    actions.push({
      description:
        "Your tracked portfolio is narrow enough that one allocation review could reduce a lot of hidden concentration risk.",
      focusTarget: "manual-entry",
      label: "Review allocation mix",
      title: "Check concentration before adding more",
      view: "portfolio",
    });
  }

  if (questionId !== "sip" && goals.length > 0 && answers.monthlyInvestment > 0) {
    actions.push({
      description:
        "Use your active goals to pressure-test whether the current monthly investing pace matches what you actually want to reach.",
      focusTarget: "goal-priorities",
      label: "Pressure-test monthly split",
      title: "Make the monthly plan more realistic",
      view: "goals",
    });
  }

  return actions.filter(
    (action, index, collection) =>
      collection.findIndex(
        (candidate) =>
          candidate.label === action.label &&
          candidate.view === action.view &&
          candidate.focusTarget === action.focusTarget,
      ) === index,
  ).slice(0, 3);
}

export function buildMentorReplyGuide({
  answers,
  assets,
  profile,
  questionId,
}: {
  answers: RiskAnswers;
  assets: PortfolioAsset[];
  profile: RiskProfile;
  questionId: MentorQuestionId;
}): MentorReplyGuide {
  const trackedValue = assets.reduce((sum, asset) => sum + asset.value, 0);

  const avoidTrap = (() => {
    switch (questionId) {
      case "allocation":
        return "Do not judge allocation only by recent winners. Judge it by whether one holding or one theme can throw the whole plan off balance.";
      case "emergency":
        return "Do not count volatile investments as emergency money just because they feel accessible on the app.";
      case "debt":
        return "Do not treat this like a pride contest between repayment and investing. The real test is what keeps your cash flow calmer and more repeatable.";
      case "sip":
        return "Do not raise the SIP just because it sounds disciplined. Raise it only when the amount still feels sustainable in a bad month.";
      case "risk":
        return "Do not read the score like a permanent identity. It is only a planning signal for your current situation.";
      case "etf":
        return "Do not assume an ETF is automatically simple in practice if order placement, liquidity, or product role still feel fuzzy.";
      case "gold":
        return "Do not let safety language turn gold into your whole plan. It is usually a support role, not the engine.";
      case "tax":
        return "Do not wait for filing season to think about taxes. Most of the stress comes from missing records, not missing brilliance.";
      case "crash":
        return "Do not build your crash plan in the middle of fear. Decide the rule before the drop shows up.";
      case "first-investment":
      default:
        return "Do not optimize the forever portfolio before you have built the first repeatable investing habit.";
    }
  })();

  const whyItFits = (() => {
    if (questionId === "allocation" && trackedValue > 0) {
      return "This fits because you already have tracked holdings, so better structure will help more than chasing one more idea.";
    }

    if (questionId === "risk" && profile.intentGap === "knowledge-gap" && profile.potentialBand) {
      return `This fits because your hesitation may be partly a knowledge gap, while your potential fit could still move toward ${profile.potentialBand}.`;
    }

    if ((questionId === "emergency" || questionId === "debt") && answers.emergencyMonths < 3) {
      return "This fits because a thinner cash buffer makes every investing decision feel heavier than it needs to.";
    }

    if (questionId === "sip" && answers.monthlyInvestment > 0) {
      return "This fits because you already have a monthly investing habit, so the next gain is improving consistency rather than starting from zero.";
    }

    if (questionId === "first-investment" && answers.experience === "new") {
      return "This fits because a simpler starter route usually creates more confidence than trying to design the perfect portfolio too early.";
    }

    return "This fits because the best next move right now is to make one calmer decision, not to absorb more theory than you can use.";
  })();

  const nextMove = (() => {
    switch (questionId) {
      case "allocation":
        return "Check whether each holding has a clear role and whether any single position is carrying too much emotional weight.";
      case "emergency":
        return "Set one fixed monthly contribution for the emergency bucket before increasing investing risk.";
      case "debt":
        return "Choose one explicit split between debt reduction and investing so the month does not get decided ad hoc.";
      case "sip":
        return "Tie the SIP amount to a real goal and confirm that it still works even in a tighter month.";
      case "risk":
        return "Revisit the assessment with your current answers and separate what feels unclear from what truly feels uncomfortable.";
      case "etf":
        return "Decide the product job first, then compare whether an ETF is the easiest way to do that job for you.";
      case "gold":
        return "Decide whether you need a diversifier at all before deciding the size or format of gold exposure.";
      case "tax":
        return "Create one clean place for statements, buy dates, and amounts so future tax decisions are easier.";
      case "crash":
        return "Write down the crash rule you want to follow before markets test your behavior for you.";
      case "first-investment":
      default:
        return "Pick the easiest first route you can repeat for a year, then let tracking and learning refine it later.";
    }
  })();

  return {
    avoidTrap,
    nextMove,
    whyItFits,
  };
}

export function buildMentorConversationSnapshot({
  contextLabel,
  launchSourceLabel,
  messages,
  note,
  questionId,
  status,
}: {
  contextLabel?: string;
  launchSourceLabel?: string;
  messages: StoredMentorChatMessage[];
  note?: string;
  questionId: MentorQuestionId;
  status?: string;
}): MentorConversationSnapshot {
  const questionTitle =
    mentorQuestions.find((question) => question.id === questionId)?.title ??
    "Mentor topic";
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  const stageLabel = (() => {
    if (lastAssistantMessage?.source === "ai") return "AI guidance active";
    if (lastAssistantMessage) return "Coach response ready";
    if (lastUserMessage) return "Question drafted";
    if (launchSourceLabel) return "Context captured";
    return "Fresh thread";
  })();

  const latestTakeaway =
    lastAssistantMessage?.content
      ?.split("\n")
      .find((line) => line.trim().length > 0)
      ?.trim() ??
    status?.trim() ??
    "Start with one concrete doubt and the mentor will turn it into a calmer next move.";

  const decisionFocus =
    contextLabel?.trim() ||
    note?.trim() ||
    lastUserMessage?.content
      ?.split("\n")
      .find((line) => line.trim().length > 0)
      ?.trim() ||
    `Clarify the current ${questionTitle.toLowerCase()} decision without opening three new ones.`;

  const nextStep =
    lastAssistantMessage?.actionLabel?.trim() ||
    (launchSourceLabel
      ? `Return to ${launchSourceLabel} once this answer feels clear enough to act on.`
      : `Use the next mentor answer to make one practical ${questionTitle.toLowerCase()} move.`);

  return {
    decisionFocus,
    latestTakeaway,
    nextStep,
    stageLabel,
  };
}

export function buildMentorComposerGuidance({
  answers,
  launchSourceLabel,
  questionId,
}: {
  answers: RiskAnswers;
  launchSourceLabel?: string;
  questionId: MentorQuestionId;
}): MentorComposerGuidance {
  const normalizedSource = launchSourceLabel?.trim().toLowerCase() ?? "";

  if (normalizedSource.includes("onboarding")) {
    return {
      helperLabel: "Best when the assessment feels unclear",
      placeholder:
        "Ask what one answer matters most, whether this is a knowledge gap or a real risk mismatch, or what to confirm before you submit.",
      prompts: [
        "Which answer here matters most for my starting plan?",
        "Does this look like lack of knowledge or a real risk mismatch?",
        "What should I confirm before I submit this assessment?",
      ],
    };
  }

  if (normalizedSource.includes("portfolio import review")) {
    return {
      helperLabel: "Best when an import review feels shaky",
      placeholder:
        "Ask what looks safe to trust, what needs manual verification, or what would make this import reliable enough to merge.",
      prompts: [
        "What in this import looks safe to trust right away?",
        "Which warning here needs a manual check before I import?",
        "What should I verify before I merge this into my portfolio?",
      ],
    };
  }

  if (normalizedSource.includes("portfolio")) {
    return {
      helperLabel: "Best when portfolio setup feels noisy",
      placeholder:
        "Ask what deserves attention first in your portfolio, whether allocation or cleanup matters more now, or what one change reduces confusion fastest.",
      prompts: [
        "What part of this portfolio setup matters most right now?",
        "Should I improve coverage first or clean up allocation first?",
        "What is the next portfolio action that would reduce confusion fastest?",
      ],
    };
  }

  if (normalizedSource.includes("goals")) {
    return {
      helperLabel: "Best when the plan feels stretched",
      placeholder:
        "Ask which goal to fund first, what looks unrealistic in the monthly split, or how to simplify the plan without dropping momentum.",
      prompts: [
        "Which goal should I fund first and why?",
        "What looks unrealistic in this goal plan right now?",
        "How do I know if my monthly split is too stretched?",
      ],
    };
  }

  if (normalizedSource.includes("academy")) {
    return {
      helperLabel: "Best when product roles are getting mixed up",
      placeholder:
        "Ask which category better fits your goal, what confusion to clear up first, or what role you might be mixing together.",
      prompts: [
        "Which category better fits my current goal and experience?",
        "What confusion should I clear up before I compare these options?",
        "What product role am I mixing up here?",
      ],
    };
  }

  if (normalizedSource.includes("dashboard")) {
    return {
      helperLabel: "Best when the dashboard feels broad",
      placeholder:
        "Ask what deserves attention first today, which page to go back to, or what single move improves the plan most right now.",
      prompts: [
        "What deserves my attention first today?",
        "Which page should I go back to after this chat?",
        "What single move would improve my plan the most right now?",
      ],
    };
  }

  const genericPlaceholder = (() => {
    switch (questionId) {
      case "allocation":
        return "Ask whether your portfolio mix is sensible, what looks concentrated, or what to review before adding another holding.";
      case "risk":
        return "Ask why this risk score fits you, whether the gap is knowledge or comfort, or what to revisit in the assessment.";
      case "sip":
        return "Ask whether your SIP is realistic, how it should connect to a goal, or when to increase it safely.";
      case "emergency":
        return "Ask how much emergency money is enough before you invest more aggressively.";
      case "debt":
        return "Ask how to balance debt cleanup with investing without making the month feel chaotic.";
      case "etf":
        return "Ask what job an ETF should play before deciding whether it belongs in your plan.";
      case "gold":
        return "Ask whether gold solves a real need in your portfolio or just sounds safe.";
      case "tax":
        return "Ask what simple tax records to keep now so this stays easy later.";
      case "crash":
        return "Ask what rule you want to follow in a market drop before emotions take over.";
      case "first-investment":
      default:
        return answers.experience === "new"
          ? "Ask the simplest first question that will help you start investing without overcomplicating the plan."
          : "Ask one practical next-step question so your plan gets clearer, not busier.";
    }
  })();

  return {
    helperLabel: "Best when you ask one concrete question",
    placeholder: genericPlaceholder,
    prompts: [],
  };
}

const mentorQuestionKeywordMap: Array<{
  id: MentorQuestionId;
  keywords: string[];
}> = [
  { id: "emergency", keywords: ["emergency", "buffer", "cash reserve", "reserve fund"] },
  { id: "debt", keywords: ["debt", "loan", "emi", "credit card"] },
  { id: "allocation", keywords: ["allocation", "mix", "portfolio split", "diversification"] },
  { id: "etf", keywords: ["etf", "index fund", "exchange traded"] },
  { id: "sip", keywords: ["sip", "systematic", "monthly invest", "monthly contribution"] },
  { id: "gold", keywords: ["gold", "sovereign gold", "bullion"] },
  { id: "tax", keywords: ["tax", "capital gains", "taxes"] },
  { id: "risk", keywords: ["risk", "volatility", "risk score", "profile"] },
  { id: "crash", keywords: ["crash", "drop", "market fall", "bear market"] },
  { id: "first-investment", keywords: ["start", "first investment", "begin", "where do i start"] },
];

export function inferMentorQuestionIdFromMessage(
  message: string,
  fallbackQuestionId: MentorQuestionId = "first-investment",
): MentorQuestionId {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return fallbackQuestionId;

  for (const entry of mentorQuestionKeywordMap) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
      return entry.id;
    }
  }

  return fallbackQuestionId;
}

export function buildMentorContextSummary({
  activeQuestionId,
  answers,
  assets,
  conversationMode,
  goals,
  launchContextLabel,
  launchSourceLabel,
  profile,
}: MentorChatContext) {
  const trackedValue = assets.reduce((sum, asset) => sum + asset.value, 0);
  const goalSummary = goals.length
    ? goals
        .slice(0, 3)
        .map(
          (goal) =>
            `${goal.name}: target ${formatMoney(goal.targetAmount)}, current ${formatMoney(goal.currentAmount)}, ${goal.years} years, ${goal.priority}`,
        )
        .join(" | ")
    : "No active goals yet";
  const holdingSummary = assets.length
    ? assets
        .slice(0, 5)
        .map((asset) => `${asset.name} (${asset.type}) ${formatMoney(asset.value)}`)
        .join(" | ")
    : "No tracked holdings yet";
  const activeQuestion =
    mentorQuestions.find((question) => question.id === activeQuestionId)?.title ??
    "No current mentor question selected";

  return [
    `Current mentor topic: ${activeQuestion}`,
    `Conversation mode: ${conversationMode ?? "fresh-question"}`,
    `Launch source: ${launchSourceLabel ?? "direct mentor page"}`,
    `Launch context: ${launchContextLabel ?? "no special handoff context"}`,
    `Risk profile: ${profile.band} / ${profile.confidence} / ${profile.personality}`,
    `Potential profile: ${profile.potentialBand ?? "n/a"} / ${profile.potentialScore ?? "n/a"}`,
    `Primary goal: ${answers.primaryGoal}`,
    `Emergency months: ${answers.emergencyMonths}`,
    `Debt level: ${answers.debtLevel}`,
    `Monthly savings: ${formatMoney(answers.monthlySavings)}`,
    `Monthly investment: ${formatMoney(answers.monthlyInvestment)}`,
    `Tracked portfolio value: ${formatMoney(trackedValue)}`,
    `Holdings: ${holdingSummary}`,
    `Goals: ${goalSummary}`,
  ].join("\n");
}

export function buildMentorSystemPrompt(context: MentorChatContext) {
  return `You are WealthCompass AI Mentor, a calm educational investing coach inside a beginner-focused financial app.

You are not a hype-driven stock picker. You explain clearly, personalize carefully, and end with one practical next move.

Rules:
- Keep answers educational and supportive.
- Do not claim guaranteed returns.
- Do not give legal or tax certainty; frame tax topics as general guidance.
- Prefer diversified, beginner-safe explanations over speculative ideas.
- Use the user's actual context below.
- Keep responses concise but useful: short paragraphs plus a tiny action list when appropriate.
- If conversation mode is "resume-mode", continue the thread like an ongoing coaching conversation instead of answering like this is the first time.
- If conversation mode is "guided-start", briefly anchor the reply to the launch source before giving guidance.
- If conversation mode is "live-thread", avoid restarting from basics unless the user's latest question truly changes direction.

User context:
${buildMentorContextSummary(context)}`;
}

function buildMentorConversationLead(context: MentorChatContext) {
  switch (context.conversationMode) {
    case "resume-mode":
      return "We are continuing an earlier mentor thread, so the goal here is to carry the last takeaway forward instead of starting over.";
    case "guided-start":
      return context.launchSourceLabel
        ? `You opened this from ${context.launchSourceLabel}, so I am anchoring the answer to that live decision instead of treating it like a random question.`
        : "This started from another page in the app, so I am treating it like a live decision handoff.";
    case "live-thread":
      return "This is already an active conversation, so I am building on the current thread rather than resetting the explanation.";
    case "fresh-question":
    default:
      return "This is a fresh mentor question, so I am giving you the clearest first explanation and next move.";
  }
}

export function buildMentorFallbackReply({
  context,
  message,
}: {
  context: MentorChatContext;
  message: string;
}): MentorChatFallback {
  const questionId = inferMentorQuestionIdFromMessage(
    message,
    context.activeQuestionId ?? "first-investment",
  );
  const answer = getMentorAnswer({
    answers: context.answers,
    assets: context.assets,
    formatMoney,
    profile: context.profile,
    questionId,
  });
  const actionTarget = getMentorActionTarget(questionId);

  const reply = [
    buildMentorConversationLead(context),
    answer.summary,
    answer.explanation,
    `Why this fits you: ${answer.personalNote}`,
    `Best next move: ${answer.actionTrack.nextMove}`,
    "Decision steps:",
    ...answer.steps.map((step, index) => `${index + 1}. ${step}`),
  ].join("\n\n");

  return {
    actionLabel: actionTarget.label,
    actionView: actionTarget.view,
    note: "Using the built-in mentor coach because live AI is not configured right now.",
    questionId,
    reply,
    suggestedFollowUps: answer.followUps,
  };
}

const mentorConversationStorageKey = "wealthcompass:mentor-conversation:v1";
const mentorInsightsStorageKey = "wealthcompass:mentor-insights:v1";

export function getMentorInsightBucket(questionId: MentorQuestionId): SavedMentorInsight["bucket"] {
  switch (questionId) {
    case "emergency":
    case "debt":
    case "allocation":
    case "sip":
      return "do-now";
    case "etf":
    case "gold":
    case "tax":
      return "learn-next";
    case "risk":
    case "crash":
    case "first-investment":
    default:
      return "review-later";
  }
}

export function loadMentorConversation(): StoredMentorConversation | null {
  if (typeof window === "undefined") return null;

  const rawConversation = window.localStorage.getItem(mentorConversationStorageKey);
  if (!rawConversation) return null;

  try {
    const parsed = JSON.parse(rawConversation) as Partial<StoredMentorConversation>;
    const activeQuestionId = parsed.activeQuestionId;
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    const status = typeof parsed.status === "string" ? parsed.status : "";

    if (!activeQuestionId || !mentorQuestions.some((question) => question.id === activeQuestionId)) {
      return null;
    }

    const normalizeMessages = (candidate: unknown) =>
      (Array.isArray(candidate) ? candidate : [])
        .filter(
          (message): message is StoredMentorChatMessage =>
            Boolean(
              message &&
                typeof message === "object" &&
                typeof message.id === "string" &&
                typeof message.content === "string" &&
                (message.role === "assistant" || message.role === "user"),
            ),
        )
        .map((message) => ({
          actionLabel:
            typeof message.actionLabel === "string" ? message.actionLabel : undefined,
          actionView:
            typeof message.actionView === "string" ? message.actionView : undefined,
          content: message.content,
          id: message.id,
          note: typeof message.note === "string" ? message.note : undefined,
          role: message.role,
          source:
            message.source === "ai" || message.source === "fallback"
              ? message.source
              : undefined,
        }));

    const threads = (() => {
      if (!parsed.threads || typeof parsed.threads !== "object") {
        return {
          [activeQuestionId]: {
            launchContextLabel: undefined,
            launchContextNote: undefined,
            launchReturnState: undefined,
            launchSourceLabel: undefined,
            messages: normalizeMessages(messages),
            note: undefined,
            status,
            updatedAt: undefined,
          },
        } satisfies Partial<Record<MentorQuestionId, StoredMentorThread>>;
      }

      return mentorQuestions.reduce<Partial<Record<MentorQuestionId, StoredMentorThread>>>(
        (collection, question) => {
          const rawThread = parsed.threads?.[question.id];
          if (!rawThread || typeof rawThread !== "object") return collection;

          const threadMessages = normalizeMessages(rawThread.messages);
          const threadStatus =
            typeof rawThread.status === "string" ? rawThread.status : "";
          const threadNote =
            typeof rawThread.note === "string" ? rawThread.note : undefined;
          const threadLaunchContextLabel =
            typeof rawThread.launchContextLabel === "string"
              ? rawThread.launchContextLabel.trim() || undefined
              : undefined;
          const threadLaunchContextNote =
            typeof rawThread.launchContextNote === "string"
              ? rawThread.launchContextNote.trim() || undefined
              : undefined;
          const threadLaunchReturnState =
            rawThread.launchReturnState &&
            typeof rawThread.launchReturnState === "object" &&
            !Array.isArray(rawThread.launchReturnState)
              ? (rawThread.launchReturnState as Record<string, unknown>)
              : undefined;
          const threadLaunchSourceLabel =
            typeof rawThread.launchSourceLabel === "string"
              ? rawThread.launchSourceLabel.trim() || undefined
              : undefined;

          if (
            threadMessages.length === 0 &&
            !threadStatus &&
            !threadNote?.trim() &&
            !threadLaunchContextLabel &&
            !threadLaunchContextNote &&
            !threadLaunchReturnState &&
            !threadLaunchSourceLabel
          ) {
            return collection;
          }

          collection[question.id] = {
            launchContextLabel: threadLaunchContextLabel,
            launchContextNote: threadLaunchContextNote,
            launchReturnState: threadLaunchReturnState,
            launchSourceLabel: threadLaunchSourceLabel,
            messages: threadMessages,
            note: threadNote,
            status: threadStatus,
            updatedAt:
              typeof rawThread.updatedAt === "string" ? rawThread.updatedAt : undefined,
          };
          return collection;
        },
        {},
      );
    })();

    const activeThread = threads[activeQuestionId] ?? {
      launchContextLabel: undefined,
      launchContextNote: undefined,
      launchReturnState: undefined,
      launchSourceLabel: undefined,
      messages: normalizeMessages(messages),
      note: undefined,
      status,
      updatedAt: undefined,
    };

    return {
      activeQuestionId,
      messages: activeThread.messages,
      status: activeThread.status,
      threads,
    };
  } catch {
    return null;
  }
}

export function saveMentorConversation(conversation: StoredMentorConversation) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    mentorConversationStorageKey,
    JSON.stringify(conversation),
  );
}

export function clearMentorConversation() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(mentorConversationStorageKey);
}

export function loadSavedMentorInsights(): SavedMentorInsight[] {
  if (typeof window === "undefined") return [];

  const rawInsights = window.localStorage.getItem(mentorInsightsStorageKey);
  if (!rawInsights) return [];

  try {
    const parsed = JSON.parse(rawInsights) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (insight): insight is SavedMentorInsight =>
          Boolean(
            insight &&
              typeof insight === "object" &&
              typeof insight.id === "string" &&
              typeof insight.content === "string" &&
              typeof insight.title === "string" &&
              typeof insight.createdAt === "string" &&
              typeof insight.questionId === "string" &&
              mentorQuestions.some((question) => question.id === insight.questionId),
          ),
      )
      .map((insight) => ({
        actionLabel:
          typeof insight.actionLabel === "string" ? insight.actionLabel : undefined,
        actionView:
          typeof insight.actionView === "string" ? insight.actionView : undefined,
        bucket:
          insight.bucket === "do-now" ||
          insight.bucket === "learn-next" ||
          insight.bucket === "review-later"
            ? insight.bucket
            : getMentorInsightBucket(insight.questionId),
        completedAt:
          typeof insight.completedAt === "string" ? insight.completedAt : undefined,
        content: insight.content,
        createdAt: insight.createdAt,
        id: insight.id,
        isPinned: Boolean(insight.isPinned),
        questionId: insight.questionId,
        status:
          insight.status === "done" ||
          insight.status === "not-now" ||
          insight.status === "stuck" ||
          insight.status === "active"
            ? insight.status
            : insight.completedAt
              ? "done"
              : "active",
        title: insight.title,
      }));
  } catch {
    return [];
  }
}

export function saveMentorInsight(insight: SavedMentorInsight) {
  if (typeof window === "undefined") return;

  const nextInsights = [
    insight,
    ...loadSavedMentorInsights().filter((savedInsight) => savedInsight.id !== insight.id),
  ].slice(0, 8);

  window.localStorage.setItem(mentorInsightsStorageKey, JSON.stringify(nextInsights));
}

export function pinMentorInsight(insightId: string) {
  if (typeof window === "undefined") return;

  const nextInsights = loadSavedMentorInsights().map((savedInsight) => ({
    ...savedInsight,
    completedAt: savedInsight.id === insightId ? undefined : savedInsight.completedAt,
    isPinned: savedInsight.id === insightId,
    status: savedInsight.id === insightId ? "active" : savedInsight.status,
  }));

  window.localStorage.setItem(mentorInsightsStorageKey, JSON.stringify(nextInsights));
}

export function completeMentorInsight(insightId: string) {
  if (typeof window === "undefined") return;

  const nextInsights = loadSavedMentorInsights().map((savedInsight) =>
    savedInsight.id === insightId
      ? {
          ...savedInsight,
          completedAt: new Date().toISOString(),
          isPinned: false,
          status: "done",
        }
      : savedInsight,
  );

  window.localStorage.setItem(mentorInsightsStorageKey, JSON.stringify(nextInsights));
}

export function updateMentorInsightStatus(
  insightId: string,
  status: "active" | "done" | "not-now" | "stuck",
) {
  if (typeof window === "undefined") return;

  const nextInsights = loadSavedMentorInsights().map((savedInsight) => {
    if (savedInsight.id !== insightId) return savedInsight;

    return {
      ...savedInsight,
      completedAt: status === "done" ? new Date().toISOString() : undefined,
      isPinned: status === "active",
      status,
    };
  });

  window.localStorage.setItem(mentorInsightsStorageKey, JSON.stringify(nextInsights));
}

export function removeMentorInsight(insightId: string) {
  if (typeof window === "undefined") return;

  const nextInsights = loadSavedMentorInsights().filter(
    (savedInsight) => savedInsight.id !== insightId,
  );
  window.localStorage.setItem(mentorInsightsStorageKey, JSON.stringify(nextInsights));
}
