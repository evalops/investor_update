// For now, we'll use regular numbers with careful rounding
// TODO: Implement proper decimal precision in a future version

export class MoneyUtils {
  // Round to 2 decimal places for currency
  static round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  // Format as currency string
  static toCurrency(value: number): string {
    return `$${MoneyUtils.round(value).toFixed(2)}`;
  }

  // Convert cents to dollars
  static fromCents(cents: number): number {
    return MoneyUtils.round(cents / 100);
  }

  // Convert to cents (for storage)
  static toCents(value: number): number {
    return Math.round(value * 100);
  }

  // Safe arithmetic operations
  static add(a: number, b: number): number {
    return MoneyUtils.round(a + b);
  }

  static subtract(a: number, b: number): number {
    return MoneyUtils.round(a - b);
  }

  static multiply(a: number, factor: number): number {
    return MoneyUtils.round(a * factor);
  }

  static divide(a: number, divisor: number): number {
    if (divisor === 0) {return 0;}
    return MoneyUtils.round(a / divisor);
  }
}
