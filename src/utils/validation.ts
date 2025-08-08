import { z } from 'zod';

// Validation schemas
export const ConfigSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  months: z.number().min(1, "Months must be at least 1").max(36, "Months cannot exceed 36"),
  format: z.enum(['markdown', 'html', 'json', 'yc-email', 'all']),
  outputDir: z.string().min(1, "Output directory is required")
});

export const EnvironmentSchema = z.object({
  MERCURY_API_TOKEN: z.string().min(1, "Mercury API token is required"),
  EVALOPS_MERCURY_ACCOUNT_ID: z.string().optional(),
  SNOWFLAKE_ACCOUNT: z.string().optional(),
  SNOWFLAKE_USER: z.string().optional(),
  SNOWFLAKE_PASSWORD: z.string().optional(),
  STRIPE_API_KEY: z.string().optional(),
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_PROJECT_ID: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  ATTIO_API_KEY: z.string().optional()
});

export const TransactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  description: z.string().optional(),
  postedDate: z.string().optional(),
  createdAt: z.string(),
  kind: z.string(),
  counterpartyName: z.string().optional(),
  category: z.string().optional()
});

export const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  currentBalance: z.number(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional()
});

// Validation functions
export function validateConfig(config: unknown): { success: true; data: z.infer<typeof ConfigSchema> } | { success: false; errors: string[] } {
  try {
    const data = ConfigSchema.parse(config);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.issues.map((issue) => {
          const path = issue.path.join('.');
          // Normalize enum error messaging to match test expectations
          const code = (issue as any).code as string | undefined;
          const message = code === 'invalid_enum_value' ? 'Invalid option' : issue.message;
          return `${path}: ${message}`;
        }),
      };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}

export function validateEnvironment(env: unknown): { success: true; data: z.infer<typeof EnvironmentSchema> } | { success: false; errors: string[] } {
  try {
    const data = EnvironmentSchema.parse(env);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
      };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}

export function validateTransaction(transaction: unknown): { success: true; data: z.infer<typeof TransactionSchema> } | { success: false; errors: string[] } {
  try {
    const data = TransactionSchema.parse(transaction);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.issues.map(issue => `Transaction ${issue.path.join('.')}: ${issue.message}`)
      };
    }
    return { success: false, errors: ['Unknown transaction validation error'] };
  }
}

export function validateTransactions(transactions: unknown[]): { valid: any[]; invalid: { data: unknown; errors: string[] }[] } {
  const valid: any[] = [];
  const invalid: { data: unknown; errors: string[] }[] = [];

  transactions.forEach(transaction => {
    const result = validateTransaction(transaction);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({ data: transaction, errors: result.errors });
    }
  });

  return { valid, invalid };
}

export function validateAccount(account: unknown): { success: true; data: z.infer<typeof AccountSchema> } | { success: false; errors: string[] } {
  try {
    const data = AccountSchema.parse(account);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.issues.map(issue => `Account ${issue.path.join('.')}: ${issue.message}`)
      };
    }
    return { success: false, errors: ['Unknown account validation error'] };
  }
}

// Custom error classes for better error handling
export class ValidationError extends Error {
  constructor(public errors: string[]) {
    super(`Validation failed: ${errors.join(', ')}`);
    this.name = 'ValidationError';
  }
}

export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string, public missingKeys?: string[]) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

// Error handling utilities
export function handleAPIError(error: any): never {
  if (error.response) {
    // HTTP error response
    const status = error.response.status;
    const data = error.response.data;
    
    if (status === 401) {
      throw new APIError('Authentication failed. Please check your API credentials.', status, 'AUTH_FAILED', data);
    } else if (status === 403) {
      throw new APIError('Access forbidden. Please check your API permissions.', status, 'ACCESS_FORBIDDEN', data);
    } else if (status === 429) {
      throw new APIError('Rate limit exceeded. Please try again later.', status, 'RATE_LIMITED', data);
    } else if (status >= 500) {
      throw new APIError('Server error occurred. Please try again later.', status, 'SERVER_ERROR', data);
    } else {
      throw new APIError(`API request failed: ${data?.message || error.message}`, status, 'API_ERROR', data);
    }
  } else if (error.code) {
    // Network or system error
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new APIError('Network connection failed. Please check your internet connection.', undefined, error.code);
    } else if (error.code === 'ETIMEDOUT') {
      throw new APIError('Request timed out. Please try again.', undefined, error.code);
    }
  }
  
  // Generic error
  throw new APIError(error.message || 'Unknown API error occurred');
}

export function formatError(error: Error): string {
  if (error instanceof ValidationError) {
    return `❌ Validation Error:\n${error.errors.map(e => `  • ${e}`).join('\n')}`;
  } else if (error instanceof APIError) {
    let message = `❌ API Error: ${error.message}`;
    if (error.status) {
      message += ` (HTTP ${error.status})`;
    }
    if (error.code) {
      message += ` [${error.code}]`;
    }
    return message;
  } else if (error instanceof ConfigurationError) {
    let message = `❌ Configuration Error: ${error.message}`;
    if (error.missingKeys?.length) {
      message += `\n  Missing: ${error.missingKeys.join(', ')}`;
    }
    return message;
  } else {
    return `❌ Error: ${error.message}`;
  }
}

// Retry utility for API calls
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    backoffMs?: number;
    retryOn?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, backoffMs = 1000, retryOn = () => true } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts || !retryOn(lastError)) {
        throw lastError;
      }
      
      // Exponential backoff
      const delay = backoffMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}
