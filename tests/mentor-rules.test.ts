import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMentorAnswer, mentorQuestions } from "../lib/mentor-rules";
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

describe("mentorQuestions", () => {
  it("keeps the expected starter question set", () => {
    assert.deepEqual(
      mentorQuestions.map((question) => question.id),
      ["etf", "sip", "emergency", "crash", "gold", "risk"],
    );
  });
});

describe("getMentorAnswer", () => {
  it("personalizes emergency guidance with current emergency months and goal", () => {
    const answer = getMentorAnswer({
      answers,
      formatMoney,
      profile: calculateRiskProfile(answers),
      questionId: "emergency",
    });

    assert.match(answer.personalNote, /4 months/);
    assert.match(answer.personalNote, /home down payment/);
  });

  it("uses the provided money formatter for SIP guidance", () => {
    const answer = getMentorAnswer({
      answers,
      formatMoney,
      profile: calculateRiskProfile(answers),
      questionId: "sip",
    });

    assert.match(answer.personalNote, /\$750/);
  });
});
