export async function play(device_id, token, uris) {
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
    method: 'PUT',
    body: JSON.stringify({ uris }),
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
}

export async function getUserPlaylists(token) {
  const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  return data.items.map(p => ({
    name: p.name,
    uri: p.uri
  }));
}

export async function playPlaylist(device_id, token, playlistUri) {
  const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
    method: 'PUT',
    body: JSON.stringify({ context_uri: playlistUri }),
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('playPlaylist error:', res.status, errorText);
  }
}

export async function getCurrentPlayback(token) {
  const res = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 204) return null;
  if (!res.ok) {
    console.warn('Playback fetch failed:', res.status);
    return null;
  }

  try {
    return await res.json();
  } catch (e) {
    console.error('Invalid JSON in getCurrentPlayback:', e);
    return null;
  }
}

export async function getAvailableDevices(token) {
  const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.devices;
}

export async function transferPlaybackTo(device_id, token, play = false) {
  await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ device_ids: [device_id], play })
  });
}

export async function resumePlayback(token, device_id, position_ms = 0, context_uri = null, offset_uri = null) {
  const body = {};

  if (position_ms) body.position_ms = position_ms;

  if (context_uri) {
    body.context_uri = context_uri;
    if (offset_uri) body.offset = { uri: offset_uri };
  } else if (offset_uri) {
    body.uris = [offset_uri]; // fallback
  }

  const url =
    typeof device_id === 'string' && device_id.trim() !== '' && device_id !== 'null'
      ? `https://api.spotify.com/v1/me/player/play?device_id=${device_id}`
      : `https://api.spotify.com/v1/me/player/play`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('resumePlayback failed:', res.status, err);
  }
}


export async function pausePlayback(token, device_id = null) {
  const url =
    device_id !== null && device_id !== undefined
      ? `https://api.spotify.com/v1/me/player/pause?device_id=${device_id}`
      : `https://api.spotify.com/v1/me/player/pause`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('pausePlayback failed:', res.status, err);
  }
}
