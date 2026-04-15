import { api } from '../api/client.js';

const GENERATE_TIMEOUT_MS = 180000;

export async function fetchStudyPlan() {
  const { data } = await api.get('/study-plan');
  return data.study_plan;
}

export async function createStudyPlan(payload) {
  const { data } = await api.post('/study-plan', payload, { timeout: GENERATE_TIMEOUT_MS });
  return data;
}

export async function regenerateStudyPlan(payload) {
  const { data } = await api.post('/study-plan/regenerate', payload ?? {}, { timeout: GENERATE_TIMEOUT_MS });
  return data;
}

export async function updateStudyPlan(payload) {
  const { data } = await api.patch('/study-plan', payload);
  return data;
}

export async function deleteStudyPlan() {
  const { data } = await api.delete('/study-plan');
  return data;
}
