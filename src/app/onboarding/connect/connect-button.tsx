"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Rutter Link integration button.
 * Rutter provides a drop-in component (like Plaid Link) that handles
 * OAuth with the user's accounting platform. We receive a public token
 * on success and exchange it server-side for an access token.
 *
 * In production, load the Rutter Link script from their CDN.
 * For now, this uses a simulated flow.
 */
export function ConnectButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);

    try {
      // In production, this opens the Rutter Link modal:
      // const rutter = Rutter.create({ publicKey: '...' });
      // rutter.open({ onSuccess: (publicToken) => { ... } });
      //
      // For the MVP, we'll call our API to create a link token
      // and open the Rutter modal.

      const res = await fetch("/api/rutter/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });

      if (!res.ok) {
        throw new Error("Failed to initialize connection");
      }

      const { linkUrl } = await res.json();

      // Open Rutter Link in a popup or redirect
      // After successful connection, Rutter redirects back with a public token
      // which our callback route handles
      if (linkUrl) {
        window.location.href = linkUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? "Connecting..." : "Connect Accounting Software"}
      </button>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}
