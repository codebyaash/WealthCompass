import { NextResponse } from "next/server";
import { analyzeImportDocument } from "@/lib/import-review";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    fileName?: string;
    normalizationApplied?: string[];
    text?: string;
    usedOcr?: boolean;
  };

  return NextResponse.json(
    analyzeImportDocument({
      fileName: payload.fileName,
      normalizationApplied: payload.normalizationApplied ?? [],
      text: payload.text ?? "",
      usedOcr: payload.usedOcr ?? false,
    }),
  );
}
