import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import config from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import logger from './config/logger.js';

// Handle BigInt serialization
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const app = express();

// Trust proxy for production deployments behind reverse proxies
if (config.env === 'production') {
  app.set('trust proxy', 1); // Trust first proxy
}

// Security middleware - Helmet with optimized configuration
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:', 'http://localhost:*', 'http://127.0.0.1:*'],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
  })
);

// CORS configuration
app.use(
  cors({
    origin: config.allowedOrigins,
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Cookie parser (for httpOnly auth cookies)
app.use(cookieParser());

// Logging middleware
if (config.env === 'development') {
  app.use(morgan('dev', { stream: logger.stream }));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}
app.use(requestLogger);

// Rate limiting (apply after body parsing)
app.use(`/api/${config.apiVersion}`, apiLimiter);

// API routes
app.use(`/api/${config.apiVersion}`, routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Morex Technologies ERP API',
    version: config.apiVersion,
    status: 'running',
  });
});

app.get('/health', (_, res) => res.send('OK'));

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
console.log('Forcing server restart for schema sync...');
const PORT = config.port;
import { startCustomerJobs } from './jobs/customerJobs.js';
import { repairMissingInventorySubRows } from './jobs/inventoryIntegrityJob.js';

app.listen(PORT, '0.0.0.0', () => {
  logger.info('API Server started', {
    port: PORT,
    env: config.env,
    version: config.apiVersion,
  });

  // Initialize cron jobs
  startCustomerJobs();

  // Self-heal legacy RM/PM masters missing inventory sub-rows (idempotent, insert-only)
  repairMissingInventorySubRows();
});

export default app;
