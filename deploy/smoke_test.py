"""Public deployment checks. Credentials/cookies are never printed.

WHAT THIS SCRIPT DOES
    Called by .github/workflows/deploy.yml after a deployment:
        python3 deploy/smoke_test.py SERVICE_URL
    It checks the live service and exits non-zero (failing the workflow) if any
    check fails. Each public check is retried up to 5 times, 3 seconds apart, to
    tolerate Cloud Run cold starts.

    Checks (in order)
1. GET /api/health      -> {"status": "ok"}
2. GET /api/ready       -> {"database": "connected"}
3. GET /                -> HTML page (the built React app is served)
4. OPTIONAL login test  -> cookie-based auth (pastelpulse_session) via
         POST /api/auth/login, GET /api/auth/me, GET /api/campaigns, and
         POST /api/auth/logout. Runs only if BOTH env vars SMOKE_EMAIL and
         SMOKE_PASSWORD are set (set both or neither).
         The session is always logged out, even if a check fails.

IMPORTANT
    Uses only the Python standard library (no pip install needed).
    Offline unit tests: deploy/tests/test_smoke.py
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request


# --- HTTP helper --------------------------------------------------------------
# Returns the response body (bytes). Raises on HTTP errors / timeouts.
def request(base, path, data=None, opener=None):
    headers = {}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(
        base + path,
        headers=headers,
        data=json.dumps(data).encode() if data is not None else None,
    )
    open_fn = opener.open if opener is not None else urllib.request.urlopen
    with open_fn(req, timeout=30) as response:
        return response.read()


def check(base):
    # --- Public checks ---
    for path, predicate in (
        ('/api/health', lambda b: json.loads(b).get('status') == 'ok'),
        ('/api/ready', lambda b: json.loads(b).get('database') == 'connected'),
        ('/', lambda b: b'<html' in b.lower()),
    ):
        # Retry: a cold Cloud Run instance may need a few seconds to start.
        for attempt in range(5):
            try:
                if not predicate(request(base, path)):
                    raise ValueError('Unexpected response')
                break
            except (urllib.error.URLError, TimeoutError, ValueError):
                if attempt == 4:
                    raise RuntimeError('Smoke check failed: ' + path) from None
                time.sleep(3)

        print('PASS ' + path)

    # --- Optional authenticated checks (cookie-based: pastelpulse_session) ---
    email = os.getenv('SMOKE_EMAIL')
    password = os.getenv('SMOKE_PASSWORD')

    if bool(email) != bool(password):
        raise RuntimeError(
            'Set both SMOKE_EMAIL and SMOKE_PASSWORD, or neither.'
        )

    if not email:
        print('SKIP login: optional smoke credentials not configured')
        return

    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
    logged_in = False
    try:
        request(
            base,
            '/api/auth/login',
            {'email': email, 'password': password},
            opener=opener,
        )
        logged_in = True

        request(base, '/api/auth/me', opener=opener)
        print('PASS login and authenticated /api/auth/me')

        campaigns = json.loads(
            request(base, '/api/campaigns', opener=opener)
        )
        if not (
            isinstance(campaigns, list)
            or (isinstance(campaigns, dict) and isinstance(campaigns.get('data'), list))
        ):
            raise ValueError('Unexpected campaigns response')

        print('PASS authenticated /api/campaigns')

    except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
        raise RuntimeError('Authenticated smoke check failed') from None

    finally:
        if logged_in:
            request(base, '/api/auth/logout', data={}, opener=opener)
            print('PASS logout')


# --- Entry point ----------------------------------------------------------------
if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 deploy/smoke_test.py SERVICE_URL')
    check(sys.argv[1].rstrip('/'))