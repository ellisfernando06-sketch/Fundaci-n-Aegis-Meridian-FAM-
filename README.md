# Fundación Aegis-Meridian

**Custodes Veritatis**

Bot de Discord de la Fundación Aegis-Meridian. Contiene y estudia anomalías. Se presenta al público como una ONG científica.

---

## Stack

- Node.js 20+
- discord.js v14
- better-sqlite3
- dotenv

## Estructura (Fase 0)

```
src/
  commands/          # Comandos slash (se añaden en fases posteriores)
  components/        # Botones, menús y formularios (customId: modulo:accion:id)
  data/
    organigrama.js   # Fuente de verdad de rangos y áreas
    llaves.js        # Catálogo inicial de llaves de acceso
  db/
    schema.js        # Esquema SQLite
    index.js         # Conexión, seed y contadores
  handlers/
    interacciones.js # Manejador global de interacciones
  services/
    auditoria.js     # Registro de auditoría
  utils/
    plantillas.js    # Embeds oficiales
    helpers.js       # Utilidades de texto y comparación
  deploy-commands.js # Registro de comandos slash
  index.js           # Punto de entrada
```

## Variables de entorno

Copia `.env.example` a `.env` (o configura en Railway):

```
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
DATABASE_PATH=data/aegis.db
```

El token ya está configurado en Railway.

## Instalación local

```bash
npm install
cp .env.example .env
# Completar DISCORD_TOKEN, CLIENT_ID y GUILD_ID
npm run register
npm start
```

## Developer Portal

- OAuth2 → Scopes: `bot` y `applications.commands`
- Permisos del bot (valor combinado `2550221824`): Manage Roles, Manage Nicknames, View Channels, Send Messages, Embed Links, Read Message History, Use Application Commands
- Pestaña Bot → activar **Server Members Intent**
- En el servidor, el rol del bot debe quedar por encima de todos los roles de rango que vaya a asignar

## Estado del proyecto

- **Fase 0** completada: estructura, base de datos, organigrama, llaves, manejador de interacciones, auditoría y plantillas.
- Fases siguientes pendientes de autorización.
