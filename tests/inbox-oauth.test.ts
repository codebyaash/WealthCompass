import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  buildInboxAuthorizationUrl,
  buildInboxRedirectUri,
  createInboxOauthStateCookie,
  fetchInboxAccountProfile,
  verifyInboxOauthStateCookie,
} from "../lib/inbox-oauth";

describe("inbox oauth helpers", () => {
  it("creates and verifies signed inbox oauth state cookies", () => {
    process.env.INBOX_OAUTH_STATE_SECRET = "test-secret";

    const created = createInboxOauthStateCookie({
      provider: "gmail",
      returnPath: "/auth",
      userId: "user-1",
    });
    const verified = verifyInboxOauthStateCookie(
      created.cookieValue,
      created.state,
      "gmail",
    );

    assert.equal(verified?.provider, "gmail");
    assert.equal(verified?.userId, "user-1");
    assert.equal(verified?.returnPath, "/auth");
  });

  it("builds provider-specific authorization urls", () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "google-client-secret";

    const url = buildInboxAuthorizationUrl({
      origin: "https://wealthcompass.app",
      provider: "gmail",
      state: "state-1",
    });

    assert.match(url, /accounts\.google\.com/);
    assert.match(url, /client_id=google-client-id/);
    assert.match(url, /state=state-1/);
    assert.equal(
      buildInboxRedirectUri("https://wealthcompass.app", "gmail"),
      "https://wealthcompass.app/api/inbox/callback/gmail",
    );
  });

  it("maps inbox account profiles from provider responses", async () => {
    const originalFetch = global.fetch;

    process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "google-client-secret";
    process.env.MICROSOFT_OAUTH_CLIENT_ID = "ms-client-id";
    process.env.MICROSOFT_OAUTH_CLIENT_SECRET = "ms-client-secret";

    mock.method(global, "fetch", async (input: string | URL | Request) => {
      const url = String(input);

      if (url.includes("googleapis.com")) {
        return new Response(JSON.stringify({ email: "user@gmail.com", id: "google-1" }), {
          status: 200,
        });
      }

      return new Response(
        JSON.stringify({ id: "ms-1", mail: null, userPrincipalName: "user@outlook.com" }),
        { status: 200 },
      );
    });

    const gmail = await fetchInboxAccountProfile({
      accessToken: "token",
      provider: "gmail",
    });
    const outlook = await fetchInboxAccountProfile({
      accessToken: "token",
      provider: "outlook",
    });

    assert.deepEqual(gmail, {
      email: "user@gmail.com",
      externalAccountId: "google-1",
    });
    assert.deepEqual(outlook, {
      email: "user@outlook.com",
      externalAccountId: "ms-1",
    });

    global.fetch = originalFetch;
  });
});
