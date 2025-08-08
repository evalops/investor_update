import Stripe from 'stripe';

import type { CollectorResult } from './baseCollector';
import { BaseCollector } from './baseCollector';


export interface StripeRevenueMetrics {
  mrr: number;
  arr: number;
  pipelineArr: number;
  bookedArr: number;
  grossMargin: number;
  revenueGrowth: number;
}

export class StripeCollector extends BaseCollector {
  private stripe: Stripe | null = null;
  private isConfigured: boolean = false;

  constructor() {
    super();
    const apiKey = process.env.STRIPE_API_KEY;
    if (apiKey) {
      try {
        this.stripe = new Stripe(apiKey, { apiVersion: '2025-07-30.basil' });
        this.isConfigured = true;
      } catch (error) {
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
    }
  }

  private async calculateMRR(): Promise<number> {
    if (!this.stripe) {return 0;}
    let mrrCents = 0;

    const subscriptions = await this.stripe.subscriptions.list({
      status: 'active',
      limit: 100
    });

    for (const subscription of subscriptions.data) {
      for (const item of subscription.items.data) {
        if (item.price?.recurring?.interval === 'month') {
          mrrCents += (item.price.unit_amount || 0) * (item.quantity || 1);
        } else if (item.price?.recurring?.interval === 'year') {
          // Convert annual to monthly
          mrrCents += ((item.price.unit_amount || 0) * (item.quantity || 1)) / 12;
        }
      }
    }

    return mrrCents / 100; // Convert cents to dollars
  }

  private async calculateBookedARR(): Promise<number> {
    // Look at subscription schedules for future revenue
    try {
      if (!this.stripe) {return 0;}
      const schedules = await this.stripe.subscriptionSchedules.list({
        limit: 100
      });

      let bookedArrCents = 0;
      for (const schedule of schedules.data) {
        // Calculate ARR from scheduled subscriptions
        for (const phase of schedule.phases) {
          for (const item of phase.items) {
            const price = typeof item.price === 'object' && item.price && 'recurring' in item.price ? item.price : null;
            if (price?.recurring?.interval === 'year') {
              bookedArrCents += (price.unit_amount || 0) * (item.quantity || 1);
            } else if (price?.recurring?.interval === 'month') {
              bookedArrCents += ((price.unit_amount || 0) * (item.quantity || 1)) * 12;
            }
          }
        }
      }

      return bookedArrCents / 100;
    } catch (error) {
      // Silently return 0 - Stripe data is optional
      return 0;
    }
  }

  private async calculateRevenueGrowth(): Promise<number> {
    // Get last 2 months of revenue to calculate growth
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    try {
      if (!this.stripe) {return 0;}
      const [thisMonthInvoices, lastMonthInvoices] = await Promise.all([
        this.stripe.invoices.list({
          created: { gte: Math.floor(thisMonth.getTime() / 1000) },
          status: 'paid'
        }),
        this.stripe.invoices.list({
          created: {
            gte: Math.floor(twoMonthsAgo.getTime() / 1000),
            lt: Math.floor(lastMonth.getTime() / 1000)
          },
          status: 'paid'
        })
      ]);

      const thisMonthRevenue = thisMonthInvoices.data.reduce((sum, inv) => sum + inv.amount_paid, 0);
      const lastMonthRevenue = lastMonthInvoices.data.reduce((sum, inv) => sum + inv.amount_paid, 0);

      if (lastMonthRevenue === 0) {return 0;}
      return ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    } catch (error) {
      // Silently return 0 - Stripe data is optional
      return 0;
    }
  }

  async collect(): Promise<CollectorResult> {
    if (!this.isConfigured || !this.stripe) {
      return {
        source: 'stripe',
        data: {
          mrr: 0,
          arr: 0,
          pipelineArr: 0,
          bookedArr: 0,
          grossMargin: 0,
          revenueGrowth: 0
        },
        timestamp: new Date(),
        error: 'Stripe API key not configured'
      };
    }

    try {
      const [mrr, bookedArr, revenueGrowth] = await Promise.all([
        this.calculateMRR(),
        this.calculateBookedARR(),
        this.calculateRevenueGrowth()
      ]);

      const arr = mrr * 12;
      const pipelineArr = bookedArr; // Simplified - could be more complex calculation

      return {
        source: 'stripe',
        data: {
          mrr,
          arr,
          pipelineArr,
          bookedArr,
          grossMargin: 0, // Will be calculated in MetricsAggregator
          revenueGrowth
        },
        timestamp: new Date()
      };

    } catch (error) {
      // Return zeros when Stripe is unavailable
      return {
        source: 'stripe',
        data: {
          mrr: 0,
          arr: 0,
          pipelineArr: 0,
          bookedArr: 0,
          grossMargin: 0,
          revenueGrowth: 0
        },
        timestamp: new Date(),
        error: `Stripe API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }


}
