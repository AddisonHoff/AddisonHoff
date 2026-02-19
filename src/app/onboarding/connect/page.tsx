import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ConnectButton } from "./connect-button";

export default async function ConnectAccountingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const member = await db.companyMember.findFirst({
    where: { clerkUserId: userId },
    include: { company: { include: { rutterConnection: true } } },
  });

  if (!member) redirect("/onboarding");
  if (member.company.rutterConnection) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm border max-w-md w-full p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Connect your accounting software</h1>
        <p className="text-gray-500 text-sm mb-8">
          We'll pull your vendor purchase history to match against open
          settlements. Read-only access — we never modify your data.
        </p>

        <ConnectButton companyId={member.company.id} />

        <div className="mt-8 text-left space-y-3">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Supported platforms
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
            <span>QuickBooks Online</span>
            <span>Xero</span>
            <span>NetSuite</span>
            <span>Sage</span>
            <span>FreshBooks</span>
            <span>Wave</span>
          </div>
        </div>
      </div>
    </div>
  );
}
