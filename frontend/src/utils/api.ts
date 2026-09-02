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
  location?: {
    city?: string;
    country?: string;
  };
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
      salary: payload.salary || 5000,
      income_frequency: payload.income_frequency || 'monthly',
      city: payload.city || 'Nairobi',
      country: payload.country || 'Kenya',
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
  });
  return updated;
};

// ── Axis Black Data & Telemetry APIs ──
export const getDashboardMetricsApi = async () => {
  return await request<any[]>('/dashboard/me');
};

export const getTransactionsApi = async () => {
  return await request<any[]>('/transactions/me');
};

export const createTransactionApi = async (txnData: any) => {
  return await request<any>('/transactions/me', {
    method: 'POST',
    body: JSON.stringify(txnData)
  });
};

export const getInventoryApi = async () => {
  return await request<any[]>('/inventory/items');
};

export const createInventoryItemApi = async (itemData: any) => {
  return await request<any>('/inventory/items', {
    method: 'POST',
    body: JSON.stringify(itemData),
  });
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

// ── Voice Agent APIs ──
export const getVoiceConfigApi = async (): Promise<any> => {
  return await request<any>('/voice/config');
};

export const getVoiceSignedUrlApi = async (): Promise<{ status: string; signed_url: string | null; agent_id: string | null; message?: string }> => {
  return await request<any>('/voice/signed-url');
};

export const processVoiceCommandApi = async (transcript: string, active_tab?: string): Promise<any> => {
  return await request<any>('/voice/process', {
    method: 'POST',
    body: JSON.stringify({ transcript, active_tab }),
  });
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


