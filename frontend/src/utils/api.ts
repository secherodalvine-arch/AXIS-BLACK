import { Currency } from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api';

export interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  role?: string;
  company?: string;
  currency?: Currency;
  salary?: number;
  income_frequency?: string;
  avatar_url?: string;
  personality?: string;
  is_sub_user?: boolean;
  owner_id?: string;
  role_id?: string;
  branch_id?: string;
  must_change_password?: boolean;
  theme?: 'light' | 'dark' | 'system';
  notification_settings?: any;
  location?: {
    city?: string;
    country?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  user_id: string;
  name: string;
  email: string;
  currency?: Currency;
}

export interface RegisterResponse {
  message: string;
  email: string;
  requires_verification: boolean;
}

// ── LocalStorage JWT Helpers ──
export const getAccessToken = (): string | null => localStorage.getItem('axis_access_token');
export const getRefreshToken = (): string | null => localStorage.getItem('axis_refresh_token');

export const setAuthTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem('axis_access_token', accessToken);
  localStorage.setItem('axis_refresh_token', refreshToken);
};

export const clearAuth = () => {
  localStorage.removeItem('axis_access_token');
  localStorage.removeItem('axis_refresh_token');
  localStorage.removeItem('axis_user');
};

export const getStoredUser = (): UserProfile | null => {
  const raw = localStorage.getItem('axis_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setStoredUser = (user: UserProfile) => {
  localStorage.setItem('axis_user', JSON.stringify(user));
};

// ── Generic Fetch Wrapper ──
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.detail || data?.message || 'An unexpected error occurred';
    const err: any = new Error(errorMsg);
    err.status = response.status;
    if (response.headers.get('x-requires-verification') === 'true') {
      err.requiresVerification = true;
      err.email = response.headers.get('x-user-email') || '';
    }
    throw err;
  }

  return data as T;
}

// ── Asset / File Storage API ──
export const uploadAssetApi = async (file: File): Promise<{ status: string; url: string; filename: string }> => {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/storage/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || 'Failed to upload asset image to storage');
  }
  return data;
};

// ── Authentication API Methods ──
export const loginApi = async (email: string, password: string): Promise<AuthTokenResponse> => {
  const res = await request<AuthTokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuthTokens(res.access_token, res.refresh_token);
  const user: UserProfile = {
    user_id: res.user_id,
    name: res.name,
    email: res.email,
    currency: res.currency || 'USD',
  };
  setStoredUser(user);
  return res;
};

export const registerApi = async (payload: {
  name: string;
  email: string;
  password: string;
  currency?: Currency;
  salary?: number;
  income_frequency?: string;
  city?: string;
  country?: string;
}): Promise<RegisterResponse> => {
  return await request<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      currency: payload.currency || 'USD',
      salary: payload.salary ?? 0,
      income_frequency: payload.income_frequency || 'monthly',
      city: payload.city || '',
      country: payload.country || '',
    }),
  });
};

export const verifyEmailApi = async (token: string): Promise<{ verified: boolean; message: string; email: string }> => {
  return await request<{ verified: boolean; message: string; email: string }>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
};

export const resendVerificationApi = async (email: string): Promise<{ message: string; cooldown_seconds?: number }> => {
  return await request<{ message: string; cooldown_seconds?: number }>('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const forgotPasswordApi = async (email: string): Promise<{ message: string }> => {
  return await request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const resendResetOtpApi = async (email: string): Promise<{ message: string; cooldown_seconds?: number }> => {
  return await request<{ message: string; cooldown_seconds?: number }>('/auth/resend-reset-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const resetPasswordApi = async (
  token: string,
  new_password: string
): Promise<{ message: string }> => {
  return await request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password }),
  });
};

export const resetPasswordOtpApi = async (
  email: string,
  otp_code: string,
  new_password: string
): Promise<{ message: string }> => {
  return await request<{ message: string }>('/auth/reset-password-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp_code, new_password }),
  });
};

export const getMeApi = async (): Promise<UserProfile> => {
  const user = await request<UserProfile>('/auth/me');
  setStoredUser(user);
  return user;
};

