// Structured logging utility
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component?: string;
  operation?: string;
  duration?: number;
  error?: Error;
  metadata?: Record<string, any>;
}

export class Logger {
  private static instance: Logger;
  private minLevel: LogLevel = LogLevel.INFO;
  private component: string;

  private constructor(component: string = 'App') {
    this.component = component;
    this.minLevel = this.getLogLevelFromEnv();
  }

  static getInstance(component: string = 'App'): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(component);
    }
    return Logger.instance;
  }

  static for(component: string): Logger {
    return new Logger(component);
  }

  private getLogLevelFromEnv(): LogLevel {
    const level = process.env.LOG_LEVEL?.toUpperCase();
    switch (level) {
      case 'DEBUG': return LogLevel.DEBUG;
      case 'INFO': return LogLevel.INFO;
      case 'WARN': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      case 'CRITICAL': return LogLevel.CRITICAL;
      default: return LogLevel.INFO;
    }
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const levelName = LogLevel[entry.level].padEnd(8);
    const component = entry.component ? `[${entry.component}]` : '';
    const operation = entry.operation ? `(${entry.operation})` : '';
    const duration = entry.duration ? `⏱️${entry.duration}ms` : '';
    
    let message = `${timestamp} ${levelName} ${component}${operation} ${entry.message}`;
    
    if (duration) {
      message += ` ${duration}`;
    }

    if (entry.error) {
      message += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\n  Stack: ${entry.error.stack}`;
      }
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += `\n  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    return message;
  }

  private getIcon(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '🐛';
      case LogLevel.INFO: return '📝';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.ERROR: return '❌';
      case LogLevel.CRITICAL: return '💥';
      default: return '📝';
    }
  }

  private log(level: LogLevel, message: string, options: {
    operation?: string;
    error?: Error;
    metadata?: Record<string, any>;
    duration?: number;
  } = {}): void {
    if (!this.shouldLog(level)) {return;}

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component: this.component,
      ...options
    };

    const formattedMessage = this.formatMessage(entry);
    const icon = this.getIcon(level);

    // Output to appropriate stream
    if (level >= LogLevel.ERROR) {
      console.error(`${icon} ${formattedMessage}`);
    } else {
      console.log(`${icon} ${formattedMessage}`);
    }
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, { metadata });
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, { metadata });
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, { metadata });
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, { error, metadata });
  }

  critical(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.CRITICAL, message, { error, metadata });
  }

  // Operation timing utilities
  startOperation(operation: string, metadata?: Record<string, any>): () => void {
    const startTime = Date.now();
    this.log(LogLevel.DEBUG, `Starting ${operation}`, { operation, metadata });
    
    return () => {
      const duration = Date.now() - startTime;
      this.log(LogLevel.INFO, `Completed ${operation}`, { operation, duration, metadata });
    };
  }

  async timeOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    this.log(LogLevel.DEBUG, `Starting ${operation}`, { operation, metadata });
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.log(LogLevel.INFO, `Completed ${operation}`, { operation, duration, metadata });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log(LogLevel.ERROR, `Failed ${operation}`, { 
        operation, 
        duration, 
        error: error as Error, 
        metadata 
      });
      throw error;
    }
  }

  // Progress tracking
  progress(message: string, current: number, total: number): void {
    const percentage = Math.round((current / total) * 100);
    const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
    this.info(`${message} [${progressBar}] ${percentage}% (${current}/${total})`);
  }

  // API call logging
  apiCall(method: string, url: string, status?: number, duration?: number, metadata?: Record<string, any>): void {
    const statusEmoji = status ? (status < 400 ? '✅' : '❌') : '🔄';
    const durationStr = duration ? ` in ${duration}ms` : '';
    const statusStr = status ? ` (${status})` : '';
    
    this.log(
      status && status >= 400 ? LogLevel.WARN : LogLevel.INFO,
      `${statusEmoji} ${method} ${url}${statusStr}${durationStr}`,
      { operation: 'API_CALL', metadata: { method, url, status, duration, ...metadata } }
    );
  }

  // Data processing logs
  dataProcessing(message: string, recordCount: number, metadata?: Record<string, any>): void {
    this.info(`📊 ${message} (${recordCount} records)`, { recordCount, ...metadata });
  }

  // Security/audit logging
  security(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, `🔒 SECURITY: ${message}`, { operation: 'SECURITY', metadata });
  }

  // Business metrics logging
  business(metric: string, value: number | string, metadata?: Record<string, any>): void {
    this.info(`📈 ${metric}: ${value}`, { operation: 'BUSINESS_METRIC', metadata: { metric, value, ...metadata } });
  }
}

// Convenience exports
export const logger = Logger.getInstance();
export const getLogger = Logger.for;