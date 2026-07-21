import type { PortfolioAsset } from "@/lib/local-storage";

export type CsvImportResult = {
  assets: PortfolioAsset[];
  errors: string[];
};

export type PortfolioImportMode = "add" | "merge";

export type PortfolioImportPreview = CsvImportResult & {
  duplicates: Array<{
    existingAsset: PortfolioAsset;
    importedAsset: PortfolioAsset;
  }>;
  importedInvestedValue: number;
  importedValue: number;
  newAssets: PortfolioAsset[];
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
  source: ["account", "broker", "platform", "source", "source app"],
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

export const samplePortfolioCsv = `scheme name,asset class,current value,invested value,units,current nav,returns %,source
Nifty 50 Index Fund,Mutual Fund,180000,158000,734.69,245,14,Manual
Gold ETF,ETF,42000,40000,600,70,5,Manual
Liquid Fund,Debt,65000,63107,550.85,118,3,Manual`;

export function portfolioAssetsToCsv(assets: PortfolioAsset[]) {
  const rows = assets.map((asset) =>
    [
      escapeCsvValue(asset.name),
      escapeCsvValue(asset.type),
      asset.value,
      asset.investedValue,
      asset.quantity,
      asset.price,
      asset.gain,
      escapeCsvValue(asset.source),
    ].join(","),
  );

  return [
    "name,type,value,investedValue,quantity,price,gain,source",
    ...rows,
  ].join("\n");
}

export function previewPortfolioImport(
  importText: string,
  existingAssets: PortfolioAsset[],
): PortfolioImportPreview {
  const parsed = parsePortfolioCsv(importText);
  const duplicates = parsed.assets.flatMap((importedAsset) => {
    const existingAsset = existingAssets.find((asset) => createAssetKey(asset) === createAssetKey(importedAsset));

    return existingAsset ? [{ existingAsset, importedAsset }] : [];
  });

  return {
    ...parsed,
    duplicates,
    importedInvestedValue: parsed.assets.reduce((sum, asset) => sum + asset.investedValue, 0),
    importedValue: parsed.assets.reduce((sum, asset) => sum + asset.value, 0),
    newAssets: parsed.assets.filter(
      (asset) => !existingAssets.some((current) => createAssetKey(current) === createAssetKey(asset)),
    ),
  };
}

export function applyPortfolioImport({
  existingAssets,
  importedAssets,
  mode,
}: {
  existingAssets: PortfolioAsset[];
  importedAssets: PortfolioAsset[];
  mode: PortfolioImportMode;
}) {
  if (mode === "add") {
    return [...importedAssets, ...existingAssets];
  }

  const merged = [...existingAssets];

  for (const importedAsset of importedAssets) {
    const existingIndex = merged.findIndex((asset) => createAssetKey(asset) === createAssetKey(importedAsset));

    if (existingIndex === -1) {
      merged.unshift(importedAsset);
      continue;
    }

    merged[existingIndex] = mergePortfolioAsset(merged[existingIndex], importedAsset);
  }

  return merged;
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
    source: findHeaderIndex(headers, headerAliases.source),
    type: findHeaderIndex(headers, headerAliases.type),
    value: findHeaderIndex(headers, headerAliases.value),
  };

  const hasValueSource =
    indexes.value !== -1 ||
    indexes.investedValue !== -1 ||
    (indexes.quantity !== -1 && indexes.price !== -1);
  const missingHeaders = [indexes.name === -1 ? "name" : "", !hasValueSource ? "value" : ""].filter(Boolean);

  if (missingHeaders.length) {
    if (isTransactionOnlyStatement(importText)) {
      return {
        assets: [],
        errors: [
          "This statement only includes transaction activity. Import the holdings section with current value if you want portfolio holdings from this file.",
        ],
      };
    }

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
    const asset = createPortfolioAssetFromRow(alignedRow, indexes);

    if (isSummaryRow(asset.name)) {
      return [];
    }

    if (!asset.name || !Number.isFinite(asset.value) || asset.value <= 0) {
      errors.push(`Line ${lineNumber}: holding name and positive value are required.`);
      return [];
    }

    return [asset];
  });

  return { assets, errors };
}

function parsePortfolioStatementText(statementText: string): CsvImportResult {
  if (isTransactionOnlyStatement(statementText)) {
    return {
      assets: [],
      errors: [
        "This statement only includes transaction activity. Import the holdings section with current value if you want portfolio holdings from this file.",
      ],
    };
  }

  const providerSpecificResult = parseProviderSpecificStatement(statementText);

  if (providerSpecificResult.assets.length) return providerSpecificResult;

  const tableResult = parseStatementTable(statementText);

  if (tableResult.assets.length) return tableResult;

  const labelledResult = parseLabelledStatement(statementText);

  if (labelledResult.assets.length) return labelledResult;

  const genericResult = parseGenericStatement(statementText);

  if (genericResult.assets.length) return genericResult;

  return {
    assets: [],
    errors: [
      "Paste a CSV/TSV export, email statement, or PDF-extracted statement with holding name and current value.",
    ],
  };
}

