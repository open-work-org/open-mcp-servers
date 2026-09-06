import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  parseCsv,
  prepareAudienceUpload,
} from "../src/services/audience-upload.js";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("audience CSV preparation", () => {
  it("normalizes and hashes email and phone values into Meta multi-key payload data", () => {
    const result = prepareAudienceUpload(
      "Email Address,Phone Number\n Test@Example.com ,+1 (415) 555-2671\n",
      {
        inputFormat: "raw",
        maxRows: 10,
      },
    );

    expect(result.schema).toEqual(["EMAIL_SHA256", "PHONE_SHA256"]);
    expect(result.data).toEqual([[hash("test@example.com"), hash("+14155552671")]]);
    expect(result.stats).toEqual({
      rowsRead: 1,
      rowsAccepted: 1,
      rowsSkipped: 0,
      duplicatesRemoved: 0,
      invalidEmailValues: 0,
      invalidPhoneValues: 0,
    });
  });

  it("supports local phone numbers when a country code is supplied", () => {
    const result = prepareAudienceUpload("phone\n020 7946 0958\n", {
      inputFormat: "raw",
      phoneCountryCode: "44",
      maxRows: 10,
    });

    expect(result.data).toEqual([hash("+442079460958")]);
  });

  it("accepts explicitly pre-hashed identifiers and validates their shape", () => {
    const emailHash = hash("person@example.com");
    const result = prepareAudienceUpload(`email_sha256\n${emailHash.toUpperCase()}\n`, {
      inputFormat: "sha256",
      maxRows: 10,
    });

    expect(result.data).toEqual([emailHash]);
  });

  it("removes duplicate rows and skips rows with no valid identifiers", () => {
    const result = prepareAudienceUpload(
      "email,phone\nvalid@example.com,+14155552671\nvalid@example.com,+14155552671\nnot-an-email,not-a-phone\n",
      {
        inputFormat: "raw",
        maxRows: 10,
      },
    );

    expect(result.stats.rowsAccepted).toBe(1);
    expect(result.stats.duplicatesRemoved).toBe(1);
    expect(result.stats.rowsSkipped).toBe(1);
    expect(result.stats.invalidEmailValues).toBe(1);
    expect(result.stats.invalidPhoneValues).toBe(1);
  });

  it("handles quoted commas, escaped quotes, and newlines", () => {
    expect(parseCsv('email,note\n"person@example.com","say ""hello"",\nnext"\n')).toEqual([
      ["email", "note"],
      ["person@example.com", 'say "hello",\nnext'],
    ]);
  });

  it("fails closed for hashed-looking headers in raw mode", () => {
    expect(() => prepareAudienceUpload("email_sha256\nabc\n", {
      inputFormat: "raw",
      maxRows: 10,
    })).toThrow("input_format");
  });
});
