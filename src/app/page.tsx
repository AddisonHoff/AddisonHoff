import Link from "next/link";

export default function LandingPage() {
  const primaryHref = "/demo";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-semibold text-green-700">ClaimScout</span>
        <div className="flex gap-4">
          <Link
            href={primaryHref}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Test Core Flow
          </Link>
          <Link
            href={primaryHref}
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Dashboard
          </Link>
          <Link
            href="/onboarding"
            className="text-sm bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            Run Demo
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold max-w-2xl leading-tight">
          Your business is owed money from class action settlements.
        </h1>
        <p className="mt-6 text-lg text-gray-600 max-w-lg">
          Connect your accounting software. We match your vendor history to
          open settlements and file claims automatically. You only pay when
          you get paid.
        </p>
        <Link
          href={primaryHref}
          href="/onboarding"
          className="mt-8 bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-green-700"
        >
          Test Matching Engine
        </Link>
        <p className="mt-4 text-sm text-gray-400">
          No signup required for local testing.
        </p>

        {/* How it works */}
        <div className="mt-20 max-w-3xl w-full grid sm:grid-cols-3 gap-8 text-left">
          <div>
            <div className="text-2xl font-bold text-green-600 mb-2">1</div>
            <h3 className="font-semibold mb-1">Connect</h3>
            <p className="text-sm text-gray-500">
              Link your QuickBooks, Xero, or other accounting software via
              secure OAuth. Takes 2 minutes.
            </p>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600 mb-2">2</div>
            <h3 className="font-semibold mb-1">We Match</h3>
            <p className="text-sm text-gray-500">
              Our engine continuously scans open class action settlements and
              matches them to your vendor purchase history.
            </p>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600 mb-2">3</div>
            <h3 className="font-semibold mb-1">Get Paid</h3>
            <p className="text-sm text-gray-500">
              Approve claims with one click from your email. We file everything
              and collect your payout. Our fee: 25% of what you receive.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white px-6 py-8 text-center text-sm text-gray-400">
        ClaimScout — Finding money businesses forgot about.
      </footer>
    </div>
  );
}
