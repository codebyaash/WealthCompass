import { NextResponse } from "next/server";
import { extractTextFromPdfBuffer } from "@/lib/pdf-import-server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const entry = formData.get("file");

    if (!(entry instanceof File)) {
      return NextResponse.json({ error: "File upload is required." }, { status: 400 });
    }

    const isPdf =
      entry.type === "application/pdf" || entry.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return NextResponse.json({
        fileName: entry.name,
        isPdf: false,
        pageCount: 0,
        text: await entry.text(),
        usedOcr: false,
        warnings: [] as string[],
      });
    }

    const buffer = new Uint8Array(await entry.arrayBuffer());
    const extraction = await extractTextFromPdfBuffer(buffer);

    return NextResponse.json({
      fileName: entry.name,
      isPdf: true,
      pageCount: extraction.pageCount,
      text: extraction.text,
      usedOcr: extraction.usedOcr,
      warnings: extraction.warnings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not extract text from that file.",
      },
      { status: 500 },
    );
  }
}
