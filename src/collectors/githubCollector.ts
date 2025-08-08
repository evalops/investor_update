import axios from 'axios';

import type { CollectorResult } from './baseCollector';
import { BaseCollector } from './baseCollector';

export interface GitHubMetrics {
  // Repository metrics
  totalCommits: number;
  commitsLast30Days: number;
  averageCommitsPerDay: number;

  // Pull request metrics
  totalPullRequests: number;
  pullRequestsLast30Days: number;
  averagePRMergeTime: number; // hours

  // Developer productivity
  activeContributors: number;
  linesOfCodeAdded: number;
  linesOfCodeRemoved: number;

  // Release metrics
  totalReleases: number;
  releasesLast30Days: number;
  averageTimeBetweenReleases: number; // days

  // Issue tracking
  totalIssues: number;
  openIssues: number;
  closedIssuesLast30Days: number;
  averageIssueCloseTime: number; // hours

  // Engineering velocity score (1-10)
  engineeringVelocityScore: number;

  // Trend data for charts
  dailyCommits: { date: string; commits: number }[];
  weeklyPRs: { week: string; prs: number }[];
  monthlyReleases: { month: string; releases: number }[];
}

export class GitHubCollector extends BaseCollector {
  private token: string;
  private org: string;
  private repos: string[];

  constructor() {
    super();
    this.token = process.env.GITHUB_TOKEN || '';
    this.org = process.env.GITHUB_ORG || '';
    this.repos = process.env.GITHUB_REPOS?.split(',') || [];
  }

  async collect(): Promise<CollectorResult> {
    if (!this.token) {
      return {
        source: 'GitHub',
        data: {},
        timestamp: new Date(),
        error: 'GitHub token not configured'
      };
    }

    if (!this.org || this.repos.length === 0) {
      return {
        source: 'GitHub',
        data: {},
        timestamp: new Date(),
        error: 'GitHub organization or repositories not configured'
      };
    }

    try {
      const headers = {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json'
      };

      // Collect metrics from all repositories
      const repoMetrics = await Promise.all(
        this.repos.map(repo => this.collectRepoMetrics(this.org, repo, headers))
      );

      // Aggregate metrics across repositories
      const aggregated = this.aggregateMetrics(repoMetrics);

      return {
        source: 'GitHub',
        data: aggregated,
        timestamp: new Date()
      };

    } catch (error: any) {
      return {
        source: 'GitHub',
        data: {},
        timestamp: new Date(),
        error: `GitHub API error: ${error.message}`
      };
    }
  }

  private async collectRepoMetrics(org: string, repo: string, headers: Record<string, string>) {
    const baseUrl = `https://api.github.com/repos/${org}/${repo}`;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Collect commits
    const commitsResponse = await axios.get(`${baseUrl}/commits`, {
      headers,
      params: {
        since: thirtyDaysAgo.toISOString(),
        per_page: 100
      }
    });

    // Collect pull requests
    const prsResponse = await axios.get(`${baseUrl}/pulls`, {
      headers,
      params: {
        state: 'all',
        per_page: 100
      }
    });

    // Collect releases
    const releasesResponse = await axios.get(`${baseUrl}/releases`, {
      headers,
      params: { per_page: 50 }
    });

    // Collect issues
    const issuesResponse = await axios.get(`${baseUrl}/issues`, {
      headers,
      params: {
        state: 'all',
        per_page: 100
      }
    });

    // Get repository stats
    const statsResponse = await axios.get(`${baseUrl}/stats/contributors`, {
      headers
    });

    return {
      repo,
      commits: commitsResponse.data,
      pullRequests: prsResponse.data,
      releases: releasesResponse.data,
      issues: issuesResponse.data,
      stats: statsResponse.data || []
    };
  }

