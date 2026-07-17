import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseImportedTransactions } from "../lib/transaction-import";

describe("parseImportedTransactions", () => {
  it("parses Paytm Money transaction summary statements into buy transactions", () => {
    const result = parseImportedTransactions(`Investment Transaction Summary
Date*	Date*	Mutual Fund Scheme Name	Mutual Fund Scheme Name	Folio No	Folio No	Type	Type	Units	Units	NAV	NAV	Amount	Amount	Status	Status
HDFC Large Cap Fund Direct Plan-
03 Jul	Purchase -
Growth	43268646	0.810	₹	1,234.1590	₹	1,000.00	Confirmed
2026	SIP
(Equity - Large Cap)
03 Jul	Edelweiss Mid Cap Direct Plan-Growth	Purchase -
91050161892	3.935	₹	127.0640	₹	500.00	Confirmed
2026	(Equity - Mid Cap)	SIP
*Transactions details shown is as per the units allocation date.`);

    assert.equal(result.errors.length, 0);
    assert.equal(result.transactions.length, 2);
    assert.equal(result.transactions[0].assetName, "HDFC Large Cap Fund Direct Plan-Growth");
    assert.equal(result.transactions[0].action, "buy");
    assert.equal(result.transactions[0].amount, 1000);
    assert.equal(result.transactions[0].quantity, 0.81);
    assert.equal(result.transactions[0].price, 1234.159);
    assert.equal(result.transactions[0].date, "2026-07-03");
    assert.equal(result.transactions[1].assetName, "Edelweiss Mid Cap Direct Plan-Growth");
    assert.equal(result.transactions[1].amount, 500);
  });

  it("parses markdown transaction summary tables copied from statements", () => {
    const result = parseImportedTransactions(`Here is the text copied from the statement:

## Transaction Summary

**Period:** 09-Jun-2026 to 08-Jul-2026

### Investment Activity

* **Fresh Purchase:** ₹3,000.00
* **Withdrawal:** ₹0.00

### Investment Transaction Summary

| Date        | Mutual Fund Scheme Name                                      | Folio No.    | Type           | Units |         NAV |    Amount | Status    |
| ----------- | ------------------------------------------------------------ | ------------ | -------------- | ----: | ----------: | --------: | --------- |
| 03 Jul 2026 | HDFC Large Cap Fund Direct Plan-Growth (Equity - Large Cap)  | 43268646     | Purchase - SIP | 0.810 | ₹1,234.1590 | ₹1,000.00 | Confirmed |
| 03 Jul 2026 | Edelweiss Mid Cap Direct Plan-Growth (Equity - Mid Cap)      | 91050161892  | Purchase - SIP | 3.935 |   ₹127.0640 |   ₹500.00 | Confirmed |
| 03 Jul 2026 | Bandhan Small Cap Fund Direct-Growth (Equity - Small Cap)    | 9397378      | Purchase - SIP | 9.013 |    ₹55.4730 |   ₹500.00 | Confirmed |
| 03 Jul 2026 | Quant Small Cap Fund Direct Plan-Growth (Equity - Small Cap) | 510106862082 | Purchase - SIP | 3.189 |   ₹313.5792 | ₹1,000.00 | Confirmed |

### Active SIPs
`);

    assert.equal(result.errors.length, 0);
    assert.equal(result.transactions.length, 4);
    assert.equal(
      result.transactions[0].assetName,
      "HDFC Large Cap Fund Direct Plan-Growth",
    );
    assert.equal(result.transactions[0].type, "Equity - Large Cap");
    assert.equal(result.transactions[0].amount, 1000);
    assert.equal(result.transactions[0].quantity, 0.81);
    assert.equal(result.transactions[0].price, 1234.159);
    assert.equal(result.transactions[0].date, "2026-07-03");
    assert.match(result.transactions[0].notes, /Folio 43268646/);
    assert.equal(
      result.transactions[3].assetName,
      "Quant Small Cap Fund Direct Plan-Growth",
    );
    assert.equal(result.transactions[3].amount, 1000);
  });
});
