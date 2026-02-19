import Link from "next/link";
import { isAuthEnabled } from "@/lib/auth";

export default async function SignInPage() {
  if (!isAuthEnabled()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white border rounded-xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-2">Auth disabled in local mode</h1>
          <p className="text-sm text-gray-500 mb-6">
            Continue directly to onboarding and test matching without sign in.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            Continue
          </Link>
        </div>
      </div>
    );
  }

  const { SignIn } = await import("@clerk/nextjs");
  return (
    <div className="min-h-screen flex items-center justify-center">
      <SignIn />
    </div>
  );
}
