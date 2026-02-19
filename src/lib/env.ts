import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  RUTTER_CLIENT_ID: z.string().min(1),
  RUTTER_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  COURT_LISTENER_API_TOKEN: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

// Only validate at runtime, not during build
export function getEnv() {
  return envSchema.parse(process.env);
}

// For use in places where partial env is acceptable (e.g., ingestion scripts)
export function getEnvPartial() {
  return envSchema.partial().parse(process.env);
}
