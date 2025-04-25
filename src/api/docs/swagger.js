'use-strict';

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = fs.readJsonSync(path.resolve(__dirname, '../../../package.json'));

export default {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'camera.ui API',
      description: '',
      version: packageJson.version,
      contact: {
        name: 'camera.ui',
        url: 'https://github.com/SeydX/camera.ui',
      },
    },
    tags: [],
    servers: [],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'oauth2',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          flows: {
            password: {
              tokenUrl: '/api/auth/login',
              scopes: null,
            },
          },
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key authentication'
        },
      },
    },
  },
  apis: [`${path.resolve(__dirname, '..')}/components/**/*.routes.js`],
};
