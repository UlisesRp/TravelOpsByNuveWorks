# Travel Ops by Nuve Works

Sistema web de gestión operativa para agencias de viajes, desarrollado por **Nuve Works**.

Esta instalación está preparada para operar **Pink Sky Travel** y **Velora Travel** desde una misma plataforma.

## Incluye
- Login preparado para Supabase Auth.
- 3 usuarios o más con acceso total a la operación.
- CRM privado por usuario mediante RLS.
- Dashboard general.
- Calendario mensual de salidas.
- Alta y consulta de salidas.
- Filtro Pink Sky Travel / Velora Travel / ambas.
- Agencias y clientes por salida.
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
7. Sirve el proyecto desde localhost o GitHub Pages.

## Arquitectura de acceso
- Los 3 usuarios tienen acceso total a calendario, salidas, pasajeros, pagos, facturación y rooming.
- El CRM es privado para cada usuario mediante `owner_id = auth.uid()`.

## Siguiente etapa
Completar los CRUD reales para:
- Agencias / clientes dentro de una salida.
- Pasajeros.
- Abonos.
- Rooming List.
- Lista de pasajeros para emisión de vuelos.
- Exportación a Excel/PDF.
- Historial de movimientos.

---
**Travel Ops by Nuve Works**
