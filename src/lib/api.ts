import { supabase } from './supabase';

export async function readJsonResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(`API returned an empty response (${response.status}).`);
  }

  if (!contentType.includes('application/json')) {
    const url = typeof response.url === 'string' ? response.url : 'the requested API route';
    const serverHint = response.status === 404
      ? ' The API route was not found; restart the Express API server so it picks up the latest routes, or run npm run dev:full.'
      : '';
    throw new Error(`API returned a non-JSON response (${response.status}) from ${url}.${serverHint}`);
  }

  const data = JSON.parse(text);

  if (!response.ok) {
    throw new Error(data?.error || `API request failed (${response.status}).`);
  }

  return data;
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers
  });
}
