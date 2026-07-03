import { requestProjectTasksRefresh, requestTasksListRefresh } from '../utils/taskManagerCache';

const API_URL = import.meta.env.VITE_API_URL || 'https://workflow.bylinelms.com/api';

export interface RealTimeNotification {
  type:
    | 'extension_request'
    | 'new_remark'
    | 'extension_reviewed'
    | 'task_under_review'
    | 'task_completed'
    | 'task_reviewed';
  title: string;
  message: string;
  data: any;
  timestamp: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ProjectTaskUpdateEvent {
  project_id: number;
  task_id: number | null;
  action: string;
  timestamp: string;
}

class NotificationService {
  private eventSource: EventSource | null = null;
  private isConnected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;
  private maxReconnectDelay = 30000;
  private token: string | null = null;
  private userType: 'admin' | 'team' | null = null;

  private notificationListeners: ((n: RealTimeNotification) => void)[] = [];
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private projectTaskUpdateListeners: ((update: ProjectTaskUpdateEvent) => void)[] = [];

  // Connect to SSE stream
  connect(token: string, _userType: 'admin' | 'team') {
    if (this.eventSource) return; // already connected

    this.token = token;
    this._open();
  }

  private _open() {
    if (!this.token) return;

    const url = `${API_URL}/notifications/stream?token=${encodeURIComponent(this.token)}`;

    this.eventSource = new EventSource(url);

    this.eventSource.addEventListener('connected', () => {
      this.isConnected = true;
      this.reconnectDelay = 2000; // reset backoff
      this._notifyConnection(true);
      this._requestNotificationPermission();
    });

    this.eventSource.addEventListener('new-notification', (e: MessageEvent) => {
      try {
        const notification: RealTimeNotification = JSON.parse(e.data);
        this._showBrowserNotification(notification);
        this.notificationListeners.forEach(cb => {
          try { cb(notification); } catch { /* ignore */ }
        });
        this._handleTaskRelatedNotification(notification);
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });

    this.eventSource.addEventListener('project-task-updated', (e: MessageEvent) => {
      try {
        const update: ProjectTaskUpdateEvent = JSON.parse(e.data);
        requestProjectTasksRefresh(update.project_id, {
          taskId: update.task_id,
          action: update.action,
        });
        requestTasksListRefresh();
        this.projectTaskUpdateListeners.forEach((cb) => {
          try { cb(update); } catch { /* ignore */ }
        });
      } catch (err) {
        console.error('SSE project-task-updated parse error:', err);
      }
    });

    this.eventSource.onerror = () => {
      this.isConnected = false;
      this._notifyConnection(false);
      this.eventSource?.close();
      this.eventSource = null;
      this._scheduleReconnect();
    };
  }

  private _scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._open();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.eventSource?.close();
    this.eventSource = null;
    this.token = null;
    this.userType = null;
    this.isConnected = false;
    this._notifyConnection(false);
  }

  // These are no-ops now (SSE is server-push only, no client rooms needed)
  joinProject(_projectId: string) {}
  joinAssignedProjects(_projectIds: string[]) {}

  onNotification(callback: (n: RealTimeNotification) => void) {
    this.notificationListeners.push(callback);
    return () => {
      const i = this.notificationListeners.indexOf(callback);
      if (i > -1) this.notificationListeners.splice(i, 1);
    };
  }

  onProjectTaskUpdate(callback: (update: ProjectTaskUpdateEvent) => void) {
    this.projectTaskUpdateListeners.push(callback);
    return () => {
      const i = this.projectTaskUpdateListeners.indexOf(callback);
      if (i > -1) this.projectTaskUpdateListeners.splice(i, 1);
    };
  }

  private _handleTaskRelatedNotification(notification: RealTimeNotification) {
    const data = notification.data || {};
    const projectId = data.project_id ?? data.projectId;
    const taskId = data.task_id ?? data.taskId ?? data.id;

    if (projectId != null) {
      requestProjectTasksRefresh(projectId, { taskId, action: notification.type });
      return;
    }

    if (
      taskId != null &&
      ['task_under_review', 'task_completed', 'task_reviewed', 'extension_request', 'extension_reviewed', 'new_remark'].includes(notification.type)
    ) {
      requestTasksListRefresh();
    }
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.connectionListeners.push(callback);
    return () => {
      const i = this.connectionListeners.indexOf(callback);
      if (i > -1) this.connectionListeners.splice(i, 1);
    };
  }

  testConnection(): boolean {
    return this.isConnected;
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      notificationListeners: this.notificationListeners.length,
      connectionListeners: this.connectionListeners.length,
    };
  }

  private _notifyConnection(connected: boolean) {
    this.connectionListeners.forEach(cb => { try { cb(connected); } catch { /* ignore */ } });
  }

  private async _requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => {});
    }
  }

  private _showBrowserNotification(notification: RealTimeNotification) {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      this._requestNotificationPermission().then(() => this._showBrowserNotification(notification));
      return;
    }

    if (Notification.permission === 'denied') {
      this._showPermissionDeniedMessage();
      return;
    }

    try {
      const n = new Notification(notification.title, {
        body: notification.message,
        icon: '/logo.png',
        tag: `notification-${notification.type}-${notification.data?.id ?? 'unknown'}`,
        requireInteraction: notification.priority === 'high',
        silent: false,
      });

      if (notification.priority === 'low') setTimeout(() => n.close(), 5000);

      n.onclick = () => { window.focus(); n.close(); };
    } catch (err) {
      console.error('Failed to show browser notification:', err);
    }
  }

  private _showPermissionDeniedMessage() {
    const div = document.createElement('div');
    div.innerHTML = `
      <div style="position:fixed;top:20px;right:20px;background:#ef4444;color:white;padding:12px 16px;
        border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:10000;font-family:system-ui,sans-serif;
        font-size:14px;max-width:300px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span>🔔</span>
          <span>Notifications are disabled. Please enable them in your browser settings.</span>
        </div>
        <button onclick="this.parentElement.parentElement.remove()"
          style="position:absolute;top:4px;right:8px;background:none;border:none;color:white;cursor:pointer;font-size:18px;">×</button>
      </div>`;
    document.body.appendChild(div);
    setTimeout(() => div.parentElement && div.remove(), 8000);
  }
}

const notificationService = new NotificationService();
export default notificationService;
