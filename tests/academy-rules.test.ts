import test from "node:test";
import assert from "node:assert/strict";
import {
  academyUseCases,
  buildComparisonSummary,
  getAcademyComparisonOptions,
  normalizeComparisonSelection,
} from "../lib/academy-rules";

test("academy comparison options exclude the category already selected on the other side", () => {
  const options = getAcademyComparisonOptions("index-funds");

  assert.equal(options.some((option) => option.id === "index-funds"), false);
  assert.equal(options.some((option) => option.id === "etfs"), true);
});

test("normalizeComparisonSelection resolves duplicate picks into two distinct categories", () => {
  const selection = normalizeComparisonSelection("index-funds", "index-funds");

  assert.equal(selection.leftCategory.id, "index-funds");
  assert.notEqual(selection.rightCategory.id, "index-funds");
});

test("buildComparisonSummary favors the more liquid option when roles differ", () => {
  const { leftCategory, rightCategory } = normalizeComparisonSelection("gold", "savings-account");
  const summary = buildComparisonSummary(leftCategory, rightCategory);

  assert.equal(summary.defaultPick, "Savings Account");
  assert.match(summary.recommendation, /liquidity and access matter more/i);
});

test("academy use cases include a broad emergency and short-term shortlist", () => {
  const useCase = academyUseCases.find((item) => item.id === "emergency-and-short-term");

  assert.ok(useCase);
  assert.deepEqual(useCase.categoryIds.slice(0, 3), [
    "savings-account",
    "liquid-funds",
    "overnight-funds",
  ]);
});
