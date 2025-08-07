import { SnowflakeCollector } from './src/collectors/snowflakeCollector';

console.log('🧪 Testing Snowflake connection...');
const collector = new SnowflakeCollector();

try {
  const result = await collector.collect();
  console.log('✅ Snowflake collector result:', result);
} catch (error) {
  console.log('❌ Snowflake collector error:', (error as Error).message);
}
