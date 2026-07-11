import { NextResponse } from "next/server";
import { importSourceDescriptors } from "@/lib/import-sources";

export async function GET() {
  return NextResponse.json({
    acceptedFormats: ["csv", "tsv", "txt", "html", "pdf"],
    importSources: importSourceDescriptors,
    message:
      "WealthCompass currently supports guided import through exports, pasted emails, and PDF statements. Direct sync connectors can plug into the same intake layer later.",
  });
}
