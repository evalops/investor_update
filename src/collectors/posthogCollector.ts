import axios from 'axios';

import type { CollectorResult } from './baseCollector';
import { BaseCollector } from './baseCollector';

export interface PostHogMetrics {
  // Core product metrics
  dailyActiveUsers: number;
  monthlyActiveUsers: number;
  weeklyActiveUsers: number;

  // Engagement metrics
  averageSessionDuration: number;
  sessionsPerUser: number;
  pageViewsPerSession: number;

  // Feature adoption
  featureAdoption: FeatureAdoptionMetrics[];

  // Customer health
  customerHealthScore: number;
  churnRiskUsers: number;
  highEngagementUsers: number;

  // Growth metrics
  newUserGrowthRate: number;
  userRetentionRates: { [period: string]: number };
  activationRate: number;

  // Event analytics
  totalEvents: number;
  topEvents: { event: string; count: number }[];

  // Cohort data
  cohortRetention: CohortRetentionData[];

  // Trend data for charts
  dailyUsers: { date: string; users: number }[];
  weeklyRetention: { week: string; retention: number }[];
  featureUsageTrends: { feature: string; data: { date: string; usage: number }[] }[];
}

export interface FeatureAdoptionMetrics {
  feature: string;
  totalUsers: number;
  adoptionRate: number;
  timeToAdoption: number; // days
  retentionRate: number;
}

export interface CohortRetentionData {
  cohortPeriod: string;
  users: number;
  retention: { [period: string]: number };
}

export class PostHogCollector extends BaseCollector {
  private apiKey: string;
  private projectId: string;
  private baseUrl: string = 'https://app.posthog.com';

  constructor() {
    super();
    this.apiKey = process.env.POSTHOG_API_KEY || '';
    this.projectId = process.env.POSTHOG_PROJECT_ID || '';
  }

  async collect(): Promise<CollectorResult> {
    if (!this.apiKey) {
      return {
        source: 'PostHog',
        data: {},
        timestamp: new Date(),
        error: 'PostHog API key not configured'
      };
    }

    if (!this.projectId) {
      return {
        source: 'PostHog',
        data: {},
        timestamp: new Date(),
        error: 'PostHog project ID not configured'
      };
    }

    try {
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      // Collect all metrics in parallel
      const [
        dauData,
        mauData,
        wauData,
        eventsData,
        retentionData,
        trendsData
      ] = await Promise.all([
        this.getDailyActiveUsers(headers),
        this.getMonthlyActiveUsers(headers),
        this.getWeeklyActiveUsers(headers),
        this.getEventAnalytics(headers),
        this.getRetentionData(headers),
        this.getTrendData(headers)
      ]);

      const metrics: PostHogMetrics = {
        dailyActiveUsers: dauData.dau,
        monthlyActiveUsers: mauData.mau,
        weeklyActiveUsers: wauData.wau,

        averageSessionDuration: eventsData.avgSessionDuration,
        sessionsPerUser: eventsData.sessionsPerUser,
        pageViewsPerSession: eventsData.pageViewsPerSession,

        featureAdoption: await this.getFeatureAdoption(headers),

        customerHealthScore: this.calculateCustomerHealthScore({
          dau: dauData.dau,
          mau: mauData.mau,
          avgSessionDuration: eventsData.avgSessionDuration,
          sessionsPerUser: eventsData.sessionsPerUser
        }),
        churnRiskUsers: await this.getChurnRiskUsers(headers),
        highEngagementUsers: await this.getHighEngagementUsers(headers),

        newUserGrowthRate: await this.getNewUserGrowthRate(headers),
        userRetentionRates: retentionData.retentionRates,
        activationRate: await this.getActivationRate(headers),

        totalEvents: eventsData.totalEvents,
        topEvents: eventsData.topEvents,

        cohortRetention: retentionData.cohorts,

        dailyUsers: trendsData.dailyUsers,
        weeklyRetention: trendsData.weeklyRetention,
        featureUsageTrends: await this.getFeatureUsageTrends(headers)
      };

      return {
        source: 'PostHog',
        data: metrics,
        timestamp: new Date()
      };

    } catch (error: any) {
      return {
        source: 'PostHog',
        data: {},
        timestamp: new Date(),
        error: `PostHog API error: ${error.message}`
      };
    }
  }

  private async getDailyActiveUsers(headers: any): Promise<{ dau: number }> {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    try {
      const response = await axios.post(`${this.baseUrl}/api/projects/${this.projectId}/insights/trend`, {
        events: [{ id: '$pageview', name: '$pageview', type: 'events' }],
        date_from: this.formatDate(yesterday),
        date_to: this.formatDate(today),
        interval: 'day',
        display: 'ActionsTable'
      }, { headers });

      return { dau: response.data.result?.[0]?.count || 0 };
    } catch (error) {
      // Silently return 0 - PostHog data is optional
      return { dau: 0 };
    }
  }

