import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getProviderParserProfile,
  providerParserProfiles,
} from "../lib/provider-parser-profiles";

describe("getProviderParserProfile", () => {
  it("returns parser guidance for known providers", () => {
    const profile = getProviderParserProfile("paytm-money");

    assert.equal(profile?.name, "Paytm Money");
    assert.ok(profile?.preferredHeaders.includes("scheme name"));
  });

  it("returns null for unknown providers", () => {
    assert.equal(getProviderParserProfile("unknown-provider"), null);
    assert.ok(providerParserProfiles.length >= 6);
  });
});
