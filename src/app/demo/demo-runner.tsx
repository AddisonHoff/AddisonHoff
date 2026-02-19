"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RunCoreResponse = {
  companyName: string;
  scrapeResults: Array<{ admin: string; found: number; created: number; error?: string }>;
  fallbackSeeded: number;
  matching: { matchesFound: number; claimsCreated: number };
};

export function DemoRunner() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunCoreResponse | null>(null);

  async function runCoreFlow() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dev/run-core", { method: "POST" });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || "Failed to run core workflow");
      }

      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={runCoreFlow}
        disabled={loading}
        className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? "Running scrape + matching..." : "Run Active Cases Scrape + Find Matches"}
      </button>

      <button
        onClick={() => router.push("/dashboard")}
        className="w-full border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50"
      >
        Open Dashboard
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="border rounded-lg p-4 bg-gray-50 text-sm space-y-2">
          <p>
            <span className="font-medium">Company:</span> {result.companyName}
          </p>
          <p>
            <span className="font-medium">Matches found:</span> {result.matching.matchesFound}
          </p>
          <p>
            <span className="font-medium">Claims created:</span> {result.matching.claimsCreated}
          </p>
          <p>
            <span className="font-medium">Fallback demo settlements seeded:</span>{" "}
            {result.fallbackSeeded}
          </p>
          <div>
            <p className="font-medium mb-1">Scrape status:</p>
            <ul className="list-disc ml-5 space-y-1">
              {result.scrapeResults.map((item) => (
                <li key={item.admin}>
                  {item.admin}: found {item.found}, created {item.created}
                  {item.error ? ` (error: ${item.error})` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
