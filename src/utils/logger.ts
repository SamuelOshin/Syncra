export class Logger {
  private static logJson(level: 'INFO' | 'WARN' | 'ERROR', event: string, context: Record<string, any> = {}) {
    const logObject = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...context,
    };

    if (level === 'ERROR') {
      console.error(JSON.stringify(logObject));
    } else if (level === 'WARN') {
      console.warn(JSON.stringify(logObject));
    } else {
      console.log(JSON.stringify(logObject));
    }
  }

  public static info(event: string, context: Record<string, any> = {}) {
    this.logJson('INFO', event, context);
  }

  public static warn(event: string, context: Record<string, any> = {}) {
    this.logJson('WARN', event, context);
  }

  public static error(event: string, error: Error | unknown, context: Record<string, any> = {}) {
    const errorDetails = error instanceof Error ? {
      error_message: error.message,
      error_stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    } : { error_details: String(error) };

    this.logJson('ERROR', event, {
      ...errorDetails,
      ...context,
    });
  }
}
export default Logger;
