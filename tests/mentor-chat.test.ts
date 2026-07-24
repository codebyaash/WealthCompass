import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  buildMentorComposerGuidance,
  buildMentorComposerMode,
  buildMentorConversationSnapshot,
  buildMentorFollowUpPrompts,
  buildMentorRecommendedActions,
  buildMentorResumePrompts,
  buildMentorFallbackReply,
  buildMentorContextSummary,
  buildMentorSystemPrompt,
  buildMentorReplyGuide,
  clearMentorConversation,
  completeMentorInsight,
  getMentorActionTarget,
  getMentorLaunchFollowThrough,
  getMentorInsightBucket,
  getMentorInsightRecovery,
  getMentorInsightWhyNow,
  inferMentorQuestionIdFromMessage,
  loadSavedMentorInsights,
  loadMentorConversation,
  pinMentorInsight,
  removeMentorInsight,
  saveMentorInsight,
  saveMentorConversation,
  updateMentorInsightStatus,
} from "../lib/mentor-chat";
import { calculateRiskProfile, type RiskAnswers } from "../lib/wealth-rules";

const answers: RiskAnswers = {
  age: 29,
  annualIncome: 120000,
  country: "India",
  decisionStyle: "guided",
  debtLevel: "manageable",
  dependents: 0,
  emergencyMonths: 3,
  experience: "new",
  horizonYears: 10,
  incomeStability: "steady",
  liquidityNeeds: "medium",
  marketDropResponse: "wait",
  monthlyInvestment: 12000,
  monthlySavings: 30000,
  postLearningDropResponse: "buy",
  primaryGoal: "wealth",
  taxAwareness: "medium",
  timeAvailable: "medium",
};

const profile = calculateRiskProfile(answers);

const originalWindow = globalThis.window;

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key) ?? null : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

afterEach(() => {
  if (originalWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
  } else {
    globalThis.window = originalWindow;
  }
});

describe("inferMentorQuestionIdFromMessage", () => {
  it("maps keyword-heavy prompts to the right mentor topic", () => {
    assert.equal(
      inferMentorQuestionIdFromMessage("Should I clear debt before investing more?"),
      "debt",
    );
    assert.equal(
      inferMentorQuestionIdFromMessage("Is my allocation too concentrated right now?"),
      "allocation",
    );
  });
});

describe("buildMentorContextSummary", () => {
  it("includes goals and holdings in the context block", () => {
    const summary = buildMentorContextSummary({
      activeQuestionId: "sip",
      answers,
      assets: [
        {
          gain: 12,
          investedValue: 100000,
          name: "Index Core",
          price: 250,
          quantity: 448,
          source: "Manual",
          type: "Index Fund",
          value: 112000,
        },
      ],
      conversationMode: "guided-start",
      goals: [
        {
          annualReturn: 10,
          currentAmount: 150000,
          id: "goal-1",
          name: "Financial freedom",
          priority: "important",
          targetAmount: 3000000,
          years: 12,
        },
      ],
      launchContextLabel: "Review this goal-linked SIP decision",
      launchSourceLabel: "Goals prioritization",
      profile,
    });

    assert.match(summary, /Current mentor topic: SIP discipline/);
    assert.match(summary, /Conversation mode: guided-start/);
    assert.match(summary, /Launch source: Goals prioritization/);
    assert.match(summary, /Holdings: Index Core/);
    assert.match(summary, /Goals: Financial freedom/);
  });
});

describe("buildMentorFallbackReply", () => {
  it("builds a personalized fallback answer with next steps", () => {
    const reply = buildMentorFallbackReply({
      context: {
        activeQuestionId: "emergency",
        answers,
        assets: [],
        conversationMode: "fresh-question",
        goals: [],
        profile,
      },
      message: "Should I focus on emergency money before increasing my SIP?",
    });

    assert.equal(reply.questionId, "emergency");
    assert.match(reply.reply, /Emergency money protects your investment plan/);
    assert.match(reply.reply, /Best next move:/);
    assert.match(reply.reply, /Decision steps:/);
    assert.equal(reply.suggestedFollowUps[0], "debt");
  });

  it("sounds like a continuation when the mentor is resuming a thread", () => {
    const reply = buildMentorFallbackReply({
      context: {
        activeQuestionId: "allocation",
        answers,
        assets: [],
        conversationMode: "resume-mode",
        goals: [],
        launchSourceLabel: "Portfolio import review",
        profile,
      },
      message: "Help me continue this takeaway before I import anything.",
    });

    assert.match(reply.reply, /continuing an earlier mentor thread/i);
  });
});

