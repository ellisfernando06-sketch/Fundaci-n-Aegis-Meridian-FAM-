# Fundación Aegis-Meridian · Catálogo de accesos

**Custodes Veritatis**

Documento de referencia: qué hace cada **llave (KEY)**, qué hace cada **nivel de autorización (permiso)** y qué **comandos** desbloquea.

---

## 1. Cómo funciona el acceso

Hay **tres capas**:

| Capa | Qué es | Para qué sirve |
|------|--------|----------------|
| **Nivel de autorización (0–5)** | Rol de clasificación de información | Define qué tan sensible es la información que puedes manejar en comandos |
| **Llaves (KEYS)** | Roles `[KEY] …` y/o registro en base de datos | Abren **canales concretos** y autorizan **comandos** de área |
| **Cargo del organigrama** | Rol de rango (Director, Jefe, etc.) | También puede autorizar comandos de mando aunque no tengas la key |

**Reglas:**

1. Quien tiene **Administrator** en Discord puede usar **todos** los comandos.
2. Si no eres Admin, para comandos restringidos hace falta:
   - alcanzar el **nivel mínimo**, **y**
   - tener **al menos una key** de la lista del comando **o** un **cargo de mando** asociado.
3. Las llaves, al otorgarse, solo dan en los canales vinculados: **Ver canal**, **Enviar mensajes**, **Leer historial**, **Embeds**. Nunca permisos de gestión del servidor.

---

## 2. Niveles de autorización (permisos)

Se gestionan con `/autorizacion otorgar` y `/autorizacion consultar`.

| Nivel | Nombre del rol | Para qué sirve |
|-------|----------------|----------------|
| **0** | Nivel 0 · Público | Información abierta. Sin acceso a material clasificado ni comandos operativos. |
| **1** | Nivel 1 · Confidencial | Personal básico, áreas y coordinación interna de bajo riesgo. |
| **2** | Nivel 2 · Restringido | Operaciones de área: anomalías, incidentes, misiones, sanciones de rutina. |
| **3** | Nivel 3 · Secreto | Alertas de sitio, investigaciones internas, material sensible de SI/Inteligencia. |
| **4** | Nivel 4 · Alto secreto | Contención de alto riesgo, archivos Keter/Apollyon, bóvedas y archivos críticos. |
| **5** | Nivel 5 · Meridiano | Máxima clasificación (cúpula / dirección estratégica). |

**Otros roles de estado:**

| Rol | Para qué sirve |
|-----|----------------|
| **Verificado en Roblox** | Cuenta de Roblox vinculada y validada (`/perfil`). |
| **Suspendido** | Miembro bajo sanción; se limita el uso normal del servidor. |
| **Visitante** | Sin ficha completa o sin rango de personal. |

---

## 3. Catálogo de llaves (KEYS)

Formato del rol en Discord: **`[KEY] Nombre de la llave`**.

### Cúpula y gobierno

| ID | Nombre | Para qué sirve | Nivel mín. |
|----|--------|----------------|------------|
| **KEY-CUP-01** | Llave Meridiano | Salas de gobierno y canales de la cúpula. | 1 |
| **KEY-CUP-02** | Llave de Junta | Sala de la Junta y coordinación del Director General. | 1 |

### Seguridad

| ID | Nombre | Para qué sirve | Nivel mín. |
|----|--------|----------------|------------|
| **KEY-SEG-01** | Llave de Guardia | Puestos de guardia, vestuario, salas de patrulla. | 4 |
| **KEY-SEG-02** | Llave de Oficiales | Sala de oficiales y canal de mando operativo. | 3 |
| **KEY-SEG-03** | Llave de Comando de Seguridad | Centro de comando y planes de defensa del sitio. | 2 |
| **KEY-SEG-04** | Llave de Dirección de Operaciones de Seguridad | **Key del Director de Operaciones de Seguridad de F.A.M.** Comando, defensa, armería y sala de control. | 1 |

### FTM y Respuesta rápida

| ID | Nombre | Para qué sirve | Nivel mín. |
|----|--------|----------------|------------|
| **KEY-FTM-01** | Llave Táctica | Cuartel FTM y canal de operaciones. | 4 |
| **KEY-FTM-02** | Llave de Mando Táctico | Mando FTM y planificación de operaciones especiales. | 3 |
| **KEY-ERR-01** | Llave de Respuesta | Área de respuesta rápida y despliegue. | 4 |
| **KEY-ERR-02** | Llave de Mando de Respuesta | Mando de respuesta rápida y coordinación de crisis. | 3 |

### Seguridad Interna (SI)

| ID | Nombre | Para qué sirve | Nivel mín. |
|----|--------|----------------|------------|
| **KEY-SI-01** | Llave de Auditoría | Canales de auditoría y revisiones de personal. | 4 |
| **KEY-SI-02** | Llave de Expedientes Internos | Expedientes y salas de investigación de SI. | 3 |
| **KEY-SI-03** | Llave de Gerencia de Seguridad Interna | Gerencia SI y control disciplinario. | 2 |

### Inteligencia

| ID | Nombre | Para qué sirve | Nivel mín. |
|----|--------|----------------|------------|
| **KEY-INT-01** | Llave de Archivo de Inteligencia | Archivo y registros de vigilancia. | 4 |
| **KEY-INT-02** | Llave de Operaciones de Inteligencia | Operaciones de campo y salas de análisis. | 3 |
| **KEY-INT-03** | Llave de Gerencia de Inteligencia | Gerencia de inteligencia y reportes clasificados. | 2 |

### Medicina

| ID | Nombre | Para qué sirve | Nivel mín. |
|----|--------|----------------|------------|
| **KEY-MED-01** | Llave Clínica | Enfermería, consultorios y registros clínicos. | 4 |
| **KEY-MED-02** | Llave de Cirugía y Bioseguridad | Quirófano, laboratorio médico y bioseguridad. | 3 |
| **KEY-MED-03** | Llave de Dirección Médica | Oficina de dirección médica e informes de salud. | 2 |

### Investigación

| ID | Nombre | Para qué sirve | Nivel mín. |
|----|--------|----------------|------------|
| **KEY-INV-01** | Llave de Laboratorio | Laboratorios y análisis de bajo riesgo. | 4 |
| **KEY-INV-02** | Llave de Cámaras de Estudio | Cámaras de estudio de anomalías. | 3 |
| **KEY-INV-03** | Llave de Dirección Científica | Oficina de dirección científica y proyectos. | 2 |

### Clase D e Insurgencia

| ID | Nombre | Para qué sirve | Nivel mín. |
|----|--------|----------------|------------|
| **KEY-CD-01** | Pase de Celda | Celdas y zonas Clase D. No abre salas del personal. | 4 |
| **KEY-CAOS-01** | Pase Insurgente | Zonas RP de la Insurgencia del Caos. | 4 |
| **KEY-CAOS-02** | Pase de Mando Insurgente | Mando de la Insurgencia del Caos. | 3 |

### Llaves especiales

| ID | Nombre | Para qué sirve | Nivel mín. |
|----|--------|----------------|------------|
| **KEY-ESP-01** | Llave de Contención Keter | Contención y archivos Keter / Apollyon. | 4 |
| **KEY-ESP-02** | Llave de Armería Pesada | Armería y equipo pesado. | 3 |
| **KEY-ESP-03** | Llave de Cámaras de Prueba | Cámaras de prueba con Clase D. | 3 |
| **KEY-ESP-04** | Llave de Archivo Omega-1 | Archivos históricos del Sitio Omega-1. | 4 |
| **KEY-ESP-05** | Llave de Quirófano de Contención | Quirófano de contención y bioseguridad. | 3 |
| **KEY-ESP-06** | Llave de Sala de Control | Cámaras, alarmas y cambios de alerta. | 3 |
| **KEY-ESP-07** | Llave de Bóveda de Artefactos | Bóveda de objetos anómalos. | 4 |
| **KEY-ESP-08** | Llave de Transferencias | Traslado de objetos entre sitios. | 3 |
| **KEY-ESP-09** | Llave de Interrogatorio | Salas de interrogatorio. | 3 |

---

## 4. Comandos: key + nivel

| Comando | Nivel mín. | Keys que autorizan |
|---------|------------|--------------------|
| `/perfil` | — | Público |
| `/organigrama` | — | Público |
| `/llaves` (catálogo / mías) | — | Público |
| `/personal` | 1 | CUP-01, CUP-02, SI-03 |
| `/autorizacion` | 2 | CUP-01, SI-03 |
| `/area` | 1 | CUP-01, SI-03 |
| `/anomalia` | 2 | INV-01…03, ESP-01, ESP-07 |
| `/incidente` | 2 | SEG-01…**04**, SI-01 |
| `/alerta` | 3 | ESP-06, SEG-03, **SEG-04**, CUP-01 |
| `/mision` | 2 | SEG-02…**04**, FTM-02, ERR-02 |
| `/sancion` | 2 | SI-01…03, CUP-01 |
| `/interna` | 3 | SI-02/03, INT-02/03, ESP-09 (+ solo MD o canal oculto) |
| `/config*` | — | Solo Administrator |

---

## 5. Guía rápida por cargo

| Cargo | Keys recomendadas | Comandos principales |
|-------|-------------------|----------------------|
| Fundador / Cofundadores | CUP-01, CUP-02 + dirección | Todo operativo |
| Director General de F.A.M | CUP-01/02, SEG-04, ESP-06 | personal, auth, alerta, sanción, interna |
| **Dir. Operaciones de Seguridad de F.A.M** | **KEY-SEG-04**, SEG-03, ESP-02/06/08 | incidente, alerta, misión |
| Director Médico de F.A.M | MED-03, MED-02, ESP-05 | anomalía médica |
| Director Investigación de F.A.M | INV-03, INV-02, ESP-01/07 | anomalía |
| Gerente SI | SI-03, SI-02, SI-01, ESP-09 | sanción, interna |
| Gerente Inteligencia | INT-03, INT-02, ESP-09 | interna |
| Jefes / Subcomandantes | Keys de mando de su rama | incidente / misión |
| Personal base | Key base de su área | Públicos + reportes si nivel ≥2 |
| Clase D | KEY-CD-01 | Solo públicos |
| Insurgencia | KEY-CAOS-01/02 | Solo públicos |

---

## 6. Gestión en el bot

| Acción | Comando |
|--------|--------|
| Ver catálogo | `/llaves catalogo` |
| Tus keys | `/llaves mias` |
| Otorgar / revocar | `/llaves otorgar` · `revocar` |
| Vincular canal | `/config_llaves vincular_canal` |
| Crear roles KEY | `/config_roles` → Crear o `/config_llaves crear_rol` |
| Nivel 0–5 | `/autorizacion otorgar` |

---

**Resumen:** los **permisos (0–5)** clasifican información; las **keys** abren canales y comandos de área. **KEY-SEG-04** es la del Director de Operaciones de Seguridad de F.A.M.

*Fundación Aegis-Meridian · Documento de accesos*
