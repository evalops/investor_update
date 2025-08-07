import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';
import { StartupMetrics, EvalOpsMetrics } from './metricsCalculator';
import { getTheme, ChartTheme } from '../config/chartThemes';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ChartGenerator {
  private chartJSNodeCanvas: ChartJSNodeCanvas;
  private theme: ChartTheme;

  constructor(themeName: string = 'professional') {
    this.theme = getTheme(themeName);
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: 900,
      height: 500,
      backgroundColour: this.theme.colors.background,
      chartCallback: (ChartJS) => {
        ChartJS.defaults.font.family = this.theme.fonts.ticks.family;
        ChartJS.defaults.color = this.theme.colors.text;
        ChartJS.defaults.borderColor = this.theme.colors.grid;
        ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
        ChartJS.defaults.plugins.legend.labels.padding = 20;
      }
    });
  }

  private getBaseChartOptions() {
    return {
      responsive: false,
      plugins: {
        legend: {
          labels: {
            font: {
              family: this.theme.fonts.legend.family,
              size: this.theme.fonts.legend.size,
            },
            color: this.theme.colors.text,
            padding: 20,
            usePointStyle: true,
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: this.theme.colors.grid,
            lineWidth: 1,
          },
          ticks: {
            font: {
              family: this.theme.fonts.ticks.family,
              size: this.theme.fonts.ticks.size,
            },
            color: this.theme.colors.text,
          }
        },
        y: {
          grid: {
            color: this.theme.colors.grid,
            lineWidth: 1,
          },
          ticks: {
            font: {
              family: this.theme.fonts.ticks.family,
              size: this.theme.fonts.ticks.size,
            },
            color: this.theme.colors.text,
          }
        }
      }
    };
  }

  async generateAllCharts(metrics: StartupMetrics | EvalOpsMetrics, outputDir: string): Promise<string[]> {
    await fs.mkdir(outputDir, { recursive: true });

    // Generate all charts in parallel for better performance
    const chartGenerators = [
      { name: 'revenue-expenses.png', generator: () => this.generateRevenueExpensesChart(metrics) },
      { name: 'burn-rate.png', generator: () => this.generateBurnRateChart(metrics) },
      { name: 'runway.png', generator: () => this.generateRunwayChart(metrics) },
      { name: 'expense-categories.png', generator: () => this.generateExpenseCategoriesChart(metrics) },
      { name: 'cash-flow.png', generator: () => this.generateCashFlowChart(metrics) },
      { name: 'growth-rate.png', generator: () => this.generateGrowthRateChart(metrics) },
      { name: 'mrr-components.png', generator: () => this.generateMRRComponentsChart(metrics) },
      { name: 'breakeven.png', generator: () => this.generateBreakevenChart(metrics) },
      { name: 'expense-trends.png', generator: () => this.generateExpenseTrendsChart(metrics) },
      { name: 'runway-scenarios.png', generator: () => this.generateRunwayScenariosChart(metrics) }
    ];

    const chartResults = await Promise.all(
      chartGenerators.map(async ({ name, generator }) => {
        try {
          const chartBuffer = await generator();
          const chartPath = path.join(outputDir, name);
          await fs.writeFile(chartPath, chartBuffer);
          return chartPath;
        } catch (error) {
          logger.error(`Failed to generate chart ${name}`, { chartName: name, error });
          return null;
        }
      })
    );

    return chartResults.filter((path): path is string => path !== null);
  }

  async generateRevenueExpensesChart(metrics: StartupMetrics): Promise<Buffer> {
    const labels = metrics.monthlyMetrics.map(m => m.month);
    const revenueData = metrics.monthlyMetrics.map(m => m.revenue);
    const expensesData = metrics.monthlyMetrics.map(m => m.expenses);

    const configuration: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '💰 Revenue',
            data: revenueData,
            backgroundColor: this.theme.colors.revenue + '80',
            borderColor: this.theme.colors.revenue,
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
          },
          {
            label: '💸 Expenses',
            data: expensesData,
            backgroundColor: this.theme.colors.expenses + '80',
            borderColor: this.theme.colors.expenses,
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
          }
        ]
      },
      options: {
        ...this.getBaseChartOptions(),
        plugins: {
          ...this.getBaseChartOptions().plugins,
          title: {
            display: true,
            text: 'Revenue vs Expenses',
            font: {
              family: this.theme.fonts.title.family,
              size: this.theme.fonts.title.size,
              weight: this.theme.fonts.title.weight,
            },
            color: this.theme.colors.text,
            padding: 30,
          },
          legend: {
            ...this.getBaseChartOptions().plugins.legend,
            position: 'top' as const,
            align: 'center' as const,
          }
        },
        scales: {
          ...this.getBaseChartOptions().scales,
          y: {
            ...this.getBaseChartOptions().scales.y,
            beginAtZero: true,
            ticks: {
              ...this.getBaseChartOptions().scales.y.ticks,
              callback: function(value) {
                return '$' + (Number(value) / 1000).toFixed(0) + 'K';
              }
            }
          }
        }
      }
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration);
  }

  async generateBurnRateChart(metrics: StartupMetrics): Promise<Buffer> {
    const labels = metrics.monthlyMetrics.map(m => m.month);
    const burnData = metrics.monthlyMetrics.map(m => m.netBurn);

    const configuration: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Net Burn Rate',
            data: burnData,
            backgroundColor: 'rgba(251, 146, 60, 0.2)',
            borderColor: 'rgb(251, 146, 60)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Monthly Burn Rate Trend',
            font: { size: 16 }
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + (Number(value) / 1000).toFixed(0) + 'K';
              }
            }
          }
        }
      }
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration);
  }

  async generateRunwayChart(metrics: StartupMetrics): Promise<Buffer> {
    const projectedMonths = 12;
    const labels: string[] = ['Current'];
    const balanceData: number[] = [metrics.currentBalance];

    let projectedBalance = metrics.currentBalance;
    for (let i = 1; i <= projectedMonths; i++) {
      labels.push(`Month ${i}`);
      projectedBalance -= metrics.averageMonthlyBurn;
      balanceData.push(Math.max(0, projectedBalance));
    }

    const configuration: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Projected Cash Balance',
            data: balanceData,
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            borderColor: 'rgb(99, 102, 241)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: `Cash Runway Projection (${metrics.runwayMonths === Infinity ? 'Unlimited' : metrics.runwayMonths + ' months'})`,
            font: { size: 16 }
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + (Number(value) / 1000).toFixed(0) + 'K';
              }
            }
          }
        }
      }
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration);
  }

  async generateExpenseCategoriesChart(metrics: StartupMetrics): Promise<Buffer> {
    const lastMonth = metrics.monthlyMetrics[metrics.monthlyMetrics.length - 1];
    if (!lastMonth || !lastMonth.topExpenseCategories || lastMonth.topExpenseCategories.length === 0) {
      return Buffer.from('');
    }

    const labels = lastMonth.topExpenseCategories.map(c => c.category);
    const data = lastMonth.topExpenseCategories.map(c => c.amount);

    const configuration: ChartConfiguration = {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: [
              'rgba(239, 68, 68, 0.8)',
              'rgba(251, 146, 60, 0.8)',
              'rgba(251, 191, 36, 0.8)',
              'rgba(34, 197, 94, 0.8)',
              'rgba(99, 102, 241, 0.8)',
              'rgba(168, 85, 247, 0.8)'
            ],
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Expense Categories (Last Month)',
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'right'
          }
        }
      }
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration);
  }

  async generateCashFlowChart(metrics: StartupMetrics): Promise<Buffer> {
    const labels = metrics.monthlyMetrics.map(m => m.month);
    const cashFlowData = metrics.monthlyMetrics.map(m => m.revenue - m.expenses);
    const cumulativeCashFlow: number[] = [];

    let cumulative = 0;
    for (const cf of cashFlowData) {
      cumulative += cf;
      cumulativeCashFlow.push(cumulative);
    }

    const configuration: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Monthly Cash Flow',
            data: cashFlowData,
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 2,
            yAxisID: 'y',
            type: 'bar'
          },
          {
            label: 'Cumulative Cash Flow',
            data: cumulativeCashFlow,
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            borderColor: 'rgb(99, 102, 241)',
            borderWidth: 2,
            yAxisID: 'y1',
            type: 'line',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Cash Flow Analysis',
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            ticks: {
              callback: function(value) {
                return '$' + (Number(value) / 1000).toFixed(0) + 'K';
              }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: {
              drawOnChartArea: false
            },
            ticks: {
              callback: function(value) {
                return '$' + (Number(value) / 1000).toFixed(0) + 'K';
              }
            }
          }
        }
      }
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration);
  }

  async generateGrowthRateChart(metrics: StartupMetrics): Promise<Buffer> {
    const labels = metrics.monthlyMetrics.slice(1).map(m => m.month);
    const growthRates: number[] = [];

    for (let i = 1; i < metrics.monthlyMetrics.length; i++) {
      const previousRevenue = metrics.monthlyMetrics[i - 1].revenue;
      const currentRevenue = metrics.monthlyMetrics[i].revenue;

      if (previousRevenue === 0) {
        growthRates.push(currentRevenue > 0 ? 100 : 0);
      } else {
        growthRates.push(((currentRevenue - previousRevenue) / previousRevenue) * 100);
      }
    }

    const configuration: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Month-over-Month Growth Rate (%)',
            data: growthRates,
            backgroundColor: 'rgba(168, 85, 247, 0.2)',
            borderColor: 'rgb(168, 85, 247)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Revenue Growth Rate',
            font: { size: 16 }
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            ticks: {
              callback: function(value) {
                return Number(value).toFixed(0) + '%';
              }
            }
          }
        }
      }
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration);
  }

  async generateMRRComponentsChart(metrics: StartupMetrics): Promise<Buffer> {
    const labels = metrics.monthlyMetrics.map(m => m.month);

    // Simplified MRR component estimation from revenue data
    const newMRR = metrics.monthlyMetrics.map((m, i) => {
      if (i === 0) return m.revenue;
      const growth = m.revenue - metrics.monthlyMetrics[i - 1].revenue;
      return Math.max(0, growth);
    });

    const existingMRR = metrics.monthlyMetrics.map((m, i) => {
      if (i === 0) return 0;
      return Math.min(m.revenue, metrics.monthlyMetrics[i - 1].revenue);
    });

    const configuration: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '📈 Existing MRR',
            data: existingMRR,
            backgroundColor: this.theme.colors.positive + '80',
            borderColor: this.theme.colors.positive,
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
          },
          {
            label: '🚀 New MRR',
            data: newMRR,
            backgroundColor: this.theme.colors.primary[0] + '80',
            borderColor: this.theme.colors.primary[0],
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false,
          }
        ]
      },
      options: {
        ...this.getBaseChartOptions(),
        plugins: {
          ...this.getBaseChartOptions().plugins,
          title: {
            display: true,
            text: 'MRR Components Analysis',
            font: {
              family: this.theme.fonts.title.family,
              size: this.theme.fonts.title.size,
              weight: this.theme.fonts.title.weight,
            },
            color: this.theme.colors.text,
            padding: 30,
          },
          legend: {
            ...this.getBaseChartOptions().plugins.legend,
            position: 'top' as const,
            align: 'center' as const,
          }
        },
        scales: {
          ...this.getBaseChartOptions().scales,
          x: {
            ...this.getBaseChartOptions().scales.x,
            stacked: true
          },
          y: {
            ...this.getBaseChartOptions().scales.y,
            stacked: true,
            beginAtZero: true,
            ticks: {
              ...this.getBaseChartOptions().scales.y.ticks,
              callback: function(value) {
                return '$' + (Number(value) / 1000).toFixed(0) + 'K';
              }
            }
          }
        }
      }
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration);
  }

  async generateBreakevenChart(metrics: StartupMetrics): Promise<Buffer> {
    const labels = metrics.monthlyMetrics.map(m => m.month);
    const revenueData = metrics.monthlyMetrics.map(m => m.revenue);
    const burnData = metrics.monthlyMetrics.map(m => m.netBurn);

    const configuration: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Monthly Revenue',
            data: revenueData,
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 2,
            fill: false,
            tension: 0.4
          },
          {
            label: 'Net Burn',
            data: burnData,
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 2,
            fill: false,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Revenue vs Burn - Break-even Analysis',
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + (Number(value) / 1000).toFixed(0) + 'K';
              }
            }
          }
        }
      }
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration);
  }

  async generateExpenseTrendsChart(metrics: StartupMetrics): Promise<Buffer> {
    const labels = metrics.monthlyMetrics.map(m => m.month);

    // Aggregate expense categories across all months
    const categoryTotals = new Map<string, number[]>();

    metrics.monthlyMetrics.forEach((month, monthIndex) => {
      const monthCategories = new Map<string, number>();

      // Initialize all categories to 0 for this month
      month.topExpenseCategories.forEach(cat => {
        monthCategories.set(cat.category, cat.amount);
      });

      // Add to running totals
      monthCategories.forEach((amount, category) => {
        if (!categoryTotals.has(category)) {
          categoryTotals.set(category, new Array(metrics.monthlyMetrics.length).fill(0));
        }
        categoryTotals.get(category)![monthIndex] = amount;
      });
    });

    const datasets = Array.from(categoryTotals.entries()).map(([category, amounts], index) => ({
      label: category,
      data: amounts,
      backgroundColor: [
        'rgba(239, 68, 68, 0.6)',
        'rgba(251, 146, 60, 0.6)',
        'rgba(251, 191, 36, 0.6)',
        'rgba(34, 197, 94, 0.6)',
        'rgba(99, 102, 241, 0.6)',
        'rgba(168, 85, 247, 0.6)'
      ][index % 6],
      borderWidth: 1
    }));

    const configuration: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: false,
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + (Number(value) / 1000).toFixed(0) + 'K';
              }
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Expense Category Trends',
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'top'
          }
        }
      }
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration);
  }

  async generateRunwayScenariosChart(metrics: StartupMetrics): Promise<Buffer> {
    const projectedMonths = 12;
    const labels: string[] = ['Current'];

    for (let i = 1; i <= projectedMonths; i++) {
      labels.push(`Month ${i}`);
    }

    // Base scenario
    const baseData: number[] = [metrics.currentBalance];
    let baseBalance = metrics.currentBalance;
    for (let i = 1; i <= projectedMonths; i++) {
      baseBalance -= metrics.averageMonthlyBurn;
      baseData.push(Math.max(0, baseBalance));
    }

    // Conservative scenario (+20% burn)
    const conservativeData: number[] = [metrics.currentBalance];
    let conservativeBalance = metrics.currentBalance;
    const conservativeBurn = metrics.averageMonthlyBurn * 1.2;
    for (let i = 1; i <= projectedMonths; i++) {
      conservativeBalance -= conservativeBurn;
      conservativeData.push(Math.max(0, conservativeBalance));
    }

    // Aggressive scenario (-20% burn)
    const aggressiveData: number[] = [metrics.currentBalance];
    let aggressiveBalance = metrics.currentBalance;
    const aggressiveBurn = metrics.averageMonthlyBurn * 0.8;
    for (let i = 1; i <= projectedMonths; i++) {
      aggressiveBalance -= aggressiveBurn;
      aggressiveData.push(Math.max(0, aggressiveBalance));
    }

    const configuration: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Conservative (+20% burn)',
            data: conservativeData,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 2,
            fill: false,
            tension: 0.4
          },
          {
            label: 'Base Case',
            data: baseData,
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            borderColor: 'rgb(99, 102, 241)',
            borderWidth: 3,
            fill: false,
            tension: 0.4
          },
          {
            label: 'Optimistic (-20% burn)',
            data: aggressiveData,
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 2,
            fill: false,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Runway Scenarios',
            font: { size: 16 }
          },
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + (Number(value) / 1000).toFixed(0) + 'K';
              }
            }
          }
        }
      }
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration);
  }

  async generateCustomChart(
    data: { labels: string[]; datasets: any[] },
    options: any,
    type: 'bar' | 'line' | 'pie' | 'doughnut' = 'line'
  ): Promise<Buffer> {
    const configuration: ChartConfiguration = {
      type,
      data,
      options: {
        responsive: false,
        ...options
      }
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration);
  }
}