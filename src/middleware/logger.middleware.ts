import { Request, Response, NextFunction } from 'express';
import Logger from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime();

  // Once the request finishes, log the details
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

    Logger.info('http_request', {
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      duration_ms: parseFloat(durationMs),
      ip: req.ip || req.socket.remoteAddress,
      user_agent: req.headers['user-agent'],
      user_id: req.user?.id || undefined,
    });
  });

  next();
}
export default requestLogger;
