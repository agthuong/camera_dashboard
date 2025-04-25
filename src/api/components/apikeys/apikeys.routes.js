'use-strict';

// Không cần import controller và middleware vì không còn route nào
// import * as ApiKeysController from './apikeys.controller.js';
// import * as PermissionMiddleware from '../../middlewares/auth.permission.middleware.js';
// import * as ValidationMiddleware from '../../middlewares/auth.validation.middleware.js';

/**
 * @swagger
 * tags:
 *  name: APIKeys
 */

export const routesConfig = (app) => {
  // Không có routes nào được định nghĩa - đã loại bỏ endpoint GET /api/apikeys
  // để tăng cường bảo mật
}; 