  private aggregateMetrics(repoMetrics: any[]): GitHubMetrics {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let totalCommits = 0;
    let commitsLast30Days = 0;
    let totalPullRequests = 0;
    let pullRequestsLast30Days = 0;
    let totalReleases = 0;
    let releasesLast30Days = 0;
    let totalIssues = 0;
    let openIssues = 0;
    let closedIssuesLast30Days = 0;
    const activeContributors = new Set();
    let linesOfCodeAdded = 0;
    let linesOfCodeRemoved = 0;

    const dailyCommits: { [date: string]: number } = {};
    const weeklyPRs: { [week: string]: number } = {};
    const monthlyReleases: { [month: string]: number } = {};

    repoMetrics.forEach(repo => {
      // Aggregate commits
      repo.commits.forEach((commit: any) => {
        totalCommits++;
        const commitDate = new Date(commit.commit.author.date);
        if (commitDate >= thirtyDaysAgo) {
          commitsLast30Days++;
        }

        // Daily commit tracking
        const dateKey = commitDate.toISOString().split('T')[0];
        dailyCommits[dateKey] = (dailyCommits[dateKey] || 0) + 1;

        // Track contributors
        if (commit.author) {
          activeContributors.add(commit.author.login);
        }
      });

      // Aggregate pull requests
      repo.pullRequests.forEach((pr: any) => {
        totalPullRequests++;
        const prDate = new Date(pr.created_at);
        if (prDate >= thirtyDaysAgo) {
          pullRequestsLast30Days++;
        }

        // Weekly PR tracking
        const weekKey = this.getWeekKey(prDate);
        weeklyPRs[weekKey] = (weeklyPRs[weekKey] || 0) + 1;
      });

      // Aggregate releases
      repo.releases.forEach((release: any) => {
        totalReleases++;
        const releaseDate = new Date(release.created_at);
        if (releaseDate >= thirtyDaysAgo) {
          releasesLast30Days++;
        }

        // Monthly release tracking
        const monthKey = releaseDate.toISOString().slice(0, 7); // YYYY-MM
        monthlyReleases[monthKey] = (monthlyReleases[monthKey] || 0) + 1;
      });

      // Aggregate issues
      repo.issues.forEach((issue: any) => {
        if (!issue.pull_request) { // Exclude PRs from issue count
          totalIssues++;
          if (issue.state === 'open') {
            openIssues++;
          } else {
            const closedDate = new Date(issue.closed_at);
            if (closedDate >= thirtyDaysAgo) {
              closedIssuesLast30Days++;
            }
          }
        }
      });

      // Aggregate code changes
      if (repo.stats && Array.isArray(repo.stats)) {
        repo.stats.forEach((contributor: any) => {
          if (contributor && contributor.weeks) {
            contributor.weeks.forEach((week: any) => {
              linesOfCodeAdded += week.a || 0;
              linesOfCodeRemoved += week.d || 0;
            });
          }
        });
      }
    });

    // Calculate derived metrics
    const averageCommitsPerDay = commitsLast30Days / 30;
    const averagePRMergeTime = this.calculateAveragePRMergeTime(repoMetrics);
    const averageTimeBetweenReleases = this.calculateAverageTimeBetweenReleases(repoMetrics);
    const averageIssueCloseTime = this.calculateAverageIssueCloseTime(repoMetrics);
    const engineeringVelocityScore = this.calculateEngineeringVelocityScore({
      commitsLast30Days,
      pullRequestsLast30Days,
      releasesLast30Days,
      closedIssuesLast30Days,
      activeContributors: activeContributors.size
    });

    return {
      totalCommits,
      commitsLast30Days,
      averageCommitsPerDay,
      totalPullRequests,
      pullRequestsLast30Days,
      averagePRMergeTime,
      activeContributors: activeContributors.size,
      linesOfCodeAdded,
      linesOfCodeRemoved,
      totalReleases,
      releasesLast30Days,
      averageTimeBetweenReleases,
      totalIssues,
      openIssues,
      closedIssuesLast30Days,
      averageIssueCloseTime,
      engineeringVelocityScore,
      dailyCommits: this.formatDailyCommits(dailyCommits),
      weeklyPRs: this.formatWeeklyPRs(weeklyPRs),
      monthlyReleases: this.formatMonthlyReleases(monthlyReleases)
    };
  }

  private calculateAveragePRMergeTime(repoMetrics: any[]): number {
    let totalMergeTime = 0;
    let mergedPRs = 0;

    repoMetrics.forEach(repo => {
      repo.pullRequests.forEach((pr: any) => {
        if (pr.merged_at && pr.created_at) {
          const created = new Date(pr.created_at);
          const merged = new Date(pr.merged_at);
          const mergeTime = (merged.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
          totalMergeTime += mergeTime;
          mergedPRs++;
        }
      });
    });

    return mergedPRs > 0 ? totalMergeTime / mergedPRs : 0;
  }

  private calculateAverageTimeBetweenReleases(repoMetrics: any[]): number {
    const allReleases: Date[] = [];

    repoMetrics.forEach(repo => {
      repo.releases.forEach((release: any) => {
        allReleases.push(new Date(release.created_at));
      });
    });

    if (allReleases.length < 2) {return 0;}

    allReleases.sort((a, b) => a.getTime() - b.getTime());

    let totalDays = 0;
    for (let i = 1; i < allReleases.length; i++) {
      const daysDiff = (allReleases[i].getTime() - allReleases[i-1].getTime()) / (1000 * 60 * 60 * 24);
      totalDays += daysDiff;
    }

    return totalDays / (allReleases.length - 1);
  }

  private calculateAverageIssueCloseTime(repoMetrics: any[]): number {
    let totalCloseTime = 0;
    let closedIssues = 0;

    repoMetrics.forEach(repo => {
      repo.issues.forEach((issue: any) => {
        if (!issue.pull_request && issue.closed_at && issue.created_at) {
          const created = new Date(issue.created_at);
          const closed = new Date(issue.closed_at);
          const closeTime = (closed.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
          totalCloseTime += closeTime;
          closedIssues++;
        }
      });
    });

    return closedIssues > 0 ? totalCloseTime / closedIssues : 0;
  }

  private calculateEngineeringVelocityScore(metrics: {
    commitsLast30Days: number;
    pullRequestsLast30Days: number;
    releasesLast30Days: number;
    closedIssuesLast30Days: number;
    activeContributors: number;
  }): number {
    // Engineering velocity scoring (1-10 scale)
    let score = 1;

    // Commits score (30% weight)
    if (metrics.commitsLast30Days >= 100) {score += 3;}
    else if (metrics.commitsLast30Days >= 50) {score += 2;}
    else if (metrics.commitsLast30Days >= 20) {score += 1;}

    // Pull requests score (25% weight)
    if (metrics.pullRequestsLast30Days >= 20) {score += 2.5;}
    else if (metrics.pullRequestsLast30Days >= 10) {score += 1.5;}
    else if (metrics.pullRequestsLast30Days >= 5) {score += 0.5;}

    // Releases score (20% weight)
    if (metrics.releasesLast30Days >= 4) {score += 2;}
    else if (metrics.releasesLast30Days >= 2) {score += 1.5;}
    else if (metrics.releasesLast30Days >= 1) {score += 1;}

    // Issue resolution score (15% weight)
    if (metrics.closedIssuesLast30Days >= 20) {score += 1.5;}
    else if (metrics.closedIssuesLast30Days >= 10) {score += 1;}
    else if (metrics.closedIssuesLast30Days >= 5) {score += 0.5;}

    // Team activity score (10% weight)
    if (metrics.activeContributors >= 5) {score += 1;}
    else if (metrics.activeContributors >= 3) {score += 0.5;}

    return Math.min(score, 10);
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  private formatDailyCommits(dailyCommits: { [date: string]: number }): { date: string; commits: number }[] {
    return Object.entries(dailyCommits)
      .map(([date, commits]) => ({ date, commits }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private formatWeeklyPRs(weeklyPRs: { [week: string]: number }): { week: string; prs: number }[] {
    return Object.entries(weeklyPRs)
      .map(([week, prs]) => ({ week, prs }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }

  private formatMonthlyReleases(monthlyReleases: { [month: string]: number }): { month: string; releases: number }[] {
    return Object.entries(monthlyReleases)
      .map(([month, releases]) => ({ month, releases }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}
