/* eslint-disable unicorn/explicit-length-check */
'use-strict';

import checkDiskSpace from 'check-disk-space';
import getFolderSize from 'get-folder-size';
import { Server } from 'socket.io';
import socketioJwt from 'socketio-jwt';
import systeminformation from 'systeminformation';

import LoggerService from '../services/logger/logger.service.js';
import ConfigService from '../services/config/config.service.js';

import Database from './database.js';

import CameraController from '../controller/camera/camera.controller.js';
import MotionController from '../controller/motion/motion.controller.js';

const { log } = LoggerService;

export default class Socket {
  #streamTimeouts = new Map();

  static #uptime = {
    systemTime: '0m',
    processTime: '0m',
  };

  static #cpuLoadHistory = [];
  static #cpuTempHistory = [];
  static #memoryUsageHistory = [];
  static #diskSpaceHistory = [];

  static diskSpace = {
    free: null,
    total: null,
    used: null,
    usedRecordings: null,
  };

  static io;

  static create = (server) => new Socket(server);

  constructor(server) {
    Socket.io = LoggerService.socket = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'Origin', 'Accept'],
        exposedHeaders: ['Cross-Origin-Resource-Policy']
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000
    });

    log.debug('Socket.io server initialized with configuration:', {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'Origin', 'Accept'],
        exposedHeaders: ['Cross-Origin-Resource-Policy']
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Middleware để thêm Cross-Origin-Resource-Policy header
    Socket.io.engine.on('headers', (headers, req) => {
      headers['Cross-Origin-Resource-Policy'] = 'cross-origin';
    });

    Socket.io.use((socket, next) => {
      log.debug(`Socket auth attempt - handshake data:`, {
        headers: socket.handshake.headers,
        query: socket.handshake.query,
        auth: socket.handshake.auth
      });
      next();
    });

    Socket.io.use(
      socketioJwt.authorize({
        secret: ConfigService.interface.jwt_secret,
        handshake: true,
        auth: {
          required: true
        }
      })
    );

    // Logs errors from socket.io authorization
    Socket.io.engine.on('connection_error', (err) => {
      log.error(`Socket connection_error: ${err.message}`, {
        code: err.code,
        message: err.message,
        context: err.context,
        stack: err.stack
      });
    });

    Socket.io.on('connect_error', (error) => {
      log.error(`Socket connect_error: ${error.message}`, error);
    });

    Socket.io.on('error', (error) => {
      log.error(`Socket general error: ${error.message}`, error);
    });

    Socket.io.on('connection', async (socket) => {
      try {
        log.debug(`Socket connection attempt from ${socket.conn.remoteAddress}`);

        //check if token is valid
        const token = socket.encoded_token;
        if (!token) {
          log.debug('No token provided for socket connection');
          socket.emit('unauthenticated');
          setTimeout(() => socket.disconnect(true), 1000);
          return;
        }

        log.debug(`Got token for socket connection: ${token.substring(0, 10)}...`);

        const tokenExist = Database.tokensDB?.chain.get('tokens').find({ token: token }).value();

        if (!tokenExist) {
          log.debug(
            `${socket.decoded_token?.username || 'Unknown'} (${socket.conn.remoteAddress}) disconnecting from socket, not authenticated - token not found in database`
          );

          socket.emit('unauthenticated');
          setTimeout(() => socket.disconnect(true), 1000);

          return;
        }

        log.debug(
          `${socket.decoded_token.username} (${socket.conn.remoteAddress}) authenticated and connected to socket`
        );

        // Ping-pong test endpoint
        socket.on('ping_test', (data) => {
          log.debug(`Received ping_test from ${socket.decoded_token.username}:`, data);
          socket.emit('pong_test', {
            received: data,
            time: new Date().toISOString(),
            message: 'Socket connection test successful!'
          });
        });

        if (
          socket.decoded_token.permissionLevel.includes('notifications:access') ||
          socket.decoded_token.permissionLevel.includes('admin')
        ) {
          const notifications = await Database.interfaceDB?.chain.get('notifications').cloneDeep().value();
          const systemNotifications = Database.notificationsDB?.chain.get('notifications').cloneDeep().value();

          if (notifications && systemNotifications) {
            const size = notifications.length + systemNotifications.length;
            socket.emit('notification_size', size);
          }
        } else {
          log.debug(`${socket.decoded_token.username} (${socket.conn.remoteAddress}) no access for notifications socket`);
        }

        // Danh sách các event listeners đã đăng ký để có thể dọn dẹp khi disconnect
        const registeredEvents = [
          'join_stream',
          'leave_stream',
          'rejoin_stream',
          'refresh_stream',
          'getUptime',
          'getCpuLoad',
          'getCpuTemp',
          'getMemory',
          'getDiskSpace',
          'getMotionServerStatus',
          'getCameraPrebufferSatus',
          'getCameraVideoanalysisSatus',
        ];

        socket.on('join_stream', (data) => {
          if (data.feed) {
            socket.join(`stream/${data.feed}`);
            log.debug(`${socket.decoded_token.username} (${socket.conn.remoteAddress}) joined stream: ${data.feed}`);
          }
        });

        socket.on('leave_stream', (data) => {
          if (data.feed) {
            socket.leave(`stream/${data.feed}`);
            log.debug(`${socket.decoded_token.username} (${socket.conn.remoteAddress}) left stream: ${data.feed}`);
          }
        });

        socket.on('rejoin_stream', (data) => {
          if (data.feed) {
            socket.leave(`stream/${data.feed}`);
            socket.join(`stream/${data.feed}`);

            log.debug(`${socket.decoded_token.username} (${socket.conn.remoteAddress}) re-joined stream: ${data.feed}`);
          }
        });

        socket.on('refresh_stream', (data) => {
          if (data.feed) {
            log.debug(
              `${socket.decoded_token.username} (${socket.conn.remoteAddress}) requested to restart stream: ${data.feed}`
            );
            this.#handleStream(data.feed, 'restart');
          }
        });

        socket.on('getUptime', () => {
          Socket.io.emit('uptime', Socket.#uptime);
        });

        socket.on('getCpuLoad', () => {
          Socket.io.emit('cpuLoad', Socket.#cpuLoadHistory);
        });

        socket.on('getCpuTemp', () => {
          Socket.io.emit('cpuTemp', Socket.#cpuTempHistory);
        });

        socket.on('getMemory', () => {
          Socket.io.emit('memory', Socket.#memoryUsageHistory);
        });

        socket.on('getDiskSpace', () => {
          Socket.io.emit('diskSpace', Socket.#diskSpaceHistory);
        });

        socket.on('getMotionServerStatus', () => {
          const ftpStatus = MotionController.ftpServer?.server?.listening;
          const httpStatus = MotionController.httpServer?.listening;
          const mqttStatus = MotionController.mqttClient?.connected;
          const smtpStatus = MotionController.smtpServer?.server?.listening;

          Socket.io.emit('motionServerStatus', {
            ftpStatus: ftpStatus ? 'online' : 'offline',
            httpStatus: httpStatus ? 'online' : 'offline',
            mqttStatus: mqttStatus ? 'online' : 'offline',
            smtpStatus: smtpStatus ? 'online' : 'offline',
          });

          Socket.io.emit('ftpStatus', {
            status: ftpStatus ? 'online' : 'offline',
          });

          Socket.io.emit('httpStatus', {
            status: httpStatus ? 'online' : 'offline',
          });

          Socket.io.emit('mqttStatus', {
            status: mqttStatus ? 'online' : 'offline',
          });

          Socket.io.emit('smtpStatus', {
            status: smtpStatus ? 'online' : 'offline',
          });
        });

        socket.on('getCameraPrebufferSatus', (cameras) => {
          if (!Array.isArray(cameras)) {
            cameras = [cameras];
          }

          for (const cameraName of cameras) {
            const controller = CameraController.cameras.get(cameraName);
            const state = controller?.prebuffer?.prebufferSession?.isActive();

            socket.emit('prebufferStatus', {
              camera: cameraName,
              status: state ? 'active' : 'inactive',
            });
          }
        });

        socket.on('getCameraVideoanalysisSatus', (cameras) => {
          if (!Array.isArray(cameras)) {
            cameras = [cameras];
          }

          for (const cameraName of cameras) {
            const controller = CameraController.cameras.get(cameraName);
            const state = controller?.videoanalysis?.videoanalysisSession?.isActive();

            socket.emit('videoanalysisStatus', {
              camera: cameraName,
              status: state ? 'active' : 'inactive',
            });
          }
        });

        socket.on('disconnect', (reason) => {
          log.debug(`${socket.decoded_token.username} (${socket.conn.remoteAddress}) disconnected from socket. Reason: ${reason}`);
        });

        socket.on('error', (error) => {
          log.error(`Socket client error for user ${socket.decoded_token.username}: ${error.message}`);
        });
      } catch (error) {
        log.error(`Error in socket connection handler: ${error.message}`, error);
      }
    });

    Socket.io.of('/').adapter.on('join-room', (room) => {
      if (room.startsWith('stream/')) {
        const cameraName = room.split('/')[1];
        const clients = Socket.io.sockets.adapter.rooms.get(`stream/${cameraName}`)?.size || 0;

        log.debug(`Active sockets in room (stream/${cameraName}): ${clients}`);

        let streamTimeout = this.#streamTimeouts.get(cameraName);

        if (streamTimeout) {
          clearTimeout(streamTimeout);
          this.#streamTimeouts.delete(cameraName);
        } else if (clients < 2) {
          this.#handleStream(cameraName, 'start');
        }
      }
    });

    Socket.io.of('/').adapter.on('leave-room', (room) => {
      if (room.startsWith('stream/')) {
        const cameraName = room.split('/')[1];
        const clients = Socket.io.sockets.adapter.rooms.get(`stream/${cameraName}`)?.size || 0;

        log.debug(`Active sockets in room (stream/${cameraName}): ${clients}`);

        if (!clients) {
          let streamTimeout = this.#streamTimeouts.get(cameraName);

          if (!streamTimeout) {
            log.debug('If no clients connects to the Websocket, the stream will be closed in 15s');

            streamTimeout = setTimeout(() => {
              this.#handleStream(cameraName, 'stop');
              this.#streamTimeouts.delete(cameraName);
            }, 15000);

            this.#streamTimeouts.set(cameraName, streamTimeout);
          }
        }
      }
    });

    Socket.io.of('/').adapter.on('delete-room', (room) => {
      if (room.startsWith('stream/')) {
        const cameraName = room.split('/')[1];
        let streamTimeout = this.#streamTimeouts.get(cameraName);

        if (!streamTimeout) {
          log.debug('If no clients connects to the Websocket, the stream will be closed in 15s');

          streamTimeout = setTimeout(() => {
            this.#handleStream(cameraName, 'stop');
            this.#streamTimeouts.delete(cameraName);
          }, 15000);

          this.#streamTimeouts.set(cameraName, streamTimeout);
        }
      }
    });

    return Socket.io;
  }

  async #handleStream(cameraName, target) {
    const controller = CameraController.cameras.get(cameraName);

    if (controller) {
      switch (target) {
        case 'start':
          controller.stream.start();
          break;
        case 'stop':
          controller.stream.stop();
          break;
        case 'restart':
          controller.stream.restart();
          break;
      }
    }
  }

  static async watchSystem() {
    await Socket.#handleUptime();
    await Socket.#handleCpuLoad();
    await Socket.#handleCpuTemperature();
    await Socket.#handleMemoryUsage();
    await Socket.handleDiskUsage();

    setTimeout(() => {
      Socket.watchSystem();
    }, 30000);
  }

  static async #handleUptime() {
    try {
      const humaniseDuration = (seconds) => {
        if (seconds < 50) {
          return '0m';
        }
        if (seconds < 3600) {
          return Math.round(seconds / 60) + 'm';
        }
        if (seconds < 86400) {
          return Math.round(seconds / 60 / 60) + 'h';
        }
        return Math.floor(seconds / 60 / 60 / 24) + 'd';
      };

      const systemTime = await systeminformation.time();
      const processUptime = process.uptime();

      Socket.#uptime = {
        systemTime: humaniseDuration(systemTime ? systemTime.uptime : 0),
        processTime: humaniseDuration(processUptime),
      };
    } catch (error) {
      log.error(error, 'Socket');
    }

    Socket.io.emit('uptime', Socket.#uptime);
  }

  static async #handleCpuLoad() {
    try {
      const cpuLoad = await systeminformation.currentLoad();
      let processLoad = await systeminformation.processLoad(process.title);

      if (processLoad?.length && !processLoad[0].pid && !processLoad[0].cpu && !processLoad[0].mem) {
        // can not find through process.title, try again with process.pid
        const processes = await systeminformation.processes();
        const processByPID = processes.list.find((p) => p.pid === process.pid);

        if (processByPID) {
          processLoad = [
            {
              cpu: processByPID.cpu,
            },
          ];
        }
      }

      Socket.#cpuLoadHistory = Socket.#cpuLoadHistory.slice(-60);
      Socket.#cpuLoadHistory.push({
        time: new Date(),
        value: cpuLoad ? cpuLoad.currentLoad : 0,
        value2: processLoad?.length ? processLoad[0].cpu || 0 : 0,
      });
    } catch (error) {
      log.error(error, 'Socket');
    }

    Socket.io.emit('cpuLoad', Socket.#cpuLoadHistory);
  }

  static async #handleCpuTemperature() {
    try {
      const cpuTemperatureData = await systeminformation.cpuTemperature();

      Socket.#cpuTempHistory = Socket.#cpuTempHistory.slice(-60);
      Socket.#cpuTempHistory.push({
        time: new Date(),
        value: cpuTemperatureData ? cpuTemperatureData.main : 0,
      });
    } catch (error) {
      log.error(error, 'Socket');
    }

    Socket.io.emit('cpuTemp', Socket.#cpuTempHistory);
  }

  static async #handleMemoryUsage() {
    try {
      const mem = await systeminformation.mem();
      const memoryFreePercent = mem ? ((mem.total - mem.available) / mem.total) * 100 : 50;
      let processLoad = await systeminformation.processLoad(process.title);

      if (!processLoad.pid && !processLoad.cpu && !processLoad.mem) {
        // can not find through process.title, try again with process.pid
        const processes = await systeminformation.processes();
        const processByPID = processes.list.find((p) => p.pid === process.pid);

        if (processByPID) {
          processLoad = [
            {
              mem: processByPID.mem,
            },
          ];
        }
      }

      Socket.#memoryUsageHistory = Socket.#memoryUsageHistory.slice(-60);
      Socket.#memoryUsageHistory.push({
        time: new Date(),
        value: memoryFreePercent,
        value2: processLoad?.length ? processLoad[0].mem || 0 : 0,
        available: mem ? (mem.available / 1024 / 1024 / 1024).toFixed(2) : 4,
        total: mem ? (mem.total / 1024 / 1024 / 1024).toFixed(2) : 8,
      });
    } catch (error) {
      log.error(error, 'Socket');
    }

    Socket.io.emit('memory', Socket.#memoryUsageHistory);
  }

  static async handleDiskUsage() {
    try {
      const settingsDatabase = await Database.interfaceDB.chain.get('settings').cloneDeep().value();
      const recordingsPath = settingsDatabase?.recordings.path;

      if (!recordingsPath) {
        return;
      }

      const diskSpace = await checkDiskSpace(recordingsPath);
      const recordingsSpace = await getFolderSize.loose(recordingsPath);

      Socket.diskSpace = {
        available: diskSpace.free / 1e9,
        total: diskSpace.size / 1e9,
        used: (diskSpace.size - diskSpace.free) / 1e9,
        usedRecordings: recordingsSpace / 1e9,
        recordingsPath: recordingsPath,
      };

      const usedPercent = Socket.diskSpace.used / Socket.diskSpace.total;
      const usedRecordingsPercent = Socket.diskSpace.usedRecordings / Socket.diskSpace.total;

      Socket.#diskSpaceHistory = Socket.#diskSpaceHistory.slice(-60);
      Socket.#diskSpaceHistory.push({
        time: new Date(),
        value: usedPercent * 100,
        value2: usedRecordingsPercent * 100,
        available: Socket.diskSpace.available.toFixed(2),
        total: Socket.diskSpace.total.toFixed(2),
      });
    } catch (error) {
      log.error(error, 'Socket');
    }

    Socket.io.emit('diskSpace', Socket.#diskSpaceHistory);
  }
}
