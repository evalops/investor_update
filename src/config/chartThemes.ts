export interface ChartTheme {
  name: string;
  colors: {
    primary: string[];
    revenue: string;
    expenses: string;
    positive: string;
    negative: string;
    neutral: string;
    background: string;
    text: string;
    grid: string;
  };
  gradients: {
    revenue: string[];
    expenses: string[];
    positive: string[];
    negative: string[];
  };
  fonts: {
    title: {
      family: string;
      size: number;
      weight: number;
    };
    legend: {
      family: string;
      size: number;
    };
    ticks: {
      family: string;
      size: number;
    };
  };
}

export const professionalTheme: ChartTheme = {
  name: 'professional',
  colors: {
    primary: [
      '#374151', // gray-700
      '#1F2937', // gray-800
      '#6B7280', // gray-500
      '#9CA3AF', // gray-400
      '#4B5563', // gray-600
      '#111827', // gray-900
      '#D1D5DB', // gray-300
      '#F3F4F6', // gray-100
    ],
    revenue: '#1F2937', // gray-800
    expenses: '#6B7280', // gray-500
    positive: '#1F2937',
    negative: '#6B7280',
    neutral: '#9CA3AF', // gray-400
    background: '#FFFFFF',
    text: '#1F2937', // gray-800
    grid: '#F3F4F6', // gray-100
  },
  gradients: {
    revenue: ['#1F2937', '#111827'], // gray-800 to gray-900
    expenses: ['#6B7280', '#4B5563'], // gray-500 to gray-600
    positive: ['#1F2937', '#111827'],
    negative: ['#6B7280', '#4B5563'],
  },
  fonts: {
    title: {
      family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      size: 18,
      weight: 600,
    },
    legend: {
      family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      size: 12,
    },
    ticks: {
      family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      size: 11,
    },
  },
};

export const darkTheme: ChartTheme = {
  name: 'dark',
  colors: {
    primary: [
      '#60A5FA', // blue-400
      '#34D399', // emerald-400
      '#FBBF24', // amber-400
      '#F87171', // red-400
      '#A78BFA', // violet-400
      '#22D3EE', // cyan-400
      '#A3E635', // lime-400
      '#FB923C', // orange-400
    ],
    revenue: '#34D399',
    expenses: '#F87171',
    positive: '#34D399',
    negative: '#F87171',
    neutral: '#9CA3AF', // gray-400
    background: '#1F2937', // gray-800
    text: '#F9FAFB', // gray-50
    grid: '#374151', // gray-700
  },
  gradients: {
    revenue: ['#34D399', '#10B981'],
    expenses: ['#F87171', '#EF4444'],
    positive: ['#34D399', '#10B981'],
    negative: ['#F87171', '#EF4444'],
  },
  fonts: {
    title: {
      family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      size: 18,
      weight: 600,
    },
    legend: {
      family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      size: 12,
    },
    ticks: {
      family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      size: 11,
    },
  },
};

export const getTheme = (themeName: string = 'professional'): ChartTheme => {
  switch (themeName) {
    case 'dark':
      return darkTheme;
    case 'professional':
    default:
      return professionalTheme;
  }
};
