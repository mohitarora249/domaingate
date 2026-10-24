import { randomBytes, timingSafeEqual } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { verificationRecordName } from "@/lib/domain";

/** Generate an unpredictable challenge; publish the complete string as TXT. */
export function createVerificationToken(): string {
  return `domaingate-verification=${randomBytes(32).toString("base64url")}`;
}


/**
 * Checks whether the expected verification token exists in the domain's
 * public DNS TXT records.
 *
 * A successful match proves control of the DNS configuration at the time
 * of verification. DNS lookup failures must never be treated as success.
 */
export async function checkTxtOwnership(
  hostname: string,
  expectedToken: string,
): Promise<{ verified: boolean; reason?: string; transient?: boolean }> {
  try {
    // Resolve the dedicated TXT record used for domain ownership verification.
    const records = await resolveTxt(verificationRecordName(hostname));

    // DNS TXT records can contain multiple string chunks per record.
    // Join each record's chunks before comparing the complete token.
    const values = records.map((chunks) => chunks.join(""));

    // Convert the expected token into bytes because timingSafeEqual()
    // compares buffers/byte arrays, not JavaScript strings.
    const expected = Buffer.from(expectedToken, "utf8");

    // Check every TXT record. One exact match is sufficient to verify
    // ownership, even if other unrelated TXT records also exist.
    const verified = values.some((value) => {
      // Convert the DNS-provided value into UTF-8 bytes as well.
      const actual = Buffer.from(value, "utf8");

      // timingSafeEqual() requires equal-length buffers and throws if
      // their lengths differ. Reject mismatched lengths before comparing.
      if (actual.length !== expected.length) {
        return false;
      }

      // Compare the token bytes using a timing-safe comparison rather
      // than ordinary string equality, reducing content-based timing leaks.
      return timingSafeEqual(actual, expected);
    });

    // A DNS response can succeed while containing no matching token.
    // Treat that as an unsuccessful verification, not a resolver error.
    return verified
      ? { verified: true }
      : {
          verified: false,
          reason: "The TXT record was found, but its value did not match.",
        };
  } catch (error) {
    // Node.js DNS errors expose a code that helps distinguish a missing
    // record from a temporary resolver or network failure.
    const code = (error as NodeJS.ErrnoException).code;

    // These errors indicate that the expected TXT record does not exist.
    if (code === "ENODATA" || code === "ENOTFOUND") {
      return {
        verified: false,
        reason:
          "The TXT record was not found yet. DNS changes can take time to propagate.",
      };
    }

    // Fail closed: resolver failures (SERVFAIL, timeouts, unexpected errors)
    // must never result in verification. They are flagged as transient so a
    // previously verified domain is not revoked over a flaky lookup.
    // Return a generic message rather than exposing internal error details.
    return {
      verified: false,
      transient: true,
      reason: "DNS lookup failed temporarily. Try again in a moment.",
    };
  }
}
