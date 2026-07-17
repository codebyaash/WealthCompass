import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePortfolioCsv, portfolioAssetsToCsv } from "../lib/csv-import";

function importedAsset(overrides: Record<string, unknown>) {
  return {
    gain: 0,
    investedValue: 0,
    price: 0,
    quantity: 0,
    source: "Imported file",
    ...overrides,
  };
}

describe("parsePortfolioCsv", () => {
  it("imports holdings with supported header aliases", () => {
    const result = parsePortfolioCsv(`holding,category,market value,return%
Index Core,Index Fund,150000,12
Liquid Reserve,Debt,50000,4`);

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.assets, [
      importedAsset({
        gain: 12,
        name: "Index Core",
        type: "Index Fund",
        value: 150000,
      }),
      importedAsset({
        gain: 4,
        name: "Liquid Reserve",
        type: "Debt",
        value: 50000,
      }),
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
      importedAsset({
        gain: 15,
        investedValue: 50000,
        name: "Axis Bluechip Fund Direct Growth",
        type: "Mutual Fund",
        value: 57500,
      }),
    ]);
  });

  it("imports Jupiter style tab-separated holdings and computes value from units and nav", () => {
    const result = parsePortfolioCsv(`Fund Name\tAsset Class\tUnits\tCurrent NAV\tInvested Value
Parag Parikh Flexi Cap Fund\tEquity Mutual Fund\t100.5\t625.50\t50000`);

    assert.equal(result.errors.length, 0);
    assert.equal(result.assets.length, 1);
    assert.equal(result.assets[0].name, "Parag Parikh Flexi Cap Fund");
    assert.equal(result.assets[0].type, "Equity Mutual Fund");
    assert.equal(result.assets[0].investedValue, 50000);
    assert.equal(result.assets[0].price, 625.5);
    assert.equal(result.assets[0].quantity, 100.5);
    assert.equal(result.assets[0].value, 62862.75);
    assert.equal(Math.round(result.assets[0].gain), 26);
  });

  it("imports dense Paytm Money statement rows without explicit delimiters", () => {
    const result = parsePortfolioCsv(`Paytm Money portfolio
Scheme Name Current Value Invested Value Units NAV
Axis Bluechip Fund Direct Growth 57500 50000 123.45 465.77
Nippon India Gold ETF 21250 20000 250 85
Total 78750 70000`);

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.assets, [
      importedAsset({
        gain: 15,
        investedValue: 50000,
        name: "Axis Bluechip Fund Direct Growth",
        price: 465.77,
        quantity: 123.45,
        source: "Paytm Money statement",
        type: "Mutual Fund",
        value: 57500,
      }),
      importedAsset({
        gain: 6.25,
        investedValue: 20000,
        name: "Nippon India Gold ETF",
        price: 85,
        quantity: 250,
        source: "Paytm Money statement",
        type: "ETF",
        value: 21250,
      }),
    ]);
  });

  it("imports dense Jupiter statement rows and splits name from asset class", () => {
    const result = parsePortfolioCsv(`Jupiter portfolio snapshot
Fund Name Asset Class Units Current NAV Invested Value Current Value
Parag Parikh Flexi Cap Fund Equity Mutual Fund 100.5 625.5 50000 62862.75
ICICI Prudential Liquid Fund Debt Mutual Fund 300 118 35000 35400`);

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.assets, [
      importedAsset({
        gain: 25.7255,
        investedValue: 50000,
        name: "Parag Parikh Flexi Cap Fund",
        price: 625.5,
        quantity: 100.5,
        source: "Jupiter statement",
        type: "Equity Mutual Fund",
        value: 62862.75,
      }),
      importedAsset({
        gain: 1.1428571428571428,
        investedValue: 35000,
        name: "ICICI Prudential Liquid Fund",
        price: 118,
        quantity: 300,
        source: "Jupiter statement",
        type: "Debt Mutual Fund",
        value: 35400,
      }),
    ]);
  });

  it("imports stock broker style security exports with market value aliases", () => {
    const result = parsePortfolioCsv(`Security Name,Segment,Market Value,P&L %
RELIANCE INDUSTRIES,EQUITY,"₹2,42,000.50",(3.5%)`);

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.assets, [
      importedAsset({
        gain: -3.5,
        name: "RELIANCE INDUSTRIES",
        type: "EQUITY",
        value: 242000.5,
      }),
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
      importedAsset({
        gain: 15,
        investedValue: 50000,
        source: "Imported statement",
        name: "Axis Bluechip Fund Direct Growth",
        type: "Mutual Fund",
        value: 57500,
      }),
      importedAsset({
        gain: 6.25,
        source: "Imported statement",
        name: "Nippon India Gold ETF",
        type: "ETF",
        value: 21250,
      }),
    ]);
  });

  it("imports generic pasted statement rows with numeric tails", () => {
    const result = parsePortfolioCsv(`Portfolio Statement
Axis Bluechip Fund Direct Growth 57500 50000 123.45 465.77
Nippon India Gold ETF 21250 20000 250 85`);

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.assets, [
      importedAsset({
        gain: 15,
        investedValue: 50000,
        name: "Axis Bluechip Fund Direct Growth",
        price: 465.77,
        quantity: 123.45,
        source: "Imported statement",
        type: "Mutual Fund",
        value: 57500,
      }),
      importedAsset({
        gain: 6.25,
        investedValue: 20000,
        name: "Nippon India Gold ETF",
        price: 85,
        quantity: 250,
        source: "Imported statement",
        type: "ETF",
        value: 21250,
      }),
    ]);
  });

  it("imports HTML email statement tables", () => {
    const result = parsePortfolioCsv(`<table>
<tr><th>Fund Name</th><th>Asset Class</th><th>Current Value</th><th>XIRR %</th></tr>
<tr><td>ICICI Prudential Liquid Fund</td><td>Debt</td><td>&#8377;75,000</td><td>4.2%</td></tr>
</table>`);

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.assets, [
      importedAsset({
        gain: 4.2,
        name: "ICICI Prudential Liquid Fund",
        type: "Debt",
        value: 75000,
      }),
    ]);
  });
});

describe("portfolioAssetsToCsv", () => {
  it("escapes commas and quotes in exported values", () => {
    const csv = portfolioAssetsToCsv([
      {
        gain: 9,
        investedValue: 200000,
        name: 'Core "Index", Fund',
        price: 250,
        quantity: 1000,
        source: "Manual",
        type: "Index Fund",
        value: 250000,
      },
    ]);

    assert.equal(
      csv,
      'name,type,value,investedValue,quantity,price,gain,source\n"Core ""Index"", Fund",Index Fund,250000,200000,1000,250,9,Manual',
    );
  });
});
