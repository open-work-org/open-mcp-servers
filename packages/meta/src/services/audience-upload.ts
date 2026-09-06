import { createHash } from "node:crypto";

export const MAX_AUDIENCE_UPLOAD_ROWS = 250_000;
export const MAX_AUDIENCE_UPLOAD_CSV_CHARACTERS = 25_000_000;

export type AudienceUploadInputFormat = "raw" | "sha256";
export type AudienceIdentifier = "email" | "phone";
export type AudienceSchema = "EMAIL_SHA256" | "PHONE_SHA256";

export interface PrepareAudienceUploadOptions {
  emailColumn?: string;
  phoneColumn?: string;
  phoneCountryCode?: string;
  inputFormat: AudienceUploadInputFormat;
  maxRows: number;
}

export interface AudienceUploadStats {
  rowsRead: number;
  rowsAccepted: number;
  rowsSkipped: number;
  duplicatesRemoved: number;
  invalidEmailValues: number;
  invalidPhoneValues: number;
}

export interface PreparedAudienceUpload {
  schema: AudienceSchema[];
  data: string[] | string[][];
  stats: AudienceUploadStats;
}

const EMAIL_COLUMN_ALIASES = new Set([
  "email",
  "email_address",
  "emailaddress",
  "email_sha256",
  "email_sha_256",
  "hashed_email",
  "hashed_email_address",
]);

const PHONE_COLUMN_ALIASES = new Set([
  "phone",
  "phone_number",
  "phonenumber",
  "phone_sha256",
  "phone_sha_256",
  "hashed_phone",
  "hashed_phone_number",
  "mobile",
  "mobile_phone",
]);

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  if (!normalized || !normalized.includes("@") || !/^[^@]+@[^@]+\.[^@]+$/.test(normalized)) {
    throw new Error("Email value is empty or malformed after normalization.");
  }
  return normalized;
}

function normalizePhone(value: string, countryCode?: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Phone value is empty.");

  const allowedCharacters = /^[+0-9().\-\s]+$/;
  if (!allowedCharacters.test(trimmed)) {
    throw new Error("Phone value contains unsupported characters.");
  }

  const digits = trimmed.replace(/\D/g, "");
  let normalized: string;

  if (trimmed.startsWith("+")) {
    normalized = `+${digits}`;
  } else if (digits.startsWith("00")) {
    normalized = `+${digits.slice(2)}`;
  } else if (countryCode) {
    const nationalDigits = digits.startsWith(countryCode)
      ? digits
      : digits.replace(/^0/, "");
    normalized = `+${nationalDigits.startsWith(countryCode) ? nationalDigits : `${countryCode}${nationalDigits}`}`;
  } else {
    throw new Error("Phone value is not in international format; provide phone_country_code for local numbers.");
  }

  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
    throw new Error("Phone value is not a valid E.164 number after normalization.");
  }

  return normalized;
}

function validateHash(value: string, identifier: AudienceIdentifier): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`${identifier} value is not a valid SHA-256 hex digest.`);
  }
  return normalized;
}

/**
 * Parses CSV text without retaining or returning source values in the result.
 * Supports quoted fields, escaped quotes, commas, CRLF, and newlines in fields.
 */
export function parseCsv(csv: string): string[][] {
  if (!csv.trim()) throw new Error("CSV content is empty.");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;
  let afterClosingQuote = false;

  const pushRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = "";
    fieldStarted = false;
    afterClosingQuote = false;
  };

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (inQuotes) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterClosingQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (afterClosingQuote) {
      if (character === ",") {
        row.push(field);
        field = "";
        fieldStarted = false;
        afterClosingQuote = false;
      } else if (character === "\n") {
        pushRow();
      } else if (character === "\r") {
        if (csv[index + 1] === "\n") index += 1;
        pushRow();
      } else if (character !== " " && character !== "\t") {
        throw new Error("Malformed CSV: unexpected characters after a quoted field.");
      }
      continue;
    }

    if (character === '"') {
      if (fieldStarted) throw new Error("Malformed CSV: quoted fields must start at the beginning of a cell.");
      inQuotes = true;
      fieldStarted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
      fieldStarted = false;
    } else if (character === "\n") {
      pushRow();
    } else if (character === "\r") {
      if (csv[index + 1] === "\n") index += 1;
      pushRow();
    } else {
      field += character;
      fieldStarted = true;
    }
  }

  if (inQuotes) throw new Error("Malformed CSV: unterminated quoted field.");
  if (fieldStarted || field.length > 0 || row.length > 0 || afterClosingQuote) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function findColumn(
  headers: string[],
  requestedColumn: string | undefined,
  aliases: Set<string>,
  identifier: AudienceIdentifier,
): number | undefined {
  if (requestedColumn) {
    const normalizedRequested = normalizeHeader(requestedColumn);
    const index = headers.indexOf(normalizedRequested);
    if (index === -1) {
      throw new Error(`CSV does not contain the requested ${identifier} column "${requestedColumn}".`);
    }
    return index;
  }

  return headers.findIndex((header) => aliases.has(header)) === -1
    ? undefined
    : headers.findIndex((header) => aliases.has(header));
}

