import { authService } from './apiService';

interface TokenResponse {
  success: boolean;
  data: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  message: string;
}

class TokenService {
  private refreshTimeout: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<TokenResponse> | null = null;
  private userType: 'admin' | 'team' | null = null;
  private isHandlingExpiration = false; // prevent duplicate expiration redirects

  // Initialize auto-refresh for admin tokens
  initializeAutoRefresh() {
    const accessToken = sessionStorage.getItem('access_token');
    const refreshToken = sessionStorage.getItem('refresh_token');
    
    if (accessToken && refreshToken) {
      this.userType = 'admin';
      this.scheduleTokenRefresh();
    }
  }

  // Initialize auto-refresh for team member tokens
  initializeTeamAutoRefresh() {
    const teamToken = sessionStorage.getItem('teamToken');
    const refreshToken = sessionStorage.getItem('teamRefreshToken');
    
    if (teamToken && refreshToken) {
      this.userType = 'team';
      this.scheduleTeamTokenRefresh();
    }
  }

  // Schedule token refresh before expiration
  private scheduleTokenRefresh() {
    const accessToken = sessionStorage.getItem('access_token');
    if (!accessToken) return;

    try {
      const payload = this.decodeJWT(accessToken);
      if (!payload) return;

      const expiresAt = payload.exp * 1000;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      // Token already expired — don't schedule a rapid retry loop, just handle expiration once
      if (timeUntilExpiry <= 0) {
        this.handleTokenExpiration();
        return;
      }

      // Refresh 5 minutes before expiration (minimum 10 seconds to avoid tight loops)
      const refreshTime = Math.max(timeUntilExpiry - (5 * 60 * 1000), 10_000);

      if (this.refreshTimeout) clearTimeout(this.refreshTimeout);

      this.refreshTimeout = setTimeout(() => {
        this.refreshToken();
      }, refreshTime);

    } catch (error) {
      console.error('❌ Error scheduling admin token refresh:', error);
    }
  }

  // Schedule team token refresh before expiration
  private scheduleTeamTokenRefresh() {
    const teamToken = sessionStorage.getItem('teamToken');
    if (!teamToken) return;

    try {
      const payload = this.decodeJWT(teamToken);
      if (!payload) return;

      const expiresAt = payload.exp * 1000;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      // Token already expired — don't schedule a rapid retry loop, just handle expiration once
      if (timeUntilExpiry <= 0) {
        this.handleTeamTokenExpiration();
        return;
      }

      // Refresh 5 minutes before expiration (minimum 10 seconds to avoid tight loops)
      const refreshTime = Math.max(timeUntilExpiry - (5 * 60 * 1000), 10_000);

      if (this.refreshTimeout) clearTimeout(this.refreshTimeout);

      this.refreshTimeout = setTimeout(() => {
        this.refreshTeamToken();
      }, refreshTime);

    } catch (error) {
      console.error('❌ Error scheduling team token refresh:', error);
    }
  }

