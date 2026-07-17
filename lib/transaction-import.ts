import { createPortfolioTransaction, type PortfolioTransaction } from "./local-storage";

export type TransactionImportResult = {
  errors: string[];
  transactions: PortfolioTransaction[];
};

const monthMap: Record<string, string> = {
  apr: "04",
  aug: "08",
  dec: "12",
  feb: "02",
  jan: "01",
  jul: "07",
  jun: "06",
  mar: "03",
  may: "05",
  nov: "11",
  oct: "10",
  sep: "09",
};

export function parseImportedTransactions(text: string): TransactionImportResult {
  const normalized = text.replace(/\r/g, "");

  if (!/investment transaction summary/i.test(normalized)) {
    return { errors: [], transactions: [] };
  }

  const markdownTransactions = parseMarkdownTransactionTable(normalized);
  if (markdownTransactions.length) {
    return { errors: [], transactions: markdownTransactions };
  }

  const section = extractLegacyTransactionSection(normalized);

  if (!section) {
    return {
      errors: [
        "Transaction statement detected, but the transaction rows could not be isolated.",
      ],
      transactions: [],
    };
  }

  const chunks = splitTransactionBlocks(section);

  const transactions = chunks.flatMap((chunk) => {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return [];

    const dateLine = lines.find((line) => /^\d{2}\s+[A-Za-z]{3}\b/.test(line));
    const yearLine = lines.find((line) => /^20\d{2}\b/.test(line));
    const categoryLine = lines.find((line) => /^\(.+\)$/.test(line));
    const numericValues = Array.from(
      chunk.matchAll(/₹\s*([\d,]+(?:\.\d+)?)/g),
      (match) => parseCurrency(match[1]),
    ).filter(Number.isFinite);

    const unitsMatch = chunk.match(/\t(\d+(?:\.\d+)?)\t₹/);
    const units = unitsMatch ? Number(unitsMatch[1]) : 0;
    const nav = numericValues[0] ?? 0;
    const amount = numericValues[1] ?? 0;
    const folioMatch = chunk.match(/(?:\t|^)(\d{5,}[A-Za-z0-9/]*)(?:\t|\n)/m);
    const folio = folioMatch?.[1] ?? "";
    const action = /\bPurchase\b/i.test(chunk)
      ? "buy"
      : /\bWithdrawal|Redeem|Redemption|Sell\b/i.test(chunk)
        ? "sell"
        : "transfer";
    const typeHint = chunk.match(/\bSIP\b/i) ? "SIP" : action;

    const namePrefix = folioMatch ? chunk.slice(0, folioMatch.index) : chunk;
    const nameParts = namePrefix
      .replace(/\b\d{2}\s+[A-Za-z]{3}\b/g, " ")
      .replace(/\b20\d{2}\b/g, " ")
      .replace(/\bPurchase\b\s*-?/gi, " ")
      .replace(/\bWithdrawal\b\s*-?/gi, " ")
      .replace(/\bRedemption\b\s*-?/gi, " ")
      .replace(/\bSIP\b/gi, " ")
      .replace(/\bConfirmed\b/gi, " ")
      .replace(/[\t\n]/g, " ")
      .replace(/₹/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s+-\s+/g, "-")
      .replace(/-\s+(Growth|IDCW|Regular|Direct)\b/gi, "-$1")
      .trim()
      .replace(/-$/, "")
      .trim();

    const name = nameParts;
    const date = buildDate(dateLine ?? "", yearLine ?? "");
    const type = categoryLine
      ? categoryLine.replace(/[()]/g, "").trim()
      : "Mutual Fund";

    if (!name || !date || amount <= 0) {
      return [];
    }

    return [
      createPortfolioTransaction({
        action,
        amount,
        assetName: name,
        date,
        notes: folio ? `Folio ${folio} · ${typeHint} import` : `${typeHint} import`,
        price: nav,
        quantity: units,
        source: "Paytm Money statement",
        type,
      }),
    ];
  });

  return {
    errors:
      transactions.length === 0
        ? [
            "A Paytm Money transaction statement was detected, but no transaction rows could be parsed yet.",
          ]
        : [],
    transactions,
  };
}

