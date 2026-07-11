import { NextResponse } from "next/server";
import { type InboundEmailPayload, processInboundEmail } from "@/lib/inbound-email";
import { getSupabaseServiceRoleClient, isSupabaseAdminConfigured } from "@/lib/supabase";
import { persistCloudImportJob } from "@/lib/supabase-sync";

export const dynamic = "force-dynamic";

type InboundEmailApiPayload = InboundEmailPayload & {
  userId?: string;
};

export async function POST(request: Request) {
  if (!isAuthorizedInboundRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      {
        error: "Missing Supabase admin configuration.",
        ok: false,
      },
      { status: 503 },
    );
  }

  const payload = (await request.json()) as InboundEmailApiPayload;

  if (!payload.userId) {
    return NextResponse.json(
      {
        error: "A target userId is required for inbound email ingestion.",
        ok: false,
      },
      { status: 400 },
    );
  }

  try {
    const processing = await processInboundEmail(payload);
    const supabase = getSupabaseServiceRoleClient();

    await persistCloudImportJob({
      job: processing.result.job,
      supabase,
      userId: payload.userId,
    });

    return NextResponse.json({
      attachmentCount: processing.attachmentCount,
      documentId: processing.result.job.documentId,
      messageId: processing.messageId,
      ok: true,
      providerId: processing.result.job.providerId,
      status: processing.result.job.status,
      summary: processing.result.review.summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: getErrorMessage(error),
        ok: false,
      },
      { status: 500 },
    );
  }
}

function isAuthorizedInboundRequest(request: Request) {
  const secret = process.env.EMAIL_INGEST_SECRET;

  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-email-ingest-secret");

  return authHeader === `Bearer ${secret}` || headerSecret === secret;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Inbound email processing failed.";
}
