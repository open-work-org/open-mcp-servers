import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MetaApiClient } from "../services/api.js";
import { errorResult, handleApiError, truncate, formatNumber, formatDate, buildPaginationNote, ResponseFormatSchema } from "../services/utils.js";
import { AUDIENCE_FIELDS } from "../constants.js";
import { MAX_AUDIENCE_UPLOAD_CSV_CHARACTERS, MAX_AUDIENCE_UPLOAD_ROWS, prepareAudienceUpload } from "../services/audience-upload.js";
import { CustomAudience, CustomAudienceUploadResponse, MetaPaginatedResponse } from "../types.js";

const AUDIENCE_UPLOAD_BATCH_SIZE = 5_000;

function numericValue(value: number | string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sumUploadField(
  responses: CustomAudienceUploadResponse[],
  field: "num_received" | "num_invalid_entries" | "num_matched",
): number | undefined {
  const values = responses.map((response) => numericValue(response[field])).filter(
    (value): value is number => value !== undefined,
  );
  return values.length ? values.reduce((total, value) => total + value, 0) : undefined;
}

function audienceStatusSummary(status: CustomAudience | undefined): Record<string, unknown> | undefined {
  if (!status) return undefined;
  return {
    id: status.id,
    name: status.name,
    operation_status: status.operation_status,
    delivery_status: status.delivery_status,
    approximate_count_lower_bound: status.approximate_count_lower_bound,
    approximate_count_upper_bound: status.approximate_count_upper_bound,
  };
}

function formatUploadResult(result: Record<string, unknown>, responseFormat: "markdown" | "json"): { content: Array<{ type: "text"; text: string }> } {
  if (responseFormat === "json") {
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  const stats = result.stats as Record<string, unknown>;
  const meta = result.meta as Record<string, unknown> | undefined;
  const status = result.audience_status as Record<string, unknown> | undefined;
  const lines = [
    result.dry_run ? "# Custom Audience CSV Dry Run" : "# Custom Audience CSV Upload",
    "",
    `- **Audience ID**: \`${result.audience_id}\``,
    `- **Operation**: ${String(result.operation).toUpperCase()}`,
    `- **Schema**: ${result.schema}`,
    `- **Rows read**: ${stats.rows_read}`,
    `- **Rows accepted locally**: ${stats.rows_accepted}`,
    `- **Rows skipped**: ${stats.rows_skipped}`,
    `- **Duplicates removed**: ${stats.duplicates_removed}`,
    `- **Invalid email values**: ${stats.invalid_email_values}`,
    `- **Invalid phone values**: ${stats.invalid_phone_values}`,
  ];

  if (result.dry_run) {
    lines.push("", "No customer data was sent to Meta.");
  } else {
    if (meta?.num_received !== undefined) lines.push(`- **Meta entries received**: ${meta.num_received}`);
    if (meta?.num_invalid_entries !== undefined) lines.push(`- **Meta entries rejected**: ${meta.num_invalid_entries}`);
    if (meta?.num_matched !== undefined) lines.push(`- **Meta entries matched**: ${meta.num_matched}`);
    lines.push("", "Meta may continue processing the upload asynchronously.");
    if (status?.operation_status) {
      const operationStatus = status.operation_status as Record<string, unknown>;
      lines.push(`- **Processing status**: ${operationStatus.description ?? operationStatus.code ?? "reported by Meta"}`);
    } else {
      lines.push("- **Processing status**: Not available yet; call `meta_get_custom_audience_upload_status` to check.");
    }
    if (status?.approximate_count_lower_bound !== undefined) {
      lines.push(`- **Current audience size**: ~${formatNumber(status.approximate_count_lower_bound as number)}–${formatNumber((status.approximate_count_upper_bound ?? status.approximate_count_lower_bound) as number)}`);
    }
    if (result.status_lookup_error) lines.push(`- **Status lookup**: ${result.status_lookup_error}`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

export function registerAudiencesTools(server: McpServer, client: MetaApiClient): void {
  // ─── List Custom Audiences ─────────────────────────────────────────────────
  server.registerTool(
    "meta_list_custom_audiences",
    {
      title: "List Custom Audiences",
      description: `Lists custom audiences in a Meta ad account.

Args:
  - ad_account_id (string): Ad account ID (e.g., act_123456789)
  - limit (number): Max results (1–100, default 20)
  - after (string, optional): Pagination cursor

Returns audience names, types, size estimates, and delivery status.`,
      inputSchema: z
        .object({
          ad_account_id: z.string().describe("Ad account ID (e.g., act_123456789)"),
          limit: z.number().int().min(1).max(100).default(20),
          after: z.string().optional(),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ ad_account_id, limit, after, response_format }) => {
      try {
        const params: Record<string, unknown> = { fields: AUDIENCE_FIELDS, limit };
        if (after) params.after = after;

        const data = await client.get<MetaPaginatedResponse<CustomAudience>>(
          `/${ad_account_id}/customaudiences`,
          params
        );

        if (!data.data?.length) {
          return { content: [{ type: "text", text: "No custom audiences found." }] };
        }

        if (response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        const nextCursor = data.paging?.cursors?.after;
        const lines = [`# Custom Audiences (${data.data.length} shown)`, ""];
        for (const aud of data.data) {
          lines.push(`## ${aud.name} (\`${aud.id}\`)`);
          lines.push(`- **Type**: ${aud.subtype}`);
          if (aud.description) lines.push(`- **Description**: ${aud.description}`);
          const sizeLow = aud.approximate_count_lower_bound;
          const sizeHigh = aud.approximate_count_upper_bound;
          if (sizeLow !== undefined) {
            lines.push(`- **Size**: ~${formatNumber(sizeLow)}–${formatNumber(sizeHigh ?? sizeLow)}`);
          }
          if (aud.delivery_status) {
            lines.push(`- **Delivery Status**: ${aud.delivery_status.description} (code ${aud.delivery_status.code})`);
          }
          if (aud.time_created) {
            lines.push(`- **Created**: ${formatDate(new Date(aud.time_created * 1000).toISOString())}`);
          }
          lines.push("");
        }
        if (nextCursor) lines.push(buildPaginationNote(data.data.length, nextCursor));
        return { content: [{ type: "text", text: truncate(lines.join("\n"), "audiences") }] };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── Get Custom Audience ──────────────────────────────────────────────────
  server.registerTool(
    "meta_get_custom_audience",
    {
      title: "Get Custom Audience",
      description: `Gets details about a specific custom audience.

Args:
  - audience_id (string): Custom audience ID`,
      inputSchema: z
        .object({
          audience_id: z.string().describe("Custom audience ID"),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ audience_id, response_format }) => {
      try {
        const aud = await client.get<CustomAudience>(`/${audience_id}`, {
          fields: AUDIENCE_FIELDS,
        });

        if (response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(aud, null, 2) }] };
        }

        const lines = [
          `# Audience: ${aud.name}`,
          "",
          `- **ID**: \`${aud.id}\``,
          `- **Type**: ${aud.subtype}`,
          aud.description ? `- **Description**: ${aud.description}` : "",
          aud.approximate_count_lower_bound !== undefined
            ? `- **Size**: ~${formatNumber(aud.approximate_count_lower_bound)}–${formatNumber(aud.approximate_count_upper_bound ?? aud.approximate_count_lower_bound)}`
            : "",
          aud.delivery_status
            ? `- **Delivery**: ${aud.delivery_status.description}`
            : "",
          aud.operation_status
            ? `- **Operation**: ${aud.operation_status.description}`
            : "",
          aud.time_created
            ? `- **Created**: ${formatDate(new Date(aud.time_created * 1000).toISOString())}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        return { content: [{ type: "text", text: lines }] };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── Create Custom Audience ───────────────────────────────────────────────
  server.registerTool(
    "meta_create_custom_audience",
    {
      title: "Create Custom Audience",
      description: `Creates a new custom audience in a Meta ad account.

Supported types:
  - CUSTOM: Website visitors (requires Pixel), app activity, or customer list
  - ENGAGEMENT: People who engaged with your content
  - VIDEO: People who watched your videos

Args:
  - ad_account_id (string): Ad account ID (e.g., act_123456789)
  - name (string): Audience name
  - subtype (string): CUSTOM, ENGAGEMENT, VIDEO, WEBSITE, or APP
  - description (string, optional): Audience description
  - customer_file_source (string, optional): For CUSTOM type — USER_PROVIDED_ONLY, PARTNER_PROVIDED_ONLY, BOTH_USER_AND_PARTNER_PROVIDED
  - retention_days (number, optional): Days to retain audience members (1–180)

Returns the new audience ID.

Note: Populating the audience with users is a separate step requiring the Audiences API to upload hashed data or configure a rule.`,
      inputSchema: z
        .object({
          ad_account_id: z.string(),
          name: z.string().min(1),
          subtype: z
            .enum(["CUSTOM", "ENGAGEMENT", "VIDEO", "WEBSITE", "APP"])
            .describe("Audience type"),
          description: z.string().optional(),
          customer_file_source: z
            .enum(["USER_PROVIDED_ONLY", "PARTNER_PROVIDED_ONLY", "BOTH_USER_AND_PARTNER_PROVIDED"])
            .optional()
            .describe("Required for CUSTOM type"),
          retention_days: z
            .number()
            .int()
            .min(1)
            .max(180)
            .optional()
            .describe("Retention window in days"),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ ad_account_id, name, subtype, description, customer_file_source, retention_days, response_format }) => {
      try {
        const fields: Record<string, unknown> = { name, subtype };
        if (description) fields.description = description;
        if (customer_file_source) fields.customer_file_source = customer_file_source;
        if (retention_days) fields.retention_days = retention_days;

        const result = await client.post<{ id: string }>(
          `/${ad_account_id}/customaudiences`,
          fields
        );

        if (response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        return {
          content: [
            {
              type: "text",
              text: `Custom audience created successfully.\n\n- **Audience ID**: \`${result.id}\`\n- **Name**: ${name}\n- **Type**: ${subtype}`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── Create Lookalike Audience ─────────────────────────────────────────────
  server.registerTool(
    "meta_create_lookalike_audience",
    {
      title: "Create Lookalike Audience",
      description: `Creates a lookalike audience based on an existing custom audience or page.

Args:
  - ad_account_id (string): Ad account ID
  - name (string): Audience name
  - origin_audience_id (string): Source custom audience ID to base the lookalike on
  - country (string): ISO 3166-1 alpha-2 country code (e.g., "US", "GB")
  - ratio (number): Lookalike size as fraction of country population (0.01–0.20, i.e. 1%–20%)

Returns the new lookalike audience ID.`,
      inputSchema: z
        .object({
          ad_account_id: z.string(),
          name: z.string().min(1),
          origin_audience_id: z.string().describe("Source custom audience ID"),
          country: z.string().length(2).describe("ISO country code (e.g., US)"),
          ratio: z
            .number()
            .min(0.01)
            .max(0.2)
            .describe("Audience size ratio (0.01–0.20)"),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ ad_account_id, name, origin_audience_id, country, ratio, response_format }) => {
      try {
        const result = await client.post<{ id: string }>(
          `/${ad_account_id}/customaudiences`,
          {
            name,
            subtype: "LOOKALIKE",
            origin_audience_id,
            lookalike_spec: {
              type: "similarity",
              ratio,
              country,
            },
          }
        );

        if (response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        return {
          content: [
            {
              type: "text",
              text: `Lookalike audience created successfully.\n\n- **Audience ID**: \`${result.id}\`\n- **Name**: ${name}\n- **Based on**: \`${origin_audience_id}\`\n- **Country**: ${country}\n- **Size**: ${(ratio * 100).toFixed(0)}% of population`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── Delete Custom Audience ───────────────────────────────────────────────
  server.registerTool(
    "meta_delete_custom_audience",
    {
      title: "Delete Custom Audience",
      description: `Deletes a custom audience permanently. This cannot be undone.

Args:
  - audience_id (string): Custom audience ID to delete`,
      inputSchema: z
        .object({
          audience_id: z.string().describe("Custom audience ID"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ audience_id }) => {
      try {
        const result = await client.delete<{ success: boolean }>(`/${audience_id}`);
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `Audience \`${audience_id}\` deleted successfully.`
                : `Failed to delete audience \`${audience_id}\`.`,
            },
          ],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ─── Upload Customer CSV ─────────────────────────────────────────────────
  server.registerTool(
    "meta_upload_custom_audience_csv",
    {
      title: "Upload Custom Audience CSV",
      description: `Adds customer identifiers from CSV text to an existing Meta Custom Audience.

The server parses the CSV locally, normalizes email/phone values, SHA-256 hashes them locally, and sends only the hashed identifiers to Meta in batches. It never returns or logs source customer values.

Required:
  - audience_id (string): Existing customer-list Custom Audience ID
  - csv_content (string): CSV text with a header row containing email and/or phone
  - acknowledge_sensitive_data (true): Confirm lawful authority to transfer this customer data and that the token has ads_management

Supported CSV columns are email/email_address and phone/phone_number. Set email_column or phone_column for custom header names. Raw phone numbers must be E.164 (for example +14155552671), or provide phone_country_code for local numbers.

operation=add is supported. operation=replace is rejected before any data is sent: Meta's membership API cannot enumerate all existing members, so a true replacement cannot be implemented safely here. Use Ads Manager for replacement or create a separate audience and switch campaigns deliberately.

Set dry_run=true to validate, normalize, hash, deduplicate, and report counts without sending anything. Upload processing is asynchronous; the result includes the immediate Meta response and a best-effort audience status lookup. Use meta_get_custom_audience_upload_status for a later check.

Only use this tool with customer data you are authorized to process under applicable law and the relevant Meta customer-list terms.`,
      inputSchema: z
        .object({
          audience_id: z.string().min(1).describe("Existing customer-list Custom Audience ID"),
          csv_content: z
            .string()
            .min(1)
            .max(MAX_AUDIENCE_UPLOAD_CSV_CHARACTERS)
            .describe("CSV text with a header row and email and/or phone values"),
          operation: z
            .enum(["add", "replace"])
            .default("add")
            .describe("Add rows; replace is fail-closed because Meta cannot enumerate existing members"),
          email_column: z.string().min(1).optional().describe("Custom email column name"),
          phone_column: z.string().min(1).optional().describe("Custom phone column name"),
          phone_country_code: z
            .string()
            .regex(/^[1-9]\d{0,2}$/)
            .optional()
            .describe("Country calling code without +, used for local phone numbers"),
          input_format: z
            .enum(["raw", "sha256"])
            .default("raw")
            .describe("Whether CSV identifiers are raw values or already SHA-256 hashed"),
          max_rows: z
            .number()
            .int()
            .min(1)
            .max(MAX_AUDIENCE_UPLOAD_ROWS)
            .default(MAX_AUDIENCE_UPLOAD_ROWS)
            .describe("Maximum number of non-empty CSV data rows"),
          dry_run: z.boolean().default(false).describe("Validate and prepare without sending data to Meta"),
          acknowledge_sensitive_data: z
            .literal(true)
            .describe("Required confirmation of lawful data authority and ads_management permission"),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      audience_id,
      csv_content,
      operation,
      email_column,
      phone_column,
      phone_country_code,
      input_format,
      max_rows,
      dry_run,
      response_format,
    }) => {
      if (operation === "replace") {
        return errorResult(new Error(
          "Replace is not supported for this tool. Meta does not expose the existing audience member list, so replacing would require an unsafe delete-and-recreate operation. Use Ads Manager or create a separate audience.",
        ));
      }

      try {
        const prepared = prepareAudienceUpload(csv_content, {
          emailColumn: email_column,
          phoneColumn: phone_column,
          phoneCountryCode: phone_country_code,
          inputFormat: input_format,
          maxRows: max_rows,
        });

        const stats = {
          rows_read: prepared.stats.rowsRead,
          rows_accepted: prepared.stats.rowsAccepted,
          rows_skipped: prepared.stats.rowsSkipped,
          duplicates_removed: prepared.stats.duplicatesRemoved,
          invalid_email_values: prepared.stats.invalidEmailValues,
          invalid_phone_values: prepared.stats.invalidPhoneValues,
        };

        if (dry_run) {
          return formatUploadResult(
            {
              audience_id,
              operation,
              dry_run: true,
              schema: prepared.schema.join(","),
              stats,
            },
            response_format,
          );
        }

        const data = prepared.data;
        const responses: CustomAudienceUploadResponse[] = [];
        const batchCount = Math.ceil(data.length / AUDIENCE_UPLOAD_BATCH_SIZE);
        let completedBatches = 0;

        try {
          for (let start = 0; start < data.length; start += AUDIENCE_UPLOAD_BATCH_SIZE) {
            const batch = data.slice(start, start + AUDIENCE_UPLOAD_BATCH_SIZE);
            const response = await client.post<CustomAudienceUploadResponse>(
              `/${audience_id}/users`,
              {
                payload: {
                  schema: prepared.schema.length === 1 ? prepared.schema[0] : prepared.schema,
                  data: batch,
                },
              },
            );
            responses.push(response);
            completedBatches += 1;
          }
        } catch (error) {
          const detail = handleApiError(error);
          return errorResult(new Error(
            `Custom Audience upload failed after ${completedBatches} of ${batchCount} batches. ${detail}`,
          ));
        }

        let status: CustomAudience | undefined;
        let statusLookupError: string | undefined;
        try {
          status = await client.get<CustomAudience>(`/${audience_id}`, { fields: AUDIENCE_FIELDS });
        } catch (error) {
          statusLookupError = handleApiError(error);
        }

        return formatUploadResult(
          {
            audience_id,
            operation,
            dry_run: false,
            schema: prepared.schema.join(","),
            stats,
            batches: responses.length,
            meta: {
              num_received: sumUploadField(responses, "num_received"),
              num_invalid_entries: sumUploadField(responses, "num_invalid_entries"),
              num_matched: sumUploadField(responses, "num_matched"),
            },
            audience_status: audienceStatusSummary(status),
            status_lookup_error: statusLookupError,
          },
          response_format,
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  // ─── Custom Audience Upload Status ────────────────────────────────────────
  server.registerTool(
    "meta_get_custom_audience_upload_status",
    {
      title: "Get Custom Audience Upload Status",
      description: `Gets the current processing and delivery status for a Custom Audience after a customer-list upload.

Returns Meta's operation status, delivery status, and approximate audience size. Meta may process customer-list uploads asynchronously, and exact match counts are not always returned by the API. This tool does not access or return audience member data.`,
      inputSchema: z
        .object({
          audience_id: z.string().min(1).describe("Custom Audience ID"),
          response_format: ResponseFormatSchema,
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ audience_id, response_format }) => {
      try {
        const status = await client.get<CustomAudience>(`/${audience_id}`, { fields: AUDIENCE_FIELDS });
        const summary = audienceStatusSummary(status) ?? { id: audience_id };

        if (response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
        }

        const operationStatus = status.operation_status;
        const deliveryStatus = status.delivery_status;
        const lines = [
          `# Custom Audience Upload Status`,
          "",
          `- **Audience ID**: \`${audience_id}\``,
          status.name ? `- **Name**: ${status.name}` : "",
          operationStatus ? `- **Processing**: ${operationStatus.description} (code ${operationStatus.code})` : "- **Processing**: Not reported",
          deliveryStatus ? `- **Delivery**: ${deliveryStatus.description} (code ${deliveryStatus.code})` : "- **Delivery**: Not reported",
          status.approximate_count_lower_bound !== undefined
            ? `- **Approximate size**: ~${formatNumber(status.approximate_count_lower_bound)}–${formatNumber(status.approximate_count_upper_bound ?? status.approximate_count_lower_bound)}`
            : "- **Approximate size**: Not reported",
          "",
          "Meta may update these values while the upload is processing.",
        ].filter(Boolean).join("\n");
        return { content: [{ type: "text", text: lines }] };
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
