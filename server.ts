import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cookieParser from 'cookie-parser';

import config from './src/config';
import initSocketManager from './src/sockets/socket.manager';
import { isPostgres, pgPool } from './src/db/db.connection';
import { initializeDatabase } from './src/db/migrations';
import authRoutes from './src/modules/auth/auth.routes';
import meetingRoutes from './src/modules/meeting/meeting.routes';
import glossaryRoutes from './src/modules/glossary/glossary.routes';
import livekitRoutes from './src/modules/livekit/livekit.routes';
import tmRoutes from './src/modules/translation-memory/tm.routes';
import searchRoutes from './src/modules/search/search.routes';
import notificationRoutes from './src/modules/notifications/notification.routes';
import projectRoutes from './src/modules/project/project.routes';
import analyticsRoutes from './src/modules/analytics/analytics.routes';
import chatRoutes from './src/modules/chat/chat.routes';
import requestLogger from './src/middleware/logger.middleware';
import errorHandler from './src/middleware/error.middleware';
import { generalApiLimiter } from './src/middleware/rate-limit.middleware';

const app = express();
// Trust proxy (necessary for express-rate-limit and secure cookies behind Railway load balancer)
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
app.set('io', io); // Attach Socket.io to Express for controller broadcasts

// 1. Structured Request Logging (First in stack)
app.use(requestLogger);

// Body parsing middleware (essential for REST APIs)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie Parser Middleware
app.use(cookieParser());

// Serve static files from the 'public' directory
app.use(express.static(path.join(process.cwd(), 'public')));

// Register API Routes
app.use('/api', generalApiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/glossary', glossaryRoutes);
app.use('/api/livekit', livekitRoutes);
app.use('/api/translation-memory', tmRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/chat', chatRoutes);

// HTML Routing for SPA Room Links
app.get('/meet/:roomId', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Global Error Handler (Must be registered after all routes)
app.use(errorHandler);

// Initialize Socket.io Manager
initSocketManager(io);

// Startup sequence: Run migrations first, then listen
async function startServer() {
  try {
    // 1. Initialize Database & Run Migrations
    await initializeDatabase();

    // 2. Start HTTP Server
    server.listen(config.port, () => {
      console.log(`[Production] Syncra server running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('FATAL: Server startup failed:', error);
    process.exit(1);
  }
}

startServer();

