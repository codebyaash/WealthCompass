import type { PortfolioAsset } from "@/lib/local-storage";

type CsvImportResult = {
  assets: PortfolioAsset[];
  errors: string[];
};

const headerAliases = {
  gain: [
    "absolute return",
    "absolute returns",
    "gain",
    "gain loss",
    "gain/loss",
    "gain%",
    "p&l %",
    "profit loss %",
    "return",
    "return%",
    "returns",
    "returns %",
    "xirr",
    "xirr %",
  ],
  investedValue: [
    "amount invested",
    "cost",
    "cost value",
    "investment",
    "investment amount",
    "invested",
    "invested amount",
    "invested value",
    "purchase value",
    "total invested",
  ],
  name: [
    "asset",
    "fund",
    "fund name",
    "holding",
    "instrument",
    "instrument name",
    "name",
    "scheme",
    "scheme name",
    "scrip",
    "scrip name",
    "security",
    "security name",
    "stock",
    "stock name",
    "symbol",
  ],
  price: [
    "current nav",
    "current price",
    "last traded price",
    "ltp",
    "market price",
    "nav",
    "price",
  ],
  quantity: ["balance units", "holding qty", "quantity", "qty", "shares", "units"],
  type: [
    "asset class",
    "asset type",
    "asset_type",
    "category",
    "fund category",
    "instrument type",
    "product",
    "product type",
    "segment",
    "sub category",
    "type",
  ],
  value: [
    "amount",
    "current",
    "current amount",
    "current market value",
    "current value",
    "current_value",
    "holding value",
    "market value",
    "market_value",
    "portfolio value",
    "present value",
    "value",
    "value as on date",
  ],
};

export const samplePortfolioCsv = `scheme name,asset class,current value,returns %
Nifty 50 Index Fund,Mutual Fund,180000,14
Gold ETF,ETF,42000,5
Liquid Fund,Debt,65000,3`;

export function portfolioAssetsToCsv(assets: PortfolioAsset[]) {
  const rows = assets.map((asset) =>
    [
      escapeCsvValue(asset.name),
      escapeCsvValue(asset.type),
      asset.value,
      asset.gain,
    ].join(","),
  );

  return ["name,type,value,gain", ...rows].join("\n");
}

export function parsePortfolioCsv(csvText: string): CsvImportResult {
  const importText = normalizeImportedText(csvText);
  const delimiter = detectDelimiter(importText);
  const rows = importText
    .split(/\r?\n/)
    .map((row) => row.trim())
    .map(stripThousandsSeparators)
    .filter(Boolean)
    .map((row) => parseDelimitedRow(row, delimiter));

  if (rows.length < 2) {
    return parsePortfolioStatementText(importText);
  }

  const headers = rows[0].map(normalizeHeader);
  const indexes = {
    gain: findHeaderIndex(headers, headerAliases.gain),
    investedValue: findHeaderIndex(headers, headerAliases.investedValue),
    name: findHeaderIndex(headers, headerAliases.name),
    price: findHeaderIndex(headers, headerAliases.price),
    quantity: findHeaderIndex(headers, headerAliases.quantity),
    type: findHeaderIndex(headers, headerAliases.type),
    value: findHeaderIndex(headers, headerAliases.value),
  };

  const hasValueSource =
    indexes.value !== -1 ||
    indexes.investedValue !== -1 ||
    (indexes.quantity !== -1 && indexes.price !== -1);
  const missingHeaders = [
    indexes.name === -1 ? "name" : "",
    !hasValueSource ? "value" : "",
  ].filter(Boolean);

  if (missingHeaders.length) {
    const statementResult = parsePortfolioStatementText(importText);

    if (statementResult.assets.length) return statementResult;

    return {
      assets: [],
      errors: [`Missing columns: ${missingHeaders.join(", ")}.`],
    };
  }

  const errors: string[] = [];
  const assets = rows.slice(1).flatMap((row, index) => {
    const lineNumber = index + 2;
    const alignedRow = alignOverflowCells(row, headers.length, indexes.value);
    const name = cell(alignedRow, indexes.name);
    const type = inferAssetType({
      name,
      sourceType: cell(alignedRow, indexes.type),
    });
    const value = getHoldingValue(alignedRow, indexes);
    const gain = getHoldingGain(alignedRow, indexes, value);

    if (isSummaryRow(name)) {
      return [];
    }

    if (!name || !Number.isFinite(value) || value <= 0) {
      errors.push(`Line ${lineNumber}: holding name and positive value are required.`);
      return [];
    }

    return [
      {
        gain: Number.isFinite(gain) ? gain : 0,
        name,
        type,
        value,
      },
    ];
  });

  return { assets, errors };
}