function identifierHeaderLooksHashed(header: string): boolean {
  return header.includes("sha256") || header.includes("sha_256") || header.includes("hashed");
}

export function prepareAudienceUpload(
  csv: string,
  options: PrepareAudienceUploadOptions,
): PreparedAudienceUpload {
  if (csv.length > MAX_AUDIENCE_UPLOAD_CSV_CHARACTERS) {
    throw new Error(
      `CSV content exceeds the ${MAX_AUDIENCE_UPLOAD_CSV_CHARACTERS.toLocaleString()} character limit.`,
    );
  }
  if (options.maxRows < 1 || options.maxRows > MAX_AUDIENCE_UPLOAD_ROWS) {
    throw new Error(`max_rows must be between 1 and ${MAX_AUDIENCE_UPLOAD_ROWS.toLocaleString()}.`);
  }

  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("CSV must contain a header row and at least one data row.");

  const headers = rows[0].map(normalizeHeader);
  if (headers.some((header) => !header)) throw new Error("CSV header row contains an empty column name.");
  if (new Set(headers).size !== headers.length) throw new Error("CSV header row contains duplicate column names.");

  const emailIndex = findColumn(headers, options.emailColumn, EMAIL_COLUMN_ALIASES, "email");
  const phoneIndex = findColumn(headers, options.phoneColumn, PHONE_COLUMN_ALIASES, "phone");
  if (emailIndex === undefined && phoneIndex === undefined) {
    throw new Error("CSV must contain an email or phone column (or provide email_column/phone_column explicitly).");
  }
  if (emailIndex !== undefined && emailIndex === phoneIndex) {
    throw new Error("email_column and phone_column must refer to different CSV columns.");
  }

  if (
    options.inputFormat === "raw" &&
    [emailIndex, phoneIndex].some((index) => index !== undefined && identifierHeaderLooksHashed(headers[index]))
  ) {
    throw new Error("CSV header indicates SHA-256 values; set input_format to 'sha256' or provide raw values.");
  }

  const dataRows = rows.slice(1).filter((dataRow) => dataRow.some((value) => value.trim() !== ""));
  if (dataRows.length > options.maxRows) {
    throw new Error(`CSV contains ${dataRows.length.toLocaleString()} rows; max_rows is ${options.maxRows.toLocaleString()}.`);
  }

  const schema: AudienceSchema[] = [];
  if (emailIndex !== undefined) schema.push("EMAIL_SHA256");
  if (phoneIndex !== undefined) schema.push("PHONE_SHA256");

  const preparedRows: string[][] = [];
  const seen = new Set<string>();
  let rowsSkipped = 0;
  let duplicatesRemoved = 0;
  let invalidEmailValues = 0;
  let invalidPhoneValues = 0;

  for (const dataRow of dataRows) {
    if (dataRow.length > headers.length) throw new Error("CSV data row contains more fields than the header row.");

    const emailValue = emailIndex === undefined ? "" : dataRow[emailIndex] ?? "";
    const phoneValue = phoneIndex === undefined ? "" : dataRow[phoneIndex] ?? "";
    let emailHash = "";
    let phoneHash = "";

    if (emailValue.trim()) {
      try {
        emailHash = options.inputFormat === "sha256"
          ? validateHash(emailValue, "email")
          : sha256(normalizeEmail(emailValue));
      } catch {
        invalidEmailValues += 1;
      }
    }

    if (phoneValue.trim()) {
      try {
        phoneHash = options.inputFormat === "sha256"
          ? validateHash(phoneValue, "phone")
          : sha256(normalizePhone(phoneValue, options.phoneCountryCode));
      } catch {
        invalidPhoneValues += 1;
      }
    }

    if (!emailHash && !phoneHash) {
      rowsSkipped += 1;
      continue;
    }

    const preparedRow = schema.length === 1
      ? [emailIndex !== undefined ? emailHash : phoneHash]
      : [emailHash, phoneHash];
    const dedupeKey = preparedRow.join("|");
    if (seen.has(dedupeKey)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(dedupeKey);
    preparedRows.push(preparedRow);
  }

  if (!preparedRows.length) throw new Error("CSV contains no valid email or phone identifiers to upload.");

  return {
    schema,
    data: schema.length === 1 ? preparedRows.map((row) => row[0]) : preparedRows,
    stats: {
      rowsRead: dataRows.length,
      rowsAccepted: preparedRows.length,
      rowsSkipped,
      duplicatesRemoved,
      invalidEmailValues,
      invalidPhoneValues,
    },
  };
}
