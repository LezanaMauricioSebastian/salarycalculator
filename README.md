# Calculadora de sueldo

Aplicación Angular para calcular horas y sueldo del cuidado de un adulto mayor en Argentina.

## Funciones

- **Período quincenal (cada 15 días)** por defecto, con opción mensual
- Calendario con **lunes a viernes seleccionados por defecto**
- Días seleccionables y deseleccionables
- **Feriados nacionales argentinos** detectados automáticamente
- Tarifa por hora normal, **tarifa por hora en feriado** (número en $) y horas por día configurables
- Resumen de sueldo con desglose de días normales y feriados
- Configuración guardada en el navegador (localStorage)

## Requisitos

- Node.js 18+
- npm

## Uso

```bash
npm install
npm start
```

Abrí [http://localhost:4200](http://localhost:4200) en el navegador.

## Cómo calcular

1. Configurá el período de cobro, tarifa por hora, tarifa en feriado y horas por día.
2. Elegí la quincena o el mes a calcular.
3. Tocá los días trabajados en el calendario (o usá "Seleccionar lun–vie").
4. Revisá el resumen al final con el total a cobrar.

## Probar en el teléfono

**Opción 1 — Simulador en la PC (rápido)**

1. Abrí la app en Chrome.
2. Presioná `F12` (herramientas de desarrollador).
3. Clic en el ícono de teléfono/tablet (o `Ctrl+Shift+M`).
4. Elegí un dispositivo, por ejemplo "iPhone 12" o "Pixel 7".

**Opción 2 — Celular real en la misma red Wi‑Fi**

1. En la PC, ejecutá `npm start` (ya escucha en toda la red).
2. Averiguá la IP de tu PC, por ejemplo: `hostname -I` en Linux.
3. En el celular, abrí el navegador y entrá a `http://TU_IP:4200` (ej: `http://192.168.1.10:4200`).

La PC y el celular tienen que estar en la misma red Wi‑Fi.

## Feriados

Se usan feriados nacionales según la Ley 27.399. Para 2025–2027 se usan fechas oficiales publicadas; para otros años se calculan con las reglas de traslado y Pascua.

## Supabase (calculate_salary)

1. En el proyecto **calculate_salary**, ejecutá el SQL de `supabase/migrations/20250616133000_initial.sql` (SQL Editor).
2. Copiá `src/environments/environment.example.ts` → `environment.ts` y `environment.prod.ts`.
3. Pegá **Project URL** y **anon key** desde Supabase → Settings → API.
4. Para GitHub Pages, agregá secrets en el repo: `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

La app guarda configuración, días seleccionados y horas por período. Si Supabase no está configurado, sigue usando localStorage.

## Build

```bash
npm run build
```

Los archivos quedan en `dist/momsproject`.
