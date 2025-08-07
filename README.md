# EvalOps Investor Update CLI

Simple CLI tool to generate comprehensive investor reports from Mercury Banking, Snowflake, Stripe, and GCP.

## Quick Start

```bash
# Install dependencies
bun install

# Copy environment file
cp .env.example .env
# Edit .env with your API keys

# Generate report
bun run generate
```

## Usage

```bash
# Basic usage (markdown report, 6 months, default account)
bun run generate

# Advanced usage
bun run generate-report.ts [accountId] [months] [format] [outputDir]

# Examples
bun run generate-report.ts "" 12 all ./reports
bun run generate-report.ts "" 3 html
```

### Parameters
- **accountId** - Mercury account ID (uses `EVALOPS_MERCURY_ACCOUNT_ID` from .env if empty)
- **months** - Number of months to analyze (default: 6)
- **format** - Output format: `markdown`, `html`, `json`, or `all` (default: markdown)
- **outputDir** - Output directory (default: ./report-output)

## Environment Variables

### Required
```bash
MERCURY_API_TOKEN=your_mercury_api_token_here
EVALOPS_MERCURY_ACCOUNT_ID=your_default_account_id
```

### Optional (for enhanced metrics)
```bash
# Snowflake
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USER=evalops_readonly_user
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_WAREHOUSE=PROD_WH
SNOWFLAKE_DATABASE=PROD_DB
SNOWFLAKE_SCHEMA=PUBLIC

# Stripe
STRIPE_API_KEY=sk_live_your_stripe_secret_key

# Google Cloud Platform
GCP_PROJECT_ID=your_gcp_project_id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

## Output Files

- `investor-update.md` - Professional markdown report
- `investor-update.html` - Styled HTML report
- `metrics.json` - Raw metrics data
- `update.json` - Structured update content
- Charts (PNG) - Revenue, burn rate, and growth visualizations

## Key Metrics

- Monthly Recurring Revenue (MRR)
- Revenue Growth Rate
- Monthly Burn Rate
- Runway (months)
- Active Users
- API Call Volume
- Customer metrics

## Examples

```bash
# Quick report
bun run generate

# Annual report with all formats
bun run generate-report.ts "" 12 all ./annual-report

# Quarterly HTML report
bun run generate-report.ts "" 3 html ./q4-report
```