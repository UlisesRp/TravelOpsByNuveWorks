# Travel Ops by Nuve Works

Sistema web de gestión operativa para agencias de viajes, desarrollado por **Nuve Works**.

Esta instalación está preparada para operar **Pink Sky Travel** y **Velora Travel** desde una misma plataforma.

## Cambios de esta versión
- Logo principal de **Travel Ops by Nuve Works** agregado en login y sidebar.
- Logo de **Pink Sky Travel** agregado en sus lugares visuales.
- Logo de **Velora Travel** agregado en sus lugares visuales.
- Las salidas nuevas ahora **quedan guardadas** en la demo mediante `localStorage`.
- El **CRM ahora es global para todos** los usuarios.
- En Supabase, el CRM también quedó con acceso global para usuarios autenticados.

## Incluye
- Login preparado para Supabase Auth.
- 3 usuarios o más con acceso total a la operación.
- CRM global para todo el equipo.
- Dashboard general.
- Calendario mensual de salidas.
- Alta y consulta de salidas.
- Filtro Pink Sky Travel / Velora Travel / ambas.
- Pasajeros con nombre completo + fecha de nacimiento.
- Base para lista completa de pasajeros por agencia o salida.
- Base para Rooming List.
- Pagos y saldos.
- Facturación.
- Base de datos SQL preparada para Supabase.

## Abrir la demo
Abre `index.html` directamente con doble clic y pulsa **Entrar en modo demo**.

La demo funciona desde `file://`, sin servidor y sin Supabase.

## Conectar Supabase
1. Crea un proyecto en Supabase.
2. Abre `supabase/schema.sql` y ejecuta todo en **SQL Editor**.
3. En Supabase entra a **Authentication > Users** y crea los 3 usuarios.
4. Abre `js/supabase.js`.
5. Pega `window.SUPABASE_URL` y `window.SUPABASE_ANON_KEY`.
6. Cambia:
   `window.SUPABASE_ENABLED = false`
   por:
   `window.SUPABASE_ENABLED = true`

## Nota
En modo demo, las salidas y prospectos se guardan en el navegador del equipo que estés usando.

---
**Travel Ops by Nuve Works**
