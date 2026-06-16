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

## Build

```bash
npm run build
```

Los archivos quedan en `dist/momsproject`.

## Publicar en GitHub Pages

El repo debe llamarse **`salarycalculator`** (o cambiá `baseHref` en `angular.json` → `github-pages` si usás otro nombre).

1. Creá un repo en GitHub: [github.com/new](https://github.com/new) → nombre **`salarycalculator`** (público, sin README).
2. En el repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. En tu PC:

```bash
git remote set-url origin https://github.com/LezanaMauricioSebastian/salarycalculator.git
git push -u origin main
```

4. GitHub Actions compila y publica solo. La URL queda:

`https://LezanaMauricioSebastian.github.io/salarycalculator/`

Si el repo se llama `TU_USUARIO.github.io` (página de usuario), cambiá en `angular.json` el `baseHref` de `github-pages` a `"/"`.