describe("buildMentorSystemPrompt", () => {
  it("teaches the live AI to treat resume mode like an ongoing conversation", () => {
    const prompt = buildMentorSystemPrompt({
      activeQuestionId: "risk",
      answers,
      assets: [],
      conversationMode: "resume-mode",
      goals: [],
      launchContextLabel: "Continue this risk-fit decision",
      launchSourceLabel: "Onboarding assessment",
      profile,
    });

    assert.match(prompt, /If conversation mode is "resume-mode"/);
    assert.match(prompt, /Conversation mode: resume-mode/);
    assert.match(prompt, /Launch source: Onboarding assessment/);
  });
});

describe("buildMentorRecommendedActions", () => {
  it("prefers returning to the launch workflow when the mentor opened from a specific page", () => {
    const actions = buildMentorRecommendedActions({
      answers,
      assets: [],
      contextLabel: "Assessment follow-up",
      goals: [],
      profile,
      questionId: "risk",
      sourceLabel: "Onboarding assessment",
    });

    assert.equal(actions[0]?.label, "Return to onboarding assessment");
    assert.equal(actions[0]?.view, "onboarding");
    assert.match(actions[0]?.description ?? "", /answer with more confidence/i);
  });

  it("adds a knowledge-gap recheck when potential risk is higher than current behavior", () => {
    const actions = buildMentorRecommendedActions({
      answers,
      assets: [],
      goals: [],
      profile,
      questionId: "etf",
      sourceLabel: "Academy category fit",
    });

    assert.ok(actions.some((action) => action.label === "Revisit risk fit"));
  });

  it("surfaces a portfolio allocation review when tracked holdings are narrow", () => {
    const actions = buildMentorRecommendedActions({
      answers,
      assets: [
        {
          gain: 0,
          investedValue: 1000,
          name: "Single Fund",
          price: 100,
          quantity: 10,
          source: "Manual",
          type: "Equity",
          value: 1000,
        },
      ],
      goals: [],
      profile,
      questionId: "gold",
    });

    assert.ok(actions.some((action) => action.label === "Review allocation mix"));
  });
});

describe("buildMentorFollowUpPrompts", () => {
  it("builds concrete next-question prompts from follow-up topics", () => {
    const prompts = buildMentorFollowUpPrompts({
      activeQuestionId: "risk",
      followUpQuestionIds: ["risk", "allocation", "sip"],
      launchSourceLabel: "Onboarding assessment",
    });

    assert.equal(prompts.length, 3);
    assert.match(prompts[0]?.prompt ?? "", /Stay with your risk profile/i);
    assert.match(prompts[0]?.prompt ?? "", /Onboarding assessment/);
    assert.match(prompts[1]?.prompt ?? "", /allocation/i);
  });

  it("skips unknown duplicates and keeps the prompt list short", () => {
    const prompts = buildMentorFollowUpPrompts({
      activeQuestionId: "allocation",
      followUpQuestionIds: ["allocation", "allocation", "tax", "gold"],
    });

    assert.equal(prompts.length, 3);
    assert.equal(new Set(prompts.map((item) => item.prompt)).size, prompts.length);
  });
});

describe("buildMentorReplyGuide", () => {
  it("explains knowledge-gap risk posture in the why-it-fits section", () => {
    const guide = buildMentorReplyGuide({
      answers,
      assets: [],
      profile,
      questionId: "risk",
    });

    assert.match(guide.whyItFits, /knowledge gap/i);
    assert.match(guide.nextMove, /revisit the assessment/i);
  });

  it("uses portfolio-aware language for allocation topics", () => {
    const guide = buildMentorReplyGuide({
      answers,
      assets: [
        {
          gain: 50,
          investedValue: 1000,
          name: "Core Equity Fund",
          price: 150,
          quantity: 10,
          source: "Manual",
          type: "Equity",
          value: 1500,
        },
      ],
      profile,
      questionId: "allocation",
    });

    assert.match(guide.whyItFits, /tracked holdings/i);
    assert.match(guide.avoidTrap, /recent winners/i);
  });
});

