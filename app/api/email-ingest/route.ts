import { NextResponse } from "next/server";
import {
  ingestEmailStatement,
  type EmailIngestionPayload,
} from "@/lib/email-ingestion";

export async function POST(request: Request) {
  const payload = (await request.json()) as Partial<EmailIngestionPayload>;

  const result = ingestEmailStatement({
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    bodyText: payload.bodyText ?? "",
    from: payload.from ?? "unknown@example.com",
    receivedAt: payload.receivedAt,
    subject: payload.subject ?? "Forwarded statement",
  });

  return NextResponse.json(result);
}
