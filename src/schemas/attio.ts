import { z } from 'zod';

// Attio Attribute Value Schema
export const AttioAttributeValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.object({
    // For complex attribute types like email, domain, etc.
    email_address: z.string().optional(),
    domain: z.string().optional(),
    original_value: z.string().optional(),
    value: z.union([z.string(), z.number()]).optional(),
    currency_code: z.string().optional(),
    target_object: z.string().optional(),
    target_record_id: z.string().optional(),
  }),
  z.array(z.any()), // For multi-select and array types
]);

// Attio Record Schema
export const AttioRecordSchema = z.object({
  id: z.object({
    workspace_id: z.string(),
    object_id: z.string(),
    record_id: z.string(),
  }),
  created_at: z.string(),
  values: z.record(z.string(), z.array(AttioAttributeValueSchema)),
});

// Attio List Response Schema
export const AttioListResponseSchema = z.object({
  data: z.array(AttioRecordSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean().optional(),
});

// Attio Object Schema (for workspace objects)
export const AttioObjectSchema = z.object({
  id: z.object({
    workspace_id: z.string(),
    object_id: z.string(),
  }),
  api_slug: z.string(),
  singular_noun: z.string(),
  plural_noun: z.string(),
});

// Attio Workspace Schema
export const AttioWorkspaceSchema = z.object({
  data: z.object({
    workspace: z.object({
      id: z.object({
        workspace_id: z.string(),
      }),
      name: z.string(),
      handle: z.string(),
    }),
    objects: z.array(AttioObjectSchema).optional(),
  }),
});

// Type exports
export type AttioRecord = z.infer<typeof AttioRecordSchema>;
export type AttioListResponse = z.infer<typeof AttioListResponseSchema>;
export type AttioObject = z.infer<typeof AttioObjectSchema>;
export type AttioWorkspace = z.infer<typeof AttioWorkspaceSchema>;
export type AttioAttributeValue = z.infer<typeof AttioAttributeValueSchema>;