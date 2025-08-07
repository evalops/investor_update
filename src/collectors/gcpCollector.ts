import { BigQuery } from '@google-cloud/bigquery';

import type { CollectorResult } from './baseCollector';
import { BaseCollector } from './baseCollector';


export interface GCPComputeMetrics {
  gpuComputeSpend: number;
  cpuComputeSpend: number;
  totalComputeSpend: number;
  computeSpendGrowth: number;
  costPerEvalRun: number;
  monthlyComputeSpend: { month: string; gpu: number; cpu: number }[];
}

export class GCPCollector extends BaseCollector {
  private bigquery: BigQuery | null = null;
  private projectId: string;
  private isConfigured: boolean = false;

  constructor() {
    super();
    this.projectId = process.env.GCP_PROJECT_ID || '';

    if (this.projectId && (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT)) {
      try {
        this.bigquery = new BigQuery({
          projectId: this.projectId,
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
        });
        this.isConfigured = true;
      } catch (error) {
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
    }
  }

  private async queryBillingData(): Promise<any[]> {
    const { start } = this.getDateRange(6);

    // Query to get GPU vs CPU costs from BigQuery billing export
    const query = `
      SELECT
        FORMAT_DATE('%Y-%m', usage_start_time) as month,
        SUM(CASE
          WHEN REGEXP_CONTAINS(sku.description, r'(?i)gpu|a100|v100|t4|k80')
          THEN cost
          ELSE 0
        END) as gpu,
        SUM(CASE
          WHEN REGEXP_CONTAINS(sku.description, r'(?i)core|cpu|standard|custom')
            AND NOT REGEXP_CONTAINS(sku.description, r'(?i)gpu|a100|v100|t4|k80')
          THEN cost
          ELSE 0
        END) as cpu,
        SUM(cost) as total
      FROM \`${this.projectId}.billing_export.gcp_billing_export_v1_*\`
      WHERE usage_start_time >= @start
        AND service.description = 'Compute Engine'
        AND cost > 0
      GROUP BY month
      ORDER BY month
    `;

    const options = {
      query,
      params: { start },
      location: 'US'
    };

    const [rows] = await this.bigquery!.query(options);
    return rows;
  }

  async collect(): Promise<CollectorResult> {
    if (!this.isConfigured || !this.bigquery) {
      return {
        source: 'gcp',
        data: {
          gpuComputeSpend: 0,
          cpuComputeSpend: 0,
          totalComputeSpend: 0,
          computeSpendGrowth: 0,
          costPerEvalRun: 0,
          monthlyComputeSpend: []
        },
        timestamp: new Date(),
        error: 'GCP BigQuery credentials not configured'
      };
    }

    try {
      const billingData = await this.queryBillingData();

      if (billingData.length === 0) {
        return {
          source: 'gcp',
          data: {
            gpuComputeSpend: 0,
            cpuComputeSpend: 0,
            totalComputeSpend: 0,
            computeSpendGrowth: 0,
            costPerEvalRun: 0,
            monthlyComputeSpend: []
          },
          timestamp: new Date(),
          error: 'No billing data available - check BigQuery billing export configuration'
        };
      }

      // Get latest month's data
      const latestMonth = billingData[billingData.length - 1];
      const previousMonth = billingData[billingData.length - 2];

      const gpuComputeSpend = Number(latestMonth.gpu) || 0;
      const cpuComputeSpend = Number(latestMonth.cpu) || 0;
      const totalComputeSpend = gpuComputeSpend + cpuComputeSpend;

      // Calculate growth
      const previousTotal = previousMonth ?
        (Number(previousMonth.gpu) + Number(previousMonth.cpu)) : 0;
      const computeSpendGrowth = previousTotal > 0 ?
        ((totalComputeSpend - previousTotal) / previousTotal) * 100 : 0;

      // Transform monthly data
      const monthlyComputeSpend = billingData.map(row => ({
        month: row.month,
        gpu: Number(row.gpu),
        cpu: Number(row.cpu)
      }));

      // Calculate cost per eval run (would need eval runs data)
      const costPerEvalRun = totalComputeSpend / 127500; // Using estimated eval runs

      return {
        source: 'gcp',
        data: {
          gpuComputeSpend,
          cpuComputeSpend,
          totalComputeSpend,
          computeSpendGrowth,
          costPerEvalRun,
          monthlyComputeSpend
        },
        timestamp: new Date()
      };

    } catch (error) {
      // Return zeros when GCP BigQuery is unavailable
      return {
        source: 'gcp',
        data: {
          gpuComputeSpend: 0,
          cpuComputeSpend: 0,
          totalComputeSpend: 0,
          computeSpendGrowth: 0,
          costPerEvalRun: 0,
          monthlyComputeSpend: []
        },
        timestamp: new Date(),
        error: `GCP BigQuery error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }


}
