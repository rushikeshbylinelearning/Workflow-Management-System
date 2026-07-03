const jwt = require('jsonwebtoken');

class SSENotificationServer {
  constructor() {
    this.adminClients = new Map();  // userId -> res
    this.teamClients = new Map();   // userId -> res
    this.pendingNotifications = [];
    console.log('🚀 SSE notification server initialized');
  }

  // Express middleware — clients connect here
  handleConnection(req, res) {
    const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = decoded.id.toString();
    const userType = decoded.type; // 'admin' | 'team'

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx/LiteSpeed buffering
    res.flushHeaders();

    // Send a connected confirmation event
    this._send(res, 'connected', { userId, userType });

    // Register client
    if (userType === 'admin') {
      this.adminClients.set(userId, res);
      console.log(`👑 Admin ${userId} connected via SSE`);

      // Flush pending notifications
      if (this.pendingNotifications.length > 0) {
        this.pendingNotifications.forEach(n => this._send(res, n.event, n.data));
        this.pendingNotifications = [];
      }
    } else {
      this.teamClients.set(userId, res);
      console.log(`👤 Team member ${userId} connected via SSE`);
    }

    // Heartbeat every 25s to keep connection alive through proxies
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 25000);

    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      if (userType === 'admin') {
        this.adminClients.delete(userId);
        console.log(`👑 Admin ${userId} disconnected from SSE`);
      } else {
        this.teamClients.delete(userId);
        console.log(`👤 Team member ${userId} disconnected from SSE`);
      }
    });
  }

  // Low-level SSE write
  _send(res, event, data) {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error('SSE write error:', err.message);
    }
  }

  // Send to a specific user
  sendToUser(userId, userType, event, data) {
    const userIdStr = userId.toString();
    const client = userType === 'admin'
      ? this.adminClients.get(userIdStr)
      : this.teamClients.get(userIdStr);

    if (client) {
      this._send(client, event, data);
      console.log(`📱 SSE ${event} → ${userType} ${userIdStr}`);
    } else {
      console.log(`⚠️ ${userType} ${userIdStr} not connected`);
    }
  }

  // Broadcast to all admins
  broadcastToAdmins(event, data) {
    if (this.adminClients.size === 0) {
      this.pendingNotifications.push({ event, data, timestamp: new Date().toISOString() });
      console.log(`📋 Queued notification (no admins). Total pending: ${this.pendingNotifications.length}`);
      return;
    }
    this.adminClients.forEach((res, adminId) => {
      this._send(res, event, data);
    });
    console.log(`📢 SSE ${event} → ${this.adminClients.size} admins`);
  }

  getConnectedClients() {
    return this.adminClients.size + this.teamClients.size;
  }

  getConnectedUsersCount() {
    return {
      admins: this.adminClients.size,
      teamMembers: this.teamClients.size,
      total: this.adminClients.size + this.teamClients.size,
      pendingNotifications: this.pendingNotifications.length
    };
  }

  // ── Notification helpers (same API as socketServer.js) ──────────────────

  async notifyTaskAssignees(taskId, event, data) {
    try {
      const db = require('./db');
      const assignees = await db.query(
        'SELECT ta.assignee_id, ta.assignee_type FROM task_assignees ta WHERE ta.task_id = ?',
        [taskId]
      );
      for (const a of assignees) {
        this.sendToUser(a.assignee_id, a.assignee_type, event, data);
      }
    } catch (err) {
      console.error('Error notifying task assignees:', err);
    }
  }

  async notifyExtensionRequest(extensionData) {
    const notification = {
      type: 'extension_request',
      title: 'New Extension Request',
      message: `${extensionData.requester_name} requested an extension for "${extensionData.task_name}"`,
      data: extensionData,
      timestamp: new Date().toISOString(),
      priority: 'high'
    };
    this.broadcastToAdmins('new-notification', notification);
    await this.notifyTaskAssignees(extensionData.task_id, 'new-notification', notification);
  }

  async notifyNewRemark(remarkData) {
    const notification = {
      type: 'new_remark',
      title: 'New Task Remark',
      message: `${remarkData.user_name} added a remark to "${remarkData.task_name}"`,
      data: remarkData,
      timestamp: new Date().toISOString(),
      priority: 'medium'
    };
    this.broadcastToAdmins('new-notification', notification);
    await this.notifyTaskAssignees(remarkData.task_id, 'new-notification', notification);
  }

  async notifyExtensionReview(extensionData) {
    const notification = {
      type: 'extension_reviewed',
      title: 'Extension Request Reviewed',
      message: `Extension request for "${extensionData.task_name}" has been ${extensionData.status}`,
      data: extensionData,
      timestamp: new Date().toISOString(),
      priority: extensionData.status === 'approved' ? 'low' : 'high'
    };
    this.sendToUser(extensionData.requested_by, extensionData.requested_by_type, 'new-notification', notification);
    await this.notifyTaskAssignees(extensionData.task_id, 'new-notification', notification);
  }

  async notifyTaskSubmission(submissionData) {
    const submitterName = submissionData.user_name || submissionData.submitted_by_name || 'Unknown User';
    const notification = {
      type: 'task_under_review',
      title: 'Task Submitted for Review',
      message: `${submitterName} submitted "${submissionData.task_name}" for review`,
      data: submissionData,
      timestamp: new Date().toISOString(),
      priority: 'high'
    };
    this.broadcastToAdmins('new-notification', notification);
    await this.notifyTaskAssignees(submissionData.task_id, 'new-notification', notification);
  }

  async notifyTaskCompletion(completionData) {
    const notification = {
      type: 'task_completed',
      title: 'Task Completed',
      message: `${completionData.user_name} has marked "${completionData.task_name}" as completed`,
      data: completionData,
      timestamp: new Date().toISOString(),
      priority: 'medium'
    };
    this.broadcastToAdmins('new-notification', notification);
    await this.notifyTaskAssignees(completionData.task_id, 'new-notification', notification);
  }

  async notifyTaskReturnedForRework(reviewData) {
    const dueLabel = reviewData.resubmission_deadline_label || 'the assigned date';
    const notification = {
      type: 'task_returned_for_rework',
      title: 'Task Returned For Rework',
      message: `Please resubmit by ${dueLabel}`,
      description: reviewData.review_notes || `Task "${reviewData.task_name}" was returned for rework.`,
      data: reviewData,
      timestamp: new Date().toISOString(),
      priority: 'high',
    };
    this.sendToUser(reviewData.assignee_id, 'team', 'new-notification', notification);
  }

  async notifyTaskReview(reviewData) {
    const notification = {
      type: 'task_reviewed',
      title: `Task ${reviewData.action === 'approve' ? 'Approved ✅' : 'Denied ❌'}`,
      message: reviewData.action === 'approve'
        ? `Admin has approved your task "${reviewData.task_name}" and it is now marked as complete!`
        : `Admin has denied your task "${reviewData.task_name}". Please make the necessary changes and resubmit.`,
      data: reviewData,
      timestamp: new Date().toISOString(),
      priority: reviewData.action === 'approve' ? 'high' : 'medium'
    };
    this.sendToUser(reviewData.assignee_id, 'team', 'new-notification', notification);
  }

  notifyProjectTaskUpdate({ project_id, task_id = null, action = 'updated' }) {
    const payload = {
      project_id: Number(project_id),
      task_id: task_id != null ? Number(task_id) : null,
      action,
      timestamp: new Date().toISOString(),
    };
    this.broadcastToAdmins('project-task-updated', payload);
  }
}

module.exports = SSENotificationServer;
