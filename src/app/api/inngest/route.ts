import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import {
  dailyIngestion,
  dailyMatching,
  onCompanyConnected,
  onClaimApproved,
  deadlineReminders,
  weeklyTransactionSync,
} from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    dailyIngestion,
    dailyMatching,
    onCompanyConnected,
    onClaimApproved,
    deadlineReminders,
    weeklyTransactionSync,
  ],
});
