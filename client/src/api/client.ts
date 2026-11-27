export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: init?.credentials ?? 'include',
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }

  return response;
}
