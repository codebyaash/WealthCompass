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

  it("imports Paytm Money style mutual fund exports without a type column", () => {
    const result = parsePortfolioCsv(`Scheme Name,Invested Amount,Current Value,Returns %
Axis Bluechip Fund Direct Growth,Rs. 50,000,Rs. 57,500,15%
Total,Rs. 50,000,Rs. 57,500,15%`);

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.assets, [
      {
        gain: 15,
        name: "Axis Bluechip Fund Direct Growth",
        type: "Mutual Fund",
        value: 57500,
      },
    ]);
  });

  it("imports Jupiter style tab-separated holdings and computes value from units and nav", () => {
    const result = parsePortfolioCsv(`Fund Name\tAsset Class\tUnits\tCurrent NAV\tInvested Value
Parag Parikh Flexi Cap Fund\tEquity Mutual Fund\t100.5\t625.50\t50000`);

    assert.equal(result.errors.length, 0);
    assert.equal(result.assets.length, 1);
    assert.equal(result.assets[0].name, "Parag Parikh Flexi Cap Fund");
    assert.equal(result.assets[0].type, "Equity Mutual Fund");
    assert.equal(result.assets[0].value, 62862.75);
    assert.equal(Math.round(result.assets[0].gain), 26);
  });

  it("imports stock broker style security exports with market value aliases", () => {
    const result = parsePortfolioCsv(`Security Name,Segment,Market Value,P&L %
RELIANCE INDUSTRIES,EQUITY,"₹2,42,000.50",(3.5%)`);

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.assets, [
      {
        gain: -3.5,
        name: "RELIANCE INDUSTRIES",
        type: "EQUITY",
        value: 242000.5,
      },
    ]);
  });

  it("imports labelled email statement text", () => {
    const result = parsePortfolioCsv(`Your portfolio statement is ready.

Scheme Name: Axis Bluechip Fund Direct Growth
Asset Class: Mutual Fund
Invested Amount: Rs. 50,000
Current Value: Rs. 57,500
Returns %: 15%

Scheme Name: Nippon India Gold ETF
Current Value: Rs. 21,250
Returns %: 6.25%`);

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.assets, [
      {
        gain: 15,
        name: "Axis Bluechip Fund Direct Growth",
        type: "Mutual Fund",
        value: 57500,
      },
      {
        gain: 6.25,
        name: "Nippon India Gold ETF",
        type: "ETF",
        value: 21250,
      },
    ]);
  });

  it("imports HTML email statement tables", () => {
    const result = parsePortfolioCsv(`<table>
<tr><th>Fund Name</th><th>Asset Class</th><th>Current Value</th><th>XIRR %</th></tr>
<tr><td>ICICI Prudential Liquid Fund</td><td>Debt</td><td>&#8377;75,000</td><td>4.2%</td></tr>
</table>`);

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.assets, [
      {
        gain: 4.2,
        name: "ICICI Prudential Liquid Fund",
        type: "Debt",
        value: 75000,
      },
    ]);
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