export const getUserProfileApi = async (): Promise<any> => {
  const profile = await request<any>('/users/me');
  setStoredUser({
    user_id: profile.user_id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    company: profile.company,
    currency: profile.currency || 'USD',
    salary: profile.salary,
    income_frequency: profile.income_frequency,
    location: profile.location,
    avatar_url: profile.avatar_url,
    personality: profile.personality,
    is_sub_user: profile.is_sub_user,
    owner_id: profile.owner_id,
    role_id: profile.role_id,
    branch_id: profile.branch_id,
    must_change_password: profile.must_change_password,
  });
  return profile;
};

export const updateUserProfileApi = async (updateData: any): Promise<any> => {
  const updated = await request<any>('/users/me', {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
  setStoredUser({
    user_id: updated.user_id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    company: updated.company,
    currency: updated.currency || 'USD',
    salary: updated.salary,
    income_frequency: updated.income_frequency,
    location: updated.location,
    avatar_url: updated.avatar_url,
    personality: updated.personality,
    is_sub_user: updated.is_sub_user,
    owner_id: updated.owner_id,
    role_id: updated.role_id,
    branch_id: updated.branch_id,
    must_change_password: updated.must_change_password,
  });
  return updated;
};

// ── Axis Black Data & Telemetry APIs ──
export const getDashboardMetricsApi = async () => {
  return await request<any[]>('/dashboard/me');
};

export const runRunwaySimulationApi = async (monthly_burn_rate: number, capital_efficiency: number) => {
  return await request<any>('/analytics/simulate', {
    method: 'POST',
    body: JSON.stringify({ monthly_burn_rate, capital_efficiency })
  });
};


// ── Axis Agent API ──
export const queryAxisAgentApi = async (query: string, advisor_type?: string) => {
  return await request<{ agent: string; advisor_type: string; answer: string; subagent_insight?: any; sources?: any[] }>('/agent/query', {
    method: 'POST',
    body: JSON.stringify({ query, advisor_type }),
  });
};

export const getAdvisorTelemetryApi = async (advisorType: string) => {
  return await request<any>(`/agent/advisors/${advisorType}`);
};

export const getAgentSessionsApi = async (): Promise<any[]> => {
  return await request<any[]>('/agent/sessions');
};

export const saveAgentSessionApi = async (sessionData: any): Promise<any> => {
  return await request<any>('/agent/sessions', {
    method: 'POST',
    body: JSON.stringify(sessionData),
  });
};

export const deleteAgentSessionApi = async (sessionId: string): Promise<any> => {
  return await request<any>(`/agent/sessions/${sessionId}`, {
    method: 'DELETE',
  });
};

// ── Voice Agent APIs (ElevenLabs) ──
export const getVoiceConfigApi = async (): Promise<any> => {
  return await request<any>('/voice/config');
};

export const getVoiceSignedUrlApi = async (): Promise<{ status: string; signed_url: string | null; agent_id: string | null; message?: string }> => {
  return await request<any>('/voice/signed-url');
};

// ── Support & Contact API ──
export const sendSupportMessageApi = async (payload: {
  name: string;
  email: string;
  message: string;
  subject?: string;
  label?: string;
}): Promise<{ message: string; label: string }> => {
  return await request<{ message: string; label: string }>('/support/message', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

// ── Business Profile API ──
export const getBusinessProfileApi = async () =>
  request<any>('/business/profile');

export const updateBusinessProfileApi = async (data: any) =>
  request<any>('/business/profile', { method: 'PUT', body: JSON.stringify(data) });

// ── Branch API ──
export const getBranchesApi = async () =>
  request<any[]>('/business/branches');

export const createBranchApi = async (data: any) =>
  request<any>('/business/branches', { method: 'POST', body: JSON.stringify(data) });

export const updateBranchApi = async (branchId: string, data: any) =>
  request<any>(`/business/branches/${branchId}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteBranchApi = async (branchId: string) =>
  request<any>(`/business/branches/${branchId}`, { method: 'DELETE' });

export const getBranchPerformanceApi = async (branchId: string) =>
  request<any>(`/business/branches/${branchId}/performance`);

// ── Roles API ──
export const getRolesApi = async () =>
  request<any[]>('/business/roles');

export const createRoleApi = async (data: any) =>
  request<any>('/business/roles', { method: 'POST', body: JSON.stringify(data) });

export const updateRoleApi = async (roleId: string, data: any) =>
  request<any>(`/business/roles/${roleId}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteRoleApi = async (roleId: string) =>
  request<any>(`/business/roles/${roleId}`, { method: 'DELETE' });

export const getBranchDetailsApi = async (branchId: string) =>
  request<any>(`/business/branches/${branchId}/details`);

// ── Team / Sub-Users API ──
export const getTeamApi = async () =>
  request<any[]>('/business/team');

export const createSubUserApi = async (data: any) =>
  request<any>('/business/team', { method: 'POST', body: JSON.stringify(data) });

export const updateSubUserApi = async (userId: string, data: any) =>
  request<any>(`/business/team/${userId}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteSubUserApi = async (userId: string) =>
  request<any>(`/business/team/${userId}`, { method: 'DELETE' });

// ── CSV Import APIs ──
export const importTransactionsCsvApi = async (file: File, branchId?: string): Promise<any> => {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append('file', file);
  const url = `${API_BASE_URL}/transactions/me/import-csv${branchId ? `?branch_id=${branchId}` : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || 'CSV import failed');
  return data;
};

export const importInventoryCsvApi = async (file: File, branchId?: string): Promise<any> => {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append('file', file);
  const url = `${API_BASE_URL}/inventory/items/import-csv${branchId ? `?branch_id=${branchId}` : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || 'CSV import failed');
  return data;
};

// ── Transactions with branch filter ──
export const getTransactionsApi = async (branchId?: string) => {
  const url = branchId ? `/transactions/me?branch_id=${branchId}` : '/transactions/me';
  return await request<any[]>(url);
};

export const createTransactionApi = async (txnData: any) => {
  return await request<any>('/transactions/me', {
    method: 'POST',
    body: JSON.stringify(txnData)
  });
};

// ── Inventory with branch filter ──
export const getInventoryApi = async (branchId?: string) => {
  const url = branchId ? `/inventory/items?branch_id=${branchId}` : '/inventory/items';
  return await request<any[]>(url);
};

export const createInventoryItemApi = async (itemData: any) => {
  return await request<any>('/inventory/items', {
    method: 'POST',
    body: JSON.stringify(itemData),
  });
};

// ── Analytics API with optional branchId ──
export const getAnalyticsApi = async (branchId?: string) => {
  const url = branchId ? `/analytics/me?branch_id=${branchId}` : '/analytics/me';
  return await request<any>(url);
};

// ── Activity Logs API ──
export const getActivitiesApi = async (branchId?: string) => {
  const url = branchId ? `/business/activities?branch_id=${branchId}` : '/business/activities';
  return await request<any[]>(url);
};

// ── Notifications API ──
export const getNotificationsApi = async () => {
  return await request<any[]>('/business/notifications');
};

export const markNotificationReadApi = async (notifId: string) => {
  return await request<any>(`/business/notifications/${notifId}/read`, {
    method: 'POST'
  });
};

// ── Transaction Deletion ──
export const deleteTransactionApi = async (id: string) => {
  return await request<any>(`/transactions/me/${id}`, {
    method: 'DELETE'
  });
};

// ── Inventory Update & Deletion ──
export const updateInventoryItemApi = async (sku: string, itemData: any) => {
  return await request<any>(`/inventory/items/${sku}`, {
    method: 'PUT',
    body: JSON.stringify(itemData)
  });
};

export const deleteInventoryItemApi = async (sku: string) => {
  return await request<any>(`/inventory/items/${sku}`, {
    method: 'DELETE'
  });
};

// ── Test Summary Notification Dispatch ──
export const sendTestNotificationApi = async (settingsPayload?: any) => {
  return await request<any>('/users/me/test-notification', {
    method: 'POST',
    body: settingsPayload ? JSON.stringify(settingsPayload) : undefined
  });
};




