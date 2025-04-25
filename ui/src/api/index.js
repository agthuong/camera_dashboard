import axios from 'axios';
// import store from '@/store';
// import router from '@/router';

// Trong môi trường Docker, sử dụng path tương đối thay vì host:port cụ thể
const APIUrl =
  process.env.NODE_ENV === 'production'
    ? '/api' // Sử dụng path tương đối trong production (Docker)
    : `${location.protocol}//${location.hostname}:${process.env.VUE_APP_SERVER_PORT}/api`;

// Set up instance
const API = axios.create({
  baseURL: APIUrl,
  timeout: 180000,
});

API.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem('user'));

    if (user && user.access_token) {
      config.headers['Authorization'] = `Bearer ${user.access_token}`;
    }

    return Promise.resolve(config);
  },

  (error) => {
    return Promise.reject(error);
  }
);

API.interceptors.response.use(
  (response) => {
    return Promise.resolve(response);
  },

  (error) => {
    return Promise.reject(error);
  }
);

export default API;
