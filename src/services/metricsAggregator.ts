import { EvalOpsMetrics, StartupMetrics } from './metricsCalculator';
import { SnowflakeCollector } from '../collectors/snowflakeCollector';
import { StripeCollector } from '../collectors/stripeCollector';
import { GCPCollector } from '../collectors/gcpCollector';
import { GitHubCollector, GitHubMetrics } from '../collectors/githubCollector';
import { PostHogCollector, PostHogMetrics } from '../collectors/posthogCollector';
import { AttioCollector, AttioMetrics } from '../collectors/attioCollector';
import { CohortAnalyzer, CohortMetrics } from './cohortAnalyzer';
import { UnitEconomicsCalculator, UnitEconomics } from './unitEconomicsCalculator';
import { NarrativeGenerator, NarrativeInsights } from './narrativeGenerator';
import { Transaction } from './mercuryClient';


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
    const evalOpsMetrics: EvalOpsMetrics = {
      ...baseMetrics,

      // Core EvalOps KPIs from Snowflake
      evalRuns: snowflakeData.data.evalRuns || 0,
      evalRunsGrowth: snowflakeData.data.evalRunsGrowth || 0,
      activeWorkspaces: snowflakeData.data.activeWorkspaces || 0,
      activeWorkspacesGrowth: snowflakeData.data.activeWorkspacesGrowth || 0,
      averageEvalDuration: snowflakeData.data.averageEvalDuration || 0,
      monthlyEvalRuns: snowflakeData.data.monthlyEvalRuns || [],

      // Compute metrics from GCP
      gpuComputeSpend: gcpData.data.gpuComputeSpend || 0,
      cpuComputeSpend: gcpData.data.cpuComputeSpend || 0,
      totalComputeSpend: gcpData.data.totalComputeSpend || 0,
      computeSpendGrowth: gcpData.data.computeSpendGrowth || 0,
      costPerEvalRun: gcpData.data.costPerEvalRun || 0,
      monthlyComputeSpend: gcpData.data.monthlyComputeSpend || [],

      // Business metrics from Stripe
      pipelineArr: stripeData.data.pipelineArr || 0,
      bookedArr: stripeData.data.bookedArr || 0,

      // Calculated metrics
      grossMargin: this.calculateGrossMargin(
        stripeData.data.mrr || baseMetrics.mrr,
        gcpData.data.totalComputeSpend || 0
      )
    };

    // Override base metrics with more accurate Stripe data if available
    if (stripeData.data.mrr) {
      evalOpsMetrics.mrr = stripeData.data.mrr;
      evalOpsMetrics.arr = stripeData.data.arr;
      evalOpsMetrics.averageMonthlyRevenue = stripeData.data.mrr;
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
        githubData.data || undefined,
        cohortMetrics,
        unitEconomics,
        posthogData.data || undefined
      );
      narrativeInsights = narrativeGenerator.generateNarrative();
    } catch (error) {
      // Silently skip narrative generation if data is invalid
    }

    const metrics: Metrics = {
      ...evalOpsMetrics,
      githubMetrics: githubData.data || undefined,
      posthogMetrics: posthogData.data || undefined,
      attioMetrics: attioData.data || undefined,
      cohortMetrics,
      unitEconomics,
      narrativeInsights
    };

    return { metrics, dataSourceStatus };
  }

  private calculateGrossMargin(monthlyRevenue: number, monthlyComputeSpend: number): number {
    if (monthlyRevenue <= 0) return 0;

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
