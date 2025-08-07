import { BaseCollector, CollectorResult } from './baseCollector';

export interface AttioCustomer {
  id: string;
  name: string;
  email?: string;
  company?: string;
  jobTitle?: string;
  createdAt: string;
}

export interface AttioCompany {
  id: string;
  name: string;
  domain?: string;
  description?: string;
  employeeCount?: number;
  industry?: string;
  createdAt: string;
}

export interface AttioDeal {
  id: string;
  name: string;
  value: number;
  status: string;
  createdAt: string;
  closedAt?: string;
}

export interface AttioMetrics {
  totalCustomers: number;
  totalCompanies: number;
  totalDeals: number;
  openDeals: number;
  closedDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalDealValue: number;
  avgDealSize: number;
  salesPipelineValue: number;
  monthlyNewCustomers: number;
  customerGrowthRate: number;
  
  // Enhanced data
  customers: AttioCustomer[];
  companies: AttioCompany[];
  deals: AttioDeal[];
  topCompanies: { name: string; employeeCount?: number }[];
  recentCustomers: AttioCustomer[];
}

interface AttioRecord {
  id: {
    workspace_id: string;
    object_id: string;
    record_id: string;
  };
  created_at: string;
  web_url: string;
  values: Record<string, any[]>;
}

interface AttioQueryResponse {
  data: AttioRecord[];
  next_cursor?: string;
}

export class AttioCollector extends BaseCollector {
  private baseUrl: string = 'https://api.attio.com/v2';
  private apiKey: string | null = null;
  private isConfigured: boolean = false;

  constructor() {
    super();
    this.apiKey = process.env.ATTIO_API_KEY;
    this.isConfigured = !!this.apiKey;
  }

  // Helper to extract the current value from Attio's historical data structure
  private extractValue(record: AttioRecord, attributeName: string, defaultValue: any = null): any {
    const values = record.values[attributeName];
    if (!values || values.length === 0) return defaultValue;
    
    // Get the most recent active value
    const activeValue = values.find(v => v.active_until === null);
    if (!activeValue) return defaultValue;
    
    // Handle different attribute types
    switch (activeValue.attribute_type) {
      case 'personal-name':
        return activeValue.full_name;
      case 'email-address':
        return activeValue.email_address;
      case 'text':
        return activeValue.value;
      case 'number':
        return activeValue.value;
      case 'timestamp':
        return activeValue.value;
      case 'record-reference':
        return activeValue.target_record_id;
      default:
        return activeValue.value || activeValue;
    }
  }

  private async makeRequest<T>(endpoint: string, body?: any): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Attio API key not configured');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Attio API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async queryRecords(objectSlug: string, filters?: any): Promise<AttioRecord[]> {
    const allRecords: AttioRecord[] = [];
    let cursor: string | undefined;

    do {
      const body: any = {
        limit: 500,
        ...(filters && { filter: filters }),
        ...(cursor && { cursor })
      };

      const response = await this.makeRequest<AttioQueryResponse>(
        `/objects/${objectSlug}/records/query`,
        body
      );

      allRecords.push(...response.data);
      cursor = response.next_cursor;
    } while (cursor);

    return allRecords;
  }

  private async getCustomerData(): Promise<{ count: number; customers: AttioCustomer[] }> {
    try {
      const people = await this.queryRecords('people');
      
      const customers: AttioCustomer[] = people.map(person => ({
        id: person.id.record_id,
        name: this.extractValue(person, 'name') || 'Unknown',
        email: this.extractValue(person, 'email_addresses'),
        jobTitle: this.extractValue(person, 'job_title'),
        company: this.extractValue(person, 'company'), // Will be company ID, could resolve later
        createdAt: person.created_at
      }));
      
      return { count: people.length, customers };
    } catch (error) {
      console.warn('Failed to get customer data:', error);
      return { count: 0, customers: [] };
    }
  }

  private async getCompanyData(): Promise<{ count: number; companies: AttioCompany[] }> {
    try {
      const companies = await this.queryRecords('companies');
      
      const companyData: AttioCompany[] = companies.map(company => ({
        id: company.id.record_id,
        name: this.extractValue(company, 'name') || 'Unknown Company',
        domain: this.extractValue(company, 'domains'),
        description: this.extractValue(company, 'description'),
        employeeCount: this.extractValue(company, 'employee_count'),
        industry: this.extractValue(company, 'industry'),
        createdAt: company.created_at
      }));
      
      return { count: companies.length, companies: companyData };
    } catch (error) {
      console.warn('Failed to get company data:', error);
      return { count: 0, companies: [] };
    }
  }

  private async getDealMetrics(): Promise<{
    totalDeals: number;
    openDeals: number;
    closedDeals: number;
    wonDeals: number;
    lostDeals: number;
    totalDealValue: number;
    salesPipelineValue: number;
    deals: AttioDeal[];
  }> {
    try {
      const deals = await this.queryRecords('deals');
      
      let openDeals = 0;
      let closedDeals = 0;
      let wonDeals = 0;
      let lostDeals = 0;
      let totalDealValue = 0;
      let salesPipelineValue = 0;

      for (const deal of deals) {
        const status = deal.attributes?.status?.value?.toLowerCase() || '';
        const value = deal.attributes?.value?.value || deal.attributes?.amount?.value || 0;
        
        totalDealValue += value;

        if (status.includes('won') || status.includes('closed won')) {
          wonDeals++;
          closedDeals++;
        } else if (status.includes('lost') || status.includes('closed lost')) {
          lostDeals++;
          closedDeals++;
        } else {
          openDeals++;
          salesPipelineValue += value;
        }
      }

      return {
        totalDeals: deals.length,
        openDeals,
        closedDeals,
        wonDeals,
        lostDeals,
        totalDealValue,
        salesPipelineValue
      };
    } catch (error) {
      console.warn('Failed to get deal metrics:', error);
      return {
        totalDeals: 0,
        openDeals: 0,
        closedDeals: 0,
        wonDeals: 0,
        lostDeals: 0,
        totalDealValue: 0,
        salesPipelineValue: 0
      };
    }
  }

  private async getMonthlyNewCustomers(): Promise<number> {
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const people = await this.queryRecords('people');
      
      const newCustomers = people.filter(person => {
        const createdAt = new Date(person.created_at);
        return createdAt >= oneMonthAgo;
      });

      return newCustomers.length;
    } catch (error) {
      console.warn('Failed to get monthly new customers:', error);
      return 0;
    }
  }

  private async getCustomerGrowthRate(): Promise<number> {
    try {
      const now = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      const people = await this.queryRecords('people');

      const thisMonthCustomers = people.filter(person => {
        const createdAt = new Date(person.created_at);
        return createdAt >= oneMonthAgo && createdAt < now;
      }).length;

      const lastMonthCustomers = people.filter(person => {
        const createdAt = new Date(person.created_at);
        return createdAt >= twoMonthsAgo && createdAt < oneMonthAgo;
      }).length;

      if (lastMonthCustomers === 0) return 0;
      return ((thisMonthCustomers - lastMonthCustomers) / lastMonthCustomers) * 100;
    } catch (error) {
      console.warn('Failed to calculate customer growth rate:', error);
      return 0;
    }
  }

  async collect(): Promise<CollectorResult> {
    if (!this.isConfigured) {
      return {
        source: 'attio',
        data: {
          totalCustomers: 0,
          totalCompanies: 0,
          totalDeals: 0,
          openDeals: 0,
          closedDeals: 0,
          wonDeals: 0,
          lostDeals: 0,
          totalDealValue: 0,
          avgDealSize: 0,
          salesPipelineValue: 0,
          monthlyNewCustomers: 0,
          customerGrowthRate: 0
        },
        timestamp: new Date(),
        error: 'Attio API key not configured'
      };
    }

    try {
      const [
        totalCustomers,
        totalCompanies,
        dealMetrics,
        monthlyNewCustomers,
        customerGrowthRate
      ] = await Promise.all([
        this.retryOperation(() => this.getCustomerCount()),
        this.retryOperation(() => this.getCompanyCount()),
        this.retryOperation(() => this.getDealMetrics()),
        this.retryOperation(() => this.getMonthlyNewCustomers()),
        this.retryOperation(() => this.getCustomerGrowthRate())
      ]);

      const avgDealSize = dealMetrics.totalDeals > 0 
        ? dealMetrics.totalDealValue / dealMetrics.totalDeals 
        : 0;

      return {
        source: 'attio',
        data: {
          totalCustomers,
          totalCompanies,
          ...dealMetrics,
          avgDealSize,
          monthlyNewCustomers,
          customerGrowthRate
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        source: 'attio',
        data: {
          totalCustomers: 0,
          totalCompanies: 0,
          totalDeals: 0,
          openDeals: 0,
          closedDeals: 0,
          wonDeals: 0,
          lostDeals: 0,
          totalDealValue: 0,
          avgDealSize: 0,
          salesPipelineValue: 0,
          monthlyNewCustomers: 0,
          customerGrowthRate: 0
        },
        timestamp: new Date(),
        error: `Attio API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
