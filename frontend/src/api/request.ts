import axios from 'axios';

const request = axios.create({
  baseURL: '/api',
  timeout: 30000
});

request.interceptors.request.use(
  (config) => {
    const user = localStorage.getItem('currentUser');
    if (user) {
      config.headers['x-user'] = user;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

request.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default request;
