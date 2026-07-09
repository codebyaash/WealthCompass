import type { PortfolioAsset } from "@/lib/local-storage";

type CsvImportResult = {
  assets: PortfolioAsset[];
  errors: string[];
};

const headerAliases = {
  gain: ["gain", "gain%", "return", "return%"],
  name: ["name", "asset", "holding", "symbol"],
  type: ["type", "category", "asset_type", "asset type"],
  value: ["value", "current_value", "current value", "amount", "market value"],
};

export const samplePortfolioCsv = `name,type,value,gain
Nifty 50 Index,Index Fund,180000,14
Gold ETF,Gold,42000,5
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
  const rows = csvText
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map(parseCsvRow);

  if (rows.length < 2) {
    return {
      assets: [],
      errors: ["Add a header row and at least one holding row."],
    };
  }

  const headers = rows[0].map(normalizeHeader);
  const indexes = {
    gain: findHeaderIndex(headers, headerAliases.gain),
    name: findHeaderIndex(headers, headerAliases.name),
    type: findHeaderIndex(headers, headerAliases.type),
    value: findHeaderIndex(headers, headerAliases.value),
  };

  const missingHeaders = Object.entries(indexes)
    .filter(([, index]) => index === -1)
    .map(([key]) => key);

  if (missingHeaders.length) {
    return {
      assets: [],
      errors: [`Missing columns: ${missingHeaders.join(", ")}.`],
    };
  }

  const errors: string[] = [];
  const assets = rows.slice(1).flatMap((row, index) => {
    const lineNumber = index + 2;
    const name = row[indexes.name]?.trim() ?? "";
    const type = row[indexes.type]?.trim() ?? "";
    const value = parseNumber(row[indexes.value]);
    const gain = parseNumber(row[indexes.gain]);

    if (!name || !type || !Number.isFinite(value) || value <= 0) {
      errors.push(`Line ${lineNumber}: name, type, and positive value are required.`);
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

function findHeaderIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function parseNumber(value: string | undefined) {
  if (!value) return Number.NaN;
  return Number(value.replaceAll(",", "").replace("%", "").trim());
}

function parseCsvRow(row: string) {
  const values: string[] = [];
  let current = "";
  let insideQuote = false;

  for (const character of row) {
    if (character === '"') {
      insideQuote = !insideQuote;
      continue;
    }

    if (character === "," && !insideQuote) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function escapeCsvValue(value: string) {
  if (!/[",\n]/.test(value)) return value;

  return `"${value.replaceAll('"', '""')}"`;
}
