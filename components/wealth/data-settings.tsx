"use client";

import { useMemo, useState } from "react";
import { Cloud, Copy, Download, RotateCcw, Upload } from "lucide-react";
import { MetricMini } from "@/components/wealth/metric-mini";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  parseWorkspaceImport,
  type PortfolioAsset,
  type RiskHistoryItem,
  type WealthCompassImport,
  type WealthGoal,
} from "@/lib/local-storage";
import type { RiskAnswers, RiskProfile } from "@/lib/wealth-rules";

export function DataSettings({
  answers,
  assets,
  goals,
  onImportWorkspace,
  onResetPortfolio,
  onRestoreDemoWorkspace,
  profile,
  riskHistory,
  syncMessage,
  syncStatus,
  userEmail,
}: {
  answers: RiskAnswers;
  assets: PortfolioAsset[];
  goals: WealthGoal[];
  onImportWorkspace: (workspace: WealthCompassImport) => void;
  onResetPortfolio: () => void;
  onRestoreDemoWorkspace: () => void;
  profile: RiskProfile;
  riskHistory: RiskHistoryItem[];
  syncMessage: string;
  syncStatus: string;
  userEmail: string;
}) {
  const [actionMessage, setActionMessage] = useState("Full workspace export is ready.");
  const [importJson, setImportJson] = useState("");
  const exportedSnapshot = useMemo(
    () =>
      JSON.stringify(
        {
          answers,
          assets,
          exportedAt: new Date().toISOString(),
          goals,
          profile,
          riskHistory,
          version: 1,
        },
        null,
        2,
      ),
    [answers, assets, goals, profile, riskHistory],
  );

  async function handleCopySnapshot() {
    if (!navigator.clipboard) {
      setActionMessage("Clipboard is unavailable in this browser.");
      return;
    }

    await navigator.clipboard.writeText(exportedSnapshot);
    setActionMessage("Workspace JSON copied.");
  }

  function handleDownloadSnapshot() {
    const blob = new Blob([exportedSnapshot], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wealthcompass-data.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setActionMessage("Downloaded wealthcompass-data.json.");
  }

  function handleResetPortfolio() {
    onResetPortfolio();
    setActionMessage("Portfolio restored to demo holdings.");
  }

  function handleRestoreDemoWorkspace() {
    onRestoreDemoWorkspace();
    setActionMessage("Demo workspace restored.");
  }

  function handleImportWorkspace() {
    const result = parseWorkspaceImport(importJson);

    if (!result.data) {
      setActionMessage(result.errors.join(" "));
      return;
    }

    onImportWorkspace(result.data);
    setImportJson("");
    setActionMessage("Imported workspace JSON.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <CardTitle>Settings and data</CardTitle>
          <CardDescription>Manage the free MVP workspace without broker or AI integrations.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Sync status</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary">{syncStatus}</Badge>
              <Badge variant="outline">{userEmail || "Browser workspace"}</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{syncMessage}</p>
          </div>

          <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium">Workspace export</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Includes onboarding answers, risk profile, portfolio, goals, and saved risk snapshots.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleCopySnapshot}>
                <Copy className="h-4 w-4" />
                Copy JSON
              </Button>
              <Button type="button" variant="outline" onClick={handleDownloadSnapshot}>
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{actionMessage}</p>
          </div>

          <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-medium">Workspace import</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Paste a `wealthcompass-data.json` export to restore onboarding, portfolio, goals, and history.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={handleImportWorkspace}>
                <Upload className="h-4 w-4" />
                Import JSON
              </Button>
            </div>
            <textarea
              className="min-h-36 w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="{ ... }"
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
            />
          </div>

          <div className="grid gap-3 rounded-md border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium">Reset controls</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Demo resets are useful for walkthroughs, screenshots, and portfolio reviews.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleResetPortfolio}>
                <RotateCcw className="h-4 w-4" />
                Portfolio
              </Button>
              <Button type="button" variant="secondary" onClick={handleRestoreDemoWorkspace}>
                <RotateCcw className="h-4 w-4" />
                Demo workspace
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Data snapshot</CardTitle>
            <CardDescription>Current local state prepared for future import and account portability.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <MetricMini label="Portfolio holdings" value={`${assets.length}`} />
            <MetricMini label="Risk snapshots" value={`${riskHistory.length}`} />
            <MetricMini label="Goals" value={`${goals.length}`} />
            <MetricMini label="Risk score" value={`${profile.score}/100`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export preview</CardTitle>
            <CardDescription>Readable backup format for demos and debugging.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/40 p-4 text-xs leading-5">
              {exportedSnapshot}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
