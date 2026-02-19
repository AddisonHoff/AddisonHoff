"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OnboardingForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name") as string,
      ein: form.get("ein") as string,
      state: form.get("state") as string,
      naicsCode: form.get("naicsCode") as string,
      address: form.get("address") as string,
      city: form.get("city") as string,
      zip: form.get("zip") as string,
    };

    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create company");
      }

      router.push("/onboarding/connect");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Company Name" name="name" required />
      <Field label="EIN (Tax ID)" name="ein" placeholder="XX-XXXXXXX" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="State" name="state" placeholder="CA" />
        <Field label="NAICS Code" name="naicsCode" placeholder="Optional" />
      </div>
      <Field label="Street Address" name="address" />
      <div className="grid grid-cols-2 gap-4">
        <Field label="City" name="city" />
        <Field label="ZIP" name="zip" />
      </div>

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? "Setting up..." : "Continue"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        placeholder={placeholder}
        required={required}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
      />
    </div>
  );
}
