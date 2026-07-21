"use client";

import type { FormEvent } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LockKeyhole, Mail } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getBrokerConnectorNotice,
  getInboxConnectorNotice,
} from "@/lib/auth-connector-notices";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const emailFieldId = useId();
  const passwordFieldId = useId();
  const configured = isSupabaseConfigured();
  const connectorNotice = useMemo(() => {
    const broker = searchParams.get("broker");
    const inbox = searchParams.get("inbox");
    return getBrokerConnectorNotice(broker) || getInboxConnectorNotice(inbox);
  }, [searchParams]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const client = supabase;

    let redirectTimer: number | null = null;

    async function hydrateSession() {
      const { data } = await client.auth.getSession();
      if (!data.session?.user) return;

      setMode("signin");
      setStatus(`Signed in as ${data.session.user.email ?? "your account"}. Redirecting to WealthCompass...`);
      redirectTimer = window.setTimeout(() => {
        router.replace("/");
      }, 500);
    }

    void hydrateSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setMode("signin");
        setStatus(`Signed in as ${session.user.email ?? "your account"}. Redirecting to WealthCompass...`);
        redirectTimer = window.setTimeout(() => {
          router.replace("/");
        }, 500);
      }
    });

    return () => {
      if (redirectTimer) window.clearTimeout(redirectTimer);
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Add Supabase URL and anon key to .env.local to enable real auth.");
      return;
    }

    setIsLoading(true);
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth`,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    setIsLoading(false);

    if (result.error) {
      setStatus(result.error.message);
      return;
    }

    const signedInSession = result.data.session;
    if (mode === "signin" || signedInSession) {
      setStatus("Signed in. Redirecting to WealthCompass...");
      router.replace("/");
      return;
    }

    setStatus("Check your email to confirm your account, then sign in to start the synced demo.");
  }

  return (
    <main className="market-grid flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button asChild variant="ghost">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <ThemeToggle />
        </div>
        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <Badge variant={configured ? "secondary" : "outline"} className="w-fit">
              {configured ? "Supabase connected" : "Local demo mode"}
            </Badge>
            <CardTitle>{mode === "signup" ? "Create account" : "Welcome back"}</CardTitle>
            <CardDescription>
              Sign in to sync your WealthCompass workspace and carry your portfolio
              intelligence across devices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              {connectorNotice ? (
                <div className="rounded-md border bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">
                  {connectorNotice}
                </div>
              ) : null}
              {!configured ? (
                <div className="rounded-md border bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">
                  Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` to enable real sign-in. Add `SUPABASE_SERVICE_ROLE_KEY` for broker and email callback persistence.
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor={emailFieldId}>Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    id={emailFieldId}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                    type="email"
                    value={email}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={passwordFieldId}>Password</Label>
                <Input
                  id={passwordFieldId}
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  type="password"
                  value={password}
                />
              </div>
              {status && (
                <div className="rounded-md border bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">
                  {status}
                </div>
              )}
              <Button disabled={isLoading}>
                {isLoading ? "Working..." : mode === "signup" ? "Sign up" : "Sign in"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              >
                {mode === "signup" ? "Use existing account" : "Create a new account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
