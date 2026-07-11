import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  buildZerodhaAuthorizationUrl,
  createZerodhaOauthStateCookie,
  syncZerodhaHoldings,
  verifyZerodhaOauthStateCookie,
} from "../lib/zerodha-sync";

describe("zerodha oauth helpers", () => {
  it("creates and verifies signed zerodha oauth state cookies", () => {
    process.env.BROKER_OAUTH_STATE_SECRET = "broker-test-secret";

    const created = createZerodhaOauthStateCookie({
      returnPath: "/auth",
      userId: "user-1",
    });
    const verified = verifyZerodhaOauthStateCookie(created.cookieValue, created.state);

    assert.equal(verified?.userId, "user-1");
    assert.equal(verified?.returnPath, "/auth");
  });

  it("builds the zerodha connect url", () => {
    process.env.KITE_CONNECT_API_KEY = "kite-api-key";

    const url = buildZerodhaAuthorizationUrl({
      origin: "https://wealthcompass.app",
      state: "state-1",
    });

    assert.match(url, /kite\.zerodha\.com\/connect\/login/);
    assert.match(url, /api_key=kite-api-key/);
    assert.match(url, /state=state-1/);
  });
});

describe("syncZerodhaHoldings", () => {
  it("maps live holdings into portfolio assets and a completed import job", async () => {
    const originalFetch = global.fetch;
    process.env.KITE_CONNECT_API_KEY = "kite-api-key";

    mock.method(global, "fetch", async () => {
      return new Response(
        JSON.stringify({
          data: [
            {
              average_price: 100,
              exchange: "NSE",
              last_price: 120,
              quantity: 10,
              t1_quantity: 2,
              tradingsymbol: "INFY",
            },
            {
              average_price: 500,
              exchange: "NSE",
              last_price: 540,
              quantity: 4,
              t1_quantity: 0,
              tradingsymbol: "NIFTYBEES",
            },
          ],
        }),
        { status: 200 },
      );
    });

    const result = await syncZerodhaHoldings({
      accessToken: "access-token",
      accountLabel: "Ash Zerodha",
    });

    assert.equal(result.assets.length, 2);
    assert.equal(result.assets[0]?.name, "INFY");
    assert.equal(result.assets[0]?.value, 1440);
    assert.equal(result.assets[1]?.type, "ETF");
    assert.equal(result.job.status, "completed");
    assert.equal(result.job.providerId, "zerodha");
    assert.match(result.job.summary, /holdings sync completed/i);

    global.fetch = originalFetch;
  });
});
