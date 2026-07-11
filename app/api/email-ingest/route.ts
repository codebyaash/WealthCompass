import { NextResponse } from "next/server";
import {
  type EmailIngestionApiResponse,
  ingestEmailStatement,
  type EmailIngestionPayload,
} from "@/lib/email-ingestion";
import {
  getSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { persistCloudImportJob } from "@/lib/supabase-sync";

export async function POST(request: Request) {
  const payload = (await request.json()) as Partial<EmailIngestionPayload>;

  const result = ingestEmailStatement({
    attachments: Array.isArray(payload.attachments)
      ? payload.attachments.map((attachment) => ({
          contentType: attachment.contentType,
          extractedText: attachment.extractedText,
          extractionWarnings: Array.isArray(attachment.extractionWarnings)
            ? attachment.extractionWarnings.filter(
                (warning): warning is string =>
                  typeof warning === "string" && warning.trim().length > 0,
              )
            : [],
          fileName: attachment.fileName ?? "statement-attachment.txt",
          pageCount:
            typeof attachment.pageCount === "number" && Number.isFinite(attachment.pageCount)
              ? attachment.pageCount
              : undefined,
          text: attachment.text,
          usedOcr: Boolean(attachment.usedOcr),
        }))
      : [],
    bodyText: payload.bodyText ?? "",
    from: payload.from ?? "unknown@example.com",
    receivedAt: payload.receivedAt,
    subject: payload.subject ?? "Forwarded statement",
  });

  let persistedToCloud = false;
  let persistenceMessage: string | null = null;
  const accessToken = getBearerToken(request.headers.get("authorization"));

  if (!isSupabaseConfigured()) {
    persistenceMessage = "Supabase is not configured, so this email import was reviewed locally only.";
  } else if (!accessToken) {
    persistenceMessage = "Sign in to save this email import to your cloud history.";
  } else {
    try {
      const supabase = getSupabaseServerClient(accessToken);
      const { data, error } = await supabase.auth.getUser(accessToken);

      if (error) throw error;
      if (!data.user) {
        persistenceMessage = "Could not verify your Supabase session for cloud import storage.";
      } else {
        await persistCloudImportJob({
          job: result.job,
          supabase,
          userId: data.user.id,
        });
        persistedToCloud = true;
        persistenceMessage = "Saved this email import to Supabase history.";
      }
    } catch (error) {
      persistenceMessage = getErrorMessage(error);
    }
  }

  return NextResponse.json({
    persistedToCloud,
    persistenceMessage,
    result,
  } satisfies EmailIngestionApiResponse);
}

function getBearerToken(header: string | null) {
  if (!header) return null;

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Cloud import persistence failed, but the email review is still available locally.";
}
