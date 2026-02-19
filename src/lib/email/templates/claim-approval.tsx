import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Button,
  Row,
  Column,
} from "@react-email/components";
import * as React from "react";

interface ClaimApprovalEmailProps {
  companyName: string;
  caseName: string;
  qualificationReason: string;
  eligibleSpend: string;
  estimatedPayout: string;
  feePercentage: number;
  deadline: string;
  approveUrl: string;
  declineUrl: string;
}

export function ClaimApprovalEmail({
  companyName = "Acme Co.",
  caseName = "Broiler Chicken Antitrust Settlement",
  qualificationReason = "You purchased from Tyson Foods 2016–2019",
  eligibleSpend = "$47,000",
  estimatedPayout = "$1,200–$4,800",
  feePercentage = 25,
  deadline = "March 15, 2026",
  approveUrl = "#",
  declineUrl = "#",
}: ClaimApprovalEmailProps) {
  const previewText = `We found a claim for ${companyName} — est. ${estimatedPayout}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>
            We found a claim for {companyName}
          </Heading>

          <Section style={detailsSection}>
            <Row style={detailRow}>
              <Column style={labelCol}>Case</Column>
              <Column style={valueCol}>{caseName}</Column>
            </Row>
            <Row style={detailRow}>
              <Column style={labelCol}>You qualify because</Column>
              <Column style={valueCol}>{qualificationReason}</Column>
            </Row>
            <Row style={detailRow}>
              <Column style={labelCol}>Your eligible spend</Column>
              <Column style={valueCol}>{eligibleSpend} (from your accounting software)</Column>
            </Row>
            <Row style={detailRow}>
              <Column style={labelCol}>Estimated recovery</Column>
              <Column style={valueCol}>
                <strong>{estimatedPayout}</strong>
              </Column>
            </Row>
            <Row style={detailRow}>
              <Column style={labelCol}>Our fee if successful</Column>
              <Column style={valueCol}>{feePercentage}%</Column>
            </Row>
          </Section>

          <Section style={buttonSection}>
            <Button style={approveButton} href={approveUrl}>
              File This Claim
            </Button>
            <Text style={skipText}>
              <Link href={declineUrl} style={skipLink}>
                Skip this one
              </Link>
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={deadlineText}>
            Deadline to file: <strong>{deadline}</strong>
          </Text>

          <Text style={footer}>
            This claim was identified automatically based on your connected
            accounting data. We only file claims you approve, and we only
            charge when you get paid.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ClaimApprovalEmail;

// ─── Styles ───────────────────────────────────────────────────────

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
  lineHeight: "1.3",
  margin: "0 0 24px",
};

const detailsSection: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  borderRadius: "8px",
  padding: "20px",
  marginBottom: "24px",
};

const detailRow: React.CSSProperties = {
  marginBottom: "12px",
};

const labelCol: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "14px",
  width: "40%",
  verticalAlign: "top",
  paddingBottom: "8px",
};

const valueCol: React.CSSProperties = {
  color: "#1a1a1a",
  fontSize: "14px",
  width: "60%",
  verticalAlign: "top",
  paddingBottom: "8px",
};

const buttonSection: React.CSSProperties = {
  textAlign: "center" as const,
  marginBottom: "24px",
};

const approveButton: React.CSSProperties = {
  backgroundColor: "#16a34a",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "12px 32px",
  display: "inline-block",
};

const skipText: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
  marginTop: "12px",
};

const skipLink: React.CSSProperties = {
  color: "#6b7280",
  textDecoration: "underline",
};

const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "20px 0",
};

const deadlineText: React.CSSProperties = {
  fontSize: "14px",
  color: "#dc2626",
  textAlign: "center" as const,
};

const footer: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  lineHeight: "1.5",
  marginTop: "16px",
};
