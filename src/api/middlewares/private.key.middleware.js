/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

import LoggerService from '../../services/logger/logger.service.js';

const { log } = LoggerService;

// Đọc API key từ biến môi trường hoặc sử dụng giá trị mặc định
const API_KEY = process.env.CAMERA_UI_API_KEY || 'ca2faf96cd28f289f8580c82b8bb2052bac8109028c4dec0a51a7ddce6cd6f3d';

// Ghi log API key khi khởi động (chỉ hiển thị một phần để bảo mật)
log.info(`API Key loaded: ${API_KEY.substring(0, 8)}...${API_KEY.substring(API_KEY.length - 4)}`, 'Auth', 'security');

/**
 * Middleware để xác thực private key
 * Kiểm tra header X-API-Key hoặc query parameter apiKey
 */
export const validPrivateKeyNeeded = async (req, res, next) => {
  try {
    // Lấy API key từ header hoặc query parameter
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!apiKey) {
      return res.status(401).send({
        statusCode: 401,
        message: 'API key is required',
      });
    }

    // Kiểm tra API key có hợp lệ không - chỉ chấp nhận key từ biến môi trường
    if (apiKey !== API_KEY) {
      return res.status(403).send({
        statusCode: 403,
        message: 'Invalid API key',
      });
    }

    // API key hợp lệ, cho phép tiếp tục
    next();
  } catch (error) {
    log.error(`Error validating private key: ${error.message}`, 'Auth', 'security');
    return res.status(500).send({
      statusCode: 500,
      message: 'Internal server error during authentication',
    });
  }
}; 