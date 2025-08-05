let CLIENT_ID, REDIRECT_URI;
let authInProgress = false;

async function loadEnv() {
  if (CLIENT_ID && REDIRECT_URI) return;
  const res = await fetch('/env');
  const data = await res.json();
  CLIENT_ID = data.CLIENT_ID;
  REDIRECT_URI = data.REDIRECT_URI;
}

export function generateRandomString(length) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const values = crypto.getRandomValues(new Uint32Array(length));
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

export async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest('SHA-256', data);
}

export function base64urlencode(a) {
  return btoa(String.fromCharCode(...new Uint8Array(a)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generateCodeChallenge(codeVerifier) {
  const hashed = await sha256(codeVerifier);
  return base64urlencode(hashed);
}

export async function redirectToAuthCodeFlow() {
  await loadEnv(); 
  if (authInProgress) return;
  authInProgress = true;

  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  localStorage.setItem('verifier', codeVerifier);

  const args = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: 'user-read-private user-read-email streaming user-read-playback-state user-modify-playback-state',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  window.location = `https://accounts.spotify.com/authorize?${args}`;
}

export async function getAccessToken(code) {
  await loadEnv(); 
  const codeVerifier = localStorage.getItem('verifier');

  const res = await fetch('/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      redirect_uri: REDIRECT_URI
    })
  });

  const data = await res.json();
  return data.access_token;
}
