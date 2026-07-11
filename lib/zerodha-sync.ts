import { createHash, createHmac, randomUUID } from "node:crypto";
import type { PortfolioAsset } from "./local-storage";
import { createImportJob, type ImportJob } from "./local-storage";

type ZerodhaOauthState = {
  returnPath: string;
  state: string;
  userId: string;
};

type ZerodhaSessionResponse = {
  data?: {
    access_token?: string;
    email?: string;
    public_token?: string;
    user_id?: string;
    user_name?: string;
  };
};

type ZerodhaHoldingsResponse = {
  data?: Array<{
    average_price?: number;
    exchange?: string;
    isin?: string;
    last_price?: number;
    pnl?: number;
    quantity?: number;
    t1_quantity?: number;
    tradingsymbol?: string;
  }>;
};

type ZerodhaHolding = NonNullable<ZerodhaHoldingsResponse["data"]>[number];

export type ZerodhaHoldingsSyncResult = {
  assets: PortfolioAsset[];
  job: ImportJob;
  providerAccountLabel: string;
};

export function isZerodhaConfigured() {
  return Boolean(process.env.KITE_CONNECT_API_KEY && process.env.KITE_CONNECT_API_SECRET);
}

export function buildZerodhaRedirectUri(origin: string) {
  return `${origin}/api/broker/callback/zerodha`;
}

export function buildZerodhaAuthorizationUrl({
  origin,
  state,
}: {
  origin: string;
  state: string;
}) {
  const apiKey = process.env.KITE_CONNECT_API_KEY;

  if (!apiKey) {
    throw new Error("Missing KITE_CONNECT_API_KEY.");
  }

  const url = new URL("https://kite.zerodha.com/connect/login");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("v", "3");
  url.searchParams.set("redirect_params", state);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", buildZerodhaRedirectUri(origin));
  return url.toString();
}

export function createZerodhaOauthStateCookie({
  returnPath = "/auth",
  userId,
}: {
  returnPath?: string;
  userId: string;
}) {
  const payload: ZerodhaOauthState = {
    returnPath,
    state: randomUUID(),
    userId,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signZerodhaState(encoded);

  return {
    cookieValue: `${encoded}.${signature}`,
    state: payload.state,
  };
}

export function verifyZerodhaOauthStateCookie(
  cookieValue: string | undefined,
  expectedState: string,
) {
  if (!cookieValue) return null;

  const [encoded, signature] = cookieValue.split(".");
  if (!encoded || !signature) return null;
  if (signZerodhaState(encoded) !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ZerodhaOauthState;
    if (payload.state !== expectedState) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function exchangeZerodhaRequestToken({
  requestToken,
}: {
  requestToken: string;
}) {
  const apiKey = process.env.KITE_CONNECT_API_KEY;
  const apiSecret = process.env.KITE_CONNECT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("Missing Kite Connect environment variables.");
  }

  const checksum = createHash("sha256")
    .update(`${apiKey}${requestToken}${apiSecret}`)
    .digest("hex");

  const response = await fetch("https://api.kite.trade/session/token", {
    body: new URLSearchParams({
      api_key: apiKey,
      checksum,
      request_token: requestToken,
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Kite-Version": "3",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Could not exchange Zerodha request token.");
  }

  const payload = (await response.json()) as ZerodhaSessionResponse;

  if (!payload.data?.access_token) {
    throw new Error("Zerodha did not return an access token.");
  }

  return payload.data;
}

export async function fetchZerodhaHoldings({
  accessToken,
}: {
  accessToken: string;
}) {
  const apiKey = process.env.KITE_CONNECT_API_KEY;

  if (!apiKey) {
    throw new Error("Missing KITE_CONNECT_API_KEY.");
  }

  const response = await fetch("https://api.kite.trade/portfolio/holdings", {
    headers: {
      Authorization: `token ${apiKey}:${accessToken}`,
      "X-Kite-Version": "3",
    },
  });

  if (!response.ok) {
    throw new Error("Could not load Zerodha holdings.");
  }

  const payload = (await response.json()) as ZerodhaHoldingsResponse;

  return payload.data ?? [];
}

export async function syncZerodhaHoldings({
  accessToken,
  accountLabel,
}: {
  accessToken: string;
  accountLabel: string;
}): Promise<ZerodhaHoldingsSyncResult> {
  const holdings = await fetchZerodhaHoldings({ accessToken });
  const assets = holdings
    .map((holding) => mapZerodhaHoldingToAsset(holding, accountLabel))
    .filter((asset): asset is PortfolioAsset => Boolean(asset));
  const job = createImportJob({
    assetCount: assets.length,
    documentKind: "broker-sync",
    documentStoragePath: null,
    fileName: "zerodha-kite-holdings.json",
    notes: `Live holdings synced from Zerodha Kite for ${accountLabel}.`,
    providerConfidence: "high",
    providerId: "zerodha",
    providerName: "Zerodha Kite",
    rawText: JSON.stringify(holdings),
    status: "completed",
    summary:
      assets.length > 0
        ? `Zerodha holdings sync completed with ${assets.length} live holding${assets.length === 1 ? "" : "s"}.`
        : "Zerodha holdings sync completed, but no holdings were returned.",
  });

  return {
    assets,
    job,
    providerAccountLabel: accountLabel,
  };
}

function mapZerodhaHoldingToAsset(
  holding: ZerodhaHolding,
  accountLabel: string,
) {
  const quantity = Number(holding.quantity ?? 0) + Number(holding.t1_quantity ?? 0);
  const price = Number(holding.last_price ?? 0);
  const investedValue = quantity * Number(holding.average_price ?? 0);
  const value = quantity * price;

  if (!holding.tradingsymbol || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  return {
    gain:
      investedValue > 0
        ? Number((((value - investedValue) / investedValue) * 100).toFixed(2))
        : 0,
    investedValue,
    name: holding.tradingsymbol,
    price,
    quantity,
    source: `${accountLabel} · ${holding.exchange ?? "NSE"}`,
    type: inferAssetTypeFromHolding(holding),
    value,
  } satisfies PortfolioAsset;
}

function inferAssetTypeFromHolding(
  holding: ZerodhaHolding,
) {
  const symbol = `${holding.tradingsymbol ?? ""} ${holding.isin ?? ""}`.toLowerCase();

  if (/etf|bees|gold/.test(symbol)) return "ETF";
  return "Equity";
}

function signZerodhaState(value: string) {
  const secret =
    process.env.BROKER_OAUTH_STATE_SECRET ??
    process.env.CRON_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("Missing BROKER_OAUTH_STATE_SECRET or fallback server secret.");
  }

  return createHmac("sha256", secret).update(value).digest("base64url");
}
