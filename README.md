# Fundación Aegis-Meridian

**Custodes Veritatis**

Bot de Discord de la Fundación Aegis-Meridian. Contiene y estudia anomalías. Se presenta al público como una ONG científica.

---

## Stack

- Node.js 20+
- discord.js v14
- better-sqlite3
- dotenv

## Comandos (Fase 1)

| Comando | Descripción |
|---------|-------------|
| `/perfil` | Crear y verificar ficha · Ver · Editar · Eliminar · Revalidar Roblox |
| `/config` | Canales · Logs · Sitios · Clases de contención · Reiniciar contadores |
| `/config_roles` | Analizar · Crear faltantes · Vincular · Sincronizar colores · Exportar |

## Variables de entorno (Railway)

```
DISCORD_TOKEN=   # ya configurado
CLIENT_ID=
GUILD_ID=
DATABASE_PATH=/data/aegis.db
```

## Poner el bot en línea (Railway)

1. Conecta este repositorio a un servicio **Worker** en Railway (no Web).
2. Variables de entorno:
   - `DISCORD_TOKEN` (ya está)
   - `CLIENT_ID` → Application ID del Developer Portal
   - `GUILD_ID` → ID del servidor de Discord
   - `DATABASE_PATH` → `/data/aegis.db` (recomendado con volumen)
3. Añade un **Volume** montado en `/data` para persistir la base SQLite.
4. Deploy. El `Procfile` y `railway.toml` arrancan `node src/index.js`.
5. Tras el primer deploy, registra los comandos slash ejecutando una vez:

```bash
node src/deploy-commands.js
```

(Con las mismas variables de entorno, desde Railway one-off o en local.)

## Developer Portal

- OAuth2 → Scopes: `bot` + `applications.commands`
- Permisos del bot (valor `2550221824`): Manage Roles, Manage Nicknames, View Channels, Send Messages, Embed Links, Read Message History, Use Application Commands
- Pestaña Bot → **Server Members Intent** activado
- El rol del bot debe quedar **por encima** de todos los roles de rango que vaya a asignar

## Instalación local

```bash
npm install
cp .env.example .env
# Completar DISCORD_TOKEN, CLIENT_ID, GUILD_ID
npm run register
npm start
```

## Estado del proyecto

- **Fase 0** · Estructura, DB, organigrama, llaves, auditoría, plantillas
- **Fase 1** · `/config`, `/config_roles`, `/perfil` + verificación Roblox + deploy Railway
- Fases 2–4 pendientes
