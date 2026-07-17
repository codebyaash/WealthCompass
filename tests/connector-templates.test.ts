import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  connectorTemplates,
  createConnectionFromTemplate,
  describeConnectorTemplate,
  getConnectorTemplate,
} from "../lib/connector-templates";

describe("connector templates", () => {
  it("creates a Paytm Money connection with guided statement defaults", () => {
    const connection = createConnectionFromTemplate("paytm-money");

    assert.equal(connection.providerId, "paytm-money");
    assert.equal(connection.providerName, "Paytm Money");
    assert.equal(connection.channel, "broker");
    assert.equal(connection.importStrategy, "statement-upload");
    assert.equal(connection.syncCadenceMinutes, 10080);
  });

  it("creates an email-forward connection with inbox-friendly defaults", () => {
    const connection = createConnectionFromTemplate("email-forward");

    assert.equal(connection.channel, "email");
    assert.equal(connection.importStrategy, "email-forward");
    assert.match(connection.sourceHint, /email/i);
  });

  it("describes template readiness and cadence with readable labels", () => {
    const template = getConnectorTemplate("cams");

    assert.ok(template);

    const description = describeConnectorTemplate(template);

    assert.equal(description.readinessLabel, "Ready now");
    assert.match(description.cadenceLabel, /Every 3 days/i);
  });

  it("keeps provider templates available for multiple source types", () => {
    assert.equal(connectorTemplates.some((template) => template.id === "zerodha"), true);
    assert.equal(connectorTemplates.some((template) => template.id === "groww"), true);
    assert.equal(connectorTemplates.some((template) => template.id === "email-forward"), true);
  });
});
