/* eslint-disable quotes */
/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import chalk from 'chalk';
import cors from 'cors';
import fs from 'fs-extra';
import helmet from 'helmet';
import history from 'connect-history-api-fallback';
import morgan from 'morgan';
import multer from 'multer';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
// Node.js < 18 không có fetch tích hợp, cần sử dụng node-fetch
import nodeFetch from 'node-fetch';
// Fallback cho các phiên bản Node.js cũ hơn
const fetch = globalThis.fetch || nodeFetch;

import LoggerService from '../services/logger/logger.service.js';

import express from 'express';

//swagger
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import swaggerOptions from './docs/swagger.js';

import * as AuthRouter from './components/auth/auth.routes.js';
import * as ApiKeysRouter from './components/apikeys/apikeys.routes.js';
import * as BackupRouter from './components/backup/backup.routes.js';
import * as CamerasRouter from './components/cameras/cameras.routes.js';
import * as ConfigRouter from './components/config/config.routes.js';
import * as FilesRouter from './components/files/files.routes.js';
import * as NotificationsRouter from './components/notifications/notifications.routes.js';
import * as RecordingsRouter from './components/recordings/recordings.routes.js';
import * as SettingsRouter from './components/settings/settings.routes.js';
import * as SubscribeRouter from './components/subscribe/subscribe.routes.js';
import * as SystemRouter from './components/system/system.routes.js';
import * as UsersRouter from './components/users/users.routes.js';

const { log } = LoggerService;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const specs = swaggerJsdoc(swaggerOptions);

