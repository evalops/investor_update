import type { AttioMetrics } from '../collectors/attioCollector';
import { AttioCollector } from '../collectors/attioCollector';
import { GCPCollector } from '../collectors/gcpCollector';
import type { GitHubMetrics } from '../collectors/githubCollector';
import { GitHubCollector } from '../collectors/githubCollector';
import type { PostHogMetrics } from '../collectors/posthogCollector';
import { PostHogCollector } from '../collectors/posthogCollector';
import { SnowflakeCollector } from '../collectors/snowflakeCollector';
import { StripeCollector } from '../collectors/stripeCollector';

import type { CohortMetrics } from './cohortAnalyzer';
import { CohortAnalyzer } from './cohortAnalyzer';
import type { Transaction } from './mercuryClient';
import type { EvalOpsMetrics, StartupMetrics } from './metricsCalculator';
import type { NarrativeInsights } from './narrativeGenerator';
import { NarrativeGenerator } from './narrativeGenerator';
import type { UnitEconomics } from './unitEconomicsCalculator';
import { UnitEconomicsCalculator } from './unitEconomicsCalculator';


export interface Metrics extends EvalOpsMetrics {
  githubMetrics?: GitHubMetrics;
  posthogMetrics?: PostHogMetrics;
  attioMetrics?: AttioMetrics;
  cohortMetrics?: CohortMetrics;
  unitEconomics?: UnitEconomics;
  narrativeInsights?: NarrativeInsights;
}

export class MetricsAggregator {
  private snowflakeCollector: SnowflakeCollector;
  private stripeCollector: StripeCollector;
  private gcpCollector: GCPCollector;
  private githubCollector: GitHubCollector;
  private posthogCollector: PostHogCollector;
  private attioCollector: AttioCollector;

  constructor() {
    this.snowflakeCollector = new SnowflakeCollector();
    this.stripeCollector = new StripeCollector();
    this.gcpCollector = new GCPCollector();
    this.githubCollector = new GitHubCollector();
    this.posthogCollector = new PostHogCollector();
    this.attioCollector = new AttioCollector();
  }

  async aggregateEvalOpsMetrics(baseMetrics: StartupMetrics): Promise<{ metrics: EvalOpsMetrics; dataSourceStatus: { [key: string]: { connected: boolean; error?: string } } }> {
    // Collect data from all sources in parallel
    const [snowflakeData, stripeData, gcpData] = await Promise.all([
      this.snowflakeCollector.collect(),
      this.stripeCollector.collect(),
      this.gcpCollector.collect()
    ]);

    // Track data source status
    const dataSourceStatus = {
      snowflake: {
        connected: !snowflakeData.error,
        error: snowflakeData.error
      },
      stripe: {
        connected: !stripeData.error,
        error: stripeData.error
      },
      gcp: {
        connected: !gcpData.error,
        error: gcpData.error
      }
    };

    // Merge all metrics into EvalOpsMetrics
    const snow = snowflakeData.data as {
      evalRuns?: number;
      evalRunsGrowth?: number;
      activeWorkspaces?: number;
      activeWorkspacesGrowth?: number;
      averageEvalDuration?: number;
      monthlyEvalRuns?: { month: string; evalRuns: number }[];
    };
    const gcp = gcpData.data as {
      gpuComputeSpend?: number;
      cpuComputeSpend?: number;
      totalComputeSpend?: number;
      computeSpendGrowth?: number;
      costPerEvalRun?: number;
      monthlyComputeSpend?: { month: string; gpu: number; cpu: number }[];
    };
    const stripe = stripeData.data as { mrr?: number; arr?: number; pipelineArr?: number; bookedArr?: number };

    const evalOpsMetrics: EvalOpsMetrics = {
      ...baseMetrics,

      // Core EvalOps KPIs from Snowflake
      evalRuns: snow.evalRuns || 0,
      evalRunsGrowth: snow.evalRunsGrowth || 0,
      activeWorkspaces: snow.activeWorkspaces || 0,
      activeWorkspacesGrowth: snow.activeWorkspacesGrowth || 0,
      averageEvalDuration: snow.averageEvalDuration || 0,
      monthlyEvalRuns: snow.monthlyEvalRuns || [],

      // Compute metrics from GCP
      gpuComputeSpend: gcp.gpuComputeSpend || 0,
      cpuComputeSpend: gcp.cpuComputeSpend || 0,
      totalComputeSpend: gcp.totalComputeSpend || 0,
      computeSpendGrowth: gcp.computeSpendGrowth || 0,
      costPerEvalRun: gcp.costPerEvalRun || 0,
      monthlyComputeSpend: gcp.monthlyComputeSpend || [],

      // Business metrics from Stripe
      pipelineArr: stripe.pipelineArr || 0,
      bookedArr: stripe.bookedArr || 0,

      // Calculated metrics
      grossMargin: this.calculateGrossMargin(
        (stripe.mrr || baseMetrics.mrr),
        (gcp.totalComputeSpend || 0)
      )
    };

    // Override base metrics with more accurate Stripe data if available
    if (stripe.mrr) {
      evalOpsMetrics.mrr = stripe.mrr;
      evalOpsMetrics.arr = stripe.arr || evalOpsMetrics.arr;
      evalOpsMetrics.averageMonthlyRevenue = stripe.mrr;
    }

    return { metrics: evalOpsMetrics, dataSourceStatus };
  }

