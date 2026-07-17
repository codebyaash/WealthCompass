"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Check,
  Copy,
  Download,
  Mail,
  Pencil,
  Plus,
  ScanSearch,
  Trash2,
  Upload,
} from "lucide-react";
import { Roadmap } from "@/components/wealth/roadmap";
import { HealthCheck } from "@/components/wealth/health-check";
import { MetricMini } from "@/components/wealth/metric-mini";
import { Badge } from "@/components/ui/badge";
import {
  NumberField,
  SegmentedControl,
  TextField,
} from "@/components/wealth/form-fields";
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
  applyPortfolioImport,
  portfolioAssetsToCsv,
  previewPortfolioImport,
  samplePortfolioCsv,
  type PortfolioImportMode,
} from "@/lib/csv-import";
import { formatMoney } from "@/lib/formatters";
import {
  describeReadiness,
  detectImportSource,
  importSourceDescriptors,
} from "@/lib/import-sources";
import { normalizeImportTextForProvider } from "@/lib/provider-import-normalizers";
import { getProviderParserProfile } from "@/lib/provider-parser-profiles";
import {
  analyzeImportDocument,
  type ImportReview,
} from "@/lib/import-review";
import { createImportJobFromReview } from "@/lib/import-jobs";
import { buildImportDiagnostics, type ImportDiagnostics } from "@/lib/import-diagnostics";
import { parseImportedTransactions } from "@/lib/transaction-import";
import {
  createPortfolioTransaction,
  coercePortfolioAssets,
  type ImportJob,
  type PortfolioAsset,
  type PortfolioTransaction,
} from "@/lib/local-storage";
import {
  calculatePortfolioInvestedValue,
  getAllocationInsights,
  getPortfolioDiversificationScore,
  calculateRealizedGainFromTransactions,
  getPortfolioHealthChecks,
  summarizeTransactions,
} from "@/lib/portfolio-rules";
import type { RiskProfile } from "@/lib/wealth-rules";

type PdfExtractResult = {
  pageCount: number;
  text: string;
  usedOcr: boolean;
  warnings: string[];
};

const importModeOptions: Array<[PortfolioImportMode, string]> = [
  ["merge", "Merge duplicates"],
  ["add", "Keep all rows"],
];

const defaultDraftAsset: PortfolioAsset = {
  gain: 0,
  investedValue: 25000,
  name: "New index fund",
  price: 100,
  quantity: 250,
  source: "Manual",
  type: "Index Fund",
  value: 25000,
};

