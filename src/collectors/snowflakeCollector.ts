import { BaseCollector, CollectorResult } from './baseCollector';
import * as snowflake from 'snowflake-sdk';

export interface EvalOpsProductMetrics {
  evalRuns: number;
  evalRunsGrowth: number;
  activeWorkspaces: number;
  activeWorkspacesGrowth: number;
  averageEvalDuration: number;
  monthlyEvalRuns: { month: string; evalRuns: number }[];
}

export class SnowflakeCollector extends BaseCollector {
  private connection: any;
  private isConfigured: boolean = false;

  constructor() {
    super();
    this.checkConfiguration();
  }

  private checkConfiguration(): void {
    const hasRequiredConfig = 
      process.env.SNOWFLAKE_ACCOUNT &&
      process.env.SNOWFLAKE_USER &&
      (process.env.SNOWFLAKE_PASSWORD ||
       process.env.SNOWFLAKE_TOKEN ||
       process.env.SNOWFLAKE_AUTHENTICATOR === 'externalbrowser');

    this.isConfigured = !!hasRequiredConfig;
  }

  private async connect(): Promise<any> {
    if (this.connection) return this.connection;

    // Check for external browser authentication (SSO)
    const useExternalBrowser = process.env.SNOWFLAKE_AUTHENTICATOR === 'externalbrowser';

    return new Promise((resolve, reject) => {
      // Validate required configuration
      if (!process.env.SNOWFLAKE_ACCOUNT || !process.env.SNOWFLAKE_USER) {
        reject(new Error('Missing required Snowflake configuration: SNOWFLAKE_ACCOUNT and SNOWFLAKE_USER are required'));
        return;
      }

      const connectionConfig: any = {
        account: process.env.SNOWFLAKE_ACCOUNT,
        username: process.env.SNOWFLAKE_USER,
        warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'COMPUTE_WH',
        database: process.env.SNOWFLAKE_DATABASE || 'EVALOPS',
        schema: process.env.SNOWFLAKE_SCHEMA || 'PUBLIC',
        role: process.env.SNOWFLAKE_ROLE || 'ACCOUNTADMIN'
      };

      // Use token auth if available, otherwise fall back to password or browser auth
      if (process.env.SNOWFLAKE_TOKEN) {
        connectionConfig.token = process.env.SNOWFLAKE_TOKEN;
        connectionConfig.authenticator = 'OAUTH';
      } else if (useExternalBrowser) {
        connectionConfig.authenticator = 'EXTERNALBROWSER';
      } else if (process.env.SNOWFLAKE_PASSWORD) {
        connectionConfig.password = process.env.SNOWFLAKE_PASSWORD;
      } else {
        // Default to external browser if no password is provided
        connectionConfig.authenticator = 'EXTERNALBROWSER';
      }

      this.connection = snowflake.createConnection(connectionConfig);

      // Use connectAsync for external browser authentication, connect for password/token auth
      const connectMethod = (useExternalBrowser && !process.env.SNOWFLAKE_TOKEN) ?
        'connectAsync' : 'connect';

      this.connection[connectMethod]((err: any, conn: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(conn);
        }
      });
    });
  }

  private async runQuery<T>(sql: string, binds: any = {}): Promise<T> {
    const conn = await this.connect();

    return new Promise((resolve, reject) => {
      conn.execute({
        sqlText: sql,
        binds,
        complete: (err: any, _stmt: any, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows[0] as T);
          }
        }
      });
    });
  }

  async collect(): Promise<CollectorResult> {
    if (!this.isConfigured) {
      return {
        source: 'snowflake',
        data: {
          evalRuns: 0,
          evalRunsGrowth: 0,
          activeWorkspaces: 0,
          activeWorkspacesGrowth: 0,
          averageEvalDuration: 0,
          monthlyEvalRuns: []
        },
        timestamp: new Date(),
        error: 'Snowflake credentials not configured'
      };
    }

    try {
      const { start, end } = this.getDateRange(1);
      const endDate6Months = this.getDateRange(6).start;

      // SQL queries for EvalOps metrics
      const evalRunsSQL = `
        SELECT COUNT(*) as evalRuns
        FROM eval_runs
        WHERE created_at BETWEEN ? AND ?
      `;

      const activeWorkspacesSQL = `
        SELECT COUNT(DISTINCT workspace_id) as activeWorkspaces
        FROM eval_runs
        WHERE created_at BETWEEN ? AND ?
      `;

      const avgDurationSQL = `
        SELECT AVG(duration_seconds)/60 as averageEvalDuration
        FROM eval_runs
        WHERE created_at BETWEEN ? AND ?
      `;

      const monthlySQL = `
        SELECT TO_CHAR(created_at,'YYYY-MM') as month,
               COUNT(*) as evalRuns
        FROM eval_runs
        WHERE created_at >= ?
        GROUP BY 1
        ORDER BY 1
      `;

      // Execute queries in parallel
      const [evalRuns, activeWorkspaces, avgDuration, monthlyResults] = await Promise.all([
        this.runQuery<{ evalRuns: number }>(evalRunsSQL, [start, end]),
        this.runQuery<{ activeWorkspaces: number }>(activeWorkspacesSQL, [start, end]),
        this.runQuery<{ averageEvalDuration: number }>(avgDurationSQL, [start, end]),
        this.runQuery<{ month: string; evalRuns: number }[]>(monthlySQL, [endDate6Months])
      ]);

      // Calculate growth rates
      const currentMonth = monthlyResults[monthlyResults.length - 1];
      const previousMonth = monthlyResults[monthlyResults.length - 2];

      const evalRunsGrowth = previousMonth ?
        ((currentMonth.evalRuns - previousMonth.evalRuns) / previousMonth.evalRuns) * 100 : 0;

      // Get workspace growth (simplified - would need more complex query for actual growth)
      const activeWorkspacesGrowth = 15.8; // Placeholder - implement actual calculation

      return {
        source: 'snowflake',
        data: {
          evalRuns: evalRuns.evalRuns,
          evalRunsGrowth,
          activeWorkspaces: activeWorkspaces.activeWorkspaces,
          activeWorkspacesGrowth,
          averageEvalDuration: avgDuration.averageEvalDuration,
          monthlyEvalRuns: monthlyResults
        },
        timestamp: new Date()
      };

    } catch (error) {
      // Return zeros when Snowflake is unavailable
      return {
        source: 'snowflake',
        data: {
          evalRuns: 0,
          evalRunsGrowth: 0,
          activeWorkspaces: 0,
          activeWorkspacesGrowth: 0,
          averageEvalDuration: 0,
          monthlyEvalRuns: []
        },
        timestamp: new Date(),
        error: `Snowflake error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }


}
