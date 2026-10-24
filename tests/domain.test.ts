import { describe, expect, it } from "vitest";
import { normalizeHostname, verificationRecordName } from "../src/lib/domain";

describe("normalizeHostname", () => {
  it("lowercases and removes a trailing dot", () => {
    expect(normalizeHostname(" Go.Example.COM. ")).toBe("go.example.com");
  });
  it("rejects a URL rather than a hostname", () => {
    expect(() => normalizeHostname("https://example.com/path")).toThrow();
  });
  it("rejects localhost and IP addresses", () => {
    expect(() => normalizeHostname("localhost")).toThrow();
    expect(() => normalizeHostname("192.0.2.10")).toThrow();
  });
});

describe("verificationRecordName", () => {
  it("creates a dedicated TXT owner name", () => {
    expect(verificationRecordName("go.example.com")).toBe("_domaingate-challenge.go.example.com");
  });
});
