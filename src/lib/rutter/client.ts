/**
 * Rutter API client for accounting platform integration.
 * Rutter provides a unified API across QuickBooks, Xero, NetSuite, and Sage.
 * One integration covers all major accounting platforms.
 */

const RUTTER_API_BASE = "https://production.rutterapi.com";

interface RutterConfig {
  clientId: string;
  secret: string;
}

interface RutterTransaction {
  id: string;
  platform_id: string;
  account_id: string;
  line_items: Array<{
    description: string;
    amount: number;
    account_id: string;
  }>;
  currency_code: string;
  total_amount: number;
  transaction_date: string;
  entity: {
    id: string;
    type: string;
    name: string;
  };
  memo: string;
}

interface RutterBill {
  id: string;
  platform_id: string;
  vendor_id: string;
  vendor_name: string;
  currency_code: string;
  total_amount: number;
  issue_date: string;
  due_date: string;
  line_items: Array<{
    description: string;
    total_amount: number;
    account_id: string;
  }>;
  status: string;
}

interface RutterVendor {
  id: string;
  platform_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  status: string;
}

interface PaginatedResponse<T> {
  connection: { id: string; platform: string };
  data: T[];
  next_cursor: string | null;
}

export class RutterClient {
  private config: RutterConfig;

  constructor(config: RutterConfig) {
    this.config = config;
  }

  private async request<T>(
    accessToken: string,
    endpoint: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${RUTTER_API_BASE}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.secret}`,
    ).toString("base64");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${credentials}`,
        "X-Rutter-Version": "2024-08-31",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Rutter API error ${response.status}: ${body}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Exchange a public token (from Rutter Link) for an access token.
   */
  async exchangeToken(publicToken: string): Promise<{
    access_token: string;
    connection_id: string;
    platform: string;
  }> {
    const response = await fetch(
      `${RUTTER_API_BASE}/item/public_token/exchange`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.secret}`).toString("base64")}`,
        },
        body: JSON.stringify({ public_token: publicToken }),
      },
    );

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * List all vendors from the connected accounting platform.
   */
  async listVendors(
    accessToken: string,
    cursor?: string,
  ): Promise<PaginatedResponse<RutterVendor>> {
    const params: Record<string, string> = {
      access_token: accessToken,
      limit: "100",
    };
    if (cursor) params.cursor = cursor;

    return this.request<PaginatedResponse<RutterVendor>>(
      accessToken,
      "/accounting/vendors",
      params,
    );
  }

  /**
   * Fetch all vendors, handling pagination.
   */
  async listAllVendors(accessToken: string): Promise<RutterVendor[]> {
    const all: RutterVendor[] = [];
    let cursor: string | undefined;

    do {
      const page = await this.listVendors(accessToken, cursor);
      all.push(...page.data);
      cursor = page.next_cursor || undefined;
    } while (cursor);

    return all;
  }

  /**
   * List bills (invoices from vendors) from the connected accounting platform.
   */
  async listBills(
    accessToken: string,
    cursor?: string,
    updatedAfter?: string,
  ): Promise<PaginatedResponse<RutterBill>> {
    const params: Record<string, string> = {
      access_token: accessToken,
      limit: "100",
    };
    if (cursor) params.cursor = cursor;
    if (updatedAfter) params.updated_at_min = updatedAfter;

    return this.request<PaginatedResponse<RutterBill>>(
      accessToken,
      "/accounting/bills",
      params,
    );
  }

  /**
   * Fetch all bills, handling pagination.
   */
  async listAllBills(
    accessToken: string,
    updatedAfter?: string,
  ): Promise<RutterBill[]> {
    const all: RutterBill[] = [];
    let cursor: string | undefined;

    do {
      const page = await this.listBills(accessToken, cursor, updatedAfter);
      all.push(...page.data);
      cursor = page.next_cursor || undefined;
    } while (cursor);

    return all;
  }

  /**
   * List transactions (expenses, payments, etc.) from the accounting platform.
   */
  async listTransactions(
    accessToken: string,
    cursor?: string,
    updatedAfter?: string,
  ): Promise<PaginatedResponse<RutterTransaction>> {
    const params: Record<string, string> = {
      access_token: accessToken,
      limit: "100",
    };
    if (cursor) params.cursor = cursor;
    if (updatedAfter) params.updated_at_min = updatedAfter;

    return this.request<PaginatedResponse<RutterTransaction>>(
      accessToken,
      "/accounting/transactions",
      params,
    );
  }
}

export function createRutterClient(): RutterClient {
  return new RutterClient({
    clientId: process.env.RUTTER_CLIENT_ID!,
    secret: process.env.RUTTER_SECRET!,
  });
}
