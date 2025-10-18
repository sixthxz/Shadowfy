import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import fetch from "node-fetch"
import path from "path"
import { fileURLToPath } from "url"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use((req, res, next) => {
  console.log("----> Incoming:", req.method, req.originalUrl)
  next()
})
app.use(cors())
app.use(express.json())

app.use(express.static(path.join(__dirname, "public")))

app.post("/auth/token", async (req, res) => {
  const { code, code_verifier, redirect_uri } = req.body

  if (!code || !code_verifier || !redirect_uri) {
    console.error("Missing required parameters:", {
      code: !!code,
      code_verifier: !!code_verifier,
      redirect_uri: !!redirect_uri,
    })
    return res.status(400).json({ error: "Missing required parameters" })
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri,
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    code_verifier,
  })

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Spotify token error:", data)
      return res.status(response.status).json({
        error: data.error || "Token exchange failed",
        error_description: data.error_description || "Unknown error",
      })
    }

    if (!data.access_token || !data.refresh_token) {
      console.error("Missing tokens in Spotify response:", data)
      return res.status(500).json({ error: "Invalid token response from Spotify" })
    }

    console.log("Token exchange successful")
    res.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    })
  } catch (err) {
    console.error("Token exchange error:", err)
    res.status(500).json({ error: "Token exchange failed" })
  }
})

app.post("/auth/refresh", async (req, res) => {
  const { refresh_token } = req.body

  if (!refresh_token) {
    console.error("Missing refresh_token in request")
    return res.status(400).json({ error: "Missing refresh_token" })
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token,
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
  })

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Spotify refresh error:", data)
      return res.status(response.status).json({
        error: data.error || "Token refresh failed",
        error_description: data.error_description || "Unknown error",
      })
    }

    if (!data.access_token) {
      console.error("Missing access_token in Spotify response:", data)
      return res.status(500).json({ error: "Invalid refresh response from Spotify" })
    }

    console.log("Token refresh successful")

    if (data.refresh_token) {
      res.json({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      })
    } else {
      res.json({
        access_token: data.access_token,
        expires_in: data.expires_in,
      })
    }
  } catch (err) {
    console.error("Token refresh error:", err)
    res.status(500).json({ error: "Token refresh failed" })
  }
})

app.get("/env", (req, res) => {
  res.json({
    CLIENT_ID: process.env.CLIENT_ID,
    REDIRECT_URI: process.env.REDIRECT_URI,
  })
})

app.get("/player", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "player.html"))
})

app.get("*", (req, res, next) => {
  if (req.originalUrl.includes(".") || req.originalUrl.startsWith("/auth/")) {
    return next()
  }
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

const PORT = process.env.PORT || 8000
app.listen(PORT, () => console.log(`Auth server running on http://localhost:${PORT}`))
