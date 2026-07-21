function formatInboxProvider(provider: string) {
  return provider === "gmail" ? "Gmail" : provider === "outlook" ? "Outlook" : "Inbox";
}

export function getBrokerConnectorNotice(status: string | null) {
  if (!status) return "";

  switch (status) {
    case "zerodha-connected":
      return "Zerodha connected. Head back to the app and run a holdings sync from Settings.";
    case "missing-admin-config":
      return "Broker callbacks are missing the Supabase service-role setup, so Zerodha could not be saved yet.";
    case "zerodha-missing-code":
      return "Zerodha did not return a complete login payload. Start the broker connect step again from Settings.";
    case "zerodha-state-invalid":
      return "Zerodha login could not be verified safely. Start the broker connect step again from Settings.";
    case "zerodha-error":
      return "Zerodha login finished, but WealthCompass could not finish saving the connection. Retry from Settings.";
    case "unsupported-provider":
      return "That broker connector is not supported in this build yet.";
    default:
      return "Zerodha connection did not finish cleanly. Try the broker connect step again from Settings.";
  }
}

export function getInboxConnectorNotice(status: string | null) {
  if (!status) return "";

  if (status === "unsupported-provider") {
    return "That inbox provider is not supported in this build yet.";
  }

  if (status === "missing-admin-config") {
    return "Inbox callbacks are missing the Supabase service-role setup, so the connection could not be saved yet.";
  }

  const matched = status.match(/^(gmail|outlook)-(connected|denied|missing-code|state-invalid|error)$/);
  if (!matched) {
    return "Inbox connection did not finish cleanly. Reconnect the provider from Settings when you are ready.";
  }

  const [, provider, result] = matched;
  const providerLabel = formatInboxProvider(provider);

  switch (result) {
    case "connected":
      return `${providerLabel} connected. You can return to the app and continue the statement-ingestion demo.`;
    case "denied":
      return `${providerLabel} access was denied before setup finished. Retry from Settings when you are ready.`;
    case "missing-code":
      return `${providerLabel} did not return a complete OAuth payload. Start the inbox connect step again from Settings.`;
    case "state-invalid":
      return `${providerLabel} login could not be verified safely. Start the inbox connect step again from Settings.`;
    case "error":
      return `${providerLabel} login finished, but WealthCompass could not finish saving the connection. Retry from Settings.`;
    default:
      return "Inbox connection did not finish cleanly. Reconnect the provider from Settings when you are ready.";
  }
}