describe("buildMentorConversationSnapshot", () => {
  it("summarizes a fresh launched thread before any assistant reply", () => {
    const snapshot = buildMentorConversationSnapshot({
      contextLabel: "Review my onboarding answers before submitting",
      launchSourceLabel: "Onboarding assessment",
      messages: [],
      questionId: "risk",
      status: "Ask anything about your plan, risk, allocation, SIP discipline, or goal funding.",
    });

    assert.equal(snapshot.stageLabel, "Context captured");
    assert.match(snapshot.decisionFocus, /onboarding answers/i);
    assert.match(snapshot.nextStep, /Return to Onboarding assessment/i);
  });

  it("uses the latest assistant reply once the coach has answered", () => {
    const snapshot = buildMentorConversationSnapshot({
      launchSourceLabel: "Portfolio import review",
      messages: [
        {
          content: "Should I trust this import preview?",
          id: "user-1",
          role: "user",
        },
        {
          actionLabel: "Return to portfolio import review",
          actionView: "portfolio",
          content: "Start by checking whether the provider fit is strong enough before you merge anything.",
          id: "assistant-2",
          role: "assistant",
          source: "fallback",
        },
      ],
      note: "Double-check the warning before import.",
      questionId: "allocation",
      status: "Using the built-in mentor coach for this conversation.",
    });

    assert.equal(snapshot.stageLabel, "Coach response ready");
    assert.match(snapshot.latestTakeaway, /provider fit is strong enough/i);
    assert.equal(snapshot.nextStep, "Return to portfolio import review");
  });
});

describe("buildMentorComposerGuidance", () => {
  it("returns onboarding-specific composer help when launched from onboarding", () => {
    const guidance = buildMentorComposerGuidance({
      answers,
      launchSourceLabel: "Onboarding assessment",
      questionId: "risk",
    });

    assert.match(guidance.helperLabel, /assessment feels unclear/i);
    assert.match(guidance.placeholder, /submit/i);
    assert.equal(guidance.prompts.length, 3);
  });

  it("falls back to a topic-aware generic placeholder when there is no launch source", () => {
    const guidance = buildMentorComposerGuidance({
      answers,
      questionId: "allocation",
    });

    assert.match(guidance.helperLabel, /one concrete question/i);
    assert.match(guidance.placeholder, /portfolio mix is sensible/i);
    assert.equal(guidance.prompts.length, 0);
  });
});

describe("buildMentorResumePrompts", () => {
  it("builds follow-up prompts from unresolved insights on the same topic", () => {
    const prompts = buildMentorResumePrompts({
      questionId: "risk",
      savedInsights: [
        {
          bucket: "review-later",
          content: "Your hesitation may be more about clarity than true discomfort.",
          createdAt: "2026-07-22T10:00:00.000Z",
          id: "insight-1",
          questionId: "risk",
          status: "active",
          title: "Your risk profile",
        },
      ],
    });

    assert.equal(prompts.length >= 2, true);
    assert.match(prompts[0] ?? "", /continue this takeaway/i);
    assert.match(prompts[1] ?? "", /one small action this week/i);
  });

  it("prefers a stuck insight and uses unblock language", () => {
    const prompts = buildMentorResumePrompts({
      questionId: "allocation",
      savedInsights: [
        {
          actionLabel: "Open portfolio",
          actionView: "portfolio",
          bucket: "do-now",
          content: "One holding is carrying too much emotional weight.",
          createdAt: "2026-07-22T10:00:00.000Z",
          id: "insight-2",
          questionId: "allocation",
          status: "stuck",
          title: "Allocation check",
        },
      ],
    });

    assert.match(prompts[1] ?? "", /still feel stuck/i);
    assert.match(prompts[2] ?? "", /before i open portfolio/i);
  });
});

