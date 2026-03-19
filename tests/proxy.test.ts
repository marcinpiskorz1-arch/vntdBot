import { describe, it, expect } from "vitest";
import { parseProxyUrl, withStickySession } from "../src/agents/scraper/session-manager.js";

describe("parseProxyUrl", () => {
  it("parses URL with username and password", () => {
    const result = parseProxyUrl("http://user-abc-region-pl:s3cret@pr.lunaproxy.com:12233");
    expect(result).toEqual({
      server: "http://pr.lunaproxy.com:12233",
      username: "user-abc-region-pl",
      password: "s3cret",
    });
  });

  it("parses URL without auth", () => {
    const result = parseProxyUrl("http://proxy.example.com:8080");
    expect(result).toEqual({
      server: "http://proxy.example.com:8080",
    });
  });

  it("decodes URL-encoded credentials", () => {
    const result = parseProxyUrl("http://user%40name:p%40ss@host:1234");
    expect(result).toEqual({
      server: "http://host:1234",
      username: "user@name",
      password: "p@ss",
    });
  });

  it("handles socks5 protocol", () => {
    const result = parseProxyUrl("socks5://admin:pass@socks.proxy.io:1080");
    expect(result).toEqual({
      server: "socks5://socks.proxy.io:1080",
      username: "admin",
      password: "pass",
    });
  });
});

describe("withStickySession", () => {
  it("appends session suffix to username", () => {
    const result = withStickySession("http://user-abc:pass@host:1234", 10);
    expect(result).toMatch(/^http:\/\/user-abc-session-[a-f0-9]{8}-sessTime-10:pass@host:1234\/?$/);
  });

  it("returns URL unchanged when no auth present", () => {
    const input = "http://host:1234";
    const result = withStickySession(input, 5);
    expect(result).toBe(input);
  });

  it("generates unique session IDs on each call", () => {
    const url = "http://user:pass@host:1234";
    const a = withStickySession(url, 10);
    const b = withStickySession(url, 10);
    expect(a).not.toBe(b);
  });

  it("preserves password with special characters", () => {
    const result = withStickySession("http://user:p%40ss%21@host:1234", 10);
    expect(result).toContain("p%40ss%21@host");
  });
});