  async aggregateMetrics(baseMetrics: StartupMetrics, transactions: Transaction[]): Promise<{ metrics: Metrics; dataSourceStatus: { [key: string]: { connected: boolean; error?: string } } }> {
    // Get base EvalOps metrics first
    const { metrics: evalOpsMetrics, dataSourceStatus } = await this.aggregateEvalOpsMetrics(baseMetrics);

    // Collect GitHub, PostHog, and Attio metrics
    const [githubData, posthogData, attioData] = await Promise.all([
      this.githubCollector.collect(),
      this.posthogCollector.collect(),
      this.attioCollector.collect()
    ]);

    dataSourceStatus.github = {
      connected: !githubData.error,
      error: githubData.error
    };

    dataSourceStatus.posthog = {
      connected: !posthogData.error,
      error: posthogData.error
    };

    dataSourceStatus.attio = {
      connected: !attioData.error,
      error: attioData.error
    };

    // Generate cohort analysis from transactions
    let cohortMetrics: CohortMetrics | undefined;
    let unitEconomics: UnitEconomics | undefined;

    if (transactions.length > 0) {
      try {
        const cohortAnalyzer = new CohortAnalyzer(transactions);
        cohortMetrics = cohortAnalyzer.generateCohortAnalysis();

        const unitEconomicsCalculator = new UnitEconomicsCalculator(transactions);
        unitEconomics = unitEconomicsCalculator.calculateUnitEconomics();
      } catch (error) {
        // Silently skip cohort/unit economics if transactions are invalid
      }
    }

    // Generate AI narrative insights
    let narrativeInsights: NarrativeInsights | undefined;
    try {
      const narrativeGenerator = new NarrativeGenerator(
        evalOpsMetrics,
        githubData.error ? undefined : githubData.data as GitHubMetrics,
        cohortMetrics,
        unitEconomics,
        posthogData.error ? undefined : posthogData.data as PostHogMetrics
      );
      narrativeInsights = narrativeGenerator.generateNarrative();
    } catch (error) {
      // Silently skip narrative generation if data is invalid
    }

    const metrics: Metrics = {
      ...evalOpsMetrics,
      githubMetrics: githubData.error ? undefined : githubData.data as GitHubMetrics,
      posthogMetrics: posthogData.error ? undefined : posthogData.data as PostHogMetrics,
      attioMetrics: attioData.error ? undefined : attioData.data as AttioMetrics,
      cohortMetrics,
      unitEconomics,
      narrativeInsights
    };

    return { metrics, dataSourceStatus };
  }

  private calculateGrossMargin(monthlyRevenue: number, monthlyComputeSpend: number): number {
    if (monthlyRevenue <= 0) {return 0;}

    const grossProfit = monthlyRevenue - monthlyComputeSpend;
    return (grossProfit / monthlyRevenue) * 100;
  }

  // Helper method to check collector health
  async checkCollectorHealth(): Promise<{ [key: string]: boolean }> {
    try {
      const results = await Promise.allSettled([
        this.snowflakeCollector.collect(),
        this.stripeCollector.collect(),
        this.gcpCollector.collect(),
        this.githubCollector.collect(),
        this.posthogCollector.collect(),
        this.attioCollector.collect()
      ]);

      return {
        snowflake: results[0].status === 'fulfilled',
        stripe: results[1].status === 'fulfilled',
        gcp: results[2].status === 'fulfilled',
        github: results[3].status === 'fulfilled',
        posthog: results[4].status === 'fulfilled',
        attio: results[5].status === 'fulfilled'
      };
    } catch (error) {
      return {
        snowflake: false,
        stripe: false,
        gcp: false,
        github: false,
        posthog: false,
        attio: false
      };
    }
  }
}
