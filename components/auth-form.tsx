"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { ArrowLeft, LockKeyhole, Mail } from "lucide-react";
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
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const configured = isSupabaseConfigured();

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

    setStatus(
      mode === "signup"
        ? "Check your email to confirm your account."
        : "Signed in. Your profile data can now be connected to Supabase.",
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Button asChild variant="ghost" className="mb-4">
          <a href="/">
            <ArrowLeft className="h-4 w-4" />
            Back
          </a>
        </Button>
        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <Badge variant={configured ? "secondary" : "outline"} className="w-fit">
              {configured ? "Supabase connected" : "Local demo mode"}
            </Badge>
            <CardTitle>{mode === "signup" ? "Create account" : "Welcome back"}</CardTitle>
            <CardDescription>Supabase Auth-ready email flow.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Password</Label>
              <Input
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