export default class App {
  constructor(options) {
    // Thiết lập trust proxy để hoạt động với ngrok
    app.set('trust proxy', true);

    // CORS cấu hình toàn diện
    app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
      credentials: true,
      exposedHeaders: ['Cross-Origin-Resource-Policy', 'X-Frame-Options']
    }));

    // Middleware cho header bảo mật - áp dụng cho mọi request
    app.use((req, res, next) => {
      // Thiết lập các header bảo mật quan trọng
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Frame-Options', 'ALLOWALL');

      // Thiết lập CORS headers đầy đủ
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization,Origin,Accept');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Expose-Headers', 'Cross-Origin-Resource-Policy,X-Frame-Options');

      // Xử lý pre-flight request
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }

      // Kiểm tra nếu request đến từ ngrok
      const host = req.headers.host || '';
      const referer = req.headers.referer || '';
      const isNgrok = host.includes('ngrok') || referer.includes('ngrok');

      if (isNgrok) {
        log.debug(`Phát hiện request từ Ngrok: ${host}`);
        // Thêm header đặc biệt cho ngrok
        req.headers['x-forwarded-proto'] = 'https';
      }

      next();
    });

    // Đảm bảo header host luôn có giá trị
    app.use((req, res, next) => {
      req.headers.host = req.headers.host || 'localhost';
      next();
    });

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Thiết lập helmet với cấu hình đặc biệt cho ngrok
    const helmetConfig = {
      contentSecurityPolicy: false, // Tắt CSP cho ngrok
      crossOriginEmbedderPolicy: false, // Tắt COEP cho iframe
      crossOriginOpenerPolicy: false, // Tắt COOP cho iframe
      crossOriginResourcePolicy: { policy: 'cross-origin' } // Thiết lập CORP
    };

    app.use(helmet(helmetConfig));

    app.use(
      history({
        index: 'index.html',
        rewrites: [
          {
            from: /^\/api\/.*$/,
            to: function (context) {
              return context.parsedUrl.pathname;
            },
          },
        ],
      })
    );

    // Chỉ áp dụng CSP tùy chỉnh nếu cần
    app.use(
      helmet.contentSecurityPolicy({
        useDefaults: false,
        directives: {
          defaultSrc: ["'unsafe-eval'", "'unsafe-inline'", "'self'", '*'],
          scriptSrc: ["'unsafe-eval'", "'unsafe-inline'", "'self'", 'https://*.googleapis.com', 'blob:', 'data:', '*'],
          frameSrc: ["'self'", '*', 'data:', 'blob:', 'https:', 'http:', 'https://*.wazimap.co.za', 'https://*.ngrok.io', 'https://*.ngrok-free.app'],
          childSrc: ["'unsafe-eval'", "'unsafe-inline'", "'self'", 'blob:', 'https:', 'http:', '*'],
          fontSrc: ["'unsafe-eval'", "'unsafe-inline'", "'self'", 'data:', '*'],
          connectSrc: [
            'ws:',
            'wss:',
            'https:',
            'http:',
            'blob:',
            'data:',
            'file:',
            'filesystem:',
            'mediastream:',
            'https://registry.npmjs.org',
            'https://unpkg.com',
            'https://*.wazimap.co.za',
            'https://*.ngrok.io',
            'https://*.ngrok-free.app',
            "'unsafe-eval'",
            "'unsafe-inline'",
            "'self'",
            '*'
          ],
          imgSrc: ["'unsafe-eval'", "'unsafe-inline'", "'self'", 'data:', 'blob:', 'https://openweathermap.org', '*'],
          mediaSrc: ["'unsafe-eval'", "'unsafe-inline'", "'self'", 'data:', 'blob:', '*'],
          frameAncestors: ["'self'", '*'],
          formAction: ["'self'", '*'],
          upgradeInsecureRequests: null
        },
      })
    );

    app.use(
      morgan(
        (tokens, req, res) => {
          // eslint-disable-next-line unicorn/consistent-function-scoping
          const headersSent = (res) => {
            return typeof res.headersSent !== 'boolean' ? Boolean(res._header) : res.headersSent;
          };

          const status = headersSent(res) ? res.statusCode : undefined;

          const color =
            status >= 500
              ? 'redBright'
              : status >= 400
                ? 'yellowBright'
                : status >= 300
                  ? 'cyanBright'
                  : status >= 200
                    ? 'greenBright'
                    : 'gray';

          return [
            chalk.gray(tokens.method(req, res)),
            chalk.gray(tokens.url(req, res)),
            chalk[color](tokens.status(req, res)),
            chalk.gray(tokens['response-time'](req, res)),
            chalk.gray('ms'),
            chalk.gray('-'),
            chalk.gray(tokens.res(req, res, 'content-length') || ''),
          ].join(' ');
        },
        {
          skip: () => !options.debug,
          stream: {
            write: (line) => {
              log.debug(line.replace(/^\s+|\s+$/g, ''));
            },
          },
        }
      )
    );

    const backupUpload = multer({
      storage: multer.diskStorage({
        destination: async (request, file, callback) => {
          const backupDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'cameraui-restore-'));
          callback(null, backupDirectory);
        },
        filename: (request, file, callback) => {
          callback(null, file.originalname);
        },
      }),
    });

    AuthRouter.routesConfig(app);
    // ApiKeysRouter vẫn được giữ lại để tương thích ngược, nhưng đã vô hiệu hóa các routes để bảo mật
    ApiKeysRouter.routesConfig(app);
    BackupRouter.routesConfig(app, backupUpload);
    CamerasRouter.routesConfig(app);
    ConfigRouter.routesConfig(app);
    FilesRouter.routesConfig(app);
    NotificationsRouter.routesConfig(app);
    RecordingsRouter.routesConfig(app);
    SettingsRouter.routesConfig(app);
    SubscribeRouter.routesConfig(app);
    SystemRouter.routesConfig(app);
    UsersRouter.routesConfig(app);

    app.get('/version', (req, res) => {
      res.status(200).send({
        version: options.version,
      });
    });

    // API đặc biệt để phục vụ nội dung iframe từ bên ngoài 
    app.get('/api/proxy', async (req, res) => {
      try {
        const targetUrl = req.query.url;

        if (!targetUrl) {
          return res.status(400).send({
            statusCode: 400,
            message: 'Missing url parameter',
          });
        }

        // Phát hiện ngrok để xử lý đặc biệt
        const isNgrok = req.headers.host?.includes('ngrok') || req.headers.referer?.includes('ngrok');
        log.debug(`Proxying request to: ${targetUrl}${isNgrok ? ' (via ngrok)' : ''}`);

        // Headers đặc biệt để tránh bị chặn
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        };

        // Nếu là ngrok, thêm Origin và Referer header
        if (isNgrok) {
          headers['Origin'] = 'https://localhost';
          headers['Referer'] = 'https://localhost/';
        }

        // Sử dụng timeout để tránh treo ứng dụng
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
          const response = await fetch(targetUrl, {
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            log.error(`Proxy target responded with status: ${response.status} - ${response.statusText}`);
            return res.status(response.status).send({
              statusCode: response.status,
              message: `Error from target server: ${response.statusText}`,
            });
          }

          const contentType = response.headers.get('content-type');
          const data = await response.text();

          // Thiết lập tất cả header bảo mật và CORS
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
          res.setHeader('Access-Control-Expose-Headers', 'Cross-Origin-Resource-Policy, X-Frame-Options');
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
          res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
          res.setHeader('X-Frame-Options', 'ALLOWALL');

          // Thiết lập content-type dựa trên phản hồi gốc
          if (contentType) {
            res.setHeader('Content-Type', contentType);
          }

          return res.send(data);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }
      } catch (error) {
        log.error(`Proxy error: ${error.message}`, error);
        return res.status(500).send({
          statusCode: 500,
          message: `Proxy error: ${error.message}`,
        });
      }
    });

    // API kiểm tra CORS và headers 
    app.get('/api/check-headers', (req, res) => {
      // Thiết lập header bảo mật và CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.setHeader('Access-Control-Expose-Headers', 'Cross-Origin-Resource-Policy, X-Frame-Options');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Frame-Options', 'ALLOWALL');

      // Trả về tất cả các headers của request
      res.status(200).json({
        message: 'Headers check',
        requestHeaders: req.headers,
        responseHeaders: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
          'Access-Control-Expose-Headers': 'Cross-Origin-Resource-Policy, X-Frame-Options',
          'Access-Control-Allow-Credentials': 'true',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'X-Frame-Options': 'ALLOWALL'
        }
      });
    });

    app.use(
      '/swagger',
      swaggerUi.serve,
      swaggerUi.setup(specs, {
        explorer: true,
        swaggerOptions: {
          displayRequestDuration: true,
          docExpansion: 'none',
          filter: false,
          showExtensions: true,
          showCommonExtensions: true,
          displayOperationId: false,
        },
      })
    );

    app.use(express.static(path.join(__dirname, '../../interface')));

    return app;
  }
}
