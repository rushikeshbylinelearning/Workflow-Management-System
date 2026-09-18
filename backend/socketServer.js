const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

class NotificationServer {
  constructor(server) {
    const extraOrigins = (process.env.CORS_ORIGIN || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    this.io = new Server(server, {
      path: '/api/socket.io/',
      cors: {
        origin: [
          "http://localhost:5173",
          "http://localhost:5174",
          "http://localhost:5175",
          "http://localhost:5176",
          "http://localhost:5177",
          "http://workflow.bylinelms.com",
          "https://workflow.bylinelms.com",
          ...extraOrigins,
        ],
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
      },
      allowEIO3: true,
      transports: ['polling', 'websocket']
    });
    
    this.adminSockets = new Map(); // Map admin IDs to socket IDs
    this.teamSockets = new Map();  // Map team member IDs to socket IDs
    this.pendingNotifications = []; // Queue for notifications when no admins are connected
    
    this.setupMiddleware();
    this.setupEventHandlers();
    
    console.log('🚀 WebSocket notification server initialized');
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id.toString(); // Ensure userId is always a string
        socket.userType = decoded.type;
        next();
      } catch (error) {
        return next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 User connected: ${socket.userId} (${socket.userType})`);
      console.log(`🔍 Debug: Before connection - Admin sockets: ${this.adminSockets.size}, Team sockets: ${this.teamSockets.size}`);
      
      // Store socket reference based on user type
      if (socket.userType === 'admin') {
        this.adminSockets.set(socket.userId, socket.id);
        console.log(`👑 Admin ${socket.userId} connected (socket: ${socket.id})`);
        
        // Deliver any pending notifications to the newly connected admin
        if (this.pendingNotifications.length > 0) {
          console.log(`📋 Delivering ${this.pendingNotifications.length} pending notifications to admin ${socket.userId}`);
          this.pendingNotifications.forEach((notification, index) => {
            console.log(`📋 Delivering pending notification ${index + 1}/${this.pendingNotifications.length}`);
            this.io.to(socket.id).emit(notification.event, notification.data);
          });
          console.log(`📋 All pending notifications delivered to admin ${socket.userId}`);
          this.pendingNotifications = []; // Clear the queue
        }
      } else if (socket.userType === 'team') {
        this.teamSockets.set(socket.userId, socket.id);
        console.log(`👤 Team member ${socket.userId} connected (socket: ${socket.id})`);
      }
      
      console.log(`🔍 Debug: After connection - Admin sockets: ${this.adminSockets.size}, Team sockets: ${this.teamSockets.size}`);

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`🔌 User disconnected: ${socket.userId} (${socket.userType}) - Reason: ${reason}`);
        console.log(`🔍 Debug: Before disconnect - Admin sockets: ${this.adminSockets.size}, Team sockets: ${this.teamSockets.size}`);
        console.log(`🔍 Debug: Disconnect reason: ${reason}`);
        
        if (socket.userType === 'admin') {
          this.adminSockets.delete(socket.userId);
          console.log(`🔍 Debug: Removed admin ${socket.userId} from adminSockets`);
        } else if (socket.userType === 'team') {
          this.teamSockets.delete(socket.userId);
          console.log(`🔍 Debug: Removed team member ${socket.userId} from teamSockets`);
        }
        
        console.log(`🔍 Debug: After disconnect - Admin sockets: ${this.adminSockets.size}, Team sockets: ${this.teamSockets.size}`);
        
        // Log if this is a frequent disconnection pattern
        if (reason === 'transport close' || reason === 'client namespace disconnect') {
          console.log(`⚠️ Frequent disconnection detected for user ${socket.userId} (${socket.userType}) - Reason: ${reason}`);
        }
      });

      // Handle admin joining specific project rooms
      socket.on('join-project', (projectId) => {
        socket.join(`project-${projectId}`);
        console.log(`👑 Admin ${socket.userId} joined project ${projectId}`);
      });

      // Handle team member joining their assigned project rooms
      socket.on('join-assigned-projects', (projectIds) => {
        console.log(`🔗 Team member ${socket.userId} attempting to join projects:`, projectIds);
        projectIds.forEach(projectId => {
          socket.join(`project-${projectId}`);
          console.log(`✅ Team member ${socket.userId} joined project room: project-${projectId}`);
        });
        console.log(`👤 Team member ${socket.userId} joined ${projectIds.length} projects`);
      });
    });
  }

  // Broadcast notification to all admins
  broadcastToAdmins(event, data) {
    console.log(`🔍 Debug: Broadcasting ${event} to ${this.adminSockets.size} admins`);
    console.log(`🔍 Debug: Admin socket IDs:`, Array.from(this.adminSockets.keys()));
    
    if (this.adminSockets.size === 0) {
      // No admins connected, queue the notification
      console.log(`📋 No admins connected, queuing notification for later delivery`);
      this.pendingNotifications.push({ event, data, timestamp: new Date().toISOString() });
      console.log(`📋 Queued notification. Total pending: ${this.pendingNotifications.length}`);
      return;
    }
    
    this.adminSockets.forEach((socketId, adminId) => {
      console.log(`🔍 Debug: Sending to admin ${adminId} (socket: ${socketId})`);
      this.io.to(socketId).emit(event, data);
    });
    console.log(`📢 Broadcasted ${event} to ${this.adminSockets.size} admins`);
  }

  // Get connected clients count
  getConnectedClients() {
    return this.adminSockets.size + this.teamSockets.size;
  }

  // Broadcast notification to specific project room
  broadcastToProject(projectId, event, data) {
    this.io.to(`project-${projectId}`).emit(event, data);
    console.log(`📢 Broadcasted ${event} to project ${projectId}`);
  }

  // Send notification to specific user
  sendToUser(userId, userType, event, data) {
    try {
      const userIdStr = userId.toString(); // Ensure userId is a string
      console.log(`🔍 Debug: sendToUser called with userId: ${userIdStr}, userType: ${userType}, event: ${event}`);
      
      const socketId = userType === 'admin' 
        ? this.adminSockets.get(userIdStr)
        : this.teamSockets.get(userIdStr);
      
      console.log(`🔍 Debug: Found socketId: ${socketId} for user ${userIdStr}`);
      
      if (socketId) {
        this.io.to(socketId).emit(event, data);
        console.log(`📱 Sent ${event} to ${userType} ${userIdStr} (socket: ${socketId})`);
        
        // Verify the socket is still connected
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket && socket.connected) {
          console.log(`✅ Socket ${socketId} is still connected and active`);
        } else {
          console.log(`❌ Socket ${socketId} is not connected or active`);
        }
      } else {
        console.log(`⚠️ User ${userIdStr} (${userType}) not connected`);
        console.log(`🔍 Debug: Available ${userType} sockets:`, Array.from(userType === 'admin' ? this.adminSockets.keys() : this.teamSockets.keys()));
        console.log(`🔍 Debug: Looking for userId: ${userIdStr} in ${userType} sockets`);
      }
    } catch (error) {
      console.error('❌ Error in sendToUser:', error);
      console.error('❌ Error stack:', error.stack);
    }
  }

  // Notify all team members assigned to a specific task
  async notifyTaskAssignees(taskId, event, data) {
    try {
      // Import db here to avoid circular dependency
      const db = require('./db');
      
      // Get all assignees for this specific task
      const assigneesQuery = `
        SELECT ta.assignee_id, ta.assignee_type
        FROM task_assignees ta
        WHERE ta.task_id = ?
      `;
      
      const assignees = await db.query(assigneesQuery, [taskId]);
      
      console.log(`📋 Found ${assignees.length} assignees for task ${taskId}:`, assignees);
      
      // Send notification to each assignee
      for (const assignee of assignees) {
        if (assignee.assignee_type === 'team') {
          // Send to team member
          this.sendToUser(assignee.assignee_id, 'team', event, data);
        } else if (assignee.assignee_type === 'admin') {
          // Send to admin (though they already get it via broadcastToAdmins)
          this.sendToUser(assignee.assignee_id, 'admin', event, data);
        }
      }
      
      console.log(`📢 Task assignee notification: ${event} sent to ${assignees.length} assignees for task ${taskId}`);
    } catch (error) {
      console.error('Error notifying task assignees:', error);
    }
  }

  // Notify about new extension request
  async notifyExtensionRequest(extensionData) {
    const notification = {
      type: 'extension_request',
      title: 'New Extension Request',
      message: `${extensionData.requester_name} requested an extension for "${extensionData.task_name}"`,
      data: extensionData,
      timestamp: new Date().toISOString(),
      priority: 'high'
    };

    // Broadcast to all admins (they can see all extension requests)
    this.broadcastToAdmins('new-notification', notification);
    
    // Get task assignees and notify only them
    await this.notifyTaskAssignees(extensionData.task_id, 'new-notification', notification);
    
    console.log(`📢 Extension notification sent to ${this.adminSockets.size} admins and task assignees for task ${extensionData.task_id}`);
  }

  // Notify about new remark
  async notifyNewRemark(remarkData) {
    const notification = {
      type: 'new_remark',
      title: 'New Task Remark',
      message: `${remarkData.user_name} added a remark to "${remarkData.task_name}"`,
      data: remarkData,
      timestamp: new Date().toISOString(),
      priority: 'medium'
    };

    // Broadcast to all admins (they can see all remarks)
    this.broadcastToAdmins('new-notification', notification);
    
    // Get task assignees and notify only them
    await this.notifyTaskAssignees(remarkData.task_id, 'new-notification', notification);
    
    console.log(`📢 Remark notification sent to ${this.adminSockets.size} admins and task assignees for task ${remarkData.task_id}`);
  }

  // Notify about extension review (to team member)
  async notifyExtensionReview(extensionData) {
    const notification = {
      type: 'extension_reviewed',
      title: 'Extension Request Reviewed',
      message: `Extension request for "${extensionData.task_name}" has been ${extensionData.status}`,
      data: extensionData,
      timestamp: new Date().toISOString(),
      priority: extensionData.status === 'approved' ? 'low' : 'high'
    };

    // Send to the team member who requested the extension
    this.sendToUser(extensionData.requested_by, extensionData.requested_by_type, 'new-notification', notification);
    
    // Also notify other team members assigned to the same task
    await this.notifyTaskAssignees(extensionData.task_id, 'new-notification', notification);
    
    console.log(`📢 Extension review notification sent to requester and task assignees for task ${extensionData.task_id}`);
  }

  // Notify about task submission for review (to admins)
  async notifyTaskSubmission(submissionData) {
    const submitterName = submissionData.user_name || submissionData.submitted_by_name || 'Unknown User';
    const notification = {
      type: 'task_under_review',
      title: 'Task Submitted for Review',
      message: `${submitterName} submitted "${submissionData.task_name}" for review`,
      description: `Hierarchy: ${submissionData.hierarchy || 'No hierarchy'}\nStage: ${submissionData.stage_name || 'No stage'}`,
      data: submissionData,
      timestamp: new Date().toISOString(),
      priority: 'high'
    };

    // Broadcast to all admins (they should know about task submissions)
    this.broadcastToAdmins('new-notification', notification);
    
    // Also notify other team members assigned to the same task
    await this.notifyTaskAssignees(submissionData.task_id, 'new-notification', notification);
    
    console.log(`📢 Task submission notification sent to ${this.adminSockets.size} admins and task assignees for task ${submissionData.task_id}`);
  }

  // Notify about task completion (to admins)
  async notifyTaskCompletion(completionData) {
    const notification = {
      type: 'task_completed',
      title: 'Task Completed',
      message: `${completionData.user_name} has marked "${completionData.task_name}" as completed`,
      description: `Hierarchy: ${completionData.hierarchy}\nStage: ${completionData.stage_name}`,
      data: completionData,
      timestamp: new Date().toISOString(),
      priority: 'medium'
    };

    // Broadcast to all admins (they should know about task completions)
    this.broadcastToAdmins('new-notification', notification);
    
    // Also notify other team members assigned to the same task
    await this.notifyTaskAssignees(completionData.task_id, 'new-notification', notification);
    
    console.log(`📢 Task completion notification sent to ${this.adminSockets.size} admins and task assignees for task ${completionData.task_id}`);
  }

  async notifyTaskReturnedForRework(reviewData) {
    try {
      const dueLabel = reviewData.resubmission_deadline_label || 'the assigned date';
      const notification = {
        type: 'task_returned_for_rework',
        title: 'Task Returned For Rework',
        message: `Please resubmit by ${dueLabel}`,
        description: reviewData.review_notes
          ? `${reviewData.reviewer_name} returned "${reviewData.task_name}". ${reviewData.review_notes}`
          : `${reviewData.reviewer_name} returned "${reviewData.task_name}" for corrections.`,
        data: reviewData,
        timestamp: new Date().toISOString(),
        priority: 'high',
      };
      this.sendToUser(reviewData.assignee_id, 'team', 'new-notification', notification);
    } catch (error) {
      console.error('Error in notifyTaskReturnedForRework:', error);
    }
  }

  // Notify about task review (approve/deny)
  async notifyTaskReview(reviewData) {
    try {
      console.log(`🔍 Debug: Starting notifyTaskReview for task ${reviewData.task_id}`);
      console.log(`🔍 Debug: Review data:`, reviewData);
      
      const notification = {
        type: 'task_reviewed',
        title: `Task ${reviewData.action === 'approve' ? 'Approved ✅' : 'Denied ❌'}`,
        message: reviewData.action === 'approve' 
          ? `Admin has approved your task "${reviewData.task_name}" and it is now marked as complete!`
          : `Admin has denied your task "${reviewData.task_name}". Please make the necessary changes and resubmit.`,
        description: reviewData.action === 'approve' 
          ? `Congratulations! Your task has been approved by ${reviewData.reviewer_name} and marked as completed.` 
          : `Your task has been denied by ${reviewData.reviewer_name}. Please review the feedback and make necessary changes before resubmitting.`,
        data: reviewData,
        timestamp: new Date().toISOString(),
        priority: reviewData.action === 'approve' ? 'high' : 'medium'
      };

      console.log(`🔍 Debug: Created notification:`, notification);

      // Send to specific team member using the sendToUser method
      console.log(`🔍 Debug: Attempting to send task review notification to team member ${reviewData.assignee_name} (ID: ${reviewData.assignee_id})`);
      console.log(`🔍 Debug: Current team sockets:`, Array.from(this.teamSockets.keys()));
      console.log(`🔍 Debug: Current admin sockets:`, Array.from(this.adminSockets.keys()));
      
      this.sendToUser(reviewData.assignee_id, 'team', 'new-notification', notification);
      console.log(`📢 Task review notification sent to team member ${reviewData.assignee_name} (ID: ${reviewData.assignee_id})`);
      
    } catch (error) {
      console.error('❌ Error in notifyTaskReview:', error);
      console.error('❌ Error stack:', error.stack);
    }
  }

  // Get connected users count
  getConnectedUsersCount() {
    return {
      admins: this.adminSockets.size,
      teamMembers: this.teamSockets.size,
      total: this.adminSockets.size + this.teamSockets.size,
      pendingNotifications: this.pendingNotifications.length
    };
  }

  // Check notification system health
  checkNotificationHealth() {
    const health = {
      adminSockets: Array.from(this.adminSockets.entries()).map(([userId, socketId]) => ({
        userId,
        socketId,
        connected: this.io.sockets.sockets.get(socketId)?.connected || false
      })),
      teamSockets: Array.from(this.teamSockets.entries()).map(([userId, socketId]) => ({
        userId,
        socketId,
        connected: this.io.sockets.sockets.get(socketId)?.connected || false
      })),
      pendingNotifications: this.pendingNotifications.length,
      totalConnections: this.io.sockets.sockets.size
    };
    
    console.log('🔍 Notification System Health Check:', JSON.stringify(health, null, 2));
    return health;
  }
}

module.exports = NotificationServer;
