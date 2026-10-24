# DomainGate architecture, in depth

This document walks through the ownership proof, request lifecycle, persistence choices, and the parts a real URL-shortener needs to add before production.

## 1. The trust boundary

A hostname typed into a form is an untrusted claim. DomainGate must not let a user activate a hostname merely because they typed it, or because its CNAME happens to point at the application. A CNAME is a routing instruction; it is not strong evidence that the requester controls the domain.

Instead, the server creates a fresh unpredictable challenge. The user must publish that challenge in DNS. The ability to change authoritative DNS is the proof of control.

## 2. Verification sequence

```mermaid
sequenceDiagram
    actor User
    participant UI as Next.js dashboard
    participant API as Route Handler
    participant DB as PostgreSQL / Prisma
    participant DNS as Public DNS resolver

    User->>UI: Enter links.example.com
    UI->>API: POST /api/domains
    API->>API: Normalize hostname
    API->>API: Generate cryptographically random token
    API->>DB: Insert PENDING domain (hostname unique)
    DB-->>API: Domain row
    API-->>UI: TXT name + expected value
    User->>DNS: Publish TXT challenge
    User->>UI: Click Verify ownership
    UI->>API: POST /api/domains/:id/verify
    API->>DB: Load saved hostname + token
    API->>DNS: Resolve TXT at _domaingate-challenge.links.example.com
    DNS-->>API: TXT values
    API->>API: Join TXT chunks and compare exact value
    alt Exact token exists
        API->>DB: Set VERIFIED and verifiedAt
        API-->>UI: Ownership verified
    else Missing/mismatched/lookup error
        API->>DB: Save lastCheckedAt + lastError
        API-->>UI: Still pending; retry later
    end
```

## 3. Why use a TXT challenge?

- It works without pointing traffic at your service first.
- It does not require the user to share registrar credentials or an API key.
- Each claim gets a unique, unpredictable value, preventing a different domain's record from accidentally satisfying the check.
- Your service controls what record name to query; it does not need to make HTTP requests to arbitrary URLs supplied by users.

The record name is `_domaingate-challenge.<hostname>`. For `go.example.com`, the record is `_domaingate-challenge.go.example.com`. The TXT value is `domaingate-verification=<random token>`.

## 4. Important implementation details

### Hostname normalization

`src/lib/domain.ts` converts Unicode domain names to their ASCII IDNA representation, lowercases them, removes a trailing dot, and rejects URL syntax, ports, paths, localhost, IP literals, and invalid labels. Normalization must happen before the uniqueness check. Otherwise, values such as `GO.Example.com` and `go.example.com.` could be treated as separate records.

This starter validates DNS hostname syntax, but it does not query a public suffix database. If your product needs to prohibit users from claiming public suffixes such as `com` or `co.uk`, add a maintained Public Suffix List library and policy checks.

### Random challenge

`src/lib/verification.ts` uses `randomBytes(32)`, which supplies 256 bits of unpredictable randomness. The challenge is not a password; it is intended to be published publicly in DNS. Its purpose is to prove that the user can create a specific record.

### TXT record parsing

DNS TXT responses can represent a single logical value as multiple character-string chunks. The verifier joins the chunks for each TXT resource record before comparing it to the expected value. It does not join separate TXT records together.

### Fail closed

Missing records, mismatches, timeouts, and resolver failures never mark a domain verified. DNS changes can take time to propagate, so the UI should allow a retry rather than interpreting one failed lookup as permanent evidence of non-ownership.

### Unique database constraint

The `hostname @unique` constraint in Prisma/PostgreSQL is essential. A `findUnique()` pre-check followed by `create()` is vulnerable to a race: two concurrent requests can both pass the pre-check. The database constraint guarantees only one claim wins. The API maps Prisma's unique-constraint error to HTTP 409.

### Verification state versus routing state

This starter uses `PENDING` and `VERIFIED` only. A production implementation should keep ownership and delivery status separate, for example:

