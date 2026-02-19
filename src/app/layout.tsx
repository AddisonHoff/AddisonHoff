import React from "react";
import type { Metadata } from "next";
import "./globals.css";

// Conditionally import Clerk only when keys are configured
let ClerkProvider: React.ComponentType<{children: React.ReactNode}> | null = null;
try {
  const { ClerkProvider: RealClerkProvider } = require("@clerk/nextjs");
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    ClerkProvider = RealClerkProvider;
  }
} catch {
  // Clerk not available or not configured
}

export const metadata: Metadata = {
  title: "ClaimScout — Automatic Settlement Claims for Businesses",
  description:
    "Connect your accounting software. We find class action settlements you're owed money from and file claims automatically.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const Wrapper = ClerkProvider || React.Fragment;

  return (
    <Wrapper>
      <html lang="en">
        <body className="bg-gray-50 text-gray-900 antialiased">
          {children}
        </body>
      </html>
    </Wrapper>
  );
}
