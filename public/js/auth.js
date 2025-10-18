let CLIENT_ID, REDIRECT_URI
let authInProgress = false
let refreshPromise = null

async function loadEnv() {
  if (CLIENT_ID && REDIRECT_URI) return
  const res = await fetch("/env")
  const data = await res.json()
  CLIENT_ID = data.CLIENT_ID
  REDIRECT_URI = data.REDIRECT_URI
}

export function generateRandomString(length) {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  const values = crypto.getRandomValues(new Uint32Array(length))
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length]
  }
  return result
}

export async function sha256(plain) {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return await crypto.subtle.digest("SHA-256", data)
}

export function base64urlencode(a) {
  return btoa(String.fromCharCode(...new Uint8Array(a)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export async function generateCodeChallenge(codeVerifier) {
  const hashed = await sha256(codeVerifier)
  return base64urlencode(hashed)
}

export async function redirectToAuthCodeFlow() {
  await loadEnv()

  if (authInProgress) {
    return
  }
  authInProgress = true

  const codeVerifier = generateRandomString(64)
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  sessionStorage.setItem("verifier", codeVerifier)

  const args = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: "user-read-private user-read-email streaming user-read-playback-state user-modify-playback-state",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  })

  setTimeout(() => {
    authInProgress = false
  }, 2000)

  window.location = `https://accounts.spotify.com/authorize?${args}`
}

export async function getAccessToken(code) {
  await loadEnv()
  const codeVerifier = sessionStorage.getItem("verifier")

  const res = await fetch("/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      redirect_uri: REDIRECT_URI,
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Falló la solicitud al backend: ${res.status}`)
  }

  const data = await res.json()

  if (!data.access_token) {
    throw new Error("El token de acceso no se encontró en la respuesta.")
  }

  sessionStorage.setItem("access_token", data.access_token)
  if (data.refresh_token) sessionStorage.setItem("refresh_token", data.refresh_token)
  sessionStorage.setItem("expires_at", Date.now() + data.expires_in * 1000)

  return data.access_token
}

export async function getValidAccessToken() {
  const accessToken = sessionStorage.getItem("access_token")
  const expiresAt = Number.parseInt(sessionStorage.getItem("expires_at") || "0", 10)
  const refreshToken = sessionStorage.getItem("refresh_token")

  const REFRESH_MARGIN = 5 * 60 * 1000 // refresh 5 min antes de expirar.

  if (accessToken && Date.now() < expiresAt - REFRESH_MARGIN) {
    return accessToken
  }

  if (!refreshToken) {
    await redirectToAuthCodeFlow()
    return null
  }

  if (refreshPromise) {
    return await refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      if (!res.ok) {
        throw new Error(`El refresco del token falló: ${res.status}`)
      }

      const data = await res.json()

      if (data.access_token) {
        sessionStorage.setItem("access_token", data.access_token)
        sessionStorage.setItem("expires_at", Date.now() + data.expires_in * 1000)

        if (data.refresh_token) {
          sessionStorage.setItem("refresh_token", data.refresh_token)
        }

        return data.access_token
      } else {
        throw new Error("Respuesta inválida al refrescar el token")
      }
    } catch (err) {
      sessionStorage.clear()
      await redirectToAuthCodeFlow()
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return await refreshPromise
}
