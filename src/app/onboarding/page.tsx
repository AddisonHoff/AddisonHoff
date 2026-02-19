import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Check if already onboarded
  const existingMember = await db.companyMember.findFirst({
    where: { clerkUserId: userId },
  });

  if (existingMember) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm border max-w-md w-full p-8">
        <h1 className="text-2xl font-bold mb-2">Set up your company</h1>
        <p className="text-gray-500 text-sm mb-6">
          We need a few details to match you to eligible settlements.
        </p>
        <OnboardingForm />
      </div>
    </div>
  );
}
