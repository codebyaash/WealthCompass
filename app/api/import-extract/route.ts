import { NextResponse } from "next/server";
import { extractTextFromPdfBuffer } from "@/lib/pdf-import-server";

export async function POST(request: Request) {
  try {
    const encodedFileName = request.headers.get("x-file-name");
    const fileName = encodedFileName ? decodeURIComponent(encodedFileName) : "upload";
    const contentType = request.headers.get("content-type") ?? "application/octet-stream";
    const buffer = new Uint8Array(await request.arrayBuffer());

    const isPdf =
      contentType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return NextResponse.json({
        fileName,
        isPdf: false,
        pageCount: 0,
        text: new TextDecoder().decode(buffer),
        usedOcr: false,
        warnings: [] as string[],
      });
    }

    const extraction = await extractTextFromPdfBuffer(buffer);

    return NextResponse.json({
      fileName,
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
