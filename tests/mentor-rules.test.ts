import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getMentorAnswer,
  getSuggestedMentorQuestions,
  mentorQuestions,
} from "../lib/mentor-rules";
import { calculateRiskProfile, type RiskAnswers } from "../lib/wealth-rules";

const formatMoney = (value: number) => `$${value}`;

const answers: RiskAnswers = {
  age: 32,
  annualIncome: 90000,
  country: "US",
  debtLevel: "manageable",
  emergencyMonths: 4,
  experience: "new",
  horizonYears: 7,
  marketDropResponse: "wait",
  monthlyInvestment: 750,
  monthlySavings: 1800,
  primaryGoal: "home",
  taxAwareness: "medium",
  timeAvailable: "medium",
};

const assets = [
  {
    gain: 15,
    investedValue: 50000,
    name: "Index Core",
    price: 65,
    quantity: 884.62,
    source: "Manual",
    type: "Index Fund",
    value: 57500,
  },
];

describe("mentorQuestions", () => {
  it("keeps the expected starter question set", () => {
    assert.deepEqual(
      mentorQuestions.map((question) => question.id),
      [
        "first-investment",
        "etf",
        "sip",
        "emergency",
        "crash",
        "gold",
        "allocation",
        "debt",
        "tax",
        "risk",
      ],
    );
  });
});

describe("getMentorAnswer", () => {
  it("personalizes emergency guidance with current emergency months and goal", () => {
    const answer = getMentorAnswer({
      answers,
      assets,
      formatMoney,
      profile: calculateRiskProfile(answers),
      questionId: "emergency",
    });

    assert.match(answer.personalNote, /4 months/);
    assert.match(answer.personalNote, /home down payment/);
    assert.equal(answer.focusLabel, "Foundation gap");
    assert.equal(answer.checkpoints[0]?.label, "Current buffer");
  });

  it("uses the provided money formatter for SIP guidance", () => {
    const answer = getMentorAnswer({
      answers,
      assets,
      formatMoney,
      profile: calculateRiskProfile(answers),
      questionId: "sip",
    });

    assert.match(answer.personalNote, /\$750/);
    assert.match(answer.personalNote, /\$57500/);
    assert.equal(answer.followUps[0], "first-investment");
  });

  it("returns allocation guidance when concentration is high", () => {
    const answer = getMentorAnswer({
      answers,
      assets: [
        ...assets,
        {
          gain: 10,
          investedValue: 5000,
          name: "Small satellite",
          price: 50,
          quantity: 110,
          source: "Manual",
          type: "Gold",
          value: 5500,
        },
      ],
      formatMoney,
      profile: calculateRiskProfile(answers),
      questionId: "allocation",
    });

    assert.equal(answer.focusLabel, "Concentration risk");
    assert.equal(answer.followUps[0], "etf");
  });
});

describe("getSuggestedMentorQuestions", () => {
  it("prioritizes starting questions when no portfolio is tracked yet", () => {
    const suggestions = getSuggestedMentorQuestions({
      answers: { ...answers, emergencyMonths: 6 },
      assets: [],
    });

    assert.deepEqual(suggestions, ["first-investment", "sip", "risk"]);
  });

  it("prioritizes emergency and debt when the foundation is weak", () => {
    const stressedAnswers = {
      ...answers,
      debtLevel: "heavy" as const,
      emergencyMonths: 1,
    };
    const suggestions = getSuggestedMentorQuestions({
      answers: stressedAnswers,
      assets,
    });

    assert.deepEqual(suggestions, ["emergency", "debt", "risk"]);
  });
});