function parseProviderSpecificStatement(statementText: string): CsvImportResult {
  const lines = statementText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const paytmHeaderIndex = lines.findIndex((line) => isPaytmMoneyHeader(line));
  if (paytmHeaderIndex !== -1) {
    return parsePaytmMoneyStatementLines(lines.slice(paytmHeaderIndex + 1));
  }

  const jupiterHeaderIndex = lines.findIndex((line) => isJupiterHeader(line));
  if (jupiterHeaderIndex !== -1) {
    return parseJupiterStatementLines(lines.slice(jupiterHeaderIndex + 1));
  }

  return { assets: [], errors: [] };
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
    source: findHeaderIndex(headers, headerAliases.source),
    type: findHeaderIndex(headers, headerAliases.type),
    value: findHeaderIndex(headers, headerAliases.value),
  };
  const errors: string[] = [];
  const assets = lines.slice(headerIndex + 1).flatMap((line, index) => {
    const row = splitStatementColumns(line);
    const lineNumber = headerIndex + index + 2;

    if (row.length < 2) return [];

    const asset = createPortfolioAssetFromRow(row, indexes);

    if (isSummaryRow(asset.name)) return [];

    if (!asset.name || !Number.isFinite(asset.value) || asset.value <= 0) {
      errors.push(`Line ${lineNumber}: holding name and positive value are required.`);
      return [];
    }

    return [asset];
  });

  return { assets, errors };
}

function parsePaytmMoneyStatementLines(lines: string[]): CsvImportResult {
  const assets = lines.flatMap((line) => {
    if (isSummaryRow(line)) return [];

    const split = splitLineByNumericTail(line, 4) ?? splitLineByNumericTail(line, 3);
    if (!split) return [];

    const [name, ...tail] = split;
    const numericTail = tail.map((value) => parseNumber(value));

    const currentValue = numericTail[0];
    const investedValue = numericTail[1];
    const quantity = numericTail[2];
    const price = numericTail[3];
    const value = deriveHoldingValue({
      investedValue: finiteOrZero(investedValue),
      parsedValue: currentValue,
      price,
      quantity,
    });

    if (!name || !Number.isFinite(value) || value <= 0) return [];

    return [
      {
        gain: deriveHoldingGain({
          gain: Number.NaN,
          investedValue: finiteOrZero(investedValue),
          value,
        }),
        investedValue: finiteOrZero(investedValue),
        name,
        price: deriveHoldingPrice({ price, quantity, value }),
        quantity: finiteOrZero(quantity),
        source: "Paytm Money statement",
        type: inferAssetType({ name, sourceType: "" }),
        value,
      } satisfies PortfolioAsset,
    ];
  });

  return { assets, errors: [] };
}

function parseJupiterStatementLines(lines: string[]): CsvImportResult {
  const assets = lines.flatMap((line) => {
    if (isSummaryRow(line)) return [];

    const split = splitLineByNumericTail(line, 4) ?? splitLineByNumericTail(line, 3);
    if (!split) return [];

    const [prefix, ...tail] = split;
    const resolvedPrefix = splitJupiterNameAndType(prefix);
    if (!resolvedPrefix) return [];

    const numericTail = tail.map((value) => parseNumber(value));
    const quantity = numericTail[0];
    const price = numericTail[1];
    const investedValue = numericTail[2];
    const currentValue = numericTail[3];
    const value = deriveHoldingValue({
      investedValue: finiteOrZero(investedValue),
      parsedValue: currentValue,
      price,
      quantity,
    });

    if (!resolvedPrefix.name || !Number.isFinite(value) || value <= 0) return [];

    return [
      {
        gain: deriveHoldingGain({
          gain: Number.NaN,
          investedValue: finiteOrZero(investedValue),
          value,
        }),
        investedValue: finiteOrZero(investedValue),
        name: resolvedPrefix.name,
        price: deriveHoldingPrice({ price, quantity, value }),
        quantity: finiteOrZero(quantity),
        source: "Jupiter statement",
        type: resolvedPrefix.type,
        value,
      } satisfies PortfolioAsset,
    ];
  });

  return { assets, errors: [] };
}

