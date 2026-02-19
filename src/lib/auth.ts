const DEV_USER_ID = "dev-local-user";

export function isAuthEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!isAuthEnabled()) {
    return process.env.DEV_USER_ID || DEV_USER_ID;
  }

  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  return userId;
}
