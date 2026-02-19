import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Row,
  Column,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface PayoutReceivedEmailProps {
  companyName: string;
  caseName: string;
  payoutAmount: string;
  feeAmount: string;
  netAmount: string;
}

export function PayoutReceivedEmail({
  companyName = "Acme Co.",
  caseName = "Broiler Chicken Antitrust Settlement",
  payoutAmount = "$3,800",
  feeAmount = "$950",
  netAmount = "$2,850",
}: PayoutReceivedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        You received {netAmount} from {caseName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>You received {payoutAmount}</Heading>

          <Text style={text}>
            Great news — the payout for <strong>{caseName}</strong> has been
            processed for <strong>{companyName}</strong>.
          </Text>

          <Section style={summarySection}>
            <Row style={summaryRow}>
              <Column style={summaryLabel}>Settlement payout</Column>
              <Column style={summaryValue}>{payoutAmount}</Column>
            </Row>
            <Row style={summaryRow}>
              <Column style={summaryLabel}>Our fee</Column>
              <Column style={summaryValue}>-{feeAmount}</Column>
            </Row>
            <Hr style={hr} />
            <Row style={summaryRow}>
              <Column style={summaryLabelBold}>Net to you</Column>
              <Column style={summaryValueBold}>{netAmount}</Column>
            </Row>
          </Section>

          <Text style={text}>
            The net amount has been deposited to your account. Our fee has been
            charged to the card on file.
          </Text>

          <Text style={footer}>
            We'll keep monitoring for new settlements you may be eligible for.
            No action needed on your part.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PayoutReceivedEmail;

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
  color: "#16a34a",
  fontSize: "24px",
  fontWeight: "600",
  margin: "0 0 20px",
};

const text: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
};

const summarySection: React.CSSProperties = {
  backgroundColor: "#f0fdf4",
  borderRadius: "8px",
  padding: "20px",
  margin: "20px 0",
};

const summaryRow: React.CSSProperties = {
  marginBottom: "8px",
};

const summaryLabel: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "14px",
  width: "60%",
};

const summaryValue: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  textAlign: "right" as const,
  width: "40%",
};

const summaryLabelBold: React.CSSProperties = {
  color: "#1a1a1a",
  fontSize: "15px",
  fontWeight: "600",
  width: "60%",
};

const summaryValueBold: React.CSSProperties = {
  color: "#16a34a",
  fontSize: "15px",
  fontWeight: "600",
  textAlign: "right" as const,
  width: "40%",
};

const hr: React.CSSProperties = {
  borderColor: "#bbf7d0",
  margin: "12px 0",
};

const footer: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
  marginTop: "24px",
  lineHeight: "1.5",
};
