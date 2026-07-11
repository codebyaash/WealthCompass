export type ImportSupport = "csv" | "email" | "pdf" | "text";

export type ImportReadiness = "guided-import" | "planned-direct" | "ready-now";

export type ImportSourceDescriptor = {
  category: "aggregator" | "broker" | "email" | "registrar";
  hints: string[];
  id: string;
  name: string;
  readiness: ImportReadiness;
  supports: ImportSupport[];
  summary: string;
};

export const importSourceDescriptors: ImportSourceDescriptor[] = [
  {
    category: "broker",
    hints: ["paytm money", "paytmmoney", "paytm", "bse star mf"],
    id: "paytm-money",
    name: "Paytm Money",
    readiness: "guided-import",
    supports: ["csv", "email", "pdf", "text"],
    summary: "Works through exports, statements, and pasted email content.",
  },
  {
    category: "aggregator",
    hints: ["jupiter", "smallcase", "mutual funds on jupiter"],
    id: "jupiter",
    name: "Jupiter",
    readiness: "guided-import",
    supports: ["email", "pdf", "text"],
    summary: "Prepared for statement PDFs and forwarded portfolio emails.",
  },
  {
    category: "broker",
    hints: ["zerodha", "coin by zerodha", "kite"],
    id: "zerodha",
    name: "Zerodha",
    readiness: "guided-import",
    supports: ["csv", "email", "pdf", "text"],
    summary: "Detects common Zerodha and Coin wording from exports and statements.",
  },
  {
    category: "broker",
    hints: ["groww", "groww mutual fund", "groww statement"],
    id: "groww",
    name: "Groww",
    readiness: "guided-import",
    supports: ["csv", "email", "pdf", "text"],
    summary: "Handles CSV, statement text, and PDF-based import preparation.",
  },
  {
    category: "registrar",
    hints: ["cams", "computer age management services"],
    id: "cams",
    name: "CAMS",
    readiness: "ready-now",
    supports: ["email", "pdf", "text"],
    summary: "Good fit for consolidated mutual fund statement emails and PDFs.",
  },
  {
    category: "registrar",
    hints: ["kfintech", "karvy", "kfin"],
    id: "kfintech",
    name: "KFintech",
    readiness: "ready-now",
    supports: ["email", "pdf", "text"],
    summary: "Prepared for registrar statements pasted from email or extracted from PDF.",
  },
  {
    category: "email",
    hints: ["gmail", "google mail", "outlook", "forwarded message", "statement attached"],
    id: "email-forward",
    name: "Email Forward",
    readiness: "ready-now",
    supports: ["email", "pdf", "text"],
    summary: "Paste email bodies directly or upload attached statement PDFs.",
  },
];

export function detectImportSource({
  fileName,
  text,
}: {
  fileName?: string;
  text?: string;
}) {
  const haystack = `${fileName ?? ""}\n${text ?? ""}`.toLowerCase();

  return (
    importSourceDescriptors.find((source) =>
      source.hints.some((hint) => haystack.includes(hint)),
    ) ?? null
  );
}

export function describeReadiness(readiness: ImportReadiness) {
  switch (readiness) {
    case "ready-now":
      return "Ready now";
    case "guided-import":
      return "Guided import";
    case "planned-direct":
      return "Direct sync later";
    default:
      return "Supported";
  }
}
