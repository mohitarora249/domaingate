# DomainGate

**DomainGate** is a small, commented learning project that demonstrates DNS TXT ownership verification for custom domains. It is designed to be readable, runnable locally, and easy to extend for a URL shortener or multi-tenant SaaS.

> **Scope:** This project proves DNS control and records verification state. It does **not** automatically configure an edge router, attach domains to a hosting provider, or issue TLS certificates. The routing target in the UI is illustrative until you integrate a provider that supports custom hostnames and automatic HTTPS.

## Stack

- Next.js App Router + Route Handlers
- TypeScript
- PostgreSQL + Prisma ORM
- Tailwind CSS v4
- Local shadcn/ui-style `Button` and `Input` primitives (kept in the repo to reduce setup steps)
- DNS TXT resolution via Node.js `dns/promises`
- Signed, HTTP-only session cookie using `jose`
- Zod request validation
- Docker Compose for local PostgreSQL

## Run locally

### Requirements

- Node.js 20.9+ (Node 22 LTS recommended)
- npm
- Docker Desktop or a local PostgreSQL 16+ instance

### 1. Install dependencies

```bash
cp .env.example .env
npm install
```

Edit `.env`. Change `ADMIN_PASSWORD` and set a random `SESSION_SECRET` of at least 32 characters. For example:

```bash
openssl rand -base64 48
```

Paste the output into `SESSION_SECRET`. Do not commit `.env`.

### 2. Start PostgreSQL

```bash
docker compose up -d postgres
```

Wait until the database is healthy:

```bash
docker compose ps
```

### 3. Create the database tables

```bash
npm run db:generate
npm run db:migrate -- --name init
```

Prisma will create the local migration and apply it. Commit `prisma/migrations/` to GitHub.

### 4. Start Next.js

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

### 5. Verify a real domain

You need a domain whose DNS you can edit. Add it in the dashboard. DomainGate generates a unique TXT challenge such as:

- **Type:** `TXT`
- **Name:** `_domaingate-challenge.go.example.com`
- **Value:** `domaingate-verification=<random-token>`

Create exactly that record in the domain's authoritative DNS provider. Wait for DNS propagation, then click **Verify ownership**. The backend resolves the TXT record and compares the complete value with the expected token stored in PostgreSQL.

For a test without a real domain, run the unit tests; a real successful verification requires the expected TXT value to be publicly resolvable in DNS.

## API overview

All domain endpoints require the demo session cookie. Sign in through the UI first.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Sign in with environment-configured demo credentials |
| `POST` | `/api/auth/logout` | Clear the session cookie |
| `GET` | `/api/domains` | List domain records and DNS instructions |
| `POST` | `/api/domains` | Normalize hostname, create unique challenge, persist pending claim |
| `POST` | `/api/domains/:id/verify` | Resolve TXT record and update verification state |
| `DELETE` | `/api/domains/:id` | Delete a domain claim |

Example create request:

```bash
curl -X POST http://localhost:3000/api/domains \
  -H 'Content-Type: application/json' \
  -b cookies.txt -c cookies.txt \
  -d '{"hostname":"go.example.com"}'
```

Use the UI for the easiest local flow. The example `curl` requires you to sign in first and preserve the cookie.

## How the ownership check works

1. The server normalizes the hostname to lowercase IDNA ASCII and rejects URLs, paths, ports, localhost, and IP literals.
2. The server generates 256 bits of random token material using Node's cryptographic random generator.
3. The token and normalized hostname are stored in PostgreSQL. A unique database constraint prevents two records from claiming the same hostname, including concurrent requests.
4. The user publishes the token as a TXT record at `_domaingate-challenge.<hostname>`.
5. The verification endpoint resolves the public TXT records on the server. TXT chunks belonging to one record are joined, then the complete expected token is compared using a timing-safe equality check.
6. Only a matching record changes the status to `VERIFIED`. Resolver errors and missing/mismatched values fail closed.

DNS may be cached, so an immediate check can fail after a record was added. Wait for propagation and retry. A temporary DNS failure is not proof that the user does not control the domain.

## Repository tour

```text
src/
  app/
    api/auth/login/route.ts         # Demo login + signed session cookie
    api/auth/logout/route.ts        # Session logout
    api/domains/route.ts            # Create/list domain claims
    api/domains/[id]/verify/route.ts# Server-side TXT verification
    api/domains/[id]/route.ts        # Delete claim
    page.tsx                        # Login or dashboard
    layout.tsx                      # Root layout + metadata
  components/
    dashboard.tsx                   # Domain list and DNS setup UI
    login.tsx                       # Demo login form
    ui/button.tsx                   # Small shadcn-style primitive
    ui/input.tsx                    # Small shadcn-style primitive
  lib/
    auth.ts                         # Signed HTTP-only cookie session
    domain.ts                       # Hostname normalization + DNS names
    http.ts                         # Small API helpers
    prisma.ts                       # Prisma client singleton
    verification.ts                 # Token generation + TXT lookup
prisma/schema.prisma                # PostgreSQL schema
 tests/domain.test.ts               # Normalization and record-name tests
```

## Security limitations and production checklist

This is an educational starter, not a drop-in production multi-tenant domain service.

- **Authentication:** The demo has one environment-configured admin login. Before using it in your SaaS, integrate your real authentication system and authorize every domain against the current user/workspace. Do not treat the demo admin as multi-tenant isolation.
- **Rate limiting:** Add rate limits to login and verification endpoints; consider per-account/domain limits and backoff.
- **Domain conflicts:** The database unique index is the final claim guard. If you add multiple organizations, keep hostname uniqueness global unless you have a deliberate reason otherwise.
- **DNS rebinding/SSRF:** The TXT verifier only queries the derived challenge owner name, not a user-provided arbitrary DNS name. Keep it that way; do not add arbitrary HTTP fetches based on submitted domains.
- **Re-verification:** DNS control can change. Re-check domains periodically or before sensitive lifecycle changes; suspend routing if the domain becomes invalid or is removed from your provider.
- **Routing and HTTPS:** Integrate a provider with custom-hostname support (for example, a suitable edge/CDN or hosting provider). Complete provider-side domain validation, configure routing, and wait for a valid certificate before activating traffic.
- **Apex domains:** A root domain often cannot use a conventional CNAME at the apex. Document supported DNS options or limit the first version to subdomains.
- **Domain abuse:** Add abuse reporting, blocked-domain policy, reserved hostname handling, audit logs, and account-level quotas before public launch.
- **Secrets:** Use a strong `SESSION_SECRET`, rotate credentials, and keep `.env` out of Git.
- **Session hardening:** Add CSRF protection appropriate to your authentication design and configure deployment security headers. The demo cookie uses `HttpOnly`, `SameSite=Strict`, and `Secure` in production.
- **Schema migration:** Commit migrations and use `npm run db:deploy` in production rather than `migrate dev`.

## Next steps to turn it into a real service

1. Replace the demo admin with your existing auth provider and add `workspaceId` to `Domain`.
2. Add a provider adapter interface such as `addHostname()`, `checkHostname()`, `removeHostname()`, and `getCertificateStatus()`.
3. Implement a Vercel, Cloudflare for SaaS, or other custom-hostname provider adapter.
4. Add background jobs for DNS/provider rechecks and certificate status.
5. Only mark a domain `ACTIVE` after ownership, routing, and TLS checks all pass.
6. Add integration tests using a controlled test domain and a DNS resolver abstraction.

## Tests

```bash
npm test
```

The tests cover hostname normalization and challenge-record naming. They do not make external DNS requests.

## License

MIT. See `LICENSE`.
