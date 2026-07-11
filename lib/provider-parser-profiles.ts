export type ProviderParserProfile = {
  bestInputs: string[];
  commonPitfalls: string[];
  id: string;
  name: string;
  preferredHeaders: string[];
  reviewChecklist: string[];
};

export const providerParserProfiles: ProviderParserProfile[] = [
  {
    bestInputs: ["Monthly account statement PDF", "Portfolio CSV export", "Email holding summary"],
    commonPitfalls: ["Mixed folio summary rows", "Statement footer noise", "Duplicate scheme rows across folios"],
    id: "paytm-money",
    name: "Paytm Money",
    preferredHeaders: ["scheme name", "current value", "invested value", "units", "nav"],
    reviewChecklist: [
      "Confirm scheme names did not split across lines.",
      "Check duplicate folios before merging.",
      "Verify invested value after OCR on PDF uploads.",
    ],
  },
  {
    bestInputs: ["Broker holdings CSV", "Statement PDF", "Email statement text"],
    commonPitfalls: ["Broker plus DP sections in one file", "Stock and MF blocks mixed together"],
    id: "groww",
    name: "Groww",
    preferredHeaders: ["security name", "market value", "invested value", "quantity", "ltp"],
    reviewChecklist: [
      "Separate equity and MF sections if values look merged.",
      "Check whether gains are absolute or percentage.",
    ],
  },
  {
    bestInputs: ["Coin statement PDF", "Kite holdings export", "Email statement text"],
    commonPitfalls: ["Coin and Kite exports use different naming", "ISIN-led rows without clean type labels"],
    id: "zerodha",
    name: "Zerodha",
    preferredHeaders: ["security name", "market value", "quantity", "ltp", "isin"],
    reviewChecklist: [
      "Review rows that only expose ISIN without a clean product label.",
      "Confirm ETFs are not classified as direct equity.",
    ],
  },
  {
    bestInputs: ["Consolidated account statement PDF", "Forwarded statement email"],
    commonPitfalls: ["Registrar disclaimers", "Multiple AMCs in one document", "Partial statement date ranges"],
    id: "cams",
    name: "CAMS",
    preferredHeaders: ["scheme name", "current value", "units", "nav", "folio"],
    reviewChecklist: [
      "Trim non-holdings pages if OCR quality is low.",
      "Verify folio-wise duplicates before import.",
    ],
  },
  {
    bestInputs: ["Consolidated statement PDF", "Email statement body"],
    commonPitfalls: ["Legacy Karvy wording", "AMC blocks split across pages"],
    id: "kfintech",
    name: "KFintech",
    preferredHeaders: ["scheme name", "current value", "units", "nav", "folio"],
    reviewChecklist: [
      "Check AMC section breaks for missing rows.",
      "Confirm OCR preserved decimal places in unit counts.",
    ],
  },
  {
    bestInputs: ["Tab-separated statement table", "Email attachment PDF"],
    commonPitfalls: ["Tables pasted with missing tabs", "Aggregator summaries without invested value"],
    id: "jupiter",
    name: "Jupiter",
    preferredHeaders: ["scheme name", "current value", "units", "nav"],
    reviewChecklist: [
      "Ensure the pasted table kept its columns.",
      "Backfill invested value if only current value is present.",
    ],
  },
  {
    bestInputs: ["Forwarded Gmail body", "Forwarded Outlook body", "Attached PDF text"],
    commonPitfalls: ["Email signatures", "Quoted reply chains", "Promotional footer blocks"],
    id: "email-forward",
    name: "Email Forward",
    preferredHeaders: ["scheme name", "current value", "invested value", "units"],
    reviewChecklist: [
      "Trim signatures and long reply chains.",
      "Keep the actual holdings block close to the top of the pasted text.",
    ],
  },
];

export function getProviderParserProfile(providerId: string | null | undefined) {
  if (!providerId) return null;
  return providerParserProfiles.find((profile) => profile.id === providerId) ?? null;
}
