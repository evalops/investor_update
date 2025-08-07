#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Testing Snowflake connection..."

# Load .env
ROOT_DIR="$( cd "$(dirname "$0")" && pwd )"
if [[ -f "$ROOT_DIR/.env" ]]; then
    echo "🔑 Loading environment from .env"
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi

echo "Using credentials:"
echo "  Account: ${SNOWFLAKE_ACCOUNT:-not set}"
echo "  User: ${SNOWFLAKE_USER:-not set}"
echo "  Authenticator: ${SNOWFLAKE_AUTHENTICATOR:-password}"

# Test the Node.js collector first
echo ""
echo "🧪 Testing Node.js Snowflake collector..."
cd "$ROOT_DIR"
npx ts-node -e "
import { SnowflakeCollector } from './src/collectors/snowflakeCollector';
const collector = new SnowflakeCollector();
collector.collect().then(result => {
  console.log('✅ Node.js collector result:', result);
}).catch(err => {
  console.log('❌ Node.js collector error:', err.message);
});
"

echo ""
echo "📋 Next steps for Snowflake CLI:"
echo "1. Verify your Snowflake account identifier format"
echo "2. Check if you need organization identifier (ORG-ACCOUNT format)"
echo "3. Try running: snow connection test --connection evalops"
echo "4. If connection works, run: ./create_dashboards.sh"
