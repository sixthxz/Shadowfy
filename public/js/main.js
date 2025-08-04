import { redirectToAuthCodeFlow, getAccessToken } from './auth.js';
import {
  getCurrentPlayback,
  getAvailableDevices,
  getUserPlaylists,
  playPlaylist,
  transferPlaybackTo,
  resumePlayback,
  pausePlayback
} from './spotify.js';
import { initializePlayer } from './player.js';

const logoutBtn = document.getElementById('logoutBtn');
const playBtn = document.getElementById('playBtn');
const playlistSelect = document.getElementById('playlistSelect');
const prevBtn = document.getElementById('prevBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const nextBtn = document.getElementById('nextBtn');
const albumArt = document.getElementById('albumArt');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const progressBar = document.getElementById('progressBar');
const nowPlaying = document.getElementById('nowPlaying');
const controls = document.getElementById('controls');
const volumeControl = document.getElementById('volumeControl');

const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
let token = localStorage.getItem('access_token');

logoutBtn.onclick = () => {
  localStorage.removeItem('access_token');
  window.location.href = '/';
};

let player;
let deviceId;
let progressInterval;
let isLocalPlayback = false;

function updateProgressBarStyle(value) {
  const percentage = (value / 1000) * 100;
  progressBar.style.background = `linear-gradient(to right, #1db954 ${percentage}%, #282828 ${percentage}%)`;
}

function updateVolumeBarStyle(value) {
  const percentage = (value / 100) * 100;
  volumeControl.style.background = `linear-gradient(to right, #1db954 ${percentage}%, #282828 ${percentage}%)`;
}

function updatePlayPauseIcon(paused) {
  document.getElementById('playIcon').style.display = paused ? 'inline' : 'none';
  document.getElementById('pauseIcon').style.display = paused ? 'none' : 'inline';
}

function renderTrackInfo(playback) {
  if (playback?.item) {
    albumArt.src = playback.item.album.images[0].url;
    trackTitle.textContent = playback.item.name;
    trackArtist.textContent = playback.item.artists.map(a => a.name).join(', ');
    const progress = (playback.progress_ms / playback.item.duration_ms) * 1000;
    progressBar.value = progress;
    updateProgressBarStyle(progress);
    updatePlayPauseIcon(!playback.is_playing);
  }
}

async function updatePlaybackUI() {
  const playback = await getCurrentPlayback(token);
  renderTrackInfo(playback);
}

async function startApp(token) {
  const playback = await getCurrentPlayback(token);
  renderTrackInfo(playback);

  const playlists = await getUserPlaylists(token);
  playlistSelect.innerHTML = '';
  playlists.forEach(pl => {
    const opt = document.createElement('option');
    opt.value = pl.uri;
    opt.textContent = pl.name;
    playlistSelect.appendChild(opt);
  });

  const devices = await getAvailableDevices(token);
  const activeDevice = devices.find(d => d.is_active);
  const localDevice = devices.find(d => d.name === 'Reproductor del Bienestar');

  const deviceList = document.createElement('ul');
  deviceList.className = 'device-list';
  devices.forEach(d => {
    const li = document.createElement('li');
    li.textContent = `${d.name} (${d.type}${d.is_active ? ' - Activo' : ''})`;
    li.style.color = d.is_active ? '#1db954' : '#aaa';
    deviceList.appendChild(li);
  });
  playlistSelect.parentElement.appendChild(deviceList);

  [playlistSelect, playBtn, logoutBtn, controls, nowPlaying].forEach(el => el.style.display = 'inline-block');

  initializePlayer(token, async (id, p) => {
    player = p;
    deviceId = id;

    if (!activeDevice || activeDevice.id !== deviceId) {
      await transferPlaybackTo(deviceId, token, false);
    }

    playBtn.onclick = async () => {
      const uri = playlistSelect.value;
      if (uri) {
        await playPlaylist(deviceId, token, uri);
      } else {
        const state = await player.getCurrentState();
        if (state) {
          player.togglePlay();
        } else {
          const playback = await getCurrentPlayback(token);
          if (playback?.item) {
            await resumePlayback(
              token,
              deviceId,
              playback.progress_ms,
              playback.context?.uri,
              playback.item.uri
            );
          }
        }
      }
    };

    playPauseBtn.onclick = async () => {
      const state = await player.getCurrentState();
      const playback = await getCurrentPlayback(token);

      if (!state || !state.track_window.current_track) {
        if (playback?.item) {
          const useDeviceId =
            playback.device?.id === deviceId ? deviceId : null;

          if (playback.is_playing) {
            const useDeviceId =
              playback.device?.id === deviceId ? null : playback.device?.id;

            await pausePlayback(token, useDeviceId);
          } else {
            await resumePlayback(
              token,
              useDeviceId,
              playback.progress_ms,
              playback.context?.uri,
              playback.item.uri
            );
          }
        } else {
          alert('No hay reproducción activa ni pista disponible.');
        }
      } else {
        player.togglePlay();
      }
    };


    nextBtn.onclick = () => player.nextTrack();
    prevBtn.onclick = () => player.previousTrack();

    player.getVolume().then(v => {
      const percent = Math.round(v * 100);
      volumeControl.value = percent;
      updateVolumeBarStyle(percent);
    });

    player.addListener('player_state_changed', state => {
      if (!state) return;
      isLocalPlayback = true;
      const { current_track } = state.track_window;
      if (current_track) {
        albumArt.src = current_track.album.images[0].url;
        trackTitle.textContent = current_track.name;
        trackArtist.textContent = current_track.artists.map(a => a.name).join(', ');
      }

      updatePlayPauseIcon(state.paused);

      clearInterval(progressInterval);
      progressInterval = setInterval(() => {
        player.getCurrentState().then(s => {
          if (!s) return;
          const progress = (s.position / s.duration) * 1000;
          progressBar.value = progress;
          updateProgressBarStyle(progress);
        });
      }, 500);
    });

    progressBar.oninput = async e => {
      const percentage = e.target.value;
      const state = await player.getCurrentState();
      if (!state) return;
      const seekPos = (percentage / 1000) * state.duration;
      player.seek(seekPos);
      updateProgressBarStyle(percentage);
    };

    volumeControl.oninput = e => {
      const volume = Number(e.target.value);
      player.setVolume(volume / 100);
      updateVolumeBarStyle(volume);
    };
  });

  setInterval(async () => {
    const playback = await getCurrentPlayback(token);
    if (!playback || playback.device.id === deviceId) return;
    renderTrackInfo(playback);
  }, 1000);

}

(async () => {
  if (!token && !code) {
    window.location.href = '/';
    return;
  }

  if (code && !token) {
    token = await getAccessToken(code);
    localStorage.setItem('access_token', token);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  if (token) {
    try {
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Token inválido');
      startApp(token);
    } catch (err) {
      localStorage.removeItem('access_token');
      window.location.href = '/';
    }
  }
})();
