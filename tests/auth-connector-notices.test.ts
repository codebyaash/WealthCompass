import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getBrokerConnectorNotice,
  getInboxConnectorNotice,
} from "../lib/auth-connector-notices";

describe("getBrokerConnectorNotice", () => {
  it("returns a success message for a connected Zerodha callback", () => {
    assert.match(getBrokerConnectorNotice("zerodha-connected"), /Zerodha connected/i);
  });

  it("returns a specific message for invalid state", () => {
    assert.match(getBrokerConnectorNotice("zerodha-state-invalid"), /verified safely/i);
  });
});

describe("getInboxConnectorNotice", () => {
  it("returns a provider-specific success message", () => {
    assert.match(getInboxConnectorNotice("gmail-connected"), /Gmail connected/i);
  });

  it("returns a provider-specific denied message", () => {
    assert.match(getInboxConnectorNotice("outlook-denied"), /Outlook access was denied/i);
  });

  it("returns an admin-config message when callbacks cannot persist", () => {
    assert.match(getInboxConnectorNotice("missing-admin-config"), /service-role setup/i);
  });
});
