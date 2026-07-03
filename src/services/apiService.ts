// Modern API service for the new Node.js backend
// Dynamically detect the API URL based on the current domain
const getApiUrl = () => {
  // If environment variable is set, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Fallback for local development
  return 'https://workflow.bylinelms.com/api';
};

const API_URL = getApiUrl();

// Helper function to get auth headers.
// Project Managers use teamToken (no admin access_token). Fall back to teamToken
// so admin components work correctly inside the PM portal.
const getAuthHeaders = () => {
  const token = sessionStorage.getItem('access_token') || sessionStorage.getItem('teamToken');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
  return headers;
};

// Helper function to get team auth headers
const getTeamAuthHeaders = () => {
  const token = sessionStorage.getItem('teamToken');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
  return headers;
};

// Helper function to handle API responses
const handleResponse = async (response: Response) => {
  const data = await response.json();

  if (!response.ok) {
    const message = data.error?.message || data.message || 'API request failed';
    const details = data.error?.details;
    const detailMessage = Array.isArray(details) && details.length > 0
      ? details.map((d: { msg?: string }) => d.msg).filter(Boolean).join('; ')
      : null;
    const error = new Error(detailMessage || message) as Error & { details?: unknown };
    error.details = details;
    throw error;
  }

  return data;
};

// Simple fetch wrapper with timeout and meaningful error messages
const simpleFetch = async (url: string, options: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 100000); // 100 second timeout

  try {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store',
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(
        `Request timed out. Make sure the backend server is running at ${API_URL.replace('/api', '')} (port ${new URL(API_URL).port || 80}).`
      );
    }
    if (err.message === 'Failed to fetch') {
      throw new Error(
        `Cannot connect to backend at ${API_URL}. Please ensure the backend server is running.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Generic API methods
// ─────────────────────────────────────────────────────────────────────────────
export const apiService = {
  get: async (endpoint: string) => {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  post: async (endpoint: string, data: any) => {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  put: async (endpoint: string, data: any) => {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  patch: async (endpoint: string, data: any) => {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (endpoint: string) => {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// Team API service — uses teamToken only
const teamApiService = {
  get: async (endpoint: string) => {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers: getTeamAuthHeaders(),
    });
    return handleResponse(response);
  },

  post: async (endpoint: string, data: any) => {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getTeamAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  put: async (endpoint: string, data: any) => {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getTeamAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (endpoint: string) => {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getTeamAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: safely extract an array from a paginated-or-plain response.
// Backend returns { success, data: [...], pagination } for list endpoints.
// Some older callers may receive a plain array — this handles both.
// ─────────────────────────────────────────────────────────────────────────────
const extractArray = (response: any): any[] => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  return [];
};

// ─────────────────────────────────────────────────────────────────────────────
// Team-specific project service  (uses teamToken)
// ─────────────────────────────────────────────────────────────────────────────
export const teamProjectService = {
  // Returns the array of projects directly
  getAll: async (filters?: any): Promise<any[]> => {
    const queryParams = new URLSearchParams(filters).toString();
    const endpoint = queryParams ? `/projects?${queryParams}` : '/projects';
    const result = await teamApiService.get(endpoint);
    return extractArray(result);
  },

  getById: async (id: string | number): Promise<any> => {
    const result = await teamApiService.get(`/projects/${id}`);
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Team Service
// ─────────────────────────────────────────────────────────────────────────────
export const teamService = {
  getAll: async (): Promise<any[]> => {
    const result = await apiService.get('/team');
    return result.data ?? result;
  },

  // Team member specific methods (uses team auth)
  getMyTasks: async (): Promise<any[]> => {
    const result = await teamApiService.get('/team/my-tasks');
    return result.data ?? result;
  },

  getMyProfile: async (): Promise<any> => {
    const result = await teamApiService.get('/team/my-profile');
    return result.data ?? result;
  },

  getMyPerformanceFlags: async (): Promise<any[]> => {
    const result = await teamApiService.get('/team/my-performance-flags');
    return result.data ?? result;
  },

  getById: async (id: string): Promise<any> => {
    const result = await apiService.get(`/team/${id}`);
    return result.data ?? result;
  },

  create: async (data: any): Promise<any> => {
    const result = await apiService.post('/team', data);
    return result.data ?? result;
  },

  update: async (id: string, data: any): Promise<any> => {
    const result = await apiService.put(`/team/${id}`, data);
    return result.data ?? result;
  },

  delete: async (id: string): Promise<any> => {
    const result = await apiService.delete(`/team/${id}`);
    return result.data ?? result;
  },

  getMembers: async (): Promise<any[]> => {
    const result = await apiService.get('/team/members');
    return result.data ?? result;
  },

  getTeams: async (): Promise<any[]> => {
    const result = await apiService.get('/team/teams');
    return result.data ?? result;
  },

  getMembersWithPerformanceRanking: async (teamId?: number): Promise<any[]> => {
    const url = teamId
      ? `/team/members/performance-ranking?teamId=${teamId}&t=${Date.now()}`
      : `/team/members/performance-ranking?t=${Date.now()}`;
    const result = await apiService.get(url);
    return result.data ?? result;
  },

  getMemberFlags: async (memberId: number): Promise<any[]> => {
    const result = await apiService.get(`/team/members/${memberId}/flags`);
    return result.data ?? result;
  },

  removeFlag: async (flagId: number): Promise<any> => {
    const result = await apiService.delete(`/team/flags/${flagId}`);
    return result.data ?? result;
  },

  getMemberById: async (id: string): Promise<any> => {
    const result = await apiService.get(`/team/members/${id}`);
    return result.data ?? result;
  },

  createMember: async (data: any): Promise<any> => {
    const result = await apiService.post('/team/members', data);
    return result.data ?? result;
  },

  updateMember: async (id: string, data: any): Promise<any> => {
    const result = await apiService.put(`/team/members/${id}`, data);
    return result.data ?? result;
  },

  deleteMember: async (id: string): Promise<any> => {
    const result = await apiService.delete(`/team/members/${id}`);
    return result.data ?? result;
  },

  getTeamById: async (id: string): Promise<any> => {
    const result = await apiService.get(`/team/teams/${id}`);
    return result.data ?? result;
  },

  createTeam: async (data: any): Promise<any> => {
    const result = await apiService.post('/team/teams', data);
    return result.data ?? result;
  },

  updateTeam: async (id: string, data: any): Promise<any> => {
    const result = await apiService.put(`/team/teams/${id}`, data);
    return result.data ?? result;
  },

  deleteTeam: async (id: string): Promise<any> => {
    const result = await apiService.delete(`/team/teams/${id}`);
    return result.data ?? result;
  },

  addMemberToTeam: async (teamId: string, data: any): Promise<any> => {
    const result = await apiService.post(`/team/teams/${teamId}/members`, data);
    return result.data ?? result;
  },

  removeMemberFromTeam: async (teamId: string, memberId: string): Promise<any> => {
    const result = await apiService.delete(`/team/teams/${teamId}/members/${memberId}`);
    return result.data ?? result;
  },

  getTeamMembers: async (teamId: string): Promise<any[]> => {
    const result = await apiService.get(`/team/teams/${teamId}`);
    return result.data?.members ?? result.members ?? [];
  },

  authenticate: async (credentials: { email: string; passcode: string }): Promise<any> => {
    const result = await apiService.post('/team/authenticate', credentials);
    return result;
  },

  toggleMemberStatus: async (id: string, is_active: boolean): Promise<any> => {
    const result = await apiService.patch(`/team/members/${id}/status`, { is_active });
    return result.data ?? result;
  },

  bulkUpdateMembersStatus: async (member_ids: number[], is_active: boolean): Promise<any> => {
    const result = await apiService.patch('/team/members/bulk/status', { member_ids, is_active });
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Project Service
// FIX: getAll now consistently returns the full server response
// { success, data: Project[], pagination } so callers can access both
// .data (the array) and .pagination. All other methods return .data directly.
// ─────────────────────────────────────────────────────────────────────────────
export const projectService = {
  // Returns the full paginated response: { success, data: Project[], pagination }
  // Callers should access .data for the array.
  getAll: async (filters?: any): Promise<{ success: boolean; data: any[]; pagination?: any }> => {
    const params = { limit: '500', ...filters };
    const queryParams = new URLSearchParams(params).toString();
    const endpoint = `/projects?${queryParams}`;
    const result = await apiService.get(endpoint);
    // Normalise: always return an object with a `data` array
    return {
      success: result?.success ?? true,
      data: extractArray(result),
      pagination: result?.pagination ?? null,
    };
  },

  getById: async (id: string | number): Promise<any> => {
    const result = await apiService.get(`/projects/${id}`);
    return result.data ?? result;
  },

  create: async (projectData: any): Promise<any> => {
    const result = await apiService.post('/projects', projectData);
    return result.data ?? result;
  },

  update: async (id: string | number, projectData: any): Promise<any> => {
    const result = await apiService.put(`/projects/${id}`, projectData);
    return result.data ?? result;
  },

  delete: async (id: string | number): Promise<any> => {
    const result = await apiService.delete(`/projects/${id}`);
    return result.data ?? result;
  },

  getMembers: async (id: string | number): Promise<any[]> => {
    const result = await apiService.get(`/projects/${id}/members`);
    return result.data ?? result;
  },

  getTeams: async (id: string | number): Promise<any[]> => {
    const result = await apiService.get(`/projects/${id}/teams`);
    return result.data ?? result;
  },

  addMember: async (projectId: string | number, memberData: any): Promise<any> => {
    const result = await apiService.post(`/projects/${projectId}/members`, memberData);
    return result.data ?? result;
  },

  addTeam: async (projectId: string | number, teamData: any): Promise<any> => {
    const result = await apiService.post(`/projects/${projectId}/members`, teamData);
    return result.data ?? result;
  },

  removeMember: async (projectId: string | number, memberId: string | number): Promise<any> => {
    const result = await apiService.delete(`/projects/${projectId}/members/${memberId}`);
    return result.data ?? result;
  },

  removeTeam: async (projectId: string | number, teamId: string | number): Promise<any> => {
    const result = await apiService.delete(`/projects/${projectId}/teams/${teamId}`);
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Category Service
// ─────────────────────────────────────────────────────────────────────────────
export const categoryService = {
  getAll: async (): Promise<any[]> => {
    const result = await apiService.get('/categories');
    return result.data ?? result;
  },

  getById: async (id: string | number): Promise<any> => {
    const result = await apiService.get(`/categories/${id}`);
    return result.data ?? result;
  },

  create: async (categoryData: any): Promise<any> => {
    const result = await apiService.post('/categories', categoryData);
    return result.data ?? result;
  },

  update: async (id: string | number, categoryData: any): Promise<any> => {
    const result = await apiService.put(`/categories/${id}`, categoryData);
    return result.data ?? result;
  },

  delete: async (id: string | number): Promise<any> => {
    const result = await apiService.delete(`/categories/${id}`);
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Skills Service
// ─────────────────────────────────────────────────────────────────────────────
export const skillService = {
  getAll: async (): Promise<any[]> => {
    const result = await apiService.get('/skills');
    return result.data ?? result;
  },

  getById: async (id: string | number): Promise<any> => {
    const result = await apiService.get(`/skills/${id}`);
    return result.data ?? result;
  },

  create: async (skillData: any): Promise<any> => {
    const result = await apiService.post('/skills', skillData);
    return result.data ?? result;
  },

  update: async (id: string | number, skillData: any): Promise<any> => {
    const result = await apiService.put(`/skills/${id}`, skillData);
    return result.data ?? result;
  },

  delete: async (id: string | number): Promise<any> => {
    const result = await apiService.delete(`/skills/${id}`);
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Task Service
// FIX: getAll returns the full paginated response (same pattern as projectService)
// so callers can access .data for the array.
// ─────────────────────────────────────────────────────────────────────────────
export const taskService = {
  // Returns the full paginated response: { success, data: Task[], pagination }
  getAll: async (filters?: any): Promise<{ success: boolean; data: any[]; pagination?: any }> => {
    const queryParams = filters ? new URLSearchParams(filters).toString() : '';
    const endpoint = queryParams ? `/tasks?${queryParams}` : '/tasks';
    const result = await apiService.get(endpoint);
    return {
      success: result?.success ?? true,
      data: extractArray(result),
      pagination: result?.pagination ?? null,
    };
  },

  getById: async (id: string | number): Promise<any> => {
    const result = await apiService.get(`/tasks/${id}`);
    return result.data ?? result;
  },

  create: async (taskData: any): Promise<any> => {
    const result = await apiService.post('/tasks', taskData);
    return result.data ?? result;
  },

  update: async (id: string | number, taskData: any): Promise<any> => {
    const result = await apiService.put(`/tasks/${id}`, taskData);
    return result.data ?? result;
  },

  delete: async (id: string | number): Promise<any> => {
    const result = await apiService.delete(`/tasks/${id}`);
    return result.data ?? result;
  },

  bulkDelete: async (taskIds: (string | number)[]): Promise<any> => {
    const response = await simpleFetch(`${API_URL}/tasks/bulk`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ taskIds }),
    });
    return handleResponse(response);
  },

  bulkAssign: async (data: {
    assignee_id: number;
    assignee_type?: 'admin' | 'team';
    task_ids?: number[];
    project_id?: number;
  }): Promise<any> => {
    const result = await apiService.post('/tasks/bulk-assign', data);
    return result;
  },

  getByProject: async (projectId: string | number): Promise<any[]> => {
    const result = await apiService.get(`/tasks?project_id=${projectId}`);
    return extractArray(result);
  },

  getByAssignee: async (assigneeId: string | number, assigneeType: 'admin' | 'team'): Promise<any[]> => {
    const result = await apiService.get(`/tasks?assignee_id=${assigneeId}&assignee_type=${assigneeType}`);
    return extractArray(result);
  },

  updateStatus: async (id: string | number, status: string, progress?: number): Promise<any> => {
    const data: any = { status };
    if (progress !== undefined) data.progress = progress;
    const result = await apiService.put(`/tasks/${id}`, data);
    return result.data ?? result;
  },

  updateProgress: async (id: string | number, progress: number): Promise<any> => {
    const result = await apiService.put(`/tasks/${id}`, { progress });
    return result.data ?? result;
  },

  reviewTask: async (
    taskId: string | number,
    action: 'approve' | 'deny',
    reviewNotes?: string,
    resubmissionDeadline?: string
  ): Promise<any> => {
    const body: Record<string, string> = {
      action,
      review_notes: reviewNotes ?? '',
    };
    if (action === 'deny' && resubmissionDeadline) {
      body.resubmission_deadline = resubmissionDeadline;
    }
    const result = await apiService.post(`/tasks/${taskId}/review`, body);
    return result.data ?? result;
  },

  // Task Extensions
  requestExtension: async (taskId: string | number, data: { requested_due_date: string; reason: string }): Promise<any> => {
    const result = await apiService.post(`/tasks/${taskId}/extensions`, data);
    return result.data ?? result;
  },

  getExtensions: async (taskId: string | number): Promise<any[]> => {
    const result = await apiService.get(`/tasks/${taskId}/extensions`);
    return result.data ?? result;
  },

  reviewExtension: async (extensionId: string | number, data: { status: 'approved' | 'rejected'; review_notes?: string }): Promise<any> => {
    const result = await apiService.put(`/tasks/extensions/${extensionId}/review`, data);
    return result.data ?? result;
  },

  // Task Remarks
  addRemark: async (taskId: string | number, data: {
    remark: string;
    remark_date?: string;
    remark_type?: string;
    is_private?: boolean;
    server_location?: string;
    file_name?: string;
  }): Promise<any> => {
    const result = await apiService.post(`/tasks/${taskId}/remarks`, data);
    return result.data ?? result;
  },

  getRemarks: async (taskId: string | number): Promise<any[]> => {
    const result = await apiService.get(`/tasks/${taskId}/remarks`);
    return result.data ?? result;
  },

  getRemarksHistory: async (
    taskId: string | number,
    params?: { page?: number; limit?: number }
  ): Promise<{ timeline: any[]; pagination?: { page: number; limit: number; total: number; hasMore: boolean } }> => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    const result = await apiService.get(`/tasks/${taskId}/remarks-history${qs ? `?${qs}` : ''}`);
    const payload = result.data ?? result;
    return {
      timeline: payload.timeline ?? [],
      pagination: payload.pagination,
    };
  },

  deleteRemark: async (remarkId: string | number): Promise<any> => {
    const result = await apiService.delete(`/tasks/remarks/${remarkId}`);
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Team-specific task service  (uses teamToken)
// ─────────────────────────────────────────────────────────────────────────────
export const teamTaskService = {
  getById: async (id: string | number): Promise<any> => {
    const result = await teamApiService.get(`/tasks/${id}`);
    return result.data ?? result;
  },

  update: async (id: string | number, taskData: any): Promise<any> => {
    const result = await teamApiService.put(`/tasks/${id}`, taskData);
    return result.data ?? result;
  },

  updateStatus: async (id: string | number, status: string, progress?: number): Promise<any> => {
    const data: any = { status };
    if (progress !== undefined) data.progress = progress;
    const result = await teamApiService.put(`/tasks/${id}`, data);
    return result.data ?? result;
  },

  updateProgress: async (id: string | number, progress: number): Promise<any> => {
    const result = await teamApiService.put(`/tasks/${id}`, { progress });
    return result.data ?? result;
  },

  // Task Extensions
  requestExtension: async (taskId: string | number, data: { requested_due_date: string; reason: string }): Promise<any> => {
    const result = await teamApiService.post(`/tasks/${taskId}/extensions`, data);
    return result.data ?? result;
  },

  getExtensions: async (taskId: string | number): Promise<any[]> => {
    const result = await teamApiService.get(`/tasks/${taskId}/extensions`);
    return result.data ?? result;
  },

  // Task Remarks
  addRemark: async (taskId: string | number, data: {
    remark: string;
    remark_date?: string;
    remark_type?: string;
    is_private?: boolean;
    server_location?: string;
    file_name?: string;
  }): Promise<any> => {
    const result = await teamApiService.post(`/tasks/${taskId}/remarks`, data);
    return result.data ?? result;
  },

  getRemarks: async (taskId: string | number): Promise<any[]> => {
    const result = await teamApiService.get(`/tasks/${taskId}/remarks`);
    return result.data ?? result;
  },

  getRemarksHistory: async (
    taskId: string | number,
    params?: { page?: number; limit?: number }
  ): Promise<{ timeline: any[]; pagination?: { page: number; limit: number; total: number; hasMore: boolean } }> => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    const result = await teamApiService.get(`/tasks/${taskId}/remarks-history${qs ? `?${qs}` : ''}`);
    const payload = result.data ?? result;
    return {
      timeline: payload.timeline ?? [],
      pagination: payload.pagination,
    };
  },

  deleteRemark: async (remarkId: string | number): Promise<any> => {
    const result = await teamApiService.delete(`/tasks/remarks/${remarkId}`);
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Allocation Service
// ─────────────────────────────────────────────────────────────────────────────
export const allocationService = {
  getAll: async (filters?: any): Promise<any[]> => {
    const queryParams = filters ? new URLSearchParams(filters).toString() : '';
    const endpoint = queryParams ? `/allocations?${queryParams}` : '/allocations';
    const result = await apiService.get(endpoint);
    return result.data ?? result;
  },

  getDaily: async (filters?: { start_date?: string; end_date?: string; group_by?: 'team' | 'project' }): Promise<any> => {
    const queryParams = filters ? new URLSearchParams(filters as any).toString() : '';
    const endpoint = queryParams ? `/allocations/daily?${queryParams}` : '/allocations/daily';
    const result = await apiService.get(endpoint);
    return result.data ?? result;
  },

  getById: async (id: string | number): Promise<any> => {
    const result = await apiService.get(`/allocations/${id}`);
    return result.data ?? result;
  },

  create: async (allocationData: any): Promise<any> => {
    const result = await apiService.post('/allocations', allocationData);
    return result.data ?? result;
  },

  update: async (id: string | number, allocationData: any): Promise<any> => {
    const result = await apiService.put(`/allocations/${id}`, allocationData);
    return result.data ?? result;
  },

  delete: async (id: string | number): Promise<any> => {
    const result = await apiService.delete(`/allocations/${id}`);
    return result.data ?? result;
  },

  getWorkloadSummary: async (date: string): Promise<any> => {
    const result = await apiService.get(`/allocations/workload-summary?date=${date}`);
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage Service
// ─────────────────────────────────────────────────────────────────────────────
export const stageService = {
  getAll: async (projectId?: string | number): Promise<any[]> => {
    const endpoint = projectId ? `/stages?project_id=${projectId}` : '/stages';
    const result = await apiService.get(endpoint);
    return result.data ?? result;
  },

  getById: async (id: string | number): Promise<any> => {
    const result = await apiService.get(`/stages/${id}`);
    return result.data ?? result;
  },

  create: async (stageData: any): Promise<any> => {
    const result = await apiService.post('/stages', stageData);
    return result.data ?? result;
  },

  update: async (id: string | number, stageData: any): Promise<any> => {
    const result = await apiService.put(`/stages/${id}`, stageData);
    return result.data ?? result;
  },

  delete: async (id: string | number): Promise<any> => {
    const result = await apiService.delete(`/stages/${id}`);
    return result.data ?? result;
  },

  getByCategory: async (categoryId: string | number): Promise<any[]> => {
    const result = await apiService.get(`/stages/category/${categoryId}`);
    return result.data ?? result;
  },

  reorder: async (categoryId: string | number, stageOrders: any[]): Promise<any> => {
    const result = await apiService.post(`/stages/category/${categoryId}/reorder`, { stage_orders: stageOrders });
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage Template Service
// ─────────────────────────────────────────────────────────────────────────────
export const stageTemplateService = {
  getByCategory: async (categoryId: string | number): Promise<any[]> => {
    const result = await apiService.get(`/stage-templates/category/${categoryId}`);
    return result.data ?? result;
  },

  getById: async (id: string | number): Promise<any> => {
    const result = await apiService.get(`/stage-templates/${id}`);
    return result.data ?? result;
  },

  create: async (templateData: any): Promise<any> => {
    const result = await apiService.post('/stage-templates', templateData);
    return result.data ?? result;
  },

  update: async (id: string | number, templateData: any): Promise<any> => {
    const result = await apiService.put(`/stage-templates/${id}`, templateData);
    return result.data ?? result;
  },

  delete: async (id: string | number): Promise<any> => {
    const result = await apiService.delete(`/stage-templates/${id}`);
    return result.data ?? result;
  },

  bulkCreate: async (categoryId: string | number, templates: any[]): Promise<any> => {
    const result = await apiService.post(`/stage-templates/category/${categoryId}/bulk`, { templates });
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Grade Service
// ─────────────────────────────────────────────────────────────────────────────
export const gradeService = {
  getByProject: async (projectId: string | number): Promise<any[]> => {
    const result = await apiService.get(`/grades/project/${projectId}`);
    return result.data ?? result;
  },

  getAll: async (): Promise<any[]> => {
    const result = await apiService.get('/grades');
    return result.data ?? result;
  },

  getById: async (id: string | number): Promise<any> => {
    const result = await apiService.get(`/grades/${id}`);
    return result.data ?? result;
  },

  create: async (gradeData: any): Promise<any> => {
    const result = await apiService.post('/grades', gradeData);
    return result.data ?? result;
  },

  update: async (id: string | number, gradeData: any): Promise<any> => {
    const result = await apiService.put(`/grades/${id}`, gradeData);
    return result.data ?? result;
  },

  delete: async (id: string | number): Promise<any> => {
    const result = await apiService.delete(`/grades/${id}`);
    return result.data ?? result;
  },

  distributeWeights: async (projectId: string | number): Promise<any> => {
    const result = await apiService.post('/grades/distribute-weights', { project_id: projectId });
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Book Service
// ─────────────────────────────────────────────────────────────────────────────
export const bookService = {
  getByGrade: async (gradeId: string | number): Promise<any[]> => {
    const result = await apiService.get(`/books/grade/${gradeId}`);
    return result.data ?? result;
  },

  getAll: async (): Promise<any[]> => {
    const result = await apiService.get('/books');
    return result.data ?? result;
  },

  getById: async (id: string | number): Promise<any> => {
    const result = await apiService.get(`/books/${id}`);
    return result.data ?? result;
  },

  create: async (bookData: any): Promise<any> => {
    const result = await apiService.post('/books', bookData);
    return result.data ?? result;
  },

  update: async (id: string | number, bookData: any): Promise<any> => {
    const result = await apiService.put(`/books/${id}`, bookData);
    return result.data ?? result;
  },

  delete: async (id: string | number): Promise<any> => {
    const result = await apiService.delete(`/books/${id}`);
    return result.data ?? result;
  },

  distributeWeights: async (gradeId: string | number): Promise<any> => {
    const result = await apiService.post('/books/distribute-weights', { grade_id: gradeId });
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Unit Service
// ─────────────────────────────────────────────────────────────────────────────
export const unitService = {
  getByBook: async (bookId: string | number): Promise<any[]> => {
    const result = await apiService.get(`/units/book/${bookId}`);
    return result.data ?? result;
  },

  getAll: async (): Promise<any[]> => {
    const result = await apiService.get('/units');
    return result.data ?? result;
  },

  getById: async (id: string | number): Promise<any> => {
    const result = await apiService.get(`/units/${id}`);
    return result.data ?? result;
  },

  create: async (unitData: any): Promise<any> => {
    const result = await apiService.post('/units', unitData);
    return result.data ?? result;
  },

  update: async (id: string | number, unitData: any): Promise<any> => {
    const result = await apiService.put(`/units/${id}`, unitData);
    return result.data ?? result;
  },

  delete: async (id: string | number): Promise<any> => {
    const result = await apiService.delete(`/units/${id}`);
    return result.data ?? result;
  },

  distributeWeights: async (bookId: string | number): Promise<any> => {
    const result = await apiService.post('/units/distribute-weights', { book_id: bookId });
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Lesson Service
// ─────────────────────────────────────────────────────────────────────────────
export const lessonService = {
  getByUnit: async (unitId: string | number): Promise<any[]> => {
    const result = await apiService.get(`/lessons/unit/${unitId}`);
    return result.data ?? result;
  },

  getAll: async (): Promise<any[]> => {
    const result = await apiService.get('/lessons');
    return result.data ?? result;
  },

  getById: async (id: string | number): Promise<any> => {
    const result = await apiService.get(`/lessons/${id}`);
    return result.data ?? result;
  },

  create: async (lessonData: any): Promise<any> => {
    const result = await apiService.post('/lessons', lessonData);
    return result.data ?? result;
  },

  update: async (id: string | number, lessonData: any): Promise<any> => {
    const result = await apiService.put(`/lessons/${id}`, lessonData);
    return result.data ?? result;
  },

  delete: async (id: string | number): Promise<any> => {
    const result = await apiService.delete(`/lessons/${id}`);
    return result.data ?? result;
  },

  distributeWeights: async (unitId: string | number): Promise<any> => {
    const result = await apiService.post('/lessons/distribute-weights', { unit_id: unitId });
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Service
// FIX: Uses the normalised extractArray helper so projects and tasks are always
// unwrapped to plain arrays regardless of the paginated response shape.
// ─────────────────────────────────────────────────────────────────────────────
export const dashboardService = {
  getOverview: async () => {
    try {
      const results = await Promise.allSettled([
        projectService.getAll().catch((error) => {
          console.error('❌ Projects fetch error:', error);
          return { success: false, data: [] };
        }),
        teamService.getMembers().catch((error) => {
          console.error('❌ Team members fetch error:', error);
          return [];
        }),
        categoryService.getAll().catch((error) => {
          console.error('❌ Categories fetch error:', error);
          return [];
        }),
        skillService.getAll().catch((error) => {
          console.error('❌ Skills fetch error:', error);
          return [];
        }),
        taskService.getAll({ all: 'true' }).catch((error) => {
          console.error('❌ Tasks fetch error:', error);
          return { success: false, data: [] };
        }),
      ]);

      const [projectsResult, teamMembersResult, categoriesResult, skillsResult, tasksResult] =
        results.map((r) => (r.status === 'fulfilled' ? r.value : null));

      // Both projectService.getAll and taskService.getAll now return { data: [] }
      const projects: any[] = extractArray(projectsResult);
      const tasks: any[]    = extractArray(tasksResult);
      const teamMembers: any[] = Array.isArray(teamMembersResult) ? teamMembersResult : [];
      const categories: any[]  = Array.isArray(categoriesResult)  ? categoriesResult  : [];
      const skills: any[]      = Array.isArray(skillsResult)       ? skillsResult      : [];

      const stats = {
        totalProjects:      projects.length,
        activeProjects:     projects.filter((p: any) => p.status === 'active').length,
        totalTeamMembers:   teamMembers.length,
        activeTeamMembers:  teamMembers.filter((m: any) => m.is_active !== false).length,
        totalCategories:    categories.length,
        totalSkills:        skills.length,
        totalTasks:         tasks.length,
        activeTasks:        tasks.filter((t: any) =>
          ['not-started', 'in-progress', 'under-review'].includes(t.status)).length,
        completedTasks:     tasks.filter((t: any) => t.status === 'completed').length,
        overdueTasks:       tasks.filter((t: any) =>
          new Date(t.end_date) < new Date() && t.status !== 'completed').length,
      };

      return { projects, teamMembers, tasks, categories, skills, stats };
    } catch (error) {
      console.error('Dashboard overview fetch error:', error);
      return {
        projects: [],
        teamMembers: [],
        tasks: [],
        categories: [],
        skills: [],
        stats: {
          totalProjects: 0,
          activeProjects: 0,
          totalTeamMembers: 0,
          activeTeamMembers: 0,
          totalCategories: 0,
          totalSkills: 0,
          totalTasks: 0,
          activeTasks: 0,
          completedTasks: 0,
          overdueTasks: 0,
        },
      };
    }
  },

  getRecentActivity: async (): Promise<any[]> => {
    // TODO: Implement when audit/activity log endpoint is available
    return [];
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Service (backend /api/dashboard/* endpoints)
// ─────────────────────────────────────────────────────────────────────────────
export const analyticsService = {
  getSummary: async (): Promise<any> => {
    const result = await apiService.get('/dashboard/summary');
    return result.data ?? result;
  },

  getProjects: async (filters?: Record<string, string>): Promise<any[]> => {
    const qs = filters ? `?${new URLSearchParams(filters)}` : '';
    const result = await apiService.get(`/dashboard/projects${qs}`);
    return extractArray(result);
  },

  getTasks: async (filters?: Record<string, string>): Promise<any[]> => {
    const qs = filters ? `?${new URLSearchParams(filters)}` : '';
    const result = await apiService.get(`/dashboard/tasks${qs}`);
    return extractArray(result);
  },

  getTeamPerformance: async (): Promise<any[]> => {
    const result = await apiService.get('/dashboard/team-performance');
    return extractArray(result);
  },

  getWorkload: async (date?: string): Promise<any[]> => {
    const qs = date ? `?date=${date}` : '';
    const result = await apiService.get(`/dashboard/workload${qs}`);
    return extractArray(result);
  },

  getTimeTracking: async (filters?: Record<string, string>): Promise<any> => {
    const qs = filters ? `?${new URLSearchParams(filters)}` : '';
    const result = await apiService.get(`/dashboard/time-tracking${qs}`);
    return result.data ?? result;
  },

  getOverdueTasks: async (): Promise<any[]> => {
    const result = await apiService.get('/dashboard/overdue-tasks');
    return extractArray(result);
  },

  getPerformanceFlags: async (filters?: Record<string, string>): Promise<any[]> => {
    const qs = filters ? `?${new URLSearchParams(filters)}` : '';
    const result = await apiService.get(`/dashboard/performance-flags${qs}`);
    return extractArray(result);
  },

  getEmployeeAnalytics: async (): Promise<any[]> => {
    const result = await apiService.get('/dashboard/employee-analytics');
    return extractArray(result);
  },

  getEmployeeAnalyticsDetail: async (memberId: number | string): Promise<any> => {
    const result = await apiService.get(`/dashboard/employee-analytics/${memberId}`);
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Performance Flags Service
// ─────────────────────────────────────────────────────────────────────────────
export const performanceFlagService = {
  getByTeamMember: async (teamMemberId: string): Promise<any[]> => {
    const result = await apiService.get(`/performance-flags/team-member/${teamMemberId}`);
    return result.data ?? result;
  },

  getByTask: async (taskId: string): Promise<any[]> => {
    const result = await apiService.get(`/performance-flags/task/${taskId}`);
    return result.data ?? result;
  },

  getSummary: async (teamMemberId: string): Promise<any> => {
    const result = await apiService.get(`/performance-flags/summary/${teamMemberId}`);
    return result.data ?? result;
  },

  add: async (flagData: {
    team_member_id: number;
    task_id?: number;
    type: 'red' | 'orange' | 'yellow' | 'green';
    reason: string;
  }): Promise<any> => {
    const result = await apiService.post('/performance-flags', flagData);
    return result.data ?? result;
  },

  update: async (flagId: string, flagData: {
    type?: 'red' | 'orange' | 'yellow' | 'green';
    reason?: string;
  }): Promise<any> => {
    const result = await apiService.put(`/performance-flags/${flagId}`, flagData);
    return result.data ?? result;
  },

  delete: async (flagId: string): Promise<any> => {
    const result = await apiService.delete(`/performance-flags/${flagId}`);
    return result.data ?? result;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Notification Service
// ─────────────────────────────────────────────────────────────────────────────
export const notificationService = {
  getAll: () => apiService.get('/tasks/notifications'),
  getTeamNotifications: () => teamApiService.get('/tasks/team/notifications'),
};

// ─────────────────────────────────────────────────────────────────────────────
// Auth Service
// ─────────────────────────────────────────────────────────────────────────────
export const authService = {
  adminLogin: (credentials: any) => apiService.post('/auth/admin/login', credentials),
  teamLogin: (credentials: any) => apiService.post('/auth/team/login', credentials),
  refreshToken: (data: { refresh_token: string }) => apiService.post('/auth/admin/refresh', data),
  refreshTeamToken: (data: { refresh_token: string }) => apiService.post('/auth/team/refresh', data),
};

// ─────────────────────────────────────────────────────────────────────────────
// Access Management Service
// ─────────────────────────────────────────────────────────────────────────────
export const accessService = {
  getPermissionDefinitions: async (): Promise<any> => {
    const result = await apiService.get('/access/permissions-definitions');
    return result.data ?? result;
  },

  getMembersWithPermissions: async (): Promise<any[]> => {
    const result = await apiService.get('/access/members');
    return result.data ?? result;
  },

  updateMemberRole: async (memberId: number, role: 'employee' | 'project_manager'): Promise<any> => {
    const result = await apiService.put(`/access/members/${memberId}/role`, { role });
    return result.data ?? result;
  },

  updateMemberPermissions: async (memberId: number, permissions: Record<string, boolean>): Promise<any> => {
    const result = await apiService.put(`/access/members/${memberId}/permissions`, { permissions });
    return result.data ?? result;
  },

  getMyPermissions: async (): Promise<any> => {
    const result = await teamApiService.get('/access/my-permissions');
    return result.data ?? result;
  },
};