- `ownershipStatus`: `PENDING`, `VERIFIED`, `REVOKED`
- `routingStatus`: `NOT_CONFIGURED`, `PENDING`, `READY`, `ERROR`
- `tlsStatus`: `PENDING`, `ISSUING`, `READY`, `ERROR`
- `lifecycleStatus`: `ACTIVE`, `SUSPENDED`, `REMOVED`

Ownership verification alone should never automatically mean a hostname is serving traffic. Provision the hostname with your edge provider, validate its DNS configuration, wait for a valid certificate, and only then activate routing.

## 5. How incoming short links should resolve

DomainGate currently manages verification state and displays a sample CNAME target. It is not a redirect server. A URL-shortener's request path should eventually do the following:

1. Read the incoming hostname from the trusted request URL / host handling layer.
2. Normalize the hostname using the same rules as the claim endpoint.
3. Find an `ACTIVE` domain row by its globally unique hostname.
4. Look up the short code within that domain's workspace/tenant scope.
5. Return the redirect only if the hostname is active and the short code belongs to that tenant.
6. Return a safe not-found response for unknown hostnames; never fall back to another tenant.

Do not trust a user-provided `X-Forwarded-Host` unless your deployment proxy is configured to overwrite it and you only accept traffic from that proxy.

## 6. Security model and what is not included

### Included

- Server-side DNS challenge verification.
- Cryptographically random challenge tokens.
- Hostname normalization before persistence.
- Global hostname uniqueness enforced by PostgreSQL.
- HTTP-only, same-site session cookie for the local demo.
- Server-side login credentials read from environment variables.
- Basic JSON request validation and fail-closed DNS errors.

### Not production-ready yet

- The login is a single demo admin, not multi-tenant authentication. Integrate your existing auth and authorize every record by `workspaceId`.
- There is no distributed rate limiter or abuse detection.
- There is no scheduled job to recheck ownership or provider state.
- There is no custom-domain provider adapter, edge routing, certificate issuance, or TLS status check.
- There is no audit trail, email notifications, or domain dispute workflow.
- There is no public-suffix policy.
- The starter doesn't implement CSRF tokens; before adapting the auth model, add CSRF protection appropriate to the deployment and enforce same-origin mutation requests.

## 7. Recommended production provider abstraction

Avoid scattering vendor API calls across route handlers. Create a provider interface that could look like this:

```ts
export interface CustomDomainProvider {
  addHostname(hostname: string): Promise<void>;
  checkHostname(hostname: string): Promise<{
    configured: boolean;
    ownershipVerified: boolean;
    tlsReady: boolean;
    message?: string;
  }>;
  removeHostname(hostname: string): Promise<void>;
}
```

Implement one adapter for the provider you choose (for example, Cloudflare for SaaS or a hosting platform's custom-domain API). Keep DomainGate's TXT challenge as your application's ownership proof, and also honor any provider-specific challenge the edge platform requires. Some providers require their own TXT record or CNAME target before routing is enabled.

A useful lifecycle is: `PENDING_OWNERSHIP -> VERIFIED -> PROVISIONING -> ACTIVE`, with error states and safe removal paths. Keep provider API credentials on the server only.

## 8. DNS operational notes

- DNS resolvers cache both positive and negative answers. A newly created TXT record may not appear immediately.
- A subdomain such as `go.example.com` can normally use a CNAME for routing. The DNS ownership TXT challenge is a separate record name, so it can coexist with the CNAME at the original hostname.
- Apex domains such as `example.com` generally cannot use a conventional CNAME under standard DNS rules. Support depends on the DNS provider's ALIAS/ANAME or CNAME-flattening behavior, or a provider-supplied A record.
- If a domain is deleted from your application, remove its edge-provider association and stop serving traffic for it. Leaving a hostname attached to stale infrastructure can create takeover risk.
- Periodic checks should use the provider's status API as well as DNS. A DNS change alone may not reflect certificate or edge provisioning status.