function parsePortfolioStatementText(statementText: string): CsvImportResult {
  const tableResult = parseStatementTable(statementText);

  if (tableResult.assets.length) return tableResult;

  const labelledResult = parseLabelledStatement(statementText);

  if (labelledResult.assets.length) return labelledResult;

  return {
    assets: [],
    errors: [
      "Paste a CSV/TSV export or an email statement with holding name and current value.",
    ],
  };
}

function parseStatementTable(statementText: string): CsvImportResult {
  const lines = statementText
    .split(/\r?\n/)
    .map((line) => stripThousandsSeparators(line.trim()))
    .filter(Boolean);

  const headerIndex = lines.findIndex((line) => {
    const normalized = normalizeHeader(line);

    return (
      headerAliases.name.some((alias) => normalized.includes(normalizeHeader(alias))) &&
      [...headerAliases.value, ...headerAliases.investedValue].some((alias) =>
        normalized.includes(normalizeHeader(alias)),
      )
    );
  });

  if (headerIndex === -1) {
    return { assets: [], errors: [] };
  }

  const headers = splitStatementColumns(lines[headerIndex]).map(normalizeHeader);
  const indexes = {
    gain: findHeaderIndex(headers, headerAliases.gain),
    investedValue: findHeaderIndex(headers, headerAliases.investedValue),
    name: findHeaderIndex(headers, headerAliases.name),
    price: findHeaderIndex(headers, headerAliases.price),
    quantity: findHeaderIndex(headers, headerAliases.quantity),
    type: findHeaderIndex(headers, headerAliases.type),
    value: findHeaderIndex(headers, headerAliases.value),
  };
  const errors: string[] = [];
  const assets = lines.slice(headerIndex + 1).flatMap((line, index) => {
    const row = splitStatementColumns(line);
    const lineNumber = headerIndex + index + 2;

    if (row.length < 2) return [];

    const name = cell(row, indexes.name);
    if (isSummaryRow(name)) return [];

    const value = getHoldingValue(row, indexes);
    const type = inferAssetType({
      name,
      sourceType: cell(row, indexes.type),
    });
    const gain = getHoldingGain(row, indexes, value);

    if (!name || !Number.isFinite(value) || value <= 0) {
      errors.push(`Line ${lineNumber}: holding name and positive value are required.`);
      return [];
    }

    return [
      {
        gain: Number.isFinite(gain) ? gain : 0,
        name,
        type,
        value,
      },
    ];
  });

  return { assets, errors };
}

function parseLabelledStatement(statementText: string): CsvImportResult {
  const records: Record<string, string>[] = [];
  let currentRecord: Record<string, string> = {};

  for (const rawLine of statementText.split(/\r?\n/)) {
    const line = stripThousandsSeparators(rawLine.trim());
    const match = /^([^:=-]{2,45})\s*[:=-]\s*(.+)$/.exec(line);

    if (!match) continue;

    const key = normalizeHeader(match[1]);
    const value = match[2].trim();

    if (isNameKey(key) && Object.keys(currentRecord).length) {
      records.push(currentRecord);
      currentRecord = {};
    }

    currentRecord[key] = value;
  }

  if (Object.keys(currentRecord).length) {
    records.push(currentRecord);
  }

  const assets = records.flatMap((record) => {
    const name = getRecordValue(record, headerAliases.name);
    if (isSummaryRow(name)) return [];

    const type = inferAssetType({
      name,
      sourceType: getRecordValue(record, headerAliases.type),
    });
    const value =
      parseNumber(getRecordValue(record, headerAliases.value)) ||
      parseNumber(getRecordValue(record, headerAliases.investedValue));
    const investedValue = parseNumber(getRecordValue(record, headerAliases.investedValue));
    const gain = parseNumber(getRecordValue(record, headerAliases.gain));
    const derivedGain =
      Number.isFinite(gain) || !Number.isFinite(investedValue) || investedValue <= 0
        ? gain
        : ((value - investedValue) / investedValue) * 100;

    if (!name || !Number.isFinite(value) || value <= 0) {
      return [];
    }

    return [
      {
        gain: Number.isFinite(derivedGain) ? derivedGain : 0,
        name,
        type,
        value,
      },
    ];
  });

  return { assets, errors: [] };
}

