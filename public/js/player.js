export async function initializePlayer(token, onReadyCallback) {
  await loadSpotifySDK();

  const player = new Spotify.Player({
    name: 'Shadowfy',
    getOAuthToken: cb => cb(token),
    volume: 0.5
  });

  player.addListener('ready', ({ device_id }) => {
    onReadyCallback(device_id, player);
  });

  player.addListener('initialization_error', ({ message }) => console.error('Init error:', message));
  player.addListener('authentication_error', ({ message }) => console.error('Auth error:', message));
  player.addListener('account_error', ({ message }) => console.error('Account error:', message));
  player.addListener('playback_error', ({ message }) => console.error('Playback error:', message));

  player.connect();
}

function loadSpotifySDK() {
  return new Promise((resolve, reject) => {
    if (window.Spotify) return resolve();

    window.onSpotifyWebPlaybackSDKReady = () => resolve();

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.onerror = () => reject(new Error('Spotify SDK failed to load.'));
    document.head.appendChild(script);
  });
}

