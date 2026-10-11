/**
 * Servicio de verificación de Roblox
 * Usa fetch nativo. Nunca solicita contraseñas ni cookies.
 */

const CACHE_TTL = 60_000;
const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.exp) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data) {
  cache.set(key, { data, exp: Date.now() + CACHE_TTL });
}

async function fetchConReintento(url, options = {}, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AegisMeridianBot/1.0',
          ...(options.headers || {}),
        },
      });

      if (res.status === 429) {
        const wait = Number(res.headers.get('retry-after') || 2) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Roblox API ${res.status}: ${body.slice(0, 200)}`);
      }

      return await res.json();
    } catch (err) {
      if (i === intentos - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

/**
 * Busca un usuario de Roblox por nombre de usuario.
 * POST https://users.roblox.com/v1/usernames/users
 */
async function buscarPorUsuario(username) {
  const key = `user:${username.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await fetchConReintento('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: true,
    }),
  });

  const user = data.data?.[0] || null;
  if (user) cacheSet(key, user);
  return user;
}

/**
 * Obtiene el perfil completo de un usuario por ID.
 * GET https://users.roblox.com/v1/users/{id}
 */
async function obtenerUsuario(userId) {
  const key = `id:${userId}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await fetchConReintento(`https://users.roblox.com/v1/users/${userId}`);
  cacheSet(key, data);
  return data;
}

/**
 * Obtiene el avatar headshot.
 * GET https://thumbnails.roblox.com/v1/users/avatar-headshot
 */
async function obtenerAvatar(userId) {
  const key = `avatar:${userId}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await fetchConReintento(
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
  );

  const url = data.data?.[0]?.imageUrl || null;
  if (url) cacheSet(key, url);
  return url;
}

/**
 * Genera un código de verificación AEGIS-XXXX-NN
 */
function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let parte = '';
  for (let i = 0; i < 4; i++) {
    parte += chars[Math.floor(Math.random() * chars.length)];
  }
  const num = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  return `AEGIS-${parte}-${num}`;
}

/**
 * Comprueba si la descripción del usuario de Roblox contiene el código.
 */
async function verificarCodigo(userId, codigo) {
  const user = await obtenerUsuario(userId);
  if (!user || !user.description) return false;
  return user.description.includes(codigo);
}

module.exports = {
  buscarPorUsuario,
  obtenerUsuario,
  obtenerAvatar,
  generarCodigo,
  verificarCodigo,
};
