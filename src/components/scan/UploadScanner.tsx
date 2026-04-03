"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileArchive, AlertTriangle, Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export default function UploadScanner() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    setError(null);
    if (!f.name.endsWith(".zip")) {
      setError("Only .zip files are supported right now");
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      setError(`File too large — max ${MAX_SIZE_MB} MB`);
      return;
    }
    setFile(f);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile]
  );

  async function handleScan() {
    if (!file) return;
    setScanning(true);
    setError(null);
    setProgress("Uploading…");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name.replace(/\.zip$/, ""));

      setProgress("Scanning files…");
      const res = await fetch("/api/scan/upload", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Scan failed");

      router.push(`/scans/${data.scanId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setScanning(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 p-12 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
          dragging
            ? "border-red-500 bg-red-950/20"
            : file
            ? "border-green-700 bg-green-950/10"
            : "border-zinc-700 hover:border-zinc-500 bg-zinc-900/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {file ? (
          <>
            <FileArchive className="h-10 w-10 text-green-400" />
            <div className="text-center">
              <p className="font-medium text-green-300">{file.name}</p>
              <p className="text-zinc-500 text-sm mt-0.5">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            <button
              className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300"
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-zinc-500" />
            <div className="text-center">
              <p className="font-medium text-zinc-300">
                Drop your project zip here
              </p>
              <p className="text-zinc-500 text-sm mt-1">
                or click to browse · max {MAX_SIZE_MB} MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* Supported types */}
      <p className="text-zinc-600 text-xs">
        Scans <span className="text-zinc-400">.js .jsx .ts .tsx .mjs .cjs .py</span> files · skips{" "}
        <span className="text-zinc-400">node_modules .git dist build</span>
      </p>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Scan button */}
      <Button
        onClick={handleScan}
        disabled={!file || scanning}
        className="bg-red-600 hover:bg-red-500 disabled:opacity-50"
      >
        {scanning ? (
          <>
            <Zap className="h-4 w-4 mr-2 animate-pulse" />
            {progress ?? "Scanning…"}
          </>
        ) : (
          <>
            <Zap className="h-4 w-4 mr-2" />
            Scan project
          </>
        )}
      </Button>
    </div>
  );
}
