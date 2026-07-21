import type { IntegrationConnection } from "./local-storage";

export type ConnectorSampleInput = {
  fileName: string;
  sourceText: string;
};

const sampleByProviderId: Record<string, ConnectorSampleInput> = {
  "paytm-money": {
    fileName: "paytm-money-transaction-summary.txt",
    sourceText: `Here is the text copied from the statement:

## Transaction Summary

**Period:** 09-Jun-2026 to 08-Jul-2026

### Investment Activity

* **Fresh Purchase:** ₹3,000.00
* **Withdrawal:** ₹0.00
* **Net Inflow/Outflow:** ₹3,000.00

### Investment Transaction Summary

| Date        | Mutual Fund Scheme Name                                      | Folio No.    | Type           | Units |         NAV |    Amount | Status    |
| ----------- | ------------------------------------------------------------ | ------------ | -------------- | ----: | ----------: | --------: | --------- |
| 03 Jul 2026 | HDFC Large Cap Fund Direct Plan-Growth (Equity - Large Cap)  | 43268646     | Purchase - SIP | 0.810 | ₹1,234.1590 | ₹1,000.00 | Confirmed |
| 03 Jul 2026 | Edelweiss Mid Cap Direct Plan-Growth (Equity - Mid Cap)      | 91050161892  | Purchase - SIP | 3.935 |   ₹127.0640 |   ₹500.00 | Confirmed |
| 03 Jul 2026 | Bandhan Small Cap Fund Direct-Growth (Equity - Small Cap)    | 9397378      | Purchase - SIP | 9.013 |    ₹55.4730 |   ₹500.00 | Confirmed |
| 03 Jul 2026 | Quant Small Cap Fund Direct Plan-Growth (Equity - Small Cap) | 510106862082 | Purchase - SIP | 3.189 |   ₹313.5792 | ₹1,000.00 | Confirmed |`,
  },
  groww: {
    fileName: "groww-holdings.csv",
    sourceText: `scheme name,current value,invested value,units,category
Parag Parikh Flexi Cap Fund Direct Growth,186540,152000,412.74,Equity
ICICI Prudential Nifty 50 Index Fund Direct Growth,98420,87600,512.19,Index Fund
Axis Liquid Fund Direct Growth,25410,25000,19.87,Liquid Fund`,
  },
  cams: {
    fileName: "cams-consolidated-statement.txt",
    sourceText: `Forwarded message
Subject: CAMS consolidated account statement

Scheme Name	Current Value	Invested Value	Units
HDFC Large Cap Fund Direct Plan-Growth	118540	102000	96.051
Parag Parikh Flexi Cap Fund Direct Growth	164220	143500	55.873
ICICI Prudential Liquid Fund Direct Growth	45210	44000	13.208`,
  },
  "email-forward": {
    fileName: "forwarded-statement.txt",
    sourceText: `Forwarded message
From: statements@example.com
Subject: Monthly statement attached

Please find the latest statement attached below.

Scheme Name	Current Value	Invested Value	Units
Index Core Fund	180000	158000	734.69
Balanced Opportunity Fund	92000	87000	401.12`,
  },
};

export function getConnectorSampleInput(
  connection: Pick<IntegrationConnection, "providerId" | "providerName" | "importStrategy">,
) {
  const directMatch = sampleByProviderId[connection.providerId];
  if (directMatch) return directMatch;

  if (connection.importStrategy === "email-forward") {
    return sampleByProviderId["email-forward"];
  }

  if (connection.providerName.toLowerCase().includes("cams")) {
    return sampleByProviderId.cams;
  }

  if (connection.providerName.toLowerCase().includes("groww")) {
    return sampleByProviderId.groww;
  }

  return {
    fileName: `${connection.providerId || "provider"}-sample.txt`,
    sourceText: `Forwarded message
Subject: ${connection.providerName} statement attached

Scheme Name	Current Value	Invested Value	Units
Sample Diversified Fund	125000	110000	450.25`,
  };
}
