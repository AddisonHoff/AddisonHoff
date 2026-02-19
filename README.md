# Settlement Claims Matcher (ClaimScout)

Automatically matches businesses to class action settlement claims they're eligible for. Connect your accounting software, and we find money you're owed.

## How It Works

1. **Sign up** and connect your QuickBooks/Xero/NetSuite via OAuth (2 min)
2. **Background engine** continuously scans open settlements and matches against your vendor purchase history
3. **Email notification** when a match is found — one-click approve or decline
4. **We file the claim** automatically via claims administrator portals
5. **You get paid** — we charge 25% only when you receive money

## Architecture

```
CourtListener API (daily poll)
        +
TopClassActions scraper (daily)
        +
ClassAction.org scraper (daily)
        +
Claims Admin portals scraper (daily)
        ↓
Settlement DB (Postgres + Prisma)
        ↓
Rutter API → vendor transactions from accounting software
        ↓
Matching engine (exact → fuzzy → LLM entity resolution)
        ↓
Email approval flow (signed JWT links, no login required)
        ↓
Playwright form automation → file with claims admin
        ↓
Stripe → auto-charge fee when payout confirmed
```

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | Clerk |
| Database | PostgreSQL + Prisma |
| Accounting Integration | Rutter API |
| Email | Resend + React Email |
| Background Jobs | Inngest |
| Matching | Fuse.js (fuzzy) + OpenAI (entity resolution) |
| Form Automation | Playwright |
| Payments | Stripe |
| Styling | Tailwind CSS |

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── claims/respond/       # Email approval link handler
│   │   ├── company/              # Company CRUD
│   │   ├── inngest/              # Inngest webhook endpoint
│   │   ├── rutter/               # Rutter OAuth flow
│   │   └── webhooks/stripe/      # Stripe webhooks
│   ├── dashboard/                # Claims dashboard (read-only ledger)
│   ├── onboarding/               # Company setup + accounting connection
│   ├── sign-in/                  # Clerk sign-in
│   └── sign-up/                  # Clerk sign-up
├── lib/
│   ├── approval/                 # JWT token generation + claim response flow
│   ├── email/
│   │   ├── send.ts               # Email sending via Resend
│   │   └── templates/            # React Email templates
│   ├── filing/
│   │   ├── base.ts               # Base Playwright filer
│   │   ├── admins/               # Per-admin Playwright scripts
│   │   └── index.ts              # Filer registry
│   ├── ingestion/                # Settlement data scrapers
│   │   ├── court-listener.ts     # CourtListener API
│   │   ├── top-class-actions.ts  # TopClassActions.com scraper
│   │   ├── class-action-org.ts   # ClassAction.org scraper
│   │   └── claims-admin-scrapers.ts  # Epiq, Rust, JND, Kroll, Angeion
│   ├── inngest/                  # Background job definitions
│   ├── matching/
│   │   ├── engine.ts             # Full matching pipeline
│   │   ├── fuzzy.ts              # Fuse.js fuzzy matching
│   │   └── llm-resolver.ts       # OpenAI entity resolution
│   ├── rutter/                   # Accounting platform integration
│   │   ├── client.ts             # Rutter API client
│   │   └── sync.ts               # Transaction sync + normalization
│   ├── stripe/                   # Payment / fee collection
│   ├── db.ts                     # Prisma client singleton
│   └── env.ts                    # Environment validation
├── middleware.ts                  # Clerk auth middleware
prisma/
└── schema.prisma                 # Database schema
```

## Setup

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

2. Fill in all API keys in `.env`

3. Install dependencies:
   ```bash
   npm install
   ```

4. Set up the database:
   ```bash
   npx prisma db push
   ```

5. Run the dev server:
   ```bash
   npm run dev
   ```

6. In a separate terminal, start Inngest:
   ```bash
   npm run inngest:dev
   ```

## Key Design Decisions

- **Email as the UI**: The approval email is the most important UI surface. Users rarely need to log in.
- **Signed JWT links**: No login required to approve/decline claims. Token in the URL is the auth.
- **Rutter over individual integrations**: One API covers QuickBooks, Xero, NetSuite, Sage, etc.
- **LLM for entity resolution**: Fuzzy string matching misses subsidiaries and DBA names. A small LLM call handles "is Hillshire Brands the same as Tyson Foods?" cheaply.
- **Per-admin Playwright scripts**: Claims admins don't have APIs. Finite set (~10 major admins) makes per-admin automation feasible.
- **Fee on payout only**: Stripe charges saved payment method when claim pays out. Zero upfront cost to user.
