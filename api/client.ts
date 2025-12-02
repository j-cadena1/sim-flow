import axios from 'axios';

// API base URL - in production this will be proxied by Nginx
const API_BASE_URL = '/api';

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor to add user context
apiClient.interceptors.request.use((config) => {
  // Get current user from sessionStorage (set by role switcher)
  const currentUser = sessionStorage.getItem('sim-flow-current-user');

  if (currentUser) {
    try {
      const user = JSON.parse(currentUser);
      config.headers['X-User-Id'] = user.id;
      config.headers['X-User-Name'] = user.name;
      config.headers['X-User-Role'] = user.role;
    } catch (e) {
      console.error('Failed to parse current user:', e);
    }
  }

  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error
      console.error('API Error:', error.response.data);
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error:', error.message);
    } else {
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
