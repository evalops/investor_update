# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code Naming Standards
**CRITICAL**: Avoid prefixing interfaces, functions, and classes with words like "Enhanced", "Advanced", "Improved", etc. These prefixes add no value and create confusing hierarchies. Use clear, descriptive names that indicate actual functionality instead of subjective quality judgments.

Examples:
- Bad: `EnhancedMetrics`, `AdvancedCalculator`, `ImprovedGenerator`
- Good: `AggregatedMetrics`, `MetricsCalculator`, `ReportGenerator`

## Development Commands

### Core Commands
- `bun install` - Install dependencies
- `bun run generate` - Generate investor report with default settings (6 months, markdown format)
- `bun run dev` - Run in watch mode for development
- `bun test` - Run test suite
- `bun test --watch` - Run tests in watch mode
- `bun test --coverage` - Run tests with coverage report

### Report Generation
```bash
# Basic usage
bun run generate

# Advanced usage with parameters
bun run generate-report.ts [accountId] [months] [format] [outputDir]

# Examples
bun run generate-report.ts "" 12 all ./reports     # 12-month report, all formats
bun run generate-report.ts "" 3 html              # 3-month HTML report
bun run generate-report.ts "" 6 yc-email          # YC-style email update
```

### Configuration & Setup
- `bun run generate-report.ts --setup` or `--wizard` - Interactive configuration wizard
- `bun run generate-report.ts --config` - Display configuration help
- `bun run generate-report.ts --check-config` - Validate environment variables

## Architecture Overview

This is a TypeScript CLI application built with Bun that generates comprehensive investor reports by aggregating data from multiple financial and business intelligence sources.

### Core Architecture Pattern
The system follows a **Collector-Aggregator-Generator** pattern:

1. **Collectors** (`src/collectors/`) - Fetch data from external APIs
2. **Services** (`src/services/`) - Process, aggregate, and calculate metrics  
3. **Templates** (`src/templates/`) - Generate formatted outputs

### Key Components

#### Data Collection Layer
- `BaseCollector` - Abstract base class with timeout and error handling
- Individual collectors for each data source:
  - `MercuryClient` - Banking/financial data
  - `StripeCollector` - Payment and subscription metrics
  - `SnowflakeCollector` - Data warehouse analytics
  - `GcpCollector` - Cloud computing costs
  - `AttioCollector` - CRM data
  - `PosthogCollector` - Product analytics
  - `GithubCollector` - Development metrics

#### Processing Services
- `MetricsAggregator` - Combines data from all collectors into unified metrics
- `MetricsCalculator` - Computes startup financial metrics (MRR, burn rate, runway)
- `ChartGenerator` - Creates visualizations using Chart.js
- `UpdateGenerator` - Orchestrates report generation
- `NarrativeGenerator` - Creates natural language insights
- `CohortAnalyzer` - Customer lifecycle analysis
- `UnitEconomicsCalculator` - LTV, CAC, and unit economics

#### Output Templates
- `htmlTemplate` - Professional HTML reports
- `template` - Email format with all metrics

### Configuration System

#### Environment Variables
Required: `MERCURY_API_TOKEN`, `EVALOPS_MERCURY_ACCOUNT_ID`
Optional: Snowflake, Stripe, GCP, PostHog, Attio credentials for enhanced metrics

#### Expense Categorization
The system uses `src/config/categories.json` to automatically categorize expenses into business-relevant categories (GPU Compute, ML Tooling, etc.) using keyword matching with priority levels.

### Output Formats
- **Markdown** - Professional investor update document
- **HTML** - Styled web report with embedded charts  
- **JSON** - Raw metrics data and structured content
- **YC Email** - Y Combinator-style email update format
- **All** - Generates all formats simultaneously

### Data Flow
1. CLI parses arguments and validates configuration
2. Collectors fetch data from configured sources (with timeout protection)
3. MetricsAggregator combines and normalizes all data
4. MetricsCalculator computes financial metrics and trends
5. ChartGenerator creates visualization files
6. UpdateGenerator orchestrates template rendering
7. Final reports saved to output directory with charts

### Testing Structure
- Unit tests in `tests/unit/` for core logic
- Integration tests in `tests/integration/` for API interactions
- Mock data fixtures in `tests/fixtures/`
- Bun test runner with coverage support

### Error Handling
- Comprehensive validation with `src/utils/validation.ts`
- Environment validation with connection testing
- Graceful degradation when optional data sources fail
- Structured error logging with `Logger` utility

## Development Notes

### Data Sources Priority
1. Mercury (required) - Primary financial data
2. Stripe - Revenue and subscription metrics  
3. Snowflake - Analytics and user metrics
4. GCP - Infrastructure costs
5. Additional sources (PostHog, Attio, GitHub) - Enhancement data

### Key Metrics Calculated
- Monthly Recurring Revenue (MRR) and growth rates
- Customer Acquisition Cost (CAC) and Lifetime Value (LTV)
- Monthly/weekly burn rate and runway projections
- Unit economics and cohort retention
- Expense categorization and trend analysis

### Output Files Generated
- `investor-update.md` - Main markdown report
- `investor-update.html` - Styled HTML version
- `yc-email-update.txt` - YC-style email update
- `metrics.json` - Raw metrics data
- Various chart PNG files (revenue, burn-rate, runway, etc.)