describe("buildMentorComposerMode", () => {
  it("prefers resume mode when there are open resume prompts", () => {
    const mode = buildMentorComposerMode({
      hasDraftedMessages: true,
      hasResumePrompts: true,
      launchSourceLabel: "Goals prioritization",
    });

    assert.equal(mode.tone, "resume");
    assert.equal(mode.badgeLabel, "Resume mode");
    assert.match(mode.description, /open mentor thread/i);
  });

  it("uses guided-start mode when launched from another page with no existing thread", () => {
    const mode = buildMentorComposerMode({
      hasDraftedMessages: false,
      hasResumePrompts: false,
      launchSourceLabel: "Onboarding assessment",
    });

    assert.equal(mode.tone, "fresh");
    assert.equal(mode.badgeLabel, "Guided start");
    assert.match(mode.title, /handoff context/i);
  });
});

describe("getMentorActionTarget", () => {
  it("routes mentor topics back into the most useful workspace", () => {
    assert.deepEqual(getMentorActionTarget("allocation"), {
      label: "Open portfolio",
      view: "portfolio",
    });
    assert.deepEqual(getMentorActionTarget("emergency"), {
      label: "Open onboarding",
      view: "onboarding",
    });
    assert.deepEqual(getMentorActionTarget("sip"), {
      label: "Open goals",
      view: "goals",
    });
  });
});

describe("getMentorLaunchFollowThrough", () => {
  it("prefers the source page when the mentor was opened from a specific workflow", () => {
    assert.deepEqual(
      getMentorLaunchFollowThrough({
        questionId: "allocation",
        sourceLabel: "Portfolio import review",
      }),
      {
        focusTarget: "import-review",
        label: "Return to portfolio import review",
        reason:
          "Check the live portfolio or import lane now, while the reliability or allocation call is still concrete.",
        view: "portfolio",
      },
    );
  });

  it("falls back to the topic action target when no specific source page is available", () => {
    assert.deepEqual(
      getMentorLaunchFollowThrough({
        contextLabel: "Blocked on risk fit",
        questionId: "risk",
      }),
      {
        label: "Return to the blocked decision",
        reason:
          "Go back to the decision that felt stuck and test whether the next step is finally simple enough to act on.",
        view: "onboarding",
      },
    );
  });

  it("maps onboarding assessment launches back to the submit step", () => {
    assert.deepEqual(
      getMentorLaunchFollowThrough({
        questionId: "risk",
        sourceLabel: "Onboarding assessment",
      }),
      {
        focusTarget: "plan",
        label: "Return to onboarding assessment",
        reason:
          "Go back while the question is still fresh so you can answer with more confidence instead of guessing.",
        view: "onboarding",
      },
    );
  });

  it("maps goals prioritization launches back to the goal priorities section", () => {
    assert.deepEqual(
      getMentorLaunchFollowThrough({
        questionId: "sip",
        sourceLabel: "Goals prioritization",
      }),
      {
        focusTarget: "goal-priorities",
        label: "Return to goal priorities",
        reason:
          "Use the mentor answer to tighten one funding decision before the goal list turns abstract again.",
        view: "goals",
      },
    );
  });

  it("maps academy category-fit launches back to the comparator", () => {
    assert.deepEqual(
      getMentorLaunchFollowThrough({
        questionId: "etf",
        sourceLabel: "Academy category fit",
      }),
      {
        focusTarget: "comparator",
        label: "Return to category comparison",
        reason:
          "Take the clearer product-role answer back into the learning desk before the category choice gets fuzzy again.",
        view: "academy",
      },
    );
  });
});

describe("loadMentorConversation", () => {
  it("restores saved launch return state for the active thread", () => {
    const localStorage = createLocalStorageMock();
    globalThis.window = {
      localStorage,
    } as typeof window;

    localStorage.setItem(
      "wealthcompass:mentor-conversation:v1",
      JSON.stringify({
        activeQuestionId: "allocation",
        messages: [],
        status: "",
        threads: {
          allocation: {
            launchContextLabel: "Portfolio import review",
            launchReturnState: {
              csvText: "scheme,value\nNifty 50,10000",
              uploadedFileLabel: "statement.csv",
            },
            launchSourceLabel: "Portfolio import review",
            messages: [
              {
                content: "Use the import preview to confirm duplicate handling.",
                id: "msg-1",
                role: "assistant",
              },
            ],
            status: "ready",
          },
        },
      }),
    );

    const conversation = loadMentorConversation();

    assert.deepEqual(conversation?.threads?.allocation?.launchReturnState, {
      csvText: "scheme,value\nNifty 50,10000",
      uploadedFileLabel: "statement.csv",
    });
    assert.equal(conversation?.status, "ready");
    assert.equal(conversation?.messages[0]?.content, "Use the import preview to confirm duplicate handling.");
  });
});

