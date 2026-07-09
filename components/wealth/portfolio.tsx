"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Check, Copy, Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Roadmap } from "@/components/wealth/roadmap";
import { HealthCheck } from "@/components/wealth/health-check";
import { NumberField, TextField } from "@/components/wealth/form-fields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  parsePortfolioCsv,
  portfolioAssetsToCsv,
  samplePortfolioCsv,
} from "@/lib/csv-import";
import { formatMoney } from "@/lib/formatters";
import type { PortfolioAsset } from "@/lib/local-storage";
import { getPortfolioHealthChecks } from "@/lib/portfolio-rules";
import type { RiskProfile } from "@/lib/wealth-rules";

export function Portfolio({
  assets,
  onAddAsset,
  onDeleteAsset,
  onImportAssets,
  onResetAssets,
  onUpdateAsset,
  portfolioTotal,
  profile,
}: {
  assets: PortfolioAsset[];
  onAddAsset: (asset: PortfolioAsset) => void;
  onDeleteAsset: (assetIndex: number) => void;
  onImportAssets: (assets: PortfolioAsset[]) => void;
  onResetAssets: () => void;
  onUpdateAsset: (assetIndex: number, asset: PortfolioAsset) => void;
  portfolioTotal: number;
  profile: RiskProfile;
}) {
  const [draftAsset, setDraftAsset] = useState<PortfolioAsset>({
    name: "New index fund",
    type: "Index Fund",
    value: 25000,
    gain: 0,
  });
  const [csvText, setCsvText] = useState(samplePortfolioCsv);
  const [csvMessage, setCsvMessage] = useState("Paste CSV with name, type, value, gain.");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingAsset, setEditingAsset] = useState<PortfolioAsset | null>(null);
  const exportedCsv = useMemo(() => portfolioAssetsToCsv(assets), [assets]);

  const chartData = assets.map((asset) => ({
    name: asset.type,
    value: asset.value,
  }));
  const portfolioChecks = getPortfolioHealthChecks({
    assets,
    portfolioTotal,
    profile,
  });

  function handleCsvImport() {
    const result = parsePortfolioCsv(csvText);

    if (!result.assets.length) {
      setCsvMessage(result.errors.join(" "));
      return;
    }

    onImportAssets(result.assets);
    setCsvMessage(
      result.errors.length
        ? `Imported ${result.assets.length} holdings. ${result.errors.join(" ")}`
        : `Imported ${result.assets.length} holdings.`,
    );
  }

  function handleStartEdit(asset: PortfolioAsset, assetIndex: number) {
    setEditingIndex(assetIndex);
    setEditingAsset(asset);
  }

  function handleSaveEdit() {
    if (editingIndex === null || !editingAsset) return;
    if (!editingAsset.name.trim() || editingAsset.value < 0) {
      setCsvMessage("Edited holding needs a name and non-negative value.");
      return;
    }

    onUpdateAsset(editingIndex, editingAsset);
    setEditingIndex(null);
    setEditingAsset(null);
    setCsvMessage("Holding updated.");
  }

  function handleCancelEdit() {
    setEditingIndex(null);
    setEditingAsset(null);
  }

  function handleDelete(assetIndex: number) {
    onDeleteAsset(assetIndex);
    if (editingIndex === assetIndex) {
      handleCancelEdit();
    }
    setCsvMessage("Holding removed.");
  }

  async function handleCsvFileUpload(file: File | null) {
    if (!file) return;

    const text = await file.text();
    setCsvText(text);
    setCsvMessage(`${file.name} loaded. Review the preview, then import.`);
  }

  async function handleCopyCsv() {
    if (!navigator.clipboard) {
      setCsvMessage("Clipboard is unavailable in this browser.");
      return;
    }

    await navigator.clipboard.writeText(exportedCsv);
    setCsvMessage("Current portfolio CSV copied.");
  }

  function handleDownloadCsv() {
    const blob = new Blob([exportedCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wealthcompass-portfolio.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setCsvMessage("Downloaded current portfolio CSV.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Manual portfolio tracker</CardTitle>
              <CardDescription>{formatMoney(portfolioTotal)} tracked</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleCopyCsv}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadCsv}>
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!draftAsset.name || draftAsset.value <= 0) return;
                  onAddAsset(draftAsset);
                }}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">Add one holding</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Manual entry is useful for quick edits and demo data.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="Asset name"
                value={draftAsset.name}
                onChange={(value) => setDraftAsset({ ...draftAsset, name: value })}
              />
              <TextField
                label="Type"
                value={draftAsset.type}
                onChange={(value) => setDraftAsset({ ...draftAsset, type: value })}
              />
              <NumberField
                label="Current value"
                value={draftAsset.value}
                onChange={(value) => setDraftAsset({ ...draftAsset, value })}
              />
              <NumberField
                label="Gain %"
                value={draftAsset.gain}
                onChange={(value) => setDraftAsset({ ...draftAsset, gain: value })}
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-medium">CSV import</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Columns: name, type, value, gain. Values stay local unless Supabase sync is active.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={handleCsvImport}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </div>
            <Input
              accept=".csv,text/csv"
              type="file"
              onChange={(event) => void handleCsvFileUpload(event.target.files?.[0] ?? null)}
            />
            <textarea
              className="min-h-32 w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
            />
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-xs leading-5 text-muted-foreground">{csvMessage}</p>
              <Button type="button" variant="ghost" size="sm" onClick={onResetAssets}>
                Reset demo data
              </Button>
            </div>
          </div>

          {assets.map((asset, index) => (
            <div
              key={`${asset.name}-${asset.type}-${index}`}
              className="grid gap-3 rounded-md border p-3"
            >
              {editingIndex === index && editingAsset ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <TextField
                    label="Asset name"
                    value={editingAsset.name}
                    onChange={(value) => setEditingAsset({ ...editingAsset, name: value })}
                  />
                  <TextField
                    label="Type"
                    value={editingAsset.type}
                    onChange={(value) => setEditingAsset({ ...editingAsset, type: value })}
                  />
                  <NumberField
                    label="Current value"
                    value={editingAsset.value}
                    onChange={(value) => setEditingAsset({ ...editingAsset, value })}
                  />
                  <NumberField
                    label="Gain %"
                    value={editingAsset.gain}
                    onChange={(value) => setEditingAsset({ ...editingAsset, gain: value })}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{asset.name}</p>
                    <p className="text-sm text-muted-foreground">{asset.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatMoney(asset.value)}</p>
                    <p className="text-sm text-primary">+{asset.gain}%</p>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {editingIndex === index ? (
                  <>
                    <Button type="button" size="sm" onClick={handleSaveEdit}>
                      <Check className="h-4 w-4" />
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartEdit(asset, index)}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(index)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Current allocation</CardTitle>
            <CardDescription>Compare real holdings with your suggested mix.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Number(value) / 1000}k`}
                />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--color-chart-3)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Portfolio health checks</CardTitle>
            <CardDescription>Rule-based review before AI review exists.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {portfolioChecks.map((check) => (
              <HealthCheck key={check.label} {...check} />
            ))}
          </CardContent>
        </Card>
        <Roadmap profile={profile} compact />
      </div>
    </div>
  );
}
