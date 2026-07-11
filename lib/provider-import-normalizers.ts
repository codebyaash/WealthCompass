export type ProviderNormalizationResult = {
  applied: string[];
  text: string;
};

export function normalizeImportTextForProvider({
  providerId,
  text,
}: {
  providerId: string | null | undefined;
  text: string;
}): ProviderNormalizationResult {
  const normalizedProviderId = providerId ?? "";
  let nextText = text;
  const applied: string[] = [];

  if (normalizedProviderId === "email-forward") {
    const cleaned = nextText
      .replace(/^>.*$/gm, "")
      .replace(/^On .*wrote:$/gim, "")
      .replace(/^From:\s.*$/gim, "")
      .replace(/^Sent:\s.*$/gim, "")
      .replace(/^Subject:\s.*$/gim, "")
      .replace(/^Regards,[\s\S]*$/gim, "")
      .trim();

    if (cleaned !== nextText) {
      nextText = cleaned;
      applied.push("Removed common email reply-chain and footer lines");
    }
  }

  if (normalizedProviderId === "cams" || normalizedProviderId === "kfintech") {
    const cleaned = nextText
      .replace(/page \d+ of \d+/gi, "")
      .replace(/this is a computer generated statement/gi, "")
      .replace(/mutual fund investments are subject to market risks[\s\S]*$/gi, "")
      .trim();

    if (cleaned !== nextText) {
      nextText = cleaned;
      applied.push("Removed common registrar footer and pagination text");
    }
  }

  if (normalizedProviderId === "paytm-money") {
    const cleaned = nextText
      .replace(/bse star mf/gi, "Paytm Money")
      .replace(/\bregular plan\b/gi, "Regular Plan")
      .replace(/\bdirect plan\b/gi, "Direct Plan");

    if (cleaned !== nextText) {
      nextText = cleaned;
      applied.push("Normalized Paytm Money naming variants");
    }
  }

  if (normalizedProviderId === "zerodha" || normalizedProviderId === "groww") {
    const cleaned = nextText
      .replace(/\bisin\s*:\s*/gi, "ISIN ")
      .replace(/\bltp\s*[:=-]?\s*/gi, "LTP ")
      .replace(/\bqty\s*[:=-]?\s*/gi, "Qty ");

    if (cleaned !== nextText) {
      nextText = cleaned;
      applied.push("Standardized broker shorthand labels");
    }
  }

  if (normalizedProviderId === "jupiter") {
    const cleaned = nextText
      .replace(/\u00a0/g, " ")
      .replace(/[ ]{2,}/g, "\t");

    if (cleaned !== nextText) {
      nextText = cleaned;
      applied.push("Recovered tabular spacing from Jupiter exports");
    }
  }

  const whitespaceCollapsed = nextText
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (whitespaceCollapsed !== nextText) {
    nextText = whitespaceCollapsed;
    applied.push("Collapsed extra whitespace");
  }

  return {
    applied,
    text: nextText,
  };
}