function extractLegacyTransactionSection(normalized: string) {
  const sectionMatch = normalized.match(
    /Investment Transaction Summary([\s\S]*?)(?:\*Transactions details shown|###\s+Active SIPs|$)/i,
  );

  return sectionMatch?.[1]
    ?.replace(/Date\*\tDate\*[\s\S]*?Status\tStatus/i, "")
    .trim() ?? "";
}

function parseMarkdownTransactionTable(text: string) {
  const sectionMatch = text.match(
    /###\s+Investment Transaction Summary([\s\S]*?)(?:###\s+Active SIPs|\*\*Total monthly SIP:|$)/i,
  );

  if (!sectionMatch?.[1]) return [];

  const rows = sectionMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.startsWith("|") &&
        !/^\|\s*Date\s*\|/i.test(line) &&
        !/^\|(?:\s*[-:]+\s*\|)+\s*$/.test(line),
    );

  return rows.flatMap((row) => {
    const cells = row
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);

    if (cells.length < 8) return [];

    const [dateText, schemeName, folio, typeText, unitsText, navText, amountText, statusText] =
      cells;

    if (!/confirmed/i.test(statusText)) return [];

    const date = buildDateFromFullText(dateText);
    const amount = parseCurrencyToken(amountText);
    const quantity = parseNumberToken(unitsText);
    const price = parseCurrencyToken(navText);
    const action = /\bpurchase\b/i.test(typeText)
      ? "buy"
      : /\bwithdrawal|redeem|redemption|sell\b/i.test(typeText)
        ? "sell"
        : "transfer";
    const type = extractSchemeCategory(schemeName);
    const cleanName = schemeName.replace(/\s*\(([^)]+)\)\s*$/, "").trim();

    if (!cleanName || !date || amount <= 0) return [];

    return [
      createPortfolioTransaction({
        action,
        amount,
        assetName: cleanName,
        date,
        notes: folio ? `Folio ${folio} · ${typeText} import` : `${typeText} import`,
        price,
        quantity,
        source: "Paytm Money statement",
        type,
      }),
    ];
  });
}

function buildDate(dayMonth: string, year: string) {
  const dateMatch = dayMonth.match(/^(\d{2})\s+([A-Za-z]{3})/);
  const yearMatch = year.match(/^(20\d{2})/);

  if (!dateMatch || !yearMatch) return "";

  const month = monthMap[dateMatch[2].toLowerCase()];
  if (!month) return "";

  return `${yearMatch[1]}-${month}-${dateMatch[1]}`;
}

function buildDateFromFullText(value: string) {
  const match = value.match(/^(\d{2})\s+([A-Za-z]{3})\s+(20\d{2})$/);
  if (!match) return "";

  const month = monthMap[match[2].toLowerCase()];
  if (!month) return "";

  return `${match[3]}-${month}-${match[1]}`;
}

function parseCurrency(value: string | undefined) {
  if (!value) return Number.NaN;
  return Number(value.replace(/,/g, ""));
}

function parseCurrencyToken(value: string | undefined) {
  if (!value) return 0;
  return Number(
    value
      .replace(/[₹,\s]/g, "")
      .trim(),
  );
}

function parseNumberToken(value: string | undefined) {
  if (!value) return 0;
  return Number(value.replace(/,/g, "").trim());
}

function extractSchemeCategory(schemeName: string) {
  const categoryMatch = schemeName.match(/\(([^)]+)\)\s*$/);
  return categoryMatch?.[1]?.trim() || "Mutual Fund";
}

function splitTransactionBlocks(section: string) {
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: string[] = [];
  let current: string[] = [];
  let seenConfirmed = false;

  for (const line of lines) {
    const startsNewRecord = /^\d{2}\s+[A-Za-z]{3}\b/.test(line);

    if (startsNewRecord && seenConfirmed) {
      blocks.push(current.join("\n"));
      current = [];
      seenConfirmed = false;
    }

    current.push(line);

    if (/Confirmed\b/.test(line)) {
      seenConfirmed = true;
    }
  }

  if (current.length) {
    blocks.push(current.join("\n"));
  }

  return blocks;
}
