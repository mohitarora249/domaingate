import { domainToASCII } from "node:url";
import { UserError } from "@/lib/errors";

/**
 * Normalize a hostname before storing or comparing it:
 * - trim whitespace and a trailing dot
 * - accept Unicode domains by converting them to IDNA ASCII (punycode)
 * - lowercase the result
 * - reject URLs, ports, paths, IPs, localhost, and malformed DNS labels
 *
 * A custom domain field should contain a hostname only, e.g. go.example.com.
 */
export function normalizeHostname(input: string): string {
  const trimmed = input.trim().replace(/\.$/, "");
  if (!trimmed || trimmed.includes("://") || /[\/@?#\s]/.test(trimmed)) {
    throw new UserError("Enter a hostname only, such as links.example.com.");
  }

  const ascii = domainToASCII(trimmed).toLowerCase();
  if (!ascii || ascii.length > 253 || ascii === "localhost" || !ascii.includes(".")) {
    throw new UserError("Enter a valid public hostname, such as links.example.com.");
  }

  // Disallow IPv4 and IPv6 literals: this feature is for DNS hostnames.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ascii) || ascii.includes("[")) {
    throw new UserError("IP addresses are not supported. Enter a domain name.");
  }

  const labels = ascii.split(".");
  const validLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  if (labels.some((label) => label.length > 63 || !validLabel.test(label))) {
    throw new UserError("The hostname contains an invalid DNS label.");
  }

  return ascii;
}

/** TXT records are looked up at a dedicated owner name for each hostname. */
export function verificationRecordName(hostname: string): string {
  return `_domaingate-challenge.${hostname}`;
}

export function getRoutingTarget(): string {
  return (process.env.ROUTING_TARGET || "domains.example-hosting-provider.com")
    .trim()
    .replace(/\.$/, "");
}

export function isReservedHostname(hostname: string): boolean {
  const reserved = process.env.RESERVED_DOMAIN?.trim().toLowerCase().replace(/\.$/, "");
  if (!reserved) return false;
  // Block the reserved hostname itself and its subdomains.
  return hostname === reserved || hostname.endsWith(`.${reserved}`);
}
