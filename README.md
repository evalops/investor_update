# EvalOps Investor Update CLI

Advanced CLI tool with **AI Chief of Staff** that generates comprehensive investor reports and strategic guidance from Mercury Banking, Snowflake, Stripe, and other business data sources.

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Copy environment file
cp .env.example .env
# Edit .env with your API keys

# Test your setup
bun run test-env-setup.ts

# Run AI Chief of Staff
bun run ai-chief-agents.ts

# Generate full report
bun run generate-report.ts
```

## 🤖 AI Chief of Staff

Our multi-agent AI system provides strategic guidance tailored to your startup stage:

```bash
# Multi-agent AI analysis
bun run ai-chief-agents.ts
```

**Features:**
- **Financial Analyst Agent**: Assesses cash situation and runway risks
- **Strategy Advisor Agent**: Creates actionable plans and priorities
- **Customer Development Expert**: Guides validation and growth
- **Chief of Staff Orchestrator**: Synthesizes insights into comprehensive guidance

**Perfect for early-stage startups** - provides specific, actionable advice based on your financial situation and stage.

## 📊 Investor Reports

```bash
# Generate comprehensive investor reports
bun run generate-report.ts [accountId] [months] [format] [outputDir]

# Examples
bun run generate-report.ts "" 12 all ./reports    # Annual report, all formats
bun run generate-report.ts "" 3 html              # Quarterly HTML report
```

## 🔧 Environment Setup

### Required
```bash
# Mercury Banking (required for financial data)
MERCURY_API_TOKEN=your_mercury_api_token_here
EVALOPS_MERCURY_ACCOUNT_ID=your_default_account_id

# OpenAI (required for AI Chief of Staff)
OPENAI_API_KEY=sk-proj-your_openai_api_key_here
```

### Optional (for enhanced metrics)
```bash
# Stripe (payment data)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key

# PostHog (product analytics)
POSTHOG_API_KEY=phx_your_posthog_api_key

# Attio (CRM data)
ATTIO_API_KEY=your_attio_api_key

# Snowflake (data warehouse)
SNOWFLAKE_OAUTH_TOKEN=your_snowflake_token
```

## 📋 Available Scripts

### Core Functionality
- **`ai-chief-agents.ts`** - Multi-agent AI Chief of Staff analysis ⭐
- **`generate-report.ts`** - Comprehensive investor reports with charts
- **`collect-data.ts`** - Background data collection from all sources
- **`validate-setup.ts`** - Validate API connections and configuration

### Testing & Validation
- **`test-env-setup.ts`** - Test environment variable setup

## 📈 What You Get

### AI Chief of Staff Reports
- Strategic analysis based on your startup stage
- Specific action items and timelines
- Early warning systems for cash flow issues
- Customer development guidance
- Saved to `./chief-of-staff-reports/`

### Investor Reports
- Professional markdown and HTML reports
- Financial charts and visualizations
- Key startup metrics (MRR, burn rate, runway)
- Growth analysis and projections
- Saved to `./report-output/`

## 🎯 Key Metrics Tracked

- **Financial**: MRR, burn rate, runway, cash efficiency
- **Growth**: Revenue growth, customer acquisition
- **Product**: API usage, active workspaces, evaluation runs
- **Strategic**: Unit economics, cohort analysis, market position

## 💡 Perfect For

- **Early-stage startups** needing strategic guidance
- **Founders** preparing investor updates
- **Teams** tracking key business metrics
- **Investors** monitoring portfolio companies

Get started with `bun run ai-chief-agents.ts` for immediate strategic insights!