describe("getMentorInsightBucket", () => {
  it("categorizes mentor takeaways into action buckets", () => {
    assert.equal(getMentorInsightBucket("allocation"), "do-now");
    assert.equal(getMentorInsightBucket("tax"), "learn-next");
    assert.equal(getMentorInsightBucket("risk"), "review-later");
  });
});

describe("getMentorInsightWhyNow", () => {
  it("explains why a saved mentor focus deserves attention now", () => {
    assert.match(
      getMentorInsightWhyNow({
        answers,
        profile,
        questionId: "emergency",
      }),
      /forced bad decisions|protection habit/,
    );
    assert.match(
      getMentorInsightWhyNow({
        answers,
        profile,
        questionId: "allocation",
      }),
      /balance and fit|intentional/,
    );
  });
});

describe("getMentorInsightRecovery", () => {
  it("returns a practical unblock move for a stuck mentor focus", () => {
    assert.match(
      getMentorInsightRecovery({
        answers,
        profile,
        questionId: "allocation",
      }).detail,
      /too much weight|whole portfolio/,
    );
    assert.match(
      getMentorInsightRecovery({
        answers,
        profile,
        questionId: "sip",
      }).detail,
      /12 months|smallest amount|consistency/,
    );
  });
});

describe("mentor conversation storage", () => {
  it("saves, loads, and clears the mentor thread", () => {
    const localStorage = createLocalStorageMock() as Storage;
    (globalThis as { window?: unknown }).window = {
      localStorage,
    };

    saveMentorConversation({
      activeQuestionId: "allocation",
      messages: [
        {
          content: "Should I rebalance now?",
          id: "user-1",
          role: "user",
        },
        {
          actionLabel: "Open portfolio",
          actionView: "portfolio",
          content: "Start by checking your current mix against your target.",
          id: "assistant-2",
          note: "Loaded from storage test.",
          role: "assistant",
          source: "fallback",
        },
      ],
      status: "Saved mentor thread",
    });

    assert.deepEqual(loadMentorConversation(), {
      activeQuestionId: "allocation",
      messages: [
        {
          actionLabel: undefined,
          actionView: undefined,
          content: "Should I rebalance now?",
          id: "user-1",
          note: undefined,
          role: "user",
          source: undefined,
        },
        {
          actionLabel: "Open portfolio",
          actionView: "portfolio",
          content: "Start by checking your current mix against your target.",
          id: "assistant-2",
          note: "Loaded from storage test.",
          role: "assistant",
          source: "fallback",
        },
      ],
      status: "Saved mentor thread",
      threads: {
        allocation: {
          launchContextLabel: undefined,
          launchContextNote: undefined,
          launchReturnState: undefined,
          launchSourceLabel: undefined,
          messages: [
            {
              actionLabel: undefined,
              actionView: undefined,
              content: "Should I rebalance now?",
              id: "user-1",
              note: undefined,
              role: "user",
              source: undefined,
            },
            {
              actionLabel: "Open portfolio",
              actionView: "portfolio",
              content: "Start by checking your current mix against your target.",
              id: "assistant-2",
              note: "Loaded from storage test.",
              role: "assistant",
              source: "fallback",
            },
          ],
          note: undefined,
          status: "Saved mentor thread",
          updatedAt: undefined,
        },
      },
    });

    clearMentorConversation();
    assert.equal(loadMentorConversation(), null);
  });

  it("restores topic-based mentor threads and returns the active one", () => {
    const localStorage = createLocalStorageMock() as Storage;
    (globalThis as { window?: unknown }).window = {
      localStorage,
    };

    saveMentorConversation({
      activeQuestionId: "tax",
      messages: [
        {
          content: "How should I think about taxes before investing more?",
          id: "user-3",
          role: "user",
        },
      ],
      status: "Tax thread active",
      threads: {
        allocation: {
          messages: [
            {
              content: "Does my allocation look too concentrated?",
              id: "user-1",
              role: "user",
            },
          ],
          status: "Allocation thread saved",
          updatedAt: undefined,
        },
        tax: {
          messages: [
            {
              content: "How should I think about taxes before investing more?",
              id: "user-3",
              role: "user",
            },
          ],
          status: "Tax thread active",
          updatedAt: undefined,
        },
      },
    });

    assert.deepEqual(loadMentorConversation(), {
      activeQuestionId: "tax",
      messages: [
        {
          actionLabel: undefined,
          actionView: undefined,
          content: "How should I think about taxes before investing more?",
          id: "user-3",
          note: undefined,
          role: "user",
          source: undefined,
        },
      ],
      status: "Tax thread active",
      threads: {
        allocation: {
          launchContextLabel: undefined,
          launchContextNote: undefined,
          launchReturnState: undefined,
          launchSourceLabel: undefined,
          messages: [
            {
              actionLabel: undefined,
              actionView: undefined,
              content: "Does my allocation look too concentrated?",
              id: "user-1",
              note: undefined,
              role: "user",
              source: undefined,
            },
          ],
          note: undefined,
          status: "Allocation thread saved",
          updatedAt: undefined,
        },
        tax: {
          launchContextLabel: undefined,
          launchContextNote: undefined,
          launchReturnState: undefined,
          launchSourceLabel: undefined,
          messages: [
            {
              actionLabel: undefined,
              actionView: undefined,
              content: "How should I think about taxes before investing more?",
              id: "user-3",
              note: undefined,
              role: "user",
              source: undefined,
            },
          ],
          note: undefined,
          status: "Tax thread active",
          updatedAt: undefined,
        },
      },
    });
  });

  it("restores a saved topic note with the thread", () => {
    const localStorage = createLocalStorageMock() as Storage;
    (globalThis as { window?: unknown }).window = {
      localStorage,
    };

    saveMentorConversation({
      activeQuestionId: "risk",
      messages: [],
      status: "",
      threads: {
        risk: {
          launchContextLabel: undefined,
          launchContextNote: undefined,
          launchReturnState: undefined,
          launchSourceLabel: undefined,
          messages: [],
          note: "I seem cautious now, but that may be mostly knowledge gap.",
          status: "",
          updatedAt: undefined,
        },
      },
    });

    assert.deepEqual(loadMentorConversation(), {
      activeQuestionId: "risk",
      messages: [],
      status: "",
      threads: {
        risk: {
          launchContextLabel: undefined,
          launchContextNote: undefined,
          launchReturnState: undefined,
          launchSourceLabel: undefined,
          messages: [],
          note: "I seem cautious now, but that may be mostly knowledge gap.",
          status: "",
          updatedAt: undefined,
        },
      },
    });
  });

  it("restores a saved launch source label with the thread", () => {
    const localStorage = createLocalStorageMock() as Storage;
    (globalThis as { window?: unknown }).window = {
      localStorage,
    };

    saveMentorConversation({
      activeQuestionId: "allocation",
      messages: [],
      status: "",
      threads: {
        allocation: {
          launchContextLabel: undefined,
          launchContextNote: undefined,
          launchReturnState: undefined,
          launchSourceLabel: "Portfolio import review",
          messages: [],
          note: undefined,
          status: "",
          updatedAt: undefined,
        },
      },
    });

    assert.deepEqual(loadMentorConversation(), {
      activeQuestionId: "allocation",
      messages: [],
      status: "",
      threads: {
        allocation: {
          launchContextLabel: undefined,
          launchContextNote: undefined,
          launchReturnState: undefined,
          launchSourceLabel: "Portfolio import review",
          messages: [],
          note: undefined,
          status: "",
          updatedAt: undefined,
        },
      },
    });
  });

  it("restores saved launch context details with the thread", () => {
    const localStorage = createLocalStorageMock() as Storage;
    (globalThis as { window?: unknown }).window = {
      localStorage,
    };

    saveMentorConversation({
      activeQuestionId: "risk",
      messages: [],
      status: "",
      threads: {
        risk: {
          launchContextLabel: "Ask AI mentor about this assessment",
          launchContextNote:
            "Opened from Onboarding assessment. Carry this page context into the conversation.",
          launchReturnState: undefined,
          launchSourceLabel: "Onboarding assessment",
          messages: [],
          note: undefined,
          status: "",
          updatedAt: undefined,
        },
      },
    });

    assert.deepEqual(loadMentorConversation(), {
      activeQuestionId: "risk",
      messages: [],
      status: "",
      threads: {
        risk: {
          launchContextLabel: "Ask AI mentor about this assessment",
          launchContextNote:
            "Opened from Onboarding assessment. Carry this page context into the conversation.",
          launchReturnState: undefined,
          launchSourceLabel: "Onboarding assessment",
          messages: [],
          note: undefined,
          status: "",
          updatedAt: undefined,
        },
      },
    });
  });
});

