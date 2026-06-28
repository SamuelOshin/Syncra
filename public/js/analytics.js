// ==========================================
// SYNCRA ANALYTICS CONTROLLER
// ==========================================

import { api } from './api.js';
import { ui } from './ui.js';

export const analytics = {
  chartInstance: null,

  init() {
    // Inline content view requires no modal-specific initialization
  },

  async loadAndRender() {
    try {
      const res = await api.getAnalytics();
      const { stats, chartData } = res.data;

      // 1. Render KPI values
      const statMeetings = document.getElementById('stat-meetings');
      const statWords = document.getElementById('stat-words');
      const statLatency = document.getElementById('stat-latency');
      const statSaved = document.getElementById('stat-saved');

      if (statMeetings) statMeetings.textContent = stats.totalMeetings;
      if (statWords) statWords.textContent = stats.totalWords.toLocaleString();
      if (statLatency) statLatency.textContent = `${stats.avgLatency.toFixed(2)}s`;
      if (statSaved) statSaved.textContent = stats.totalSavedTerms;

      // 2. Render Chart.js
      this.renderChart(chartData);

    } catch (err) {
      console.error('[Analytics] Failed to load statistics:', err);
      ui.showToast('Failed to load analytics statistics', 'error');
    }
  },

  renderChart(chartData) {
    const canvas = document.getElementById('analytics-chart');
    if (!canvas || !window.Chart) return;

    // Destroy existing chart instance to prevent canvas rendering conflicts
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    
    // Create gradient fill matching Syncra primary theme
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(30, 91, 240, 0.22)');
    gradient.addColorStop(1, 'rgba(30, 91, 240, 0.00)');

    this.chartInstance = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.map(d => d.date),
        datasets: [{
          label: 'Words Translated',
          data: chartData.map(d => d.words),
          borderColor: '#1E5BF0',
          backgroundColor: gradient,
          borderWidth: 2.5,
          fill: true,
          tension: 0.35, // Smooth bezier curves
          pointBackgroundColor: '#1E5BF0',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleFont: { family: 'Outfit, sans-serif', size: 12, weight: 'bold' },
            bodyFont: { family: 'Inter, sans-serif', size: 12 },
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (context) => ` ${context.parsed.y} words`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Inter, sans-serif', size: 11 }, color: '#64748B' }
          },
          y: {
            border: { dash: [5, 5] }, // Dashed gridline borders
            grid: { color: '#E2E8F0' },
            ticks: { 
              font: { family: 'Inter, sans-serif', size: 11 }, 
              color: '#64748B', 
              precision: 0 
            }
          }
        }
      }
    });
  }
};
export default analytics;
