import { test, expect } from "bun:test";
import { 
  validateConfig, 
  validateEnvironment, 
  ValidationError, 
  APIError, 
  ConfigurationError,
  formatError 
} from "../../src/utils/validation";

test("validateConfig - should accept valid configuration", () => {
  const validConfig = {
    accountId: "test-account-123",
    months: 6,
    format: "yc-email" as const,
    outputDir: "./output"
  };
  
  const result = validateConfig(validConfig);
  expect(result.success).toBe(true);
  
  if (result.success) {
    expect(result.data).toEqual(validConfig);
  }
});

test("validateConfig - should reject invalid months", () => {
  const invalidConfig = {
    accountId: "test-account-123",
    months: 0, // Invalid - must be at least 1
    format: "yc-email" as const,
    outputDir: "./output"
  };
  
  const result = validateConfig(invalidConfig);
  expect(result.success).toBe(false);
  
  if (!result.success) {
    expect(result.errors).toContain("months: Months must be at least 1");
  }
});

test("validateConfig - should reject invalid format", () => {
  const invalidConfig = {
    accountId: "test-account-123",
    months: 6,
    format: "invalid-format",
    outputDir: "./output"
  };
  
  const result = validateConfig(invalidConfig);
  expect(result.success).toBe(false);
  
  if (!result.success) {
    expect(result.errors[0]).toContain("Invalid option");
  }
});

test("validateEnvironment - should accept valid environment", () => {
  const validEnv = {
    MERCURY_API_TOKEN: "mer_live_test123",
    EVALOPS_MERCURY_ACCOUNT_ID: "account-123"
  };
  
  const result = validateEnvironment(validEnv);
  expect(result.success).toBe(true);
  
  if (result.success) {
    expect(result.data.MERCURY_API_TOKEN).toBe("mer_live_test123");
  }
});

test("validateEnvironment - should reject missing required token", () => {
  const invalidEnv = {};
  
  const result = validateEnvironment(invalidEnv);
  expect(result.success).toBe(false);
  
  if (!result.success) {
    expect(result.errors[0]).toContain("MERCURY_API_TOKEN:");
  }
});

test("ValidationError - should format errors correctly", () => {
  const errors = ["Field is required", "Value is invalid"];
  const error = new ValidationError(errors);
  
  expect(error.name).toBe("ValidationError");
  expect(error.errors).toEqual(errors);
  expect(error.message).toContain("Validation failed");
});

test("APIError - should include status and code", () => {
  const error = new APIError("API request failed", 404, "NOT_FOUND", { detail: "Resource not found" });
  
  expect(error.name).toBe("APIError");
  expect(error.message).toBe("API request failed");
  expect(error.status).toBe(404);
  expect(error.code).toBe("NOT_FOUND");
  expect(error.details).toEqual({ detail: "Resource not found" });
});

test("ConfigurationError - should track missing keys", () => {
  const missingKeys = ["MERCURY_API_TOKEN", "STRIPE_API_KEY"];
  const error = new ConfigurationError("Required configuration missing", missingKeys);
  
  expect(error.name).toBe("ConfigurationError");
  expect(error.missingKeys).toEqual(missingKeys);
});

test("formatError - should format ValidationError correctly", () => {
  const error = new ValidationError(["Field 1 is required", "Field 2 is invalid"]);
  const formatted = formatError(error);
  
  expect(formatted).toContain("❌ Validation Error:");
  expect(formatted).toContain("• Field 1 is required");
  expect(formatted).toContain("• Field 2 is invalid");
});

test("formatError - should format APIError correctly", () => {
  const error = new APIError("Request failed", 500, "SERVER_ERROR");
  const formatted = formatError(error);
  
  expect(formatted).toContain("❌ API Error: Request failed");
  expect(formatted).toContain("(HTTP 500)");
  expect(formatted).toContain("[SERVER_ERROR]");
});

test("formatError - should format ConfigurationError correctly", () => {
  const error = new ConfigurationError("Config missing", ["TOKEN", "KEY"]);
  const formatted = formatError(error);
  
  expect(formatted).toContain("❌ Configuration Error: Config missing");
  expect(formatted).toContain("Missing: TOKEN, KEY");
});

test("formatError - should format generic Error correctly", () => {
  const error = new Error("Something went wrong");
  const formatted = formatError(error);
  
  expect(formatted).toBe("❌ Error: Something went wrong");
});