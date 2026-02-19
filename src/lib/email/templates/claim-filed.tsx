import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

interface ClaimFiledEmailProps {
  companyName: string;
  caseName: string;
  estimatedPayout: string;
}

export function ClaimFiledEmail({
  companyName = "Acme Co.",
  caseName = "Broiler Chicken Antitrust Settlement",
  estimatedPayout = "$1,200–$4,800",
}: ClaimFiledEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your claim has been submitted — {caseName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Your claim was submitted</Heading>

          <Text style={text}>
            We've filed a claim on behalf of <strong>{companyName}</strong> in
            the <strong>{caseName}</strong>.
          </Text>

          <Text style={text}>
            Estimated recovery: <strong>{estimatedPayout}</strong>
          </Text>

          <Text style={text}>
            Settlement payouts typically take 3–12 months after the claim
            deadline closes. We'll notify you as soon as we receive payment.
          </Text>

          <Text style={footer}>
            You don't need to do anything else. We'll track this claim and
            update you when there's news.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ClaimFiledEmail;

const main: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 32px",
  maxWidth: "560px",
  borderRadius: "8px",
};

const heading: React.CSSProperties = {
  color: "#1a1a1a",
  fontSize: "22px",
  fontWeight: "600",
  margin: "0 0 20px",
};

const text: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
};

const footer: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
  marginTop: "24px",
  lineHeight: "1.5",
};