export function Portfolio({
  assets,
  onAddAsset,
  onAddTransaction,
  onDeleteAsset,
  onDeleteTransaction,
  onImportAssets,
  onLogImportJob,
  onResetAssets,
  onUpdateAsset,
  portfolioTotal,
  profile,
  transactions,
}: {
  assets: PortfolioAsset[];
  onAddAsset: (asset: PortfolioAsset) => void;
  onAddTransaction: (transaction: PortfolioTransaction) => void;
  onDeleteAsset: (assetIndex: number) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onImportAssets: (assets: PortfolioAsset[]) => void;
  onLogImportJob: (job: ImportJob) => void;
  onResetAssets: () => void;
  onUpdateAsset: (assetIndex: number, asset: PortfolioAsset) => void;
  portfolioTotal: number;
  profile: RiskProfile;
  transactions: PortfolioTransaction[];
}) {
  const [draftAsset, setDraftAsset] = useState<PortfolioAsset>(defaultDraftAsset);
  const [csvText, setCsvText] = useState(samplePortfolioCsv);
  const [csvMessage, setCsvMessage] = useState(
    "Paste or upload portfolio exports, email statements, or broker spreadsheets.",
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingAsset, setEditingAsset] = useState<PortfolioAsset | null>(null);
  const [importMode, setImportMode] = useState<PortfolioImportMode>("merge");
  const [importReview, setImportReview] = useState<ImportReview | null>(null);
  const [importArtifacts, setImportArtifacts] = useState<ImportDiagnostics | null>(null);
  const [selectedImportKeys, setSelectedImportKeys] = useState<string[]>([]);
  const [isReviewingImport, setIsReviewingImport] = useState(false);
  const [draftTransaction, setDraftTransaction] = useState<PortfolioTransaction>(
    createPortfolioTransaction(),
  );
  const safeAssets = useMemo(() => coercePortfolioAssets(assets, []), [assets]);
  const exportedCsv = useMemo(() => portfolioAssetsToCsv(safeAssets), [safeAssets]);
  const importPreview = useMemo(
    () => previewPortfolioImport(csvText, safeAssets),
    [safeAssets, csvText],
  );
  const selectedImportedAssets = useMemo(
    () =>
      importPreview.assets.filter((asset, index) =>
        selectedImportKeys.includes(createImportSelectionKey(asset, index)),
      ),
    [importPreview.assets, selectedImportKeys],
  );
  const selectedDuplicateCount = useMemo(() => {
    const selectedAssetKeys = new Set(selectedImportedAssets.map(createImportAssetKey));

    return importPreview.duplicates.filter(({ importedAsset }) =>
      selectedAssetKeys.has(createImportAssetKey(importedAsset)),
    ).length;
  }, [importPreview.duplicates, selectedImportedAssets]);

  const chartData = useMemo(() => {
    const grouped = new Map<string, number>();

    for (const asset of safeAssets) {
      grouped.set(asset.type, (grouped.get(asset.type) ?? 0) + asset.value);
    }

    return Array.from(grouped.entries()).map(([name, value]) => ({ name, value }));
  }, [safeAssets]);

  const portfolioChecks = getPortfolioHealthChecks({
    assets: safeAssets,
    portfolioTotal,
    profile,
  });
  const transactionSummary = useMemo(
    () => summarizeTransactions(transactions),
    [transactions],
  );
  const transactionImportPreview = useMemo(
    () => parseImportedTransactions(csvText),
    [csvText],
  );
  const realizedGain = useMemo(
    () => calculateRealizedGainFromTransactions(transactions),
    [transactions],
  );
  const investedValue = useMemo(
    () => calculatePortfolioInvestedValue(safeAssets),
    [safeAssets],
  );
  const unrealizedGain = useMemo(
    () => portfolioTotal - investedValue,
    [portfolioTotal, investedValue],
  );
  const diversificationScore = useMemo(
    () => getPortfolioDiversificationScore({ assets: safeAssets, portfolioTotal }),
    [portfolioTotal, safeAssets],
  );
  const allocationInsights = useMemo(
    () => getAllocationInsights({ assets: safeAssets, portfolioTotal, profile }),
    [portfolioTotal, profile, safeAssets],
  );

  useEffect(() => {
    setSelectedImportKeys(
      importPreview.assets.map((asset, index) => createImportSelectionKey(asset, index)),
    );
  }, [importPreview.assets]);

  function handleCsvImport() {
    const rawText = importArtifacts?.rawText || csvText;
    const normalizedText = importArtifacts?.normalizedText || csvText;
    const rowWarnings = importArtifacts?.rowWarnings ?? importPreview.errors;

    if (!importPreview.assets.length && transactionImportPreview.transactions.length) {
      transactionImportPreview.transactions.forEach((transaction) => {
        onAddTransaction(transaction);
      });
      setCsvMessage(
        `Imported ${transactionImportPreview.transactions.length} transaction${transactionImportPreview.transactions.length === 1 ? "" : "s"} into the journal.`,
      );
      return;
    }

    if (!importPreview.assets.length) {
      setCsvMessage(
        [...importPreview.errors, ...transactionImportPreview.errors].filter(Boolean).join(" "),
      );
      if (importReview) {
        onLogImportJob(
          createImportJobFromReview({
            assetCount: 0,
            duplicateCount: 0,
            fileName: "manual-import.txt",
            notes: importPreview.errors.join(" "),
            normalizedText,
            rawText,
            review: importReview,
            rowWarnings,
            status: "failed",
          }),
        );
      }
      return;
    }

    if (!selectedImportedAssets.length) {
      setCsvMessage("Select at least one parsed holding before importing.");
      return;
    }

    const nextAssets = applyPortfolioImport({
      existingAssets: safeAssets,
      importedAssets: selectedImportedAssets,
      mode: importMode,
    });

    onImportAssets(nextAssets);
    if (importReview) {
      onLogImportJob(
        createImportJobFromReview({
          assetCount: selectedImportedAssets.length,
          duplicateCount: selectedDuplicateCount,
          fileName: "manual-import.txt",
          notes:
            selectedDuplicateCount && importMode === "merge"
              ? "Import completed with duplicate merge handling."
              : "Import completed successfully.",
          normalizationApplied: importReview.normalizationApplied,
          normalizedText,
          rawText,
          review: importReview,
          rowWarnings,
          status: "completed",
        }),
      );
    }
    setCsvMessage(
      selectedDuplicateCount && importMode === "merge"
        ? `Imported ${selectedImportedAssets.length} holdings and merged ${selectedDuplicateCount} duplicates.`
        : `Imported ${selectedImportedAssets.length} holdings.`,
    );
  }

  function handleToggleImportRow(rowKey: string) {
    setSelectedImportKeys((current) =>
      current.includes(rowKey)
        ? current.filter((key) => key !== rowKey)
        : [...current, rowKey],
    );
  }

  function handleSelectAllImportRows() {
    setSelectedImportKeys(
      importPreview.assets.map((asset, index) => createImportSelectionKey(asset, index)),
    );
  }

  function handleClearImportRows() {
    setSelectedImportKeys([]);
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

    onUpdateAsset(editingIndex, syncHoldingNumbers(editingAsset));
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

  function handleAddTransactionClick() {
    if (!draftTransaction.assetName.trim() || draftTransaction.amount <= 0) {
      setCsvMessage("Transaction needs an asset name and positive amount.");
      return;
    }

    onAddTransaction(syncTransactionAmount(draftTransaction));
    setDraftTransaction(
      createPortfolioTransaction({
        assetName: draftTransaction.assetName,
        source: draftTransaction.source,
        type: draftTransaction.type,
      }),
    );
    setCsvMessage("Transaction added.");
  }

  async function handleCsvFileUpload(file: File | null) {
    if (!file) return;

    try {
      setIsReviewingImport(true);
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const serverPdfResult = isPdf ? await extractImportTextFromUpload(file) : null;
      const pdfResult =
        serverPdfResult ?? (isPdf ? await extractTextFromPdfOnDemand(file) : null);
      const rawText = pdfResult ? pdfResult.text : await file.text();
      const detectedSource = detectImportSource({
        fileName: file.name,
        text: rawText,
      });
      const normalized = normalizeImportTextForProvider({
        providerId: detectedSource?.id,
        text: rawText,
      });
      const text = normalized.text;
      const filePreview = previewPortfolioImport(text, safeAssets);
      const diagnostics = buildImportDiagnostics({
        normalizedText: text,
        preview: filePreview,
        rawText,
      });
      const pdfWarnings = pdfResult?.warnings ?? [];
      const reviewWarnings = [...pdfWarnings, ...diagnostics.rowWarnings];

      setCsvText(text);
      const review = await reviewImportDocument({
        fileName: file.name,
        text,
        normalizationApplied: normalized.applied,
        usedOcr: pdfResult?.usedOcr ?? false,
      });
      setImportReview(review);
      setImportArtifacts(diagnostics);
      onLogImportJob(
        createImportJobFromReview({
          assetCount: filePreview.assets.length,
          duplicateCount: filePreview.duplicates.length,
          fileName: file.name,
          notes: "Statement reviewed and ready for import.",
          normalizationApplied: normalized.applied,
          normalizedText: text,
          rawText,
          review,
          rowWarnings: reviewWarnings,
          status: "reviewed",
        }),
      );
      setCsvMessage(
        isPdf
          ? pdfResult?.usedOcr
            ? `${file.name} looked scanned, so OCR was used on ${pdfResult.pageCount} page${pdfResult.pageCount === 1 ? "" : "s"}.${detectedSource ? ` Detected ${detectedSource.name}.` : ""} Review the extracted text and duplicate preview, then import.`
            : `${file.name} converted from PDF.${detectedSource ? ` Detected ${detectedSource.name}.` : ""} Review the extracted text and duplicate preview, then import.`
          : `${file.name} loaded.${detectedSource ? ` Detected ${detectedSource.name}.` : ""}${normalized.applied.length ? " Provider cleanup applied." : ""} Review the import preview, then import.`,
      );
    } catch (error) {
      setImportReview(null);
      setImportArtifacts(null);
      setCsvMessage(
        error instanceof Error
          ? error.message
          : "Could not read that file. For PDFs, use a selectable text statement rather than a scanned image.",
      );
    } finally {
      setIsReviewingImport(false);
    }
  }

  async function handleAnalyzeCurrentText() {
    setIsReviewingImport(true);

    try {
      const detectedSource = detectImportSource({
        text: csvText,
      });
      const normalized = normalizeImportTextForProvider({
        providerId: detectedSource?.id,
        text: csvText,
      });
      if (normalized.text !== csvText) {
        setCsvText(normalized.text);
      }
      const normalizedPreview = previewPortfolioImport(normalized.text, safeAssets);
      const diagnostics = buildImportDiagnostics({
        normalizedText: normalized.text,
        preview: normalizedPreview,
        rawText: csvText,
      });
      const review = await reviewImportDocument({
        text: normalized.text,
        normalizationApplied: normalized.applied,
      });
      setImportReview(review);
      setImportArtifacts(diagnostics);
      onLogImportJob(
        createImportJobFromReview({
          assetCount: normalizedPreview.assets.length,
          duplicateCount: normalizedPreview.duplicates.length,
          fileName: "manual-import.txt",
          notes: "Text analyzed from the editor.",
          normalizationApplied: normalized.applied,
          normalizedText: normalized.text,
          rawText: csvText,
          review,
          rowWarnings: diagnostics.rowWarnings,
          status: "reviewed",
        }),
      );
      setCsvMessage("Import text analyzed. Review the cues before importing.");
    } catch (error) {
      setImportReview(null);
      setImportArtifacts(null);
      setCsvMessage(
        error instanceof Error ? error.message : "Could not analyze the pasted text.",
      );
    } finally {
      setIsReviewingImport(false);
    }
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
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
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
                  onAddAsset(syncHoldingNumbers(draftAsset));
                  setDraftAsset(defaultDraftAsset);
                }}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-4">
            <MetricMini label="Tracked value" value={formatMoney(portfolioTotal)} />
            <MetricMini label="Invested basis" value={formatMoney(investedValue)} />
            <MetricMini label="Unrealized P&L" value={formatMoney(unrealizedGain)} />
            <MetricMini label="Diversification" value={`${diversificationScore}/100`} />
          </div>
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">Add one holding</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Manual entry is useful for quick edits, fixing import gaps, and demo data.
              </p>
            </div>
            <HoldingFields asset={draftAsset} onChange={setDraftAsset} />
          </div>

          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Transaction journal</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Record buys, sells, dividends, and transfers so holdings stay transaction-driven.
                </p>
              </div>
              <Button type="button" size="sm" onClick={handleAddTransactionClick}>
                <Plus className="h-4 w-4" />
                Add transaction
              </Button>
            </div>
            <TransactionFields
              transaction={draftTransaction}
              onChange={setDraftTransaction}
            />
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              <span>Buys {formatMoney(transactionSummary.buys)}</span>
              <span>Sells {formatMoney(transactionSummary.sells)}</span>
              <span>Dividends {formatMoney(transactionSummary.dividends)}</span>
              <span>Realized P&L {formatMoney(realizedGain)}</span>
            </div>
            <div className="grid gap-2">
              {transactions.slice(0, 5).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-medium">
                      {transaction.assetName} · {transaction.action}
                    </p>
                    <p className="text-muted-foreground">
                      {transaction.date} · {transaction.source}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p>{formatMoney(transaction.amount)}</p>
                      <p className="text-muted-foreground">
                        {transaction.quantity.toFixed(2)} @ {formatMoney(transaction.price)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => onDeleteTransaction(transaction.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">Import channels</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Built for exported statements first, so holdings from Paytm Money, Jupiter,
                Zerodha, Groww, CAMS, KFintech, and forwarded email statements can land in one
                intake flow.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {importSourceDescriptors.map((source) => (
                <div
                  key={source.id}
                  className="rounded-md border bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{source.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{source.summary}</p>
                    </div>
                    <span className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground">
                      {describeReadiness(source.readiness)}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {source.supports.join(" · ")}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid gap-2 rounded-md border bg-background p-3 text-xs text-muted-foreground md:grid-cols-2">
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 text-primary" />
                <span>
                  Forwarded Gmail or Outlook statements can be pasted directly before we add full inbox connectors.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ScanSearch className="mt-0.5 h-4 w-4 text-primary" />
                <span>
                  PDF statements are reviewed with OCR fallback, so scanned attachments already fit the MVP flow.
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-medium">Portfolio import</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports CSV/TSV, pasted email text, OCR-backed PDF statements,
                  HTML tables, scheme/security name, current value, invested value, units,
                  NAV, LTP, and source labels.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleCsvImport}
                disabled={
                  !selectedImportedAssets.length &&
                  !transactionImportPreview.transactions.length
                }
              >
                <Upload className="h-4 w-4" />
                Import {selectedImportedAssets.length || transactionImportPreview.transactions.length || ""}
              </Button>
            </div>
            <SegmentedControl
              label="Duplicate handling"
              options={importModeOptions}
              value={importMode}
              onChange={(value) => setImportMode(value as PortfolioImportMode)}
            />
            <Input
              accept=".csv,.tsv,.txt,.html,.pdf,text/csv,text/tab-separated-values,text/plain,text/html,application/pdf"
              type="file"
              onChange={(event) => void handleCsvFileUpload(event.target.files?.[0] ?? null)}
            />
            <textarea
              className="min-h-32 w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={csvText}
              onChange={(event) => {
                setCsvText(event.target.value);
                setImportArtifacts(null);
                setImportReview(null);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleAnalyzeCurrentText()}
              >
                <ScanSearch className="h-4 w-4" />
                {isReviewingImport ? "Analyzing..." : "Analyze import text"}
              </Button>
            </div>
            {importReview && (
              <ImportReviewCard
                artifacts={importArtifacts}
                review={importReview}
              />
            )}
            {transactionImportPreview.transactions.length > 0 && (
              <TransactionImportPreview
                transactions={transactionImportPreview.transactions}
              />
            )}
            <ImportPreview
              onClearSelection={handleClearImportRows}
              onSelectAll={handleSelectAllImportRows}
              onToggleRow={handleToggleImportRow}
              preview={importPreview}
              selectedKeys={selectedImportKeys}
            />
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-xs leading-5 text-muted-foreground">{csvMessage}</p>
              <Button type="button" variant="ghost" size="sm" onClick={onResetAssets}>
                Reset demo data
              </Button>
            </div>
          </div>

          {safeAssets.map((asset, index) => (
            <div
              key={`${asset.name}-${asset.type}-${index}`}
              className="grid gap-3 rounded-md border p-3"
            >
              {editingIndex === index && editingAsset ? (
                <HoldingFields asset={editingAsset} onChange={setEditingAsset} />
              ) : (
                <div className="grid gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {asset.type} · {asset.source}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(asset.value)}</p>
                      <p className={asset.gain >= 0 ? "text-sm text-primary" : "text-sm text-destructive"}>
                        {asset.gain >= 0 ? "+" : ""}
                        {asset.gain.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                    <span>Invested {formatMoney(asset.investedValue)}</span>
                    <span>Units {asset.quantity.toFixed(2)}</span>
                    <span>Price {formatMoney(asset.price)}</span>
                    <span>
                      P&L {formatMoney(asset.value - asset.investedValue)}
                    </span>
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
            <CardDescription>Compare your tracked mix with your suggested profile.</CardDescription>
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
        <Card>
          <CardHeader>
            <CardTitle>Allocation alignment</CardTitle>
            <CardDescription>Compare your current mix with the suggested profile buckets.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {allocationInsights.length ? (
              allocationInsights.map((insight) => (
                <div
                  key={insight.bucket}
                  className="flex items-center justify-between gap-4 rounded-md border bg-background p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{insight.bucket}</p>
                    <p className="text-xs text-muted-foreground">{insight.status}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Current {insight.currentShare}%</p>
                    <p>Suggested {insight.suggestedShare}%</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-md border bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
                Add holdings or imported transactions to compare your real mix with the suggested allocation buckets.
              </div>
            )}
          </CardContent>
        </Card>
        <Roadmap profile={profile} compact />
      </div>
    </div>
  );
}

async function extractTextFromPdfOnDemand(file: File): Promise<PdfExtractResult> {
  const { extractTextFromPdf } = await import("@/lib/pdf-import");

  return extractTextFromPdf(file);
}

async function extractImportTextFromUpload(file: File): Promise<PdfExtractResult | null> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/import-extract", {
      body: formData,
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Upload extraction route unavailable.");
    }

    const payload = (await response.json()) as {
      error?: string;
      isPdf: boolean;
      pageCount: number;
      text: string;
      usedOcr: boolean;
      warnings: string[];
    };

    if (payload.error) {
      throw new Error(payload.error);
    }

    return payload.isPdf
      ? {
          pageCount: payload.pageCount,
          text: payload.text,
          usedOcr: payload.usedOcr,
          warnings: payload.warnings,
        }
      : null;
  } catch {
    return null;
  }
}

async function reviewImportDocument({
  fileName,
  normalizationApplied,
  text,
  usedOcr,
}: {
  fileName?: string;
  normalizationApplied?: string[];
  text: string;
  usedOcr?: boolean;
}) {
  try {
    const response = await fetch("/api/import-review", {
      body: JSON.stringify({ fileName, normalizationApplied, text, usedOcr }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Import review route unavailable.");
    }

    return (await response.json()) as ImportReview;
  } catch {
    return analyzeImportDocument({ fileName, normalizationApplied, text, usedOcr });
  }
}

function ImportReviewCard({
  artifacts,
  review,
}: {
  artifacts: ImportDiagnostics | null;
  review: ImportReview;
}) {
  const parserProfile = getProviderParserProfile(review.detectedSource?.id);

  return (
    <div className="grid gap-3 rounded-md border bg-background p-3">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium">Import review</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{review.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{review.parseReadiness}</Badge>
          <Badge variant="outline">{review.providerConfidence} provider fit</Badge>
          <Badge variant="outline">{review.qualityScore}/100</Badge>
        </div>
      </div>
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <span>Type {review.documentKind}</span>
        <span>Provider {review.detectedSource?.name ?? "Not detected"}</span>
        <span>Text length {review.textLength}</span>
      </div>
      {artifacts && <ImportDiagnosticsSummary artifacts={artifacts} />}
      {review.cues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {review.cues.map((cue) => (
            <Badge key={cue} variant="outline">
              {cue}
            </Badge>
          ))}
        </div>
      )}
      {review.normalizationApplied.length > 0 && (
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Cleanup applied</p>
          {review.normalizationApplied.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      )}
      {artifacts && (artifacts.beforeSnippet || artifacts.afterSnippet) && (
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-2">
          <div className="grid gap-2">
            <p className="text-xs font-medium text-foreground">Before cleanup</p>
            <pre className="overflow-auto rounded-md bg-background p-2 text-[11px] leading-5 text-muted-foreground">
              {artifacts.beforeSnippet || "No raw text saved."}
            </pre>
          </div>
          <div className="grid gap-2">
            <p className="text-xs font-medium text-foreground">After cleanup</p>
            <pre className="overflow-auto rounded-md bg-background p-2 text-[11px] leading-5 text-muted-foreground">
              {artifacts.afterSnippet || "No normalized text saved."}
            </pre>
          </div>
        </div>
      )}
      {artifacts?.rowWarnings.length ? (
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Parser warnings</p>
          {artifacts.rowWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      {artifacts?.parsedRows.length ? (
        <ParsedImportRows artifacts={artifacts} />
      ) : null}
      {parserProfile && (
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Provider parser profile</p>
          <p>Best inputs: {parserProfile.bestInputs.join(" · ")}</p>
          <p>Preferred headers: {parserProfile.preferredHeaders.join(", ")}</p>
          <p>First pitfall to check: {parserProfile.commonPitfalls[0]}</p>
        </div>
      )}
      <div className="grid gap-2">
        {review.guidance.map((item) => (
          <p key={item} className="text-xs leading-5 text-muted-foreground">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function ImportDiagnosticsSummary({
  artifacts,
}: {
  artifacts: ImportDiagnostics;
}) {
  const items = [
    ["Parsed", artifacts.summary.parsedCount.toString()],
    ["New", artifacts.summary.newCount.toString()],
    ["Duplicates", artifacts.summary.duplicateCount.toString()],
    ["Review", artifacts.summary.reviewCount.toString()],
    ["Current", formatMoney(artifacts.summary.totalCurrentValue)],
    ["Invested", formatMoney(artifacts.summary.totalInvestedValue)],
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border bg-muted/30 p-3">
          <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm font-semibold">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ParsedImportRows({
  artifacts,
}: {
  artifacts: ImportDiagnostics;
}) {
  return (
    <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Parsed holdings</p>
        <p className="text-xs text-muted-foreground">
          Showing {Math.min(artifacts.parsedRows.length, 8)} of {artifacts.parsedRows.length}
        </p>
      </div>
      <div className="grid gap-2">
        {artifacts.parsedRows.slice(0, 8).map((row, index) => (
          <div
            key={`${row.name}-${row.type}-${index}`}
            className="grid gap-3 rounded-md border bg-background p-3 text-xs lg:grid-cols-[1.2fr_0.9fr_0.9fr_1fr]"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{row.name}</p>
                <Badge
                  variant={row.status === "new" ? "secondary" : "outline"}
                >
                  {row.status}
                </Badge>
              </div>
              <p className="mt-1 text-muted-foreground">
                {row.type} · {row.source}
              </p>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <span>Current {formatMoney(row.currentValue)}</span>
              <span>Invested {formatMoney(row.investedValue)}</span>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <span>Units {row.quantity.toFixed(2)}</span>
              <span>Price {formatMoney(row.price)}</span>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <span>Gain {row.gain.toFixed(2)}%</span>
              {row.notes.length ? (
                <span>{row.notes.join(" · ")}</span>
              ) : (
                <span>Ready to import</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransactionImportPreview({
  transactions,
}: {
  transactions: PortfolioTransaction[];
}) {
  return (
    <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Parsed transactions</p>
        <p className="text-xs text-muted-foreground">
          {transactions.length} row{transactions.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="grid gap-2">
        {transactions.slice(0, 8).map((transaction) => (
          <div
            key={transaction.id}
            className="grid gap-2 rounded-md border bg-background p-3 text-xs md:grid-cols-[1.6fr_0.8fr_0.8fr_1fr]"
          >
            <div>
              <p className="font-medium text-foreground">{transaction.assetName}</p>
              <p className="mt-1 text-muted-foreground">
                {transaction.type} · {transaction.source}
              </p>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <span>{transaction.date}</span>
              <span>{transaction.action}</span>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <span>Units {transaction.quantity.toFixed(3)}</span>
              <span>NAV {formatMoney(transaction.price)}</span>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <span>Amount {formatMoney(transaction.amount)}</span>
              <span>{transaction.notes}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HoldingFields({
  asset,
  onChange,
}: {
  asset: PortfolioAsset;
  onChange: (asset: PortfolioAsset) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <TextField
        label="Asset name"
        value={asset.name}
        onChange={(value) => onChange({ ...asset, name: value })}
      />
      <TextField
        label="Type"
        value={asset.type}
        onChange={(value) => onChange({ ...asset, type: value })}
      />
      <NumberField
        label="Current value"
        value={asset.value}
        onChange={(value) =>
          onChange(
            syncHoldingNumbers({
              ...asset,
              price: asset.quantity > 0 ? value / asset.quantity : asset.price,
              value,
            }),
          )
        }
      />
      <NumberField
        label="Invested value"
        value={asset.investedValue}
        onChange={(value) => onChange(syncHoldingNumbers({ ...asset, investedValue: value }))}
      />
      <NumberField
        label="Units"
        value={asset.quantity}
        onChange={(value) =>
          onChange(
            syncHoldingNumbers({
              ...asset,
              quantity: value,
              value: asset.price > 0 ? value * asset.price : asset.value,
            }),
          )
        }
      />
      <NumberField
        label="Current price"
        value={asset.price}
        onChange={(value) =>
          onChange(
            syncHoldingNumbers({
              ...asset,
              price: value,
              value: asset.quantity > 0 ? asset.quantity * value : asset.value,
            }),
          )
        }
      />
      <NumberField
        label="Gain %"
        value={asset.gain}
        onChange={(value) => onChange({ ...asset, gain: value })}
      />
      <TextField
        label="Source"
        value={asset.source}
        onChange={(value) => onChange({ ...asset, source: value })}
      />
    </div>
  );
}

function TransactionFields({
  onChange,
  transaction,
}: {
  onChange: (transaction: PortfolioTransaction) => void;
  transaction: PortfolioTransaction;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <TextField
        label="Asset name"
        value={transaction.assetName}
        onChange={(value) => onChange({ ...transaction, assetName: value })}
      />
      <TextField
        label="Type"
        value={transaction.type}
        onChange={(value) => onChange({ ...transaction, type: value })}
      />
      <SegmentedControl
        label="Action"
        options={[
          ["buy", "Buy"],
          ["sell", "Sell"],
          ["dividend", "Dividend"],
          ["transfer", "Transfer"],
        ]}
        value={transaction.action}
        onChange={(value) =>
          onChange({ ...transaction, action: value as PortfolioTransaction["action"] })
        }
      />
      <TextField
        label="Date"
        value={transaction.date}
        onChange={(value) => onChange({ ...transaction, date: value })}
      />
      <NumberField
        label="Units"
        value={transaction.quantity}
        onChange={(value) =>
          onChange(
            syncTransactionAmount({
              ...transaction,
              amount: transaction.price > 0 ? value * transaction.price : transaction.amount,
              quantity: value,
            }),
          )
        }
      />
      <NumberField
        label="Price"
        value={transaction.price}
        onChange={(value) =>
          onChange(
            syncTransactionAmount({
              ...transaction,
              amount: transaction.quantity > 0 ? transaction.quantity * value : transaction.amount,
              price: value,
            }),
          )
        }
      />
      <NumberField
        label="Amount"
        value={transaction.amount}
        onChange={(value) =>
          onChange(
            syncTransactionAmount({
              ...transaction,
              amount: value,
            }),
          )
        }
      />
      <TextField
        label="Source"
        value={transaction.source}
        onChange={(value) => onChange({ ...transaction, source: value })}
      />
      <div className="md:col-span-2">
        <TextField
          label="Notes"
          value={transaction.notes}
          onChange={(value) => onChange({ ...transaction, notes: value })}
        />
      </div>
    </div>
  );
}

function ImportPreview({
  onClearSelection,
  onSelectAll,
  onToggleRow,
  preview,
  selectedKeys,
}: {
  onClearSelection: () => void;
  onSelectAll: () => void;
  onToggleRow: (rowKey: string) => void;
  preview: ReturnType<typeof previewPortfolioImport>;
  selectedKeys: string[];
}) {
  if (!preview.assets.length && !preview.errors.length) return null;

  const selectedCount = preview.assets.filter((asset, index) =>
    selectedKeys.includes(createImportSelectionKey(asset, index)),
  ).length;
  const selectedValue = preview.assets.reduce(
    (sum, asset, index) =>
      selectedKeys.includes(createImportSelectionKey(asset, index))
        ? sum + asset.value
        : sum,
    0,
  );

  return (
    <div className="grid gap-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Import preview</p>
          <p className="text-xs text-muted-foreground">
            {preview.assets.length} holdings · {formatMoney(preview.importedValue)} current value ·{" "}
            {formatMoney(preview.importedInvestedValue)} invested
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{preview.duplicates.length} duplicates · {preview.newAssets.length} new</span>
          <span>{selectedCount} selected · {formatMoney(selectedValue)}</span>
        </div>
      </div>
      {preview.errors.length > 0 && (
        <p className="text-xs text-destructive">{preview.errors.join(" ")}</p>
      )}
      {preview.assets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onSelectAll}>
            Select all
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClearSelection}>
            Clear
          </Button>
        </div>
      )}
      <div className="grid gap-2">
        {preview.assets.map((asset, index) => {
          const rowKey = createImportSelectionKey(asset, index);
          const isSelected = selectedKeys.includes(rowKey);
          const isDuplicate = preview.duplicates.some(
            ({ importedAsset }) =>
              createImportAssetKey(importedAsset) === createImportAssetKey(asset),
          );

          return (
          <div
            key={rowKey}
            className="grid gap-3 rounded-md border bg-muted/20 px-3 py-2 text-xs sm:grid-cols-[auto_1fr_auto]"
          >
            <input
              aria-label={`Select ${asset.name}`}
              checked={isSelected}
              className="mt-1 h-4 w-4 accent-current"
              type="checkbox"
              onChange={() => onToggleRow(rowKey)}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{asset.name}</p>
                {isDuplicate && <Badge variant="outline">duplicate</Badge>}
              </div>
              <p className="text-muted-foreground">
                {asset.type} · {asset.source}
              </p>
            </div>
            <div className="text-right">
              <p>{formatMoney(asset.value)}</p>
              <p className="text-muted-foreground">{asset.quantity.toFixed(2)} units</p>
            </div>
          </div>
          );
        })}
      </div>
      {preview.duplicates.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Duplicate matches:{" "}
          {preview.duplicates
            .slice(0, 3)
            .map((item) => item.importedAsset.name)
            .join(", ")}
          {preview.duplicates.length > 3 ? "..." : ""}
        </div>
      )}
    </div>
  );
}

function syncHoldingNumbers(asset: PortfolioAsset) {
  const quantity =
    asset.quantity > 0 ? asset.quantity : asset.price > 0 ? asset.value / asset.price : 0;
  const price = quantity > 0 ? asset.value / quantity : asset.price;
  const gain =
    asset.investedValue > 0 ? ((asset.value - asset.investedValue) / asset.investedValue) * 100 : asset.gain;

  return {
    ...asset,
    gain,
    price,
    quantity,
  };
}

function syncTransactionAmount(transaction: PortfolioTransaction) {
  const quantity =
    transaction.quantity > 0
      ? transaction.quantity
      : transaction.price > 0
        ? transaction.amount / transaction.price
        : 0;
  const price = quantity > 0 ? transaction.amount / quantity : transaction.price;

  return {
    ...transaction,
    price,
    quantity,
  };
}

function createImportSelectionKey(asset: PortfolioAsset, index: number) {
  return `${createImportAssetKey(asset)}::${index}`;
}

function createImportAssetKey(asset: Pick<PortfolioAsset, "name" | "type">) {
  return `${asset.name.trim().toLowerCase()}::${asset.type.trim().toLowerCase()}`;
}