function parseLabelledStatement(statementText: string): CsvImportResult {
  if (isTransactionOnlyStatement(statementText)) {
    return { assets: [], errors: [] };
  }

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
    const name = getRecordValue(record, headerAliases.name) ?? "";

    if (isSummaryRow(name)) return [];

    const type = inferAssetType({
      name,
      sourceType: getRecordValue(record, headerAliases.type) ?? "",
    });
    const quantity = parseNumber(getRecordValue(record, headerAliases.quantity));
    const price = parseNumber(getRecordValue(record, headerAliases.price));
    const parsedValue = parseNumber(getRecordValue(record, headerAliases.value));
    const investedValue = finiteOrZero(parseNumber(getRecordValue(record, headerAliases.investedValue)));
    const value = deriveHoldingValue({ investedValue, parsedValue, price, quantity });
    const gain = parseNumber(getRecordValue(record, headerAliases.gain));
    const derivedGain = deriveHoldingGain({ gain, investedValue, value });

    if (!name || !Number.isFinite(value) || value <= 0) {
      return [];
    }

    return [
      {
        gain: derivedGain,
        investedValue,
        name,
        price: deriveHoldingPrice({ price, quantity, value }),
        quantity: finiteOrZero(quantity),
        source: getRecordValue(record, headerAliases.source) ?? "Imported statement",
        type,
        value,
      },
    ];
  });

  return { assets, errors: [] };
}

function parseGenericStatement(statementText: string): CsvImportResult {
  if (isTransactionOnlyStatement(statementText)) {
    return { assets: [], errors: [] };
  }

  const lines = statementText
    .split(/\r?\n/)
    .map((line) => stripThousandsSeparators(line.trim()))
    .filter(Boolean);
  const assets = lines.flatMap((line) => {
    if (isSummaryRow(line)) return [];

    const split =
      splitLineByNumericTail(line, 4) ??
      splitLineByNumericTail(line, 3) ??
      splitLineByNumericTail(line, 2);

    if (!split) return [];

    const [name, ...tail] = split;
    const numericTail = tail.map((value) => parseNumber(value));
    const parsedValue = numericTail[0];
    const investedValue = finiteOrZero(numericTail[1]);
    const quantity = finiteOrZero(numericTail[2]);
    const price = numericTail[3];
    const value = deriveHoldingValue({
      investedValue,
      parsedValue,
      price,
      quantity,
    });

    if (!name || !Number.isFinite(value) || value <= 0) return [];

    return [
      {
        gain: deriveHoldingGain({
          gain: Number.NaN,
          investedValue,
          value,
        }),
        investedValue,
        name,
        price: deriveHoldingPrice({ price, quantity, value }),
        quantity,
        source: "Imported statement",
        type: inferAssetType({ name, sourceType: "" }),
        value,
      } satisfies PortfolioAsset,
    ];
  });

  const contextLooksLikeStatement =
    /current value|market value|invested|units|nav|ltp|folio|isin|portfolio|statement/i.test(
      statementText,
    );

  if (assets.length >= 2 || (assets.length >= 1 && contextLooksLikeStatement)) {
    return { assets, errors: [] };
  }

  return { assets: [], errors: [] };
}

function createPortfolioAssetFromRow(
  row: string[],
  indexes: Record<
    "gain" | "investedValue" | "name" | "price" | "quantity" | "source" | "type" | "value",
    number
  >,
): PortfolioAsset {
  const name = cell(row, indexes.name);
  const type = inferAssetType({
    name,
    sourceType: cell(row, indexes.type),
  });
  const quantity = parseNumber(cell(row, indexes.quantity));
  const price = parseNumber(cell(row, indexes.price));
  const parsedValue = parseNumber(cell(row, indexes.value));
  const investedValue = finiteOrZero(parseNumber(cell(row, indexes.investedValue)));
  const value = deriveHoldingValue({ investedValue, parsedValue, price, quantity });
  const gain = deriveHoldingGain({
    gain: parseNumber(cell(row, indexes.gain)),
    investedValue,
    value,
  });

  return {
    gain,
    investedValue,
    name,
    price: deriveHoldingPrice({ price, quantity, value }),
    quantity: finiteOrZero(quantity),
    source: cell(row, indexes.source) || "Imported file",
    type,
    value,
  };
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
      count: parseDelimitedRow(firstLine, delimiter).length,
      delimiter,
    }))
    .sort((left, right) => right.count - left.count)[0].delimiter;
}

function stripThousandsSeparators(row: string) {
  return row.replace(/(?<=\d),(?=\d{3}(\D|$))/g, "");
}

