# EvalOps Snowflake Dashboards

This directory contains Streamlit dashboards for visualizing EvalOps product metrics stored in Snowflake.

## Dashboards

### 1. Main Dashboard (`evalops_dashboard.py`)
- **Key Metrics**: Total evaluation runs, active workspaces, average duration, workspace utilization
- **Trends**: Monthly evaluation runs, active workspaces, and performance metrics
- **Time Periods**: Last 30 days, 3 months, or 6 months

### 2. Workspace Details (`pages/workspace_details.py`)
- **Top Workspaces**: Most active workspaces by evaluation runs
- **Distributions**: Average duration and activity level distributions
- **Detailed Table**: Searchable workspace metrics table
- **Summary Statistics**: Overall workspace performance metrics

## Quick Start

### Prerequisites
1. Snowflake CLI installed: `pip install snowflake-cli-labs`
2. Valid Snowflake credentials
3. Access to `eval_runs` table in Snowflake

### Environment Variables
Set these environment variables before deployment:

```bash
export SNOWFLAKE_ACCOUNT="KEXWQDG-LT12658"
export SNOWFLAKE_USER="jahaas"
export SNOWFLAKE_AUTHENTICATOR="externalbrowser"
export SNOWFLAKE_WAREHOUSE="COMPUTE_WH"
export SNOWFLAKE_DATABASE="SNOWFLAKE"
export SNOWFLAKE_SCHEMA="PUBLIC"
```

### Deploy Dashboards
Run the deployment script from the project root:

```bash
./create_dashboards.sh
```

### Manual Deployment
If you prefer manual deployment:

```bash
cd dashboards

# Create Snowflake connection
snow connection add \
    --connection-name evalops \
    --account KEXWQDG-LT12658 \
    --user jahaas \
    --authenticator externalbrowser \
    --warehouse COMPUTE_WH \
    --database SNOWFLAKE \
    --schema PUBLIC

# Create stage
snow sql --connection evalops --query "CREATE STAGE IF NOT EXISTS dashboards_stage;"

# Deploy dashboard
snow streamlit deploy --connection evalops --replace

# Get dashboard URL
snow streamlit get-url evalops_dashboard --connection evalops
```

## Required Snowflake Schema

The dashboards expect an `eval_runs` table with this schema:

```sql
CREATE TABLE eval_runs (
    created_at TIMESTAMP,
    workspace_id VARCHAR,
    duration_seconds NUMBER
);
```

## Configuration Files

- **`snowflake.yml`**: Streamlit app configuration
- **`environment.yml`**: Conda environment with required packages
- **`.streamlit/secrets.toml`**: Snowflake connection secrets
- **`config.toml`**: Snowflake CLI connection configuration

## Features

### Dashboard 1: Main Metrics
- 📊 Real-time metrics with 5-minute cache
- 📈 Interactive time period selection
- 📉 Growth rate calculations
- 🎨 Interactive Plotly charts
- 📱 Responsive layout

### Dashboard 2: Workspace Details
- 🏢 Top 10 most active workspaces
- 📊 Duration and activity distributions
- 🔍 Searchable workspace table
- 📈 Summary statistics

## Customization

### Adding New Metrics
1. Add new SQL queries to the dashboard files
2. Create new visualization components
3. Update the cache TTL if needed

### Styling
- Modify Plotly chart configurations
- Update Streamlit layout components
- Customize color schemes and themes

## Troubleshooting

### Connection Issues
- **Account Identifier**: Modern Snowflake accounts use `ORG-ACCOUNT` format (e.g., `MYORG-MYACCOUNT123`)
- **Legacy Identifiers**: Older accounts use region-based format (e.g., `ACCOUNT.region.cloud`)
- **Test Connection**: Run `snow connection test --connection evalops` to verify CLI connection
- **Test App Connection**: Run `./test_snowflake_connection.sh` to test your app's connection
- **Auth Methods**: Try `externalbrowser`, `oauth`, or password authentication
- **Permissions**: Ensure your user has access to the warehouse, database, and schema

### Data Issues
- Verify `eval_runs` table exists
- Check data permissions
- Validate column names match expectations

### Performance
- Adjust cache TTL in `@st.cache_data(ttl=300)`
- Optimize SQL queries for large datasets
- Consider data pagination for large result sets

## Support
For issues with Snowflake CLI or dashboard deployment, check:
- [Snowflake CLI Documentation](https://docs.snowflake.com/en/developer-guide/snowflake-cli)
- [Streamlit in Snowflake Documentation](https://docs.snowflake.com/en/developer-guide/streamlit/about-streamlit)