  // Decode JWT token (without verification)
  private decodeJWT(token: string) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('❌ Error decoding JWT:', error);
      return null;
    }
  }

  // Refresh the access token
  async refreshToken(): Promise<boolean> {
    if (this.isRefreshing) {
      if (this.refreshPromise) {
        try {
          await this.refreshPromise;
          return true;
        } catch (error) {
          return false;
        }
      }
    }

    this.isRefreshing = true;
    
    try {
      const refreshToken = sessionStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      this.refreshPromise = authService.refreshToken({ refresh_token: refreshToken });
      const response = await this.refreshPromise;

      if (response && response.success && response.data) {
        sessionStorage.setItem('access_token', response.data.access_token);
        sessionStorage.setItem('refresh_token', response.data.refresh_token);
        this.scheduleTokenRefresh();
        return true;
      } else {
        throw new Error(response?.message || 'Failed to refresh token');
      }

    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('refresh_token');
      this.handleTokenExpiration();
      return false;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  // Refresh the team member token
  async refreshTeamToken(): Promise<boolean> {
    if (this.isRefreshing) {
      if (this.refreshPromise) {
        try {
          await this.refreshPromise;
          return true;
        } catch (error) {
          return false;
        }
      }
    }

    this.isRefreshing = true;
    
    try {
      const refreshToken = sessionStorage.getItem('teamRefreshToken');
      if (!refreshToken) {
        throw new Error('No team refresh token available');
      }

      this.refreshPromise = authService.refreshTeamToken({ refresh_token: refreshToken });
      const response = await this.refreshPromise;

      if (response && response.success && response.data) {
        sessionStorage.setItem('teamToken', response.data.access_token);
        sessionStorage.setItem('teamRefreshToken', response.data.refresh_token);
        this.scheduleTeamTokenRefresh();
        return true;
      } else {
        throw new Error(response?.message || 'Failed to refresh team token');
      }

    } catch (error) {
      console.error('❌ Team token refresh failed:', error);
      sessionStorage.removeItem('teamToken');
      sessionStorage.removeItem('teamRefreshToken');
      this.handleTeamTokenExpiration();
      return false;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  // Handle admin token expiration
  private handleTokenExpiration() {
    if (this.isHandlingExpiration) return;
    this.isHandlingExpiration = true;
    this.clearRefreshTimeout();

    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('adminUserData');

    this.showExpirationMessage('admin');

    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  }

  // Handle team token expiration
  private handleTeamTokenExpiration() {
    if (this.isHandlingExpiration) return;
    this.isHandlingExpiration = true;
    this.clearRefreshTimeout();

    sessionStorage.removeItem('teamToken');
    sessionStorage.removeItem('teamRefreshToken');
    sessionStorage.removeItem('teamUserData');

    this.showExpirationMessage('team');

    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  }

  // Show user-friendly expiration message
  private showExpirationMessage(userType: 'admin' | 'team') {
    const userLabel = userType === 'admin' ? 'Admin' : 'Team Member';
    const messageDiv = document.createElement('div');
    messageDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #fef3c7;
        color: #92400e;
        padding: 24px;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        z-index: 10000;
        font-family: system-ui, sans-serif;
        text-align: center;
        max-width: 400px;
        border: 2px solid #f59e0b;
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">⏰</div>
        <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">
          ${userLabel} Session Expired
        </h3>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5;">
          Your session has expired for security reasons. You'll be redirected to the login page in a few seconds.
        </p>
        <div style="font-size: 12px; opacity: 0.7;">
          This is normal after 10 days of inactivity
        </div>
      </div>
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      if (messageDiv.parentElement) {
        messageDiv.remove();
      }
    }, 5000);
  }

  // Check if admin token is expired
  isTokenExpired(): boolean {
    const accessToken = sessionStorage.getItem('access_token');
    if (!accessToken) return true;

    try {
      const payload = this.decodeJWT(accessToken);
      if (!payload) return true;
      return Date.now() >= payload.exp * 1000;
    } catch (error) {
      console.error('❌ Error checking admin token expiration:', error);
      return true;
    }
  }

  // Check if team token is expired
  isTeamTokenExpired(): boolean {
    const teamToken = sessionStorage.getItem('teamToken');
    if (!teamToken) return true;

    try {
      const payload = this.decodeJWT(teamToken);
      if (!payload) return true;
      return Date.now() >= payload.exp * 1000;
    } catch (error) {
      console.error('❌ Error checking team token expiration:', error);
      return true;
    }
  }

  // Check if the currently active token (admin or team) is expired.
  isActiveTokenExpired(): boolean {
    const adminToken = sessionStorage.getItem('access_token');
    const teamToken = sessionStorage.getItem('teamToken');

    const token = adminToken || teamToken;
    if (!token) return true;

    try {
      const payload = this.decodeJWT(token);
      if (!payload) return true;
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }

  // Refresh whichever token is active (admin or team).
  async refreshActiveToken(): Promise<boolean> {
    const adminToken = sessionStorage.getItem('access_token');
    if (adminToken) {
      return this.refreshToken();
    }
    const teamToken = sessionStorage.getItem('teamToken');
    if (teamToken) {
      return this.refreshTeamToken();
    }
    return false;
  }

  // Get admin token expiration time
  getTokenExpirationTime(): Date | null {
    const accessToken = sessionStorage.getItem('access_token');
    if (!accessToken) return null;

    try {
      const payload = this.decodeJWT(accessToken);
      if (!payload) return null;
      return new Date(payload.exp * 1000);
    } catch (error) {
      console.error('❌ Error getting admin token expiration:', error);
      return null;
    }
  }

  // Get team token expiration time
  getTeamTokenExpirationTime(): Date | null {
    const teamToken = sessionStorage.getItem('teamToken');
    if (!teamToken) return null;

    try {
      const payload = this.decodeJWT(teamToken);
      if (!payload) return null;
      return new Date(payload.exp * 1000);
    } catch (error) {
      console.error('❌ Error getting team token expiration:', error);
      return null;
    }
  }

  // Get time until admin token expires
  getTimeUntilExpiry(): number {
    const expiresAt = this.getTokenExpirationTime();
    if (!expiresAt) return 0;
    return Math.max(expiresAt.getTime() - Date.now(), 0);
  }

  // Get time until team token expires
  getTeamTimeUntilExpiry(): number {
    const expiresAt = this.getTeamTokenExpirationTime();
    if (!expiresAt) return 0;
    return Math.max(expiresAt.getTime() - Date.now(), 0);
  }

  // Clear refresh timeout
  clearRefreshTimeout() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  // Cleanup
  cleanup() {
    this.clearRefreshTimeout();
    this.isRefreshing = false;
    this.refreshPromise = null;
    this.isHandlingExpiration = false;
  }
}

// Create singleton instance
const tokenService = new TokenService();

export default tokenService;
