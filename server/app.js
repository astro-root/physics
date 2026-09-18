import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { config, ROOT } from './config.js';
import { attachUser } from './auth.js';
import { getDb } from './db.js';
import { authRouter } from './routes/auth.js';
import { simulationsRouter } from './routes/simulations.js';
import { taxonomyRouter } from './routes/taxonomy.js';
import { statsRouter } from './routes/stats.js';

export function createApp() {
  getDb();
  const app = express();
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The app itself never loads remote script. Author code runs only inside
      // the srcdoc sandbox, which ships its own stricter policy.
      contentSecurityPolicy: config.isProd
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com'],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'"],
              frameSrc: ["'self'", 'blob:'],
              objectSrc: ["'none'"],
              baseUri: ["'none'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && config.corsOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Credentials', 'true');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.set('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use(attachUser);

  app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.use('/api/auth', authRouter);
  app.use('/api/simulations', simulationsRouter);
  app.use('/api', taxonomyRouter);
  app.use('/api/stats', statsRouter);

  app.use('/api', (req, res) => res.status(404).json({ error: 'No such endpoint.' }));

  if (config.serveClient) {
    const dist = path.join(ROOT, 'dist');
    if (fs.existsSync(dist)) {
      app.use(express.static(dist));
      app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
    }
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something broke on the server.' : err.message });
  });

  return app;
}