function findHeaderIndex(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);

  return headers.findIndex((header) => normalizedAliases.includes(header));
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[%₹()]/g, "")
    .replace(/[_/-]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseNumber(value: string | undefined) {
  if (!value) return Number.NaN;
  const normalized = value
    .replace(/[₹$€£]/g, "")
    .replace(/\b(rs|inr|usd)\.?\s*/gi, "")
    .replaceAll(",", "")
    .replace("%", "")
    .trim();
  const isNegative = /^\(.*\)$/.test(normalized) || normalized.startsWith("-");
  const numeric = Number(normalized.replace(/[()]/g, ""));

  if (!Number.isFinite(numeric)) return Number.NaN;
  return isNegative ? -Math.abs(numeric) : numeric;
}

function normalizeImportedText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8377;/g, "₹");
}

function parseDelimitedRow(row: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let insideQuote = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];

    if (character === '"') {
      if (insideQuote && row[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }

      insideQuote = !insideQuote;
      continue;
    }

    if (character === delimiter && !insideQuote) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function detectDelimiter(csvText: string) {
  const firstLine = csvText.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const candidates = [",", "\t", ";"];

  return candidates
    .map((delimiter) => ({
      delimiter,
      count: parseDelimitedRow(firstLine, delimiter).length,
    }))
    .sort((left, right) => right.count - left.count)[0].delimiter;
}

function stripThousandsSeparators(row: string) {
  return row.replace(/(?<=\d),(?=\d{3}(\D|$))/g, "");
}

function splitStatementColumns(line: string) {
  if (line.includes("\t")) {
    return line.split("\t").map((value) => value.trim()).filter(Boolean);
  }

  if (line.includes("|")) {
    return line.split("|").map((value) => value.trim()).filter(Boolean);
  }

  return line.split(/\s{2,}/).map((value) => value.trim()).filter(Boolean);
}

function alignOverflowCells(row: string[], headerCount: number, valueIndex: number) {
  const extraCells = row.length - headerCount;

  if (extraCells <= 0 || valueIndex < 0 || valueIndex >= row.length) return row;

  const beforeValue = row.slice(0, valueIndex);
  const mergedValue = row.slice(valueIndex, valueIndex + extraCells + 1).join("");
  const afterValue = row.slice(valueIndex + extraCells + 1);

  return [...beforeValue, mergedValue, ...afterValue];
}

function cell(row: string[], index: number) {
  if (index < 0) return "";
  return row[index]?.trim() ?? "";
}

function getHoldingValue(
  row: string[],
  indexes: Record<"gain" | "investedValue" | "name" | "price" | "quantity" | "type" | "value", number>,
) {
  const currentValue = parseNumber(cell(row, indexes.value));

  if (Number.isFinite(currentValue) && currentValue > 0) return currentValue;

  const quantity = parseNumber(cell(row, indexes.quantity));
  const price = parseNumber(cell(row, indexes.price));

  if (Number.isFinite(quantity) && Number.isFinite(price) && quantity > 0 && price > 0) {
    return quantity * price;
  }

  return parseNumber(cell(row, indexes.investedValue));
}

function getHoldingGain(
  row: string[],
  indexes: Record<"gain" | "investedValue" | "name" | "price" | "quantity" | "type" | "value", number>,
  value: number,
) {
  const gain = parseNumber(cell(row, indexes.gain));

  if (Number.isFinite(gain)) return gain;

  const investedValue = parseNumber(cell(row, indexes.investedValue));

  if (Number.isFinite(investedValue) && investedValue > 0 && Number.isFinite(value)) {
    return ((value - investedValue) / investedValue) * 100;
  }

  return 0;
}

function inferAssetType({
  name,
  sourceType,
}: {
  name: string;
  sourceType: string;
}) {
  if (sourceType) return sourceType;

  const normalizedName = name.toLowerCase();

  if (/\betf\b/.test(normalizedName)) return "ETF";
  if (/\bfund\b|direct plan|regular plan|growth|idcw/.test(normalizedName)) return "Mutual Fund";
  if (/\bgold\b|sgb|sovereign gold/.test(normalizedName)) return "Gold";
  if (/\bbond\b|gilt|debt|liquid|overnight/.test(normalizedName)) return "Debt";

  return "Imported Holding";
}

function isSummaryRow(name: string) {
  return /^(grand\s+)?total|summary|net worth$/i.test(name.trim());
}

function isNameKey(key: string) {
  return headerAliases.name.map(normalizeHeader).includes(key);
}

function getRecordValue(record: Record<string, string>, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  const matchingKey = Object.keys(record).find((key) => normalizedAliases.includes(key));

  return matchingKey ? record[matchingKey] : "";
}

function escapeCsvValue(value: string) {
  if (!/[",\n]/.test(value)) return value;

  return `"${value.replaceAll('"', '""')}"`;
}
