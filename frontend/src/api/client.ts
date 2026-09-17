/**
 * API client for the MedReminder backend.
 * Wraps fetch with JWT auth header injection and typed response handling.
 * All API methods return typed promises matching the backend response shapes.
 */

const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

// Generic fetch wrapper that attaches the JWT and handles error responses
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.toString() || `Request failed: ${res.status}`);
  }
  return data;
}

// Typed API methods matching each backend endpoint
export const api = {
  register: (body: { email: string; name: string; password: string }) =>
    request<{ token: string; user: { id: number; email: string; name: string } }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(body) }
    ),

  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: { id: number; email: string; name: string } }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify(body) }
    ),

  getMedications: () =>
    request<Medication[]>("/medications"),

  getMedication: (id: number) =>
    request<MedicationDetail>(`/medications/${id}`),

  createMedication: (body: CreateMedicationBody) =>
    request<Medication>("/medications", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateMedication: (id: number, body: Partial<Medication>) =>
    request<Medication>(`/medications/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteMedication: (id: number) =>
    request<void>(`/medications/${id}`, { method: "DELETE" }),

  refillMedication: (id: number, newCount: number) =>
    request<Medication>(`/medications/${id}/refill`, {
      method: "POST",
      body: JSON.stringify({ newCount }),
    }),

  confirmDose: (logId: number) =>
    request<DoseLog & { remainingPillCount: number; refillWarning: boolean }>(
      `/doses/${logId}/confirm`,
      { method: "POST" }
    ),

  getTodayDoses: () =>
    request<TodayDose[]>("/doses/today"),

  getHistory: (params?: { medId?: number; from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.medId) query.set("medId", String(params.medId));
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const qs = query.toString();
    return request<HistoryDose[]>(`/doses/history${qs ? `?${qs}` : ""}`);
  },

  getRefills: () =>
    request<Medication[]>("/doses/refills"),
};

// --- Type definitions matching the backend schema ---

export interface Medication {
  id: number;
  userId: number;
  name: string;
  dosage: string;
  frequency: number;
  totalPillCount: number;
  remainingPillCount: number;
  active: boolean;
  createdAt: string;
}

export interface Schedule {
  id: number;
  medicationId: number;
  timeOfDay: string;
  label: string;
  enabled: boolean;
}

export interface MedicationDetail extends Medication {
  schedules: Schedule[];
  recentLogs: DoseLog[];
}

export interface DoseLog {
  id: number;
  medicationId: number;
  scheduleId: number;
  status: "pending" | "taken" | "missed";
  scheduledAt: string;
  takenAt: string | null;
  createdAt: string;
}

export interface TodayDose extends DoseLog {
  medicationName: string;
  dosage: string;
  scheduleLabel: string;
  scheduleTime: string;
}

export interface HistoryDose extends DoseLog {
  medicationName: string;
  dosage: string;
  scheduleLabel: string;
}

export interface CreateMedicationBody {
  name: string;
  dosage: string;
  frequency: number;
  totalPillCount: number;
  schedules: { timeOfDay: string; label: string }[];
}
