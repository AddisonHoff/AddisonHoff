import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUserId, isAuthEnabled } from "@/lib/auth";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/sign-in");

  // Get company for this user
  const member = await db.companyMember.findFirst({
    where: isAuthEnabled() ? { clerkUserId: userId } : undefined,
    include: {
      company: {
        include: {
          rutterConnection: true,
        },
      },
    },
  });

  if (!member) {
    redirect("/onboarding");
  }

  const company = member.company;

  // In local mode, allow dashboard testing without live accounting OAuth.
  if (isAuthEnabled() && !company.rutterConnection) {
    redirect("/onboarding/connect");
  }

  // Get claims summary
  const claims = await db.claim.findMany({
    where: { companyId: company.id },
    include: { settlement: true },
    orderBy: { createdAt: "desc" },
  });

  const stats = {
    pendingApproval: claims.filter((c) => c.status === "PENDING_APPROVAL").length,
    filed: claims.filter((c) => ["FILED", "APPROVED", "FILING"].includes(c.status)).length,
    paid: claims.filter((c) => ["PAID", "FEE_COLLECTED"].includes(c.status)).length,
    totalRecovered: claims
      .filter((c) => c.payoutAmount)
      .reduce((sum, c) => sum + Number(c.payoutAmount), 0),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-semibold text-green-700">ClaimScout</span>
        <span className="text-sm text-gray-500">{company.name}</span>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-8">Claims Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <StatCard label="Pending Approval" value={stats.pendingApproval} />
          <StatCard label="Filed" value={stats.filed} />
          <StatCard label="Paid" value={stats.paid} />
          <StatCard
            label="Total Recovered"
            value={`$${stats.totalRecovered.toLocaleString()}`}
          />
        </div>

        {/* Claims list */}
        <h2 className="text-lg font-semibold mb-4">All Claims</h2>

        {claims.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
            <p>No claims found yet.</p>
            <p className="text-sm mt-2">
              We're continuously scanning for settlements that match your
              vendor history. You'll receive an email when we find one.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border divide-y">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="px-6 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{claim.settlement.caseName}</p>
                  <p className="text-sm text-gray-500">
                    {claim.settlement.claimDeadline
                      ? `Deadline: ${new Date(claim.settlement.claimDeadline).toLocaleDateString()}`
                      : "No deadline set"}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={claim.status} />
                  {claim.payoutAmount && (
                    <p className="text-sm text-green-600 font-medium mt-1">
                      ${Number(claim.payoutAmount).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    IDENTIFIED: "bg-gray-100 text-gray-700",
    PENDING_APPROVAL: "bg-yellow-100 text-yellow-700",
    APPROVED: "bg-blue-100 text-blue-700",
    FILING: "bg-blue-100 text-blue-700",
    FILED: "bg-indigo-100 text-indigo-700",
    PAID: "bg-green-100 text-green-700",
    FEE_COLLECTED: "bg-green-100 text-green-700",
    DECLINED: "bg-gray-100 text-gray-500",
    EXPIRED: "bg-red-100 text-red-700",
    REJECTED: "bg-red-100 text-red-700",
  };

  const labels: Record<string, string> = {
    IDENTIFIED: "Identified",
    PENDING_APPROVAL: "Pending Approval",
    APPROVED: "Approved",
    FILING: "Filing",
    FILED: "Filed",
    PAID: "Paid",
    FEE_COLLECTED: "Paid",
    DECLINED: "Declined",
    EXPIRED: "Expired",
    REJECTED: "Rejected",
  };

  return (
    <span
      className={`inline-block px-2 py-1 rounded text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-700"}`}
    >
      {labels[status] || status}
    </span>
  );
}
