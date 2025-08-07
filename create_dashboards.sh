#!/usr/bin/env bash
set -euo pipefail

# --- 1️⃣ Load project-wide .env so its vars are exported ---
ROOT_DIR="$( cd "$(dirname "$0")" && pwd )"
if [[ -f "$ROOT_DIR/.env" ]]; then
    echo "🔑 Loading environment from .env"
    # export everything defined in .env
    set -a
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.env"
    set +a
else
    echo "⚠️  No .env file found in project root"
fi

# Script to create EvalOps Snowflake dashboards
# Prerequisites:
# 1. Snowflake CLI installed (snow)
# 2. Valid Snowflake credentials in .env file

echo "🚀 Creating EvalOps Snowflake Dashboards..."

# Check if snow CLI is available
if ! command -v snow &> /dev/null; then
    echo "❌ Snowflake CLI (snow) is not installed"
    echo "Please install it: pip install snowflake-cli-labs"
    exit 1
fi

# --- 2️⃣ Generate Streamlit secrets.toml from env vars ---
mkdir -p "$ROOT_DIR/dashboards/.streamlit"
cat > "$ROOT_DIR/dashboards/.streamlit/secrets.toml" <<EOF
[snowflake]
account     = "${SNOWFLAKE_ACCOUNT:-}"
user        = "${SNOWFLAKE_USER:-}"
password    = "${SNOWFLAKE_PASSWORD:-}"
warehouse   = "${SNOWFLAKE_WAREHOUSE:-COMPUTE_WH}"
database    = "${SNOWFLAKE_DATABASE:-SNOWFLAKE}"
schema      = "${SNOWFLAKE_SCHEMA:-PUBLIC}"
role        = "${SNOWFLAKE_ROLE:-ACCOUNTADMIN}"
authenticator = "${SNOWFLAKE_AUTHENTICATOR:-password}"
token         = "${SNOWFLAKE_TOKEN:-}"
EOF
echo "🔐 secrets.toml generated from .env"

# Navigate to dashboards directory
cd "$ROOT_DIR/dashboards" || exit 1

echo "📂 Current directory: $(pwd)"
echo "📋 Files in directory:"
ls -la

# Check if connection exists, if not create it
echo "🔗 Setting up Snowflake connection..."

# Validate required environment variables from .env
if [[ -z "${SNOWFLAKE_ACCOUNT:-}" || -z "${SNOWFLAKE_USER:-}" ]]; then
    echo "❌ Missing required Snowflake credentials in .env file:"
    echo "  SNOWFLAKE_ACCOUNT"
    echo "  SNOWFLAKE_USER"
    echo "  And one of: SNOWFLAKE_PASSWORD, SNOWFLAKE_TOKEN, or SNOWFLAKE_AUTHENTICATOR=externalbrowser"
    exit 1
fi

echo "✅ Using Snowflake credentials from .env file"
echo "   Account: $SNOWFLAKE_ACCOUNT"
echo "   User: $SNOWFLAKE_USER"
echo "   Authenticator: ${SNOWFLAKE_AUTHENTICATOR:-password}"

# Create connection using environment variables
if [[ "${SNOWFLAKE_AUTHENTICATOR:-}" == "externalbrowser" ]]; then
    snow connection add \
        --connection-name evalops \
        --account "$SNOWFLAKE_ACCOUNT" \
        --user "$SNOWFLAKE_USER" \
        --authenticator externalbrowser \
        --warehouse "${SNOWFLAKE_WAREHOUSE:-COMPUTE_WH}" \
        --database "${SNOWFLAKE_DATABASE:-SNOWFLAKE}" \
        --schema "${SNOWFLAKE_SCHEMA:-PUBLIC}" \
|| echo "Connection already exists"
elif [[ -n "${SNOWFLAKE_TOKEN:-}" ]]; then
    echo "Using OAuth token authentication"
    # Token auth handled in secrets.toml
    snow connection add \
        --connection-name evalops \
        --account "$SNOWFLAKE_ACCOUNT" \
        --user "$SNOWFLAKE_USER" \
        --authenticator oauth \
        --warehouse "${SNOWFLAKE_WAREHOUSE:-COMPUTE_WH}" \
        --database "${SNOWFLAKE_DATABASE:-SNOWFLAKE}" \
        --schema "${SNOWFLAKE_SCHEMA:-PUBLIC}" \
|| echo "Connection already exists"
else
    echo "Using password authentication"
    # Password handled in secrets.toml
    snow connection add \
        --connection-name evalops \
        --account "$SNOWFLAKE_ACCOUNT" \
        --user "$SNOWFLAKE_USER" \
        --warehouse "${SNOWFLAKE_WAREHOUSE:-COMPUTE_WH}" \
        --database "${SNOWFLAKE_DATABASE:-SNOWFLAKE}" \
        --schema "${SNOWFLAKE_SCHEMA:-PUBLIC}" \
|| echo "Connection already exists"
fi

# Create the stage for storing Streamlit files
echo "📦 Creating stage for Streamlit files..."
snow sql \
    --connection evalops \
    --query "CREATE STAGE IF NOT EXISTS dashboards_stage;"

# Deploy the main dashboard
echo "🚀 Deploying EvalOps Dashboard..."
snow streamlit deploy \
    --connection evalops \
    --replace

# Get the dashboard URL
echo "🌐 Getting dashboard URL..."
DASHBOARD_URL=$(snow streamlit get-url evalops_dashboard --connection evalops 2>/dev/null | grep -o 'https://[^[:space:]]*')

if [[ -n "$DASHBOARD_URL" ]]; then
    echo "✅ Dashboard deployed successfully!"
    echo "🔗 Dashboard URL: $DASHBOARD_URL"
else
    echo "⚠️  Dashboard deployed but URL not retrieved. Check Snowflake console."
fi

# Create a second dashboard for workspace details (optional)
echo "📊 Creating workspace details dashboard..."

# Copy workspace_details.py as a separate Streamlit app
cp pages/workspace_details.py workspace_details_dashboard.py

# Create separate config for workspace details
cat > snowflake_workspace.yml << EOF
definition_version: 1

streamlit:
  name: workspace_details_dashboard
  stage: dashboards_stage
  query_warehouse: COMPUTE_WH
  main_file: workspace_details_dashboard.py
  title: "EvalOps Workspace Details"
EOF

# Deploy workspace details dashboard
snow streamlit deploy \
    --project-definition snowflake_workspace.yml \
    --connection evalops \
    --replace

WORKSPACE_URL=$(snow streamlit get-url workspace_details_dashboard --connection evalops 2>/dev/null | grep -o 'https://[^[:space:]]*')

if [[ -n "$WORKSPACE_URL" ]]; then
    echo "✅ Workspace details dashboard deployed!"
    echo "🔗 Workspace URL: $WORKSPACE_URL"
fi

echo ""
echo "🎉 Dashboard deployment complete!"
echo ""
echo "📊 Your dashboards:"
echo "   Main Dashboard: $DASHBOARD_URL"
echo "   Workspace Details: $WORKSPACE_URL"
echo ""
echo "📝 Note: You may need to update the secrets.toml file with your actual Snowflake credentials"
echo "📁 Location: ./dashboards/.streamlit/secrets.toml"
