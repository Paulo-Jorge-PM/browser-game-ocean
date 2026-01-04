const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        return { error: error.detail || 'Request failed' };
      }

      const data = await response.json();
      return { data };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  // Auth
  async register(username: string, email: string, password: string) {
    return this.request<{ player: unknown; access_token: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(email: string, password: string) {
    return this.request<{ access_token: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Players
  async getCurrentPlayer() {
    return this.request<unknown>('/api/v1/players/me');
  }

  // Cities
  async createCity(name: string) {
    return this.request<unknown>('/api/v1/cities/', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getCity(cityId: string) {
    return this.request<unknown>(`/api/v1/cities/${cityId}`);
  }

  async buildBase(cityId: string, base: unknown) {
    return this.request<unknown>(`/api/v1/cities/${cityId}/bases`, {
      method: 'POST',
      body: JSON.stringify(base),
    });
  }

  // Health check
  async healthCheck() {
    return this.request<{ status: string }>('/health');
  }
}

export const apiService = new ApiService();
