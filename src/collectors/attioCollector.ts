import { BaseCollector, CollectorResult } from './baseCollector';

export interface AttioContact {
  id: string;
  name: string;
  email?: string;
  company?: string;
  jobTitle?: string;
  createdAt: string;
  lastInteraction?: string;
  interactionType?: string;
  connectionStrength?: string;
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
  // Deal-based true customers
  totalCustomers: number; // Only closed won deals
  totalRevenue: number;
  
  // Early-stage prospect metrics  
  totalContacts: number;
  totalCompanies: number;
  activeConversations: number;
  recentConversations: number;
  strongConnections: number;
  
  // Deal pipeline
  totalDeals: number;
  openDeals: number;
  closedDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalDealValue: number;
  avgDealSize: number;
  salesPipelineValue: number;
  
  // Growth metrics
  monthlyNewContacts: number;
  contactGrowthRate: number;
  
  // Detailed data
  contacts: AttioContact[];
  companies: AttioCompany[];
  deals: AttioDeal[];
  topCompanies: { name: string; employeeCount?: number }[];
  recentContacts: AttioContact[];
  activeContactsDetails: AttioContact[];
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
      case 'domain':
        return activeValue.domain || activeValue.domain_name;
      case 'website':
        return activeValue.url;
      case 'text':
        return activeValue.value;
      case 'number':
        return activeValue.value;
      case 'currency':
        return activeValue.currency_value;
      case 'timestamp':
        return activeValue.value;
      case 'date':
        return activeValue.value;
      case 'select':
        return activeValue.option?.title;
      case 'location':
        return `${activeValue.locality || ''}, ${activeValue.region || ''}, ${activeValue.country_code || ''}`.replace(/^,\s*|,\s*$/g, '');
      case 'record-reference':
        return activeValue.target_record_id;
      case 'interaction':
        return activeValue.interacted_at;
      case 'actor-reference':
        return activeValue.referenced_actor_id;
      default:
        return activeValue.value || defaultValue;
    }
  }

  // Helper to parse employee range strings to numbers
  private parseEmployeeRange(range: string | null): number | undefined {
    if (!range) return undefined;
    
    // Parse ranges like "251-1K", "1-10", "11-50", etc.
    const match = range.match(/^(\d+)[\s-]*(?:to|-)?\s*(\d+|[KM]?)$/i);
    if (!match) return undefined;
    
    let start = parseInt(match[1]);
    let endStr = match[2];
    
    if (endStr.toUpperCase().includes('K')) {
      // Handle "1K" format
      const num = endStr.replace(/K/i, '');
      const end = num ? parseInt(num) * 1000 : 1000;
      return Math.floor((start + end) / 2); // Return midpoint
    } else if (endStr.toUpperCase().includes('M')) {
      // Handle "1M" format  
      const num = endStr.replace(/M/i, '');
      const end = num ? parseInt(num) * 1000000 : 1000000;
      return Math.floor((start + end) / 2);
    } else if (endStr) {
      // Handle normal range like "1-10"
      const end = parseInt(endStr);
      return Math.floor((start + end) / 2);
    }
    
    return start;
  }

  // Helper to log available attributes for debugging
  private logAvailableAttributes(record: AttioRecord, objectType: string) {
    console.log(`Available ${objectType} attributes:`, Object.keys(record.values));
    Object.keys(record.values).forEach(key => {
      const value = record.values[key];
      if (value && value.length > 0) {
        console.log(`  ${key}:`, value[0].attribute_type, value[0]);
      }
    });
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

  private async getContactData(): Promise<{ count: number; contacts: AttioContact[] }> {
    try {
      const people = await this.queryRecords('people');
      
      const contacts: AttioContact[] = people.map(person => ({
        id: person.id.record_id,
        name: this.extractValue(person, 'name') || 'Unknown',
        email: this.extractValue(person, 'email_addresses'),
        jobTitle: this.extractValue(person, 'job_title'),
        company: this.extractValue(person, 'company'), // Company ID reference
        createdAt: person.created_at,
        lastInteraction: this.extractValue(person, 'last_interaction'),
        interactionType: this.extractValue(person, 'last_email_interaction') ? 'email' : 
                        this.extractValue(person, 'last_calendar_interaction') ? 'calendar' : undefined,
        connectionStrength: this.extractValue(person, 'strongest_connection_strength')
      }));
      
      return { count: people.length, contacts };
    } catch (error) {
      console.warn('Failed to get contact data:', error);
      return { count: 0, contacts: [] };
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
        employeeCount: this.parseEmployeeRange(this.extractValue(company, 'employee_range')),
        industry: this.extractValue(company, 'categories'),
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
      const dealsRecords = await this.queryRecords('deals');
      
      let openDeals = 0;
      let closedDeals = 0;
      let wonDeals = 0;
      let lostDeals = 0;
      let totalDealValue = 0;
      let salesPipelineValue = 0;
      
      const deals: AttioDeal[] = dealsRecords.map(deal => {
        const status = this.extractValue(deal, 'status') || 'open';
        const value = this.extractValue(deal, 'value') || this.extractValue(deal, 'amount') || 0;
        const name = this.extractValue(deal, 'name') || 'Unnamed Deal';
        
        return {
          id: deal.id.record_id,
          name,
          value,
          status,
          createdAt: deal.created_at,
          closedAt: this.extractValue(deal, 'closed_at')
        };
      });

      for (const deal of deals) {
        const status = deal.status.toLowerCase();
        totalDealValue += deal.value;

        if (status.includes('won') || status.includes('closed won')) {
          wonDeals++;
          closedDeals++;
        } else if (status.includes('lost') || status.includes('closed lost')) {
          lostDeals++;
          closedDeals++;
        } else {
          openDeals++;
          salesPipelineValue += deal.value;
        }
      }

      return {
        totalDeals: dealsRecords.length,
        openDeals,
        closedDeals,
        wonDeals,
        lostDeals,
        totalDealValue,
        salesPipelineValue,
        deals
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
        salesPipelineValue: 0,
        deals: []
      };
    }
  }

  private async getMonthlyNewContacts(): Promise<number> {
    try {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const people = await this.queryRecords('people');
      
      const newContacts = people.filter(person => {
        const createdAt = new Date(person.created_at);
        return createdAt >= oneMonthAgo;
      });

      return newContacts.length;
    } catch (error) {
      console.warn('Failed to get monthly new contacts:', error);
      return 0;
    }
  }

  private async getContactGrowthRate(): Promise<number> {
    try {
      const now = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      const people = await this.queryRecords('people');

      const thisMonthContacts = people.filter(person => {
        const createdAt = new Date(person.created_at);
        return createdAt >= oneMonthAgo && createdAt < now;
      }).length;

      const lastMonthContacts = people.filter(person => {
        const createdAt = new Date(person.created_at);
        return createdAt >= twoMonthsAgo && createdAt < oneMonthAgo;
      }).length;

      if (lastMonthContacts === 0) return 0;
      return ((thisMonthContacts - lastMonthContacts) / lastMonthContacts) * 100;
    } catch (error) {
      console.warn('Failed to calculate contact growth rate:', error);
      return 0;
    }
  }

  // Helper to analyze conversation activity
  private analyzeConversations(contacts: AttioContact[]): { 
    activeConversations: number; 
    recentConversations: number; 
    strongConnections: number;
    activeContacts: AttioContact[];
  } {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let activeConversations = 0;
    let recentConversations = 0;
    let strongConnections = 0;
    const activeContacts: AttioContact[] = [];

    contacts.forEach(contact => {
      // Check for recent interactions
      if (contact.lastInteraction) {
        const interactionDate = new Date(contact.lastInteraction);
        if (interactionDate >= sevenDaysAgo) {
          recentConversations++;
          activeContacts.push(contact);
        }
      }

      // Check for any interaction at all
      if (contact.lastInteraction) {
        activeConversations++;
      }

      // Check for strong connections
      if (contact.connectionStrength && 
          ['Strong', 'Very Strong', 'Good'].includes(contact.connectionStrength)) {
        strongConnections++;
      }
    });

    return {
      activeConversations,
      recentConversations,
      strongConnections,
      activeContacts
    };
  }

  async collect(): Promise<CollectorResult> {
    if (!this.isConfigured) {
      return {
        source: 'attio',
        data: {
          totalCustomers: 0,
          totalRevenue: 0,
          totalContacts: 0,
          totalCompanies: 0,
          activeConversations: 0,
          recentConversations: 0,
          strongConnections: 0,
          totalDeals: 0,
          openDeals: 0,
          closedDeals: 0,
          wonDeals: 0,
          lostDeals: 0,
          totalDealValue: 0,
          avgDealSize: 0,
          salesPipelineValue: 0,
          monthlyNewContacts: 0,
          contactGrowthRate: 0,
          contacts: [],
          companies: [],
          deals: [],
          topCompanies: [],
          recentContacts: [],
          activeContactsDetails: []
        },
        timestamp: new Date(),
        error: 'Attio API key not configured'
      };
    }

    try {
      const [
        contactData,
        companyData,
        dealMetrics,
        monthlyNewContacts,
        contactGrowthRate
      ] = await Promise.all([
        this.retryOperation(() => this.getContactData()),
        this.retryOperation(() => this.getCompanyData()),
        this.retryOperation(() => this.getDealMetrics()),
        this.retryOperation(() => this.getMonthlyNewContacts()),
        this.retryOperation(() => this.getContactGrowthRate())
      ]);

      const avgDealSize = dealMetrics.totalDeals > 0 
        ? dealMetrics.totalDealValue / dealMetrics.totalDeals 
        : 0;

      // Analyze conversations and connections
      const conversationAnalysis = this.analyzeConversations(contactData.contacts);

      // Get recent contacts (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentContacts = contactData.contacts.filter(contact => 
        new Date(contact.createdAt) >= thirtyDaysAgo
      );

      // Get top companies by employee count
      const topCompanies = companyData.companies
        .filter(company => company.employeeCount)
        .sort((a, b) => (b.employeeCount || 0) - (a.employeeCount || 0))
        .slice(0, 5)
        .map(company => ({ name: company.name, employeeCount: company.employeeCount }));

      // Calculate true customers (only from closed won deals)
      const trueCustomers = dealMetrics.wonDeals;
      const totalRevenue = dealMetrics.deals
        .filter(deal => deal.status.toLowerCase().includes('won'))
        .reduce((sum, deal) => sum + deal.value, 0);

      return {
        source: 'attio',
        data: {
          // True customers (closed won deals)
          totalCustomers: trueCustomers,
          totalRevenue,
          
          // Early-stage prospect metrics
          totalContacts: contactData.count,
          totalCompanies: companyData.count,
          activeConversations: conversationAnalysis.activeConversations,
          recentConversations: conversationAnalysis.recentConversations,
          strongConnections: conversationAnalysis.strongConnections,
          
          // Deal pipeline
          ...dealMetrics,
          avgDealSize,
          
          // Growth metrics
          monthlyNewContacts,
          contactGrowthRate,
          
          // Detailed data
          contacts: contactData.contacts,
          companies: companyData.companies,
          deals: dealMetrics.deals,
          topCompanies,
          recentContacts,
          activeContactsDetails: conversationAnalysis.activeContacts
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        source: 'attio',
        data: {
          totalCustomers: 0,
          totalRevenue: 0,
          totalContacts: 0,
          totalCompanies: 0,
          activeConversations: 0,
          recentConversations: 0,
          strongConnections: 0,
          totalDeals: 0,
          openDeals: 0,
          closedDeals: 0,
          wonDeals: 0,
          lostDeals: 0,
          totalDealValue: 0,
          avgDealSize: 0,
          salesPipelineValue: 0,
          monthlyNewContacts: 0,
          contactGrowthRate: 0,
          contacts: [],
          companies: [],
          deals: [],
          topCompanies: [],
          recentContacts: [],
          activeContactsDetails: []
        },
        timestamp: new Date(),
        error: `Attio API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
