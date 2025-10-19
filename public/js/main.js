import { getAccessToken, getValidAccessToken } from "./auth.js"
import {
  getCurrentPlayback,
  getAvailableDevices,
  getUserPlaylists,
  playPlaylist,
  transferPlaybackTo,
  resumePlayback,
  pausePlayback,
} from "./spotify.js"
import { initializePlayer } from "./player.js"

const logoutBtn = document.getElementById("logoutBtn")
const playBtn = document.getElementById("playBtn")
const playlistSelect = document.getElementById("playlistSelect")
const prevBtn = document.getElementById("prevBtn")
const playPauseBtn = document.getElementById("playPauseBtn")
const nextBtn = document.getElementById("nextBtn")
const albumArt = document.getElementById("albumArt")
const trackTitle = document.getElementById("trackTitle")
const trackArtist = document.getElementById("trackArtist")
const trackAlbum = document.getElementById("trackAlbum")
const progressBar = document.getElementById("progressBar")
const nowPlaying = document.getElementById("nowPlaying")
const controls = document.getElementById("controls")
const volumeControl = document.getElementById("volumeControl")
const miniArt = document.getElementById("miniArt")

const isPlayerPage = logoutBtn && playPauseBtn && albumArt && trackTitle

if (!isPlayerPage) {
  
}

if (logoutBtn) {
  logoutBtn.onclick = () => {
    sessionStorage.clear()
    window.location.href = "/"
  }
}

let player
let deviceId
let progressInterval
let isLocalPlayback = false

function updateProgressBarStyle(value) {
  const percentage = (value / 1000) * 100
  progressBar.style.background = `linear-gradient(to right, #1db954 ${percentage}%, #282828 ${percentage}%)`
}

function updateVolumeBarStyle(value) {
  const percentage = (value / 100) * 100
  volumeControl.style.background = `linear-gradient(to right, #1db954 ${percentage}%, #282828 ${percentage}%)`
}

function updatePlayPauseIcon(paused) {
  document.getElementById("playIcon").style.display = paused ? "inline" : "none"
  document.getElementById("pauseIcon").style.display = paused ? "none" : "inline"
}

function renderTrackInfo(playback) {
  if (playback?.item) {
    albumArt.classList.add("loading")
    albumArt.src = "/placeholder.svg"

    const img = new Image()
    const imageUrl = playback.item.album.images?.[0]?.url

    img.src = imageUrl
    trackTitle.textContent = playback.item.name
    trackArtist.textContent = playback.item.artists.map((a) => a.name).join(", ")
    if (trackAlbum) {
      trackAlbum.textContent = playback.item.album.name || "Unknown Album"
    }

    const progress = (playback.progress_ms / playback.item.duration_ms) * 1000
    progressBar.value = progress
    updateProgressBarStyle(progress)
    updatePlayPauseIcon(!playback.is_playing)
  } else {
    albumArt.src = "/placeholder.svg"
    trackTitle.textContent = "No song playing"
    trackArtist.textContent = "Unknown Artist"
    if (trackAlbum) {
      trackAlbum.textContent = "Unknown Album"
    }
  }
}

async function updatePlaybackUI() {
  const token = await getValidAccessToken()
  if (!token) return
  const playback = await getCurrentPlayback(token)
  renderTrackInfo(playback)
}

