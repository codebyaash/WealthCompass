import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePortfolioCsv, portfolioAssetsToCsv } from "../lib/csv-import";

describe("parsePortfolioCsv", () => {
  it("imports holdings with supported header aliases", () => {
    const result = parsePortfolioCsv(`holding,category,market value,return%
Index Core,Index Fund,150000,12
Liquid Reserve,Debt,50000,4`);

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.assets, [
      {
        gain: 12,
        name: "Index Core",
        type: "Index Fund",
        value: 150000,
      },
      {
        gain: 4,
        name: "Liquid Reserve",
        type: "Debt",
        value: 50000,
      },
    ]);
  });

  it("reports invalid rows without rejecting valid holdings", () => {
    const result = parsePortfolioCsv(`name,type,value,gain
Valid Holding,Gold,42000,5
Missing Value,Debt,,3`);

    assert.equal(result.assets.length, 1);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Line 3/);
  });
});

describe("portfolioAssetsToCsv", () => {
  it("escapes commas and quotes in exported values", () => {
    const csv = portfolioAssetsToCsv([
      {
        gain: 9,
        name: 'Core "Index", Fund',
        type: "Index Fund",
        value: 250000,
      },
    ]);

    assert.equal(csv, 'name,type,value,gain\n"Core ""Index"", Fund",Index Fund,250000,9');
  });
});