  private async getMonthlyActiveUsers(headers: any): Promise<{ mau: number }> {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const response = await axios.post(`${this.baseUrl}/api/projects/${this.projectId}/insights/trend`, {
        events: [{ id: '$pageview', name: '$pageview', type: 'events' }],
        date_from: this.formatDate(thirtyDaysAgo),
        date_to: this.formatDate(today),
        interval: 'month',
        display: 'ActionsTable'
      }, { headers });

      return { mau: response.data.result?.[0]?.count || 0 };
    } catch (error) {
      // Silently return 0 - PostHog data is optional
      return { mau: 0 };
    }
  }

  private async getWeeklyActiveUsers(headers: any): Promise<{ wau: number }> {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
      const response = await axios.post(`${this.baseUrl}/api/projects/${this.projectId}/insights/trend`, {
        events: [{ id: '$pageview', name: '$pageview', type: 'events' }],
        date_from: this.formatDate(sevenDaysAgo),
        date_to: this.formatDate(today),
        interval: 'week',
        display: 'ActionsTable'
      }, { headers });

      return { wau: response.data.result?.[0]?.count || 0 };
    } catch (error) {
      // Silently return 0 - PostHog data is optional
      return { wau: 0 };
    }
  }

  private async getEventAnalytics(headers: any): Promise<{
    totalEvents: number;
    topEvents: { event: string; count: number }[];
    avgSessionDuration: number;
    sessionsPerUser: number;
    pageViewsPerSession: number;
  }> {
    try {
      // Get top events
      const eventsResponse = await axios.get(`${this.baseUrl}/api/projects/${this.projectId}/events`, {
        headers,
        params: { limit: 10 }
      });

      const events = eventsResponse.data.results || [];
      const topEvents = events.slice(0, 5).map((event: any) => ({
        event: event.event,
        count: event.count || 0
      }));

      const totalEvents = events.reduce((sum: number, event: any) => sum + (event.count || 0), 0);

      return {
        totalEvents,
        topEvents,
        avgSessionDuration: 300, // Default 5 minutes - would need session analysis
        sessionsPerUser: 2.5, // Default - would need session analysis
        pageViewsPerSession: 4.2 // Default - would need page view analysis
      };
    } catch (error) {
      // Silently return defaults - PostHog data is optional
      return {
        totalEvents: 0,
        topEvents: [],
        avgSessionDuration: 0,
        sessionsPerUser: 0,
        pageViewsPerSession: 0
      };
    }
  }

  private async getRetentionData(headers: any): Promise<{
    retentionRates: { [period: string]: number };
    cohorts: CohortRetentionData[];
  }> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/projects/${this.projectId}/insights/retention`, {
        target_entity: { id: '$pageview', name: '$pageview', type: 'events' },
        returning_entity: { id: '$pageview', name: '$pageview', type: 'events' },
        date_from: '-30d',
        period: 'Week'
      }, { headers });

      const retentionData = response.data.result || [];

      const retentionRates: { [period: string]: number } = {};
      const cohorts: CohortRetentionData[] = [];

      retentionData.forEach((cohort: any, index: number) => {
        if (cohort.values) {
          const cohortPeriod = `Week ${index + 1}`;
          const retention: { [period: string]: number } = {};

          cohort.values.forEach((value: any, periodIndex: number) => {
            const rate = value.count / cohort.values[0].count;
            retention[`Period ${periodIndex}`] = rate;

            if (periodIndex === 1) {retentionRates['1-week'] = rate;}
            if (periodIndex === 4) {retentionRates['1-month'] = rate;}
          });

          cohorts.push({
            cohortPeriod,
            users: cohort.values[0]?.count || 0,
            retention
          });
        }
      });

      return { retentionRates, cohorts };
    } catch (error) {
      // Silently return defaults - PostHog data is optional
      return {
        retentionRates: {},
        cohorts: []
      };
    }
  }

  private async getFeatureAdoption(headers: any): Promise<FeatureAdoptionMetrics[]> {
    // This would need to be customized based on your specific feature events
    const keyFeatures = [
      'eval_run_created',
      'dashboard_viewed',
      'report_generated',
      'integration_connected'
    ];

    try {
      const adoptionMetrics: FeatureAdoptionMetrics[] = [];

      for (const feature of keyFeatures) {
        try {
          const response = await axios.post(`${this.baseUrl}/api/projects/${this.projectId}/insights/trend`, {
            events: [{ id: feature, name: feature, type: 'events' }],
            date_from: '-30d',
            interval: 'day'
          }, { headers });

          const data = response.data.result?.[0];
          if (data) {
            adoptionMetrics.push({
              feature,
              totalUsers: data.count || 0,
              adoptionRate: 0.15, // Would need total user count to calculate
              timeToAdoption: 3, // Would need funnel analysis
              retentionRate: 0.65 // Would need retention analysis
            });
          }
        } catch (featureError) {
          // Continue with other features if one fails
          continue;
        }
      }

      return adoptionMetrics;
    } catch (error) {
      // Silently return empty array - PostHog data is optional
      return [];
    }
  }

  private calculateCustomerHealthScore(data: {
    dau: number;
    mau: number;
    avgSessionDuration: number;
    sessionsPerUser: number;
  }): number {
    // Calculate health score based on engagement metrics
    let score = 1;

    // DAU/MAU ratio (stickiness)
    if (data.mau > 0) {
      const stickiness = data.dau / data.mau;
      if (stickiness >= 0.2) {score += 3;}
      else if (stickiness >= 0.1) {score += 2;}
      else if (stickiness >= 0.05) {score += 1;}
    }

    // Session duration
    if (data.avgSessionDuration >= 600) {score += 2;} // 10+ minutes
    else if (data.avgSessionDuration >= 300) {score += 1;} // 5+ minutes

    // Session frequency
    if (data.sessionsPerUser >= 5) {score += 2;}
    else if (data.sessionsPerUser >= 2) {score += 1;}

    return Math.min(score, 10);
  }

  private async getChurnRiskUsers(headers: any): Promise<number> {
    // Users who haven't been active in 7 days
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const response = await axios.get(`${this.baseUrl}/api/projects/${this.projectId}/persons`, {
        headers,
        params: {
          is_identified: true,
          search: `last_seen:< ${this.formatDate(sevenDaysAgo)}`
        }
      });

      return response.data.results?.length || 0;
    } catch (error) {
      // Silently return 0 - PostHog data is optional
      return 0;
    }
  }

  private async getHighEngagementUsers(headers: any): Promise<number> {
    // Users with high activity in last 7 days
    try {
      const response = await axios.post(`${this.baseUrl}/api/projects/${this.projectId}/insights/trend`, {
        events: [{ id: '$pageview', name: '$pageview', type: 'events' }],
        date_from: '-7d',
        breakdown: '$distinct_id',
        display: 'ActionsTable'
      }, { headers });

      const results = response.data.result || [];
      return results.filter((user: any) => user.count > 10).length; // 10+ page views in 7 days
    } catch (error) {
      // Silently return 0 - PostHog data is optional
      return 0;
    }
  }

  private async getNewUserGrowthRate(headers: any): Promise<number> {
    try {
      const thisMonth = new Date();
      const lastMonth = new Date(thisMonth);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const [thisMonthUsers, lastMonthUsers] = await Promise.all([
        this.getNewUsersForPeriod(headers, thisMonth),
        this.getNewUsersForPeriod(headers, lastMonth)
      ]);

      if (lastMonthUsers === 0) {return 0;}
      return ((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100;
    } catch (error) {
      // Silently return 0 - PostHog data is optional
      return 0;
    }
  }

  private async getNewUsersForPeriod(headers: any, date: Date): Promise<number> {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    try {
      const response = await axios.get(`${this.baseUrl}/api/projects/${this.projectId}/persons`, {
        headers,
        params: {
          created_after: this.formatDate(startOfMonth),
          created_before: this.formatDate(endOfMonth)
        }
      });

      return response.data.results?.length || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getActivationRate(headers: any): Promise<number> {
    // Simplified activation rate - users who performed key action within first week
    try {
      const response = await axios.post(`${this.baseUrl}/api/projects/${this.projectId}/insights/funnel`, {
        events: [
          { id: '$identify', name: 'Sign Up', type: 'events' },
          { id: 'eval_run_created', name: 'First Eval', type: 'events' }
        ],
        date_from: '-30d',
        funnel_window_days: 7
      }, { headers });

      const steps = response.data.result?.steps || [];
      if (steps.length >= 2) {
        return (steps[1].count / steps[0].count) * 100;
      }
      return 0;
    } catch (error) {
      // Silently return 0 - PostHog data is optional
      return 0;
    }
  }

  private async getTrendData(headers: any): Promise<{
    dailyUsers: { date: string; users: number }[];
    weeklyRetention: { week: string; retention: number }[];
  }> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/projects/${this.projectId}/insights/trend`, {
        events: [{ id: '$pageview', name: '$pageview', type: 'events' }],
        date_from: '-30d',
        interval: 'day'
      }, { headers });

      const data = response.data.result?.[0]?.data || [];
      const dailyUsers = data.map((point: any) => ({
        date: point[0],
        users: point[1] || 0
      }));

      return {
        dailyUsers,
        weeklyRetention: [] // Would need retention analysis
      };
    } catch (error) {
      // Silently return empty arrays - PostHog data is optional
      return {
        dailyUsers: [],
        weeklyRetention: []
      };
    }
  }

  private async getFeatureUsageTrends(headers: any): Promise<{ feature: string; data: { date: string; usage: number }[] }[]> {
    const features = ['eval_run_created', 'dashboard_viewed'];
    const trends: { feature: string; data: { date: string; usage: number }[] }[] = [];

    for (const feature of features) {
      try {
        const response = await axios.post(`${this.baseUrl}/api/projects/${this.projectId}/insights/trend`, {
          events: [{ id: feature, name: feature, type: 'events' }],
          date_from: '-30d',
          interval: 'day'
        }, { headers });

        const data = response.data.result?.[0]?.data || [];
        trends.push({
          feature,
          data: data.map((point: any) => ({
            date: point[0],
            usage: point[1] || 0
          }))
        });
      } catch (error) {
        continue;
      }
    }

    return trends;
  }
}