async function startApp() {
  if (!trackTitle || !albumArt || !trackArtist) {
    return
  }

  await new Promise((res) => setTimeout(res, 500))

  const token = await getValidAccessToken()
  if (!token) {
    return
  }

  const playback = await getCurrentPlayback(token)
  renderTrackInfo(playback)

  const playlists = await getUserPlaylists(token)

  if (playlistSelect) {
    playlistSelect.innerHTML = ""
    playlists.forEach((pl) => {
      const opt = document.createElement("option")
      opt.value = pl.uri
      opt.textContent = pl.name
      playlistSelect.appendChild(opt)
    })
  }

  const devices = await getAvailableDevices(token)
  const activeDevice = devices.find((d) => d.is_active)
  const localDevice = devices.find((d) => d.name === "Shadowfy")

  if (playlistSelect && playlistSelect.parentElement) {
    const deviceList = document.createElement("ul")
    deviceList.className = "device-list"
    devices.forEach((d) => {
      const li = document.createElement("li")
      li.textContent = `${d.name} (${d.type}${d.is_active ? " - Activo" : ""})`
      li.style.color = d.is_active ? "#1db954" : "#aaa"
      deviceList.appendChild(li)
    })
    playlistSelect.parentElement.appendChild(deviceList)
  }

  const elementsToShow = [playlistSelect, playBtn, logoutBtn, controls, nowPlaying].filter((el) => el)
  elementsToShow.forEach((el) => (el.style.removeProperty("display")))

  initializePlayer(token, async (id, p) => {
    player = p
    deviceId = id

    const currentToken = await getValidAccessToken()
    if (!activeDevice || activeDevice.id !== deviceId) {
      await transferPlaybackTo(deviceId, currentToken, false)
    }

    if (playBtn) {
      playBtn.onclick = async () => {
        const token = await getValidAccessToken()
        if (!token) return
        const uri = playlistSelect?.value
        if (uri) {
          await playPlaylist(deviceId, token, uri)
        } else {
          const state = await player.getCurrentState()
          if (state) {
            player.togglePlay()
          } else {
            const playback = await getCurrentPlayback(token)
            if (playback?.item) {
              await resumePlayback(token, deviceId, playback.progress_ms, playback.context?.uri, playback.item.uri)
            }
          }
        }
      }
    }

    if (playPauseBtn) {
      playPauseBtn.onclick = async () => {
        const token = await getValidAccessToken()
        if (!token) return

        const state = await player.getCurrentState()
        const playback = await getCurrentPlayback(token)

        if (!state || !state.track_window.current_track) {
          if (playback?.item) {
            const useDeviceId = playback.device?.id === deviceId ? deviceId : null
            if (playback.is_playing) {
              const useDeviceId = playback.device?.id === deviceId ? null : playback.device?.id
              await pausePlayback(token, useDeviceId)
            } else {
              await resumePlayback(token, useDeviceId, playback.progress_ms, playback.context?.uri, playback.item.uri)
            }
          } else {
            
          }
        } else {
          player.togglePlay()
        }
      }
    }

    if (nextBtn) nextBtn.onclick = () => player.nextTrack()
    if (prevBtn) prevBtn.onclick = () => player.previousTrack()

    player.getVolume().then((v) => {
      const percent = Math.round(v * 100)
      if (volumeControl) {
        volumeControl.value = percent
        updateVolumeBarStyle(percent)
      }
    })

    player.addListener("player_state_changed", (state) => {
      if (!state) return
      isLocalPlayback = true
      const { current_track } = state.track_window
      if (current_track && albumArt) {
        

        const img = new Image()
        const imageUrl = current_track.album.images?.[0]?.url
        img.onload = () => {
          albumArt.src = imageUrl
          albumArt.classList.remove("loading")
          miniArt.src = imageUrl
        }
        img.onerror = () => {
          albumArt.src = "/placeholder.svg"
          albumArt.classList.remove("loading")
        }
        img.src = imageUrl || "/placeholder.svg"

        if (trackTitle) trackTitle.textContent = current_track.name
        if (trackArtist) trackArtist.textContent = current_track.artists.map((a) => a.name).join(", ")
        if (trackAlbum) trackAlbum.textContent = current_track.album.name || "Unknown Album"
      }
      updatePlayPauseIcon(state.paused)

      clearInterval(progressInterval)
      progressInterval = setInterval(() => {
        player.getCurrentState().then((s) => {
          if (!s || !progressBar) return
          const progress = (s.position / s.duration) * 1000
          progressBar.value = progress
          updateProgressBarStyle(progress)
        })
      }, 500)
    })

    if (progressBar) {
      progressBar.oninput = async (e) => {
        const percentage = e.target.value
        const state = await player.getCurrentState()
        if (!state) return
        const seekPos = (percentage / 1000) * state.duration
        player.seek(seekPos)
        updateProgressBarStyle(percentage)
      }
    }

    if (volumeControl) {
      volumeControl.oninput = (e) => {
        const volume = Number(e.target.value)
        player.setVolume(volume / 100)
        updateVolumeBarStyle(volume)
      }
    }
  })

  setInterval(async () => {
    try {
      const token = await getValidAccessToken()
      if (!token) return

      const playback = await getCurrentPlayback(token)
      if (!playback) return
      if (playback.device?.name === "Shadowfy" || playback.device?.id === deviceId) return
      renderTrackInfo(playback)
    } catch (err) {
    }
  }, 30000)
}
;(async () => {
  if (!isPlayerPage) return

  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get("code")

  if (code) {
    window.history.replaceState({}, document.title, "/player")

    try {
      await getAccessToken(code)

      const token = sessionStorage.getItem("access_token")
      if (!token) {
        throw new Error("El token no se guardó correctamente")
      }
    } catch (error) {
      alert("La autenticación falló. Por favor, inicia sesión nuevamente.")
      sessionStorage.clear()
      setTimeout(() => {
        window.location.href = "/"
      }, 1000)
      return
    }

    try {
      await startApp()
    } catch (error) {
      alert("Hubo un error al cargar la aplicación. Recarga la página.")
    }
    return
  }

  const token = await getValidAccessToken()
  if (!token) {
    window.location.href = "/"
    return
  }

  try {
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      throw new Error(`Token inválido: ${res.status}`)
    }

    await startApp()
  } catch (err) {
    const refreshToken = sessionStorage.getItem("refresh_token")
    if (refreshToken) {
      sessionStorage.removeItem("access_token")
      const newToken = await getValidAccessToken()
      if (newToken) {
        await startApp()
        return
      }
    }
    sessionStorage.clear()
    window.location.href = "/"
  }
})()
