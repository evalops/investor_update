import type { InvestorUpdate } from '../services/updateGenerator';

export function generateProfessionalHTML(update: InvestorUpdate, chartBasePath?: string): string {
  const chartsSection = chartBasePath ? `
  <section class="charts-section">
    <h2 class="section-title">Financial Analytics</h2>
    <div class="charts-grid">
      <div class="chart-container">
        <h3 class="chart-title">Revenue vs Expenses</h3>
        <img src="${chartBasePath}/revenue-expenses.png" alt="Revenue vs Expenses" class="chart-image">
      </div>
      <div class="chart-container">
        <h3 class="chart-title">MRR Components</h3>
        <img src="${chartBasePath}/mrr-components.png" alt="MRR Components" class="chart-image">
      </div>
      <div class="chart-container">
        <h3 class="chart-title">Break-even Analysis</h3>
        <img src="${chartBasePath}/breakeven.png" alt="Break-even Analysis" class="chart-image">
      </div>
      <div class="chart-container">
        <h3 class="chart-title">Burn Rate Analysis</h3>
        <img src="${chartBasePath}/burn-rate.png" alt="Burn Rate Trend" class="chart-image">
      </div>
      <div class="chart-container">
        <h3 class="chart-title">Runway Scenarios</h3>
        <img src="${chartBasePath}/runway-scenarios.png" alt="Runway Scenarios" class="chart-image">
      </div>
      <div class="chart-container">
        <h3 class="chart-title">Cash Flow Analysis</h3>
        <img src="${chartBasePath}/cash-flow.png" alt="Cash Flow Analysis" class="chart-image">
      </div>
    </div>
  </section>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Investor Update - ${update.period}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      color: #1f2937;
      background: #f8fafc;
      min-height: 100vh;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      min-height: 100vh;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05);
    }

    .header {
      background: white;
      border-bottom: 2px solid #e5e7eb;
      padding: 3rem 3rem 2rem 3rem;
    }

    .company-logo {
      width: 40px;
      height: 40px;
      background: #1f2937;
      border-radius: 6px;
      margin-bottom: 1.5rem;
    }

    .main-title {
      font-size: 2rem;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 0.5rem;
      letter-spacing: -0.025em;
    }

    .subtitle {
      font-size: 0.875rem;
      font-weight: 400;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }

    .period-info {
      display: flex;
      align-items: center;
      gap: 2rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .period-info strong {
      color: #1f2937;
      font-weight: 500;
    }

    .content {
      padding: 0 3rem 3rem 3rem;
    }

    .section {
      margin-bottom: 3rem;
    }

    .section-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 1.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e5e7eb;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .executive-summary {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 2rem;
      margin-bottom: 2rem;
      font-size: 1rem;
      line-height: 1.6;
    }

    .highlights {
      display: grid;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }

    .highlight {
      background: #f0f9ff;
      padding: 1rem 1.25rem;
      border-radius: 6px;
      border-left: 3px solid #3b82f6;
      font-size: 0.875rem;
      color: #1f2937;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1px;
      background: #e5e7eb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 2rem;
    }

    .metric-card {
      background: white;
      padding: 1.5rem;
      position: relative;
    }

    .metric-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }

    .metric-value {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
      font-variant-numeric: tabular-nums;
    }

    .metric-change {
      font-size: 0.75rem;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }

    .positive { color: #10b981; }
    .negative { color: #ef4444; }
    .neutral { color: #6b7280; }

    .charts-section {
      margin: 3rem 0;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 3rem 2rem;
    }

    .chart-container {
      background: white;
    }

    .chart-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .chart-image {
      width: 100%;
      height: auto;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      margin: 1.5rem 0;
      font-variant-numeric: tabular-nums;
    }

    .data-table th {
      background: #f9fafb;
      color: #1f2937;
      padding: 0.75rem 1rem;
      text-align: left;
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #e5e7eb;
    }

    .data-table td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #f3f4f6;
      background: white;
      font-size: 0.875rem;
    }

    .data-table tr:last-child td {
      border-bottom: none;
    }

    .data-table tr:nth-child(even) td {
      background: #fafbfc;
    }

    .insights, .concerns, .milestones, .asks {
      margin: 2rem 0;
    }

    .insight-list, .concern-list, .milestone-list, .ask-list {
      list-style: none;
      padding: 0;
      display: grid;
      gap: 0.5rem;
    }

    .insight-list li, .milestone-list li, .ask-list li {
      background: #f8fafc;
      margin: 0;
      padding: 0.75rem 1rem;
      border-radius: 4px;
      border-left: 2px solid #6b7280;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .concern-list li {
      background: #fef7f7;
      border-left: 2px solid #dc2626;
    }

    .footer {
      background: #f9fafb;
      padding: 1.5rem 3rem;
      text-align: center;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
      font-size: 0.75rem;
    }

    @media (max-width: 768px) {
      .header { padding: 2rem 1.5rem 1.5rem 1.5rem; }
      .content { padding: 0 1.5rem 2rem 1.5rem; }
      .footer { padding: 1.5rem; }
      .metrics-grid { grid-template-columns: 1fr; }
      .charts-grid { grid-template-columns: 1fr; }
      .period-info { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="company-logo"></div>
      <h1 class="main-title">Investor Update</h1>
      <p class="subtitle">Financial Performance Report</p>
      <div class="period-info">
        <span><strong>Period:</strong> ${update.period}</span>
        <span><strong>Generated:</strong> ${new Date(update.generatedAt).toLocaleDateString()}</span>
      </div>
    </header>

    <main class="content">
      <section class="section">
        <h2 class="section-title">Executive Summary</h2>
        <div class="executive-summary">
          ${update.summary}
        </div>
      </section>

      ${update.highlights.length > 0 ? `
      <section class="section">
        <h2 class="section-title">Key Highlights</h2>
        <div class="highlights">
          ${update.highlights.map(h => `<div class="highlight">${h}</div>`).join('')}
        </div>
      </section>
      ` : ''}

      <section class="section">
        <h2 class="section-title">Financial Metrics</h2>
        <div class="metrics-grid">
          ${update.metrics.map(m => `
          <div class="metric-card">
            <div class="metric-label">${m.label}</div>
            <div class="metric-value ${m.status || 'neutral'}">${m.value}</div>
            ${m.change ? `<div class="metric-change ${m.status || 'neutral'}">${m.change}</div>` : ''}
          </div>
          `).join('')}
        </div>
      </section>

      ${chartsSection}

      <section class="section">
        <h2 class="section-title">Monthly Performance</h2>
        <table class="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Revenue</th>
              <th>Expenses</th>
              <th>Net Burn</th>
            </tr>
          </thead>
          <tbody>
            ${update.monthlyBreakdown.map(m => `
            <tr>
              <td><strong>${m.month}</strong></td>
              <td class="positive">${m.revenue}</td>
              <td class="negative">${m.expenses}</td>
              <td class="${parseFloat(m.netBurn.replace(/[$,]/g, '')) > 0 ? 'negative' : 'positive'}">${m.netBurn}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </section>

      ${update.keyInsights.length > 0 ? `
      <section class="section insights">
        <h2 class="section-title">Key Insights</h2>
        <ul class="insight-list">
          ${update.keyInsights.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </section>
      ` : ''}

      ${update.concerns.length > 0 ? `
      <section class="section concerns">
        <h2 class="section-title">Areas of Concern</h2>
        <ul class="concern-list">
          ${update.concerns.map(c => `<li>${c}</li>`).join('')}
        </ul>
      </section>
      ` : ''}

      ${update.upcomingMilestones.length > 0 ? `
      <section class="section milestones">
        <h2 class="section-title">Upcoming Milestones</h2>
        <ul class="milestone-list">
          ${update.upcomingMilestones.map(m => `<li>${m}</li>`).join('')}
        </ul>
      </section>
      ` : ''}

      ${update.asks.length > 0 ? `
      <section class="section asks">
        <h2 class="section-title">Investor Support Requests</h2>
        <ul class="ask-list">
          ${update.asks.map(a => `<li>${a}</li>`).join('')}
        </ul>
      </section>
      ` : ''}
    </main>

    <footer class="footer">
      <p>Generated on ${update.generatedAt} | Powered by Mercury Investor Update System</p>
    </footer>
  </div>
</body>
</html>
  `;
}
