const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Centralized API service with authentication
class ApiService {
  constructor() {
    this.baseURL = BACKEND_URL;
  }

  // Get auth headers
  getAuthHeaders() {
    const token = localStorage.getItem('justbetToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Generic fetch method with authentication
  async fetch(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      credentials: 'include', // Always include cookies
      headers: this.getAuthHeaders(),
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers
      }
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    return response;
  }

  // GET request
  async get(endpoint) {
    const response = await this.fetch(endpoint);
    return response.json();
  }

  // POST request
  async post(endpoint, data) {
    const response = await this.fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // PATCH request
  async patch(endpoint, data) {
    const response = await this.fetch(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // PUT request
  async put(endpoint, data) {
    const response = await this.fetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // DELETE request
  async delete(endpoint) {
    const response = await this.fetch(endpoint, {
      method: 'DELETE'
    });
    return response.json();
  }

  // Fetch admin activity logs
  async getActivityLogs() {
    return this.get('/api/admin/activity-logs');
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService; 