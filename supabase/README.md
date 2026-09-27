# Configurar el sistema contable con Supabase

El código ya utiliza Supabase para guardar los ejercicios. Para ponerlo en marcha debes crear tu proyecto, ejecutar los dos SQL y configurar las claves en tu equipo. No hay un proyecto remoto ni credenciales incluidos en el repositorio.

## 1. Crear el proyecto

1. Entra en [Supabase](https://supabase.com/dashboard) y accede a tu cuenta.
2. Crea una organización si aún no tienes una y selecciona **New project**.
3. Escribe un nombre, por ejemplo `sistema-contable`, elige una región cercana y establece una contraseña segura para PostgreSQL. Guarda esa contraseña; no es la contraseña del usuario de la aplicación.
4. Espera a que el proyecto termine de crearse.

## 2. Crear las tablas y funciones

En el proyecto, abre **SQL Editor → New query**:

1. Copia el contenido completo de [script.sql](script.sql) y ejecútalo con **Run**.
2. Abre otra consulta, copia [data.sql](data.sql) completo y ejecútalo.

`script.sql` es una instalación inicial para un proyecto vacío: crea 11 tablas, relaciones, índices, validaciones de partida doble, funciones transaccionales y políticas de acceso. Se ejecuta una vez. Si lo repites, PostgreSQL indicará que los objetos ya existen; no borres las tablas para actualizar una instalación con datos. Las futuras actualizaciones requieren migraciones específicas.

`data.sql` carga **43 cuentas**: 20 grupos y rubros, y 23 cuentas operativas compatibles con tu archivo `asientosguia1.json`. Puede repetirse: actualiza la plantilla sin modificar ejercicios existentes. No carga asientos, saldos ni usuarios. Lee [CATALOGO.md](CATALOGO.md) antes de cambiar a otro catálogo.

Comprueba la instalación con esta consulta:

```sql
select count(*) as cuentas_plantilla from public.catalogo_base;
-- Resultado esperado: 43

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
-- Las 11 tablas de la aplicación tienen rowsecurity = true.
```

Los libros aparecerán en **Table Editor** después de iniciar sesión por primera vez. `auth.users` lo administra Supabase; no debes crearlo manualmente.

## 3. Configurar autenticación

1. En **Authentication**, habilita el proveedor **Email** y el registro de usuarios si deseas usar el botón **Crear una cuenta**.
2. En **URL Configuration**, establece **Site URL** como `http://localhost:3000` para desarrollo.
3. Añade `http://localhost:3000` y `http://localhost:3000/**` a las URL de redirección permitidas. Cuando publiques la aplicación, añade su dominio y úsalo como Site URL.
4. Si mantienes activa la confirmación de correo, confirma el mensaje recibido antes de entrar. La recuperación de contraseña utiliza también estas URL. Para enviar correos a usuarios reales, configura tu proveedor SMTP en Supabase; el servicio de correo de pruebas tiene restricciones.

También puedes crear un usuario confirmado desde **Authentication → Users** para probar el sistema. No insertes contraseñas mediante SQL.

## 4. Configurar las variables del proyecto

En **Connect** copia la URL del proyecto y su clave pública. En **Settings → API Keys** copia también una clave secreta para el servidor.

Desde la raíz del repositorio, en PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Edita `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE
SUPABASE_SECRET_KEY=sb_secret_TU_CLAVE
```

La clave pública se utiliza en el navegador. La clave secreta se utiliza exclusivamente en el servidor Next.js: nunca la prefijes con `NEXT_PUBLIC_`, la pongas en un componente ni la subas a Git. `.env.local` está ignorado. Si tu proyecto todavía usa claves antiguas, se admiten `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` como alternativas.

No necesitas colocar la contraseña de PostgreSQL ni una cadena `DATABASE_URL`: esta integración utiliza Supabase Auth y su API de funciones PostgreSQL.

## 5. Iniciar la aplicación

```powershell
npm install
npm run dev
```

Abre `http://localhost:3000`. Crea tu cuenta, confirma el correo si corresponde e inicia sesión. El primer acceso crea un libro propio con el catálogo inicial, el año actual abierto, IVA incluido y el método de inventarios explícitos. Puedes cambiar estas opciones en **Configuración**.

Si editas `.env.local`, reinicia `npm run dev`. Para producción, configura las mismas variables en el alojamiento, ejecuta `npm run build` y `npm start`; la aplicación necesita un servidor Next.js, no solo archivos estáticos.

## 6. Recuperar tus ejercicios actuales

Abre la aplicación desde **el mismo navegador y la misma dirección** donde usabas la versión anterior (incluido el puerto). Inicia sesión y entra en **Configuración → Trasladar datos y restaurar respaldos**.

- Pulsa **Buscar ejercicios en este navegador**.
- Selecciona el actual o uno archivado y pulsa **Trasladar a Supabase**.
- Confirma la importación. Se valida el libro completo en el servidor y se crea un nuevo ejercicio en tu cuenta; el ejercicio de Supabase que estaba activo queda archivado.
- Repite para otros ejercicios que quieras conservar en la nube.

El proceso no modifica ni borra IndexedDB. Si repites una importación, crea otra copia independiente. También puedes restaurar un archivo JSON de respaldo completo con `versionLocal: 2/3` o `versionAuditoria: 2`. Los JSON de solo catálogo o solo asientos se importan desde sus respectivas pantallas, no como respaldos completos.

La descarga de respaldo conserva IDs, asientos originales y reversiones, períodos, configuración y Kardex. Comprueba los totales y el número de registros después de importar.

## 7. Cargar tu guía

El catálogo inicial corresponde a [catalogo-para-asientosguia1.json](../examples/catalogo-para-asientosguia1.json). Se incluye una copia de tu archivo en [asientos-guia1-personalizado.json](../examples/asientos-guia1-personalizado.json).

1. Abre el período **2026** en Configuración si no existe.
2. Mantén **IVA incluido** y los enlaces iniciales de IVA/reportes.
3. En **Libro Diario**, importa ese archivo y confirma la vista previa.
4. Deben aparecer **13 asientos y 38 líneas**, con **$134,980.00 en Debe y Haber**.

El archivo `examples/asientos-guia-1.json`, con guiones, es un ejemplo comercial diferente de 11 asientos. No lo mezcles con este catálogo. Los inventarios físicos, las unidades y los costos de Kardex se completan con los datos del ejercicio; no se inventaron existencias iniciales ni finales.

## 8. Generar el DER

Se incluyen tres formatos, porque dbdiagram.io y diagrams.net son herramientas diferentes:

- **dbdiagram.io:** importa [diagram.sql](diagram.sql) como PostgreSQL, o pega [diagram.dbml](diagram.dbml) en su editor DBML.
- **diagrams.net / draw.io:** abre [diagram.drawio](diagram.drawio) con **File → Open from → Device**. Ya contiene las entidades y sus relaciones.

`diagram.sql` contiene únicamente tablas y relaciones para diagramación. **No lo ejecutes en Supabase**: usa `script.sql` para instalar la base real. El DER representa `auth.users` como `users`, con su identificador; omite las columnas internas de autenticación y contraseñas. Sus demás entidades y claves se generan desde el esquema real.

Para regenerar estos archivos después de modificar el esquema:

```powershell
node scripts/generate-diagram.cjs
```

## Funcionamiento y alcance

| Funcionalidad | Persistencia |
|---|---|
| Usuarios y contraseñas | Supabase Auth |
| Ejercicio activo y archivados | `libros` |
| Catálogo por ejercicio y jerarquía | `cuentas` |
| Períodos abiertos/cerrados | `periodos` |
| IVA, método de inventario, inventario físico y enlaces | `configuracion_libro`, `cuentas_reporte` |
| Diario, ajustes, reversiones, liquidaciones y cierre | `asientos`, `detalles_asiento` |
| Productos, cuentas y costos específicos del Kardex | `kardex_productos`, `kardex_cuentas`, `kardex_costos_movimiento` |
| Plantilla de nuevas cuentas | `catalogo_base` |
| Mayor, balanza y estados financieros | Calculados del diario mediante el motor existente |

Cada usuario tiene sus propios libros. La antigua pantalla de Usuarios y Roles era una maqueta sin operaciones; ahora **Mi cuenta** permite consultar la identidad y cambiar nombre y contraseña. No se implementaron equipos, invitaciones ni roles compartidos de contador/auxiliar/auditor.

Cada operación viaja a `/api/accounting`, donde se verifica el token con Supabase Auth y se ejecuta la validación contable. La escritura de todas sus tablas ocurre en una única transacción PostgreSQL; un error revierte el cambio completo. La base también comprueba partida doble y relaciones entre cuentas/asientos del mismo libro.

Las tablas tienen RLS y permiten a usuarios autenticados leer solo sus datos. El navegador no puede escribir tablas ni ejecutar las funciones de persistencia directamente. Las RPC de guardado son exclusivas del servidor. La identidad del propietario siempre proviene del token verificado, nunca del cuerpo de la petición.

La revisión del libro impide que dos pestañas sobrescriban cambios silenciosamente. Si aparece un conflicto, pulsa **Actualizar datos**, revisa el estado y vuelve a enviar tu operación. No se reintentan escrituras automáticamente. Los datos también se actualizan al volver a enfocar la ventana; no hay suscripción Realtime ni edición sin conexión.

Para conservar el motor y los flujos existentes, cada guardado reemplaza las filas del libro de forma transaccional y mantiene sus identificadores. Es una integración orientada a los ejercicios del sistema actual: libros muy grandes necesitarán operaciones incrementales y paginación. Las solicitudes de importación admiten hasta 10 MB.

## Verificación

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Las pruebas de base de datos ejecutan `script.sql` en PostgreSQL embebido (PGlite), con roles y `auth.uid()` simulados; verifican persistencia, RLS, permisos RPC, transacciones, conflictos y catálogo. Las pruebas HTTP verifican autenticación con un cliente simulado. Esto no sustituye la prueba final contra tu proyecto real.

Después de configurar Supabase, registra un asiento, recarga la página, entra desde otro navegador con la misma cuenta y comprueba que persiste. Crea otra cuenta y comprueba que su ejercicio sea independiente. Prueba también archivar/abrir un ejercicio y recuperar una contraseña.

## Problemas habituales

- **Falta configurar Supabase:** revisa las tres variables y reinicia Next.js.
- **Ejecuta script.sql/data.sql:** verifica que las claves sean del mismo proyecto donde ejecutaste los scripts.
- **El correo no llega:** comprueba la confirmación, URL de redirección y configuración SMTP en Authentication.
- **El período está bloqueado:** abre el año correspondiente antes de registrar movimientos nuevos.
- **El archivo no coincide con el IVA:** guarda el modo adecuado en Configuración antes de importar; los importes JSON ya son finales.
- **No aparecen datos locales:** utiliza el mismo origen y navegador de la versión anterior o restaura un respaldo descargado.
- **La compilación no descarga Inter:** el diseño existente usa Google Fonts; permite acceso de red durante la compilación o configura una fuente local.

Referencias oficiales: [claves de API](https://supabase.com/docs/guides/getting-started/api-keys), [autenticación por contraseña](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [funciones PostgreSQL](https://supabase.com/docs/guides/database/functions).