function splitStatementColumns(line: string) {
  if (line.includes("\t")) {
    return line
      .split("\t")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (line.includes("|")) {
    return line
      .split("|")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return line
    .split(/\s{2,}/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function splitLineByNumericTail(line: string, numericColumns: number) {
  const compact = line.replace(/\s+/g, " ").trim();
  const tokens = compact.split(" ");

  if (tokens.length <= numericColumns) return null;

  const tail = tokens.slice(-numericColumns);
  if (!tail.every((token) => Number.isFinite(parseNumber(token)))) return null;

  const head = tokens.slice(0, -numericColumns).join(" ").trim();
  if (!head || isSummaryRow(head)) return null;

  return [head, ...tail];
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

function deriveHoldingValue({
  investedValue,
  parsedValue,
  price,
  quantity,
}: {
  investedValue: number;
  parsedValue: number;
  price: number;
  quantity: number;
}) {
  if (Number.isFinite(parsedValue) && parsedValue > 0) return parsedValue;

  if (Number.isFinite(quantity) && Number.isFinite(price) && quantity > 0 && price > 0) {
    return quantity * price;
  }

  return investedValue;
}

function deriveHoldingPrice({
  price,
  quantity,
  value,
}: {
  price: number;
  quantity: number;
  value: number;
}) {
  if (Number.isFinite(price) && price > 0) return price;
  if (Number.isFinite(quantity) && quantity > 0 && Number.isFinite(value) && value > 0) {
    return value / quantity;
  }

  return 0;
}

function deriveHoldingGain({
  gain,
  investedValue,
  value,
}: {
  gain: number;
  investedValue: number;
  value: number;
}) {
  if (Number.isFinite(gain)) return gain;

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
  if (/\bfund\b|direct plan|regular plan|growth|idcw/.test(normalizedName)) {
    return "Mutual Fund";
  }
  if (/\bgold\b|sgb|sovereign gold/.test(normalizedName)) return "Gold";
  if (/\bbond\b|gilt|debt|liquid|overnight/.test(normalizedName)) return "Debt";

  return "Imported Holding";
}

function isPaytmMoneyHeader(line: string) {
  const normalized = normalizeHeader(line);

  return (
    normalized.includes("scheme name") &&
    normalized.includes("current value") &&
    normalized.includes("invested value")
  );
}

function isJupiterHeader(line: string) {
  const normalized = normalizeHeader(line);

  return (
    normalized.includes("fund name") &&
    normalized.includes("units") &&
    (normalized.includes("current nav") || normalized.includes("nav")) &&
    normalized.includes("invested value")
  );
}

function splitJupiterNameAndType(prefix: string) {
  const typePatterns = [
    "Equity Mutual Fund",
    "Debt Mutual Fund",
    "Mutual Fund",
    "Gold ETF",
    "ETF",
    "Debt",
    "Gold",
  ];

  for (const type of typePatterns) {
    if (prefix.endsWith(type)) {
      return {
        name: prefix.slice(0, -type.length).trim(),
        type,
      };
    }
  }

  return {
    name: prefix,
    type: "Mutual Fund",
  };
}

function isSummaryRow(name: string) {
  return /^(grand\s+)?total|summary|net worth$/i.test(name.trim());
}

function isTransactionOnlyStatement(text: string) {
  const lowerText = text.toLowerCase();
  const hasTransactionMarkers =
    /investment transaction summary|transaction summary|investment activity|fresh purchase|withdrawal|redemption|purchase - sip|purchase -/i.test(
      text,
    );
  const hasHoldingsHeaders =
    /current value|market value|invested value|holding value|portfolio value|scheme name\s+current value/i.test(
      lowerText,
    );

  return hasTransactionMarkers && !hasHoldingsHeaders;
}

function getRecordValue(record: Record<string, string>, aliases: string[]) {
  return aliases
    .map((alias) => record[normalizeHeader(alias)])
    .find((value) => Boolean(value))
    ?.trim();
}

function isNameKey(key: string) {
  return headerAliases.name.some((alias) => normalizeHeader(alias) === key);
}

function finiteOrZero(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function createAssetKey(asset: PortfolioAsset) {
  return `${normalizeHeader(asset.name)}::${normalizeHeader(asset.type)}`;
}

function mergePortfolioAsset(existingAsset: PortfolioAsset, importedAsset: PortfolioAsset): PortfolioAsset {
  const value = existingAsset.value + importedAsset.value;
  const investedValue = existingAsset.investedValue + importedAsset.investedValue;
  const quantity = existingAsset.quantity + importedAsset.quantity;
  const price = quantity > 0 ? value / quantity : importedAsset.price || existingAsset.price;
  const gain = investedValue > 0 ? ((value - investedValue) / investedValue) * 100 : importedAsset.gain;

  return {
    ...existingAsset,
    gain,
    investedValue,
    price,
    quantity,
    source:
      existingAsset.source === importedAsset.source
        ? existingAsset.source
        : `${existingAsset.source} + ${importedAsset.source}`,
    value,
  };
}

function escapeCsvValue(value: string) {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}