describe("mentor insight storage", () => {
  it("saves, loads, and removes saved mentor insights", () => {
    const localStorage = createLocalStorageMock() as Storage;
    (globalThis as { window?: unknown }).window = {
      localStorage,
    };

    saveMentorInsight({
      actionLabel: "Open portfolio",
      actionView: "portfolio",
      bucket: "do-now",
      content: "Check whether your small-cap weight still matches your target mix.",
      createdAt: "2026-07-21T10:00:00.000Z",
      id: "assistant-7",
      questionId: "allocation",
      title: "Does my allocation look too concentrated?",
    });

    assert.deepEqual(loadSavedMentorInsights(), [
      {
        actionLabel: "Open portfolio",
        actionView: "portfolio",
        bucket: "do-now",
        completedAt: undefined,
        content: "Check whether your small-cap weight still matches your target mix.",
        createdAt: "2026-07-21T10:00:00.000Z",
        id: "assistant-7",
        isPinned: false,
        questionId: "allocation",
        status: "active",
        title: "Does my allocation look too concentrated?",
      },
    ]);

    saveMentorInsight({
      actionLabel: "Open academy",
      actionView: "academy",
      bucket: "learn-next",
      content: "Read the tax basics before comparing post-tax returns.",
      createdAt: "2026-07-21T10:10:00.000Z",
      id: "assistant-8",
      questionId: "tax",
      title: "How should I think about tax before investing more?",
    });

    pinMentorInsight("assistant-7");
    assert.equal(
      loadSavedMentorInsights().find((insight) => insight.id === "assistant-7")?.isPinned,
      true,
    );

    completeMentorInsight("assistant-7");
    const completedInsight = loadSavedMentorInsights().find(
      (insight) => insight.id === "assistant-7",
    );
    assert.equal(completedInsight?.isPinned, false);
    assert.equal(completedInsight?.status, "done");
    assert.ok(completedInsight?.completedAt);

    updateMentorInsightStatus("assistant-8", "stuck");
    assert.equal(
      loadSavedMentorInsights().find((insight) => insight.id === "assistant-8")?.status,
      "stuck",
    );

    updateMentorInsightStatus("assistant-8", "not-now");
    assert.equal(
      loadSavedMentorInsights().find((insight) => insight.id === "assistant-8")?.status,
      "not-now",
    );

    updateMentorInsightStatus("assistant-8", "active");
    const activeInsight = loadSavedMentorInsights().find(
      (insight) => insight.id === "assistant-8",
    );
    assert.equal(activeInsight?.isPinned, true);
    assert.equal(activeInsight?.status, "active");
    assert.equal(activeInsight?.completedAt, undefined);

    removeMentorInsight("assistant-7");
    assert.deepEqual(loadSavedMentorInsights(), [
      {
        actionLabel: "Open academy",
        actionView: "academy",
        bucket: "learn-next",
        completedAt: undefined,
        content: "Read the tax basics before comparing post-tax returns.",
        createdAt: "2026-07-21T10:10:00.000Z",
        id: "assistant-8",
        isPinned: true,
        questionId: "tax",
        status: "active",
        title: "How should I think about tax before investing more?",
      },
    ]);
  });
});
