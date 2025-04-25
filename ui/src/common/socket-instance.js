import io from 'socket.io-client';

// Thêm console.log để debug
console.log('Environment:', process.env.NODE_ENV);
console.log('Server Port:', process.env.VUE_APP_SERVER_PORT);

// Lấy cổng hiện tại từ URL nếu đang ở production
const currentPort = window.location.port || '8085';
console.log('Current port from URL:', currentPort);
console.log('Location hostname:', location.hostname);

// Trong môi trường Docker, sử dụng đường dẫn tương đối
const socketInstance = io(
  process.env.NODE_ENV === 'production'
    ? '/' // Sử dụng đường dẫn tương đối cho Docker/Nginx
    : `${location.protocol}//${location.hostname}:${process.env.VUE_APP_SERVER_PORT || '8082'}`,
  {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling'],
    // Thêm authorization nếu cần thiết để giải quyết lỗi "no token provided"
    auth: {
      token: localStorage.getItem('token') || ''
    }
  }
);

// Thêm xử lý lỗi để debug
socketInstance.on('connect_error', (err) => {
  console.error('Socket connection error:', err);
  console.debug('Socket connection options:', socketInstance.io.opts);
  // Thử kết nối lại với token mới nếu lỗi là do token
  if (err.message === 'no token provided' || err.message.includes('jwt')) {
    console.log('Attempting to reconnect with updated token...');
    // Cập nhật token từ store hoặc localStorage nếu cần
    socketInstance.io.opts.auth = {
      token: localStorage.getItem('token') || ''
    };
    socketInstance.disconnect().connect();
  }
});

// Thêm sự kiện kết nối thành công
socketInstance.on('connect', () => {
  console.log('Socket connected successfully!');
  console.log('Socket ID:', socketInstance.id);
});

export default socketInstance;
