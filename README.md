## Catálogo y cuentas de mayor

Cada ejercicio comienza con los 7 grupos de 1 dígito y los 13 rubros de 2
dígitos del manual comercial. Estos niveles son predefinidos, no reciben
asientos y no se modifican mediante JSON. Las cuentas de 4 dígitos las
registra el usuario; no se cargan automáticamente.

La jerarquía es `1 → 11 → 1101 → 110101 → 11010101`. Solo se admiten cuentas
de usuario de 4, 6, 8 y 10 dígitos, con su padre inmediato existente o incluido
en el mismo archivo. El orden del archivo no importa.

```json
{
  "version": 1,
  "cuentas": [
    { "codigo": "1101", "nombre": "Efectivo y equivalentes de efectivo", "padreCodigo": "11", "activa": true },
    { "codigo": "110101", "nombre": "Caja", "padreCodigo": "1101", "activa": true },
    { "codigo": "11010101", "nombre": "Caja general", "padreCodigo": "110101", "activa": true }
  ]
}
```

`padreCodigo` se puede omitir: se obtiene quitando los últimos dos dígitos.
El campo antiguo `familia` es opcional; se conserva la clasificación interna
de cuentas conocidas para los asistentes del diario, sin limitar la creación
de otras cuentas de 4 dígitos. Los ejemplos completos están en
`examples/catalogo.json` y `examples/catalogo-parcial.json`.

En ambos ejemplos, `1101` es **Efectivo y equivalentes de efectivo** y
`110101` es **Caja**, hija de `1101`, tal como indica el PDF. Los movimientos
de caja de `examples/asientos-ejemplo.json` usan `110101`; el Mayor los acumula
en `1101`. `11010101` identifica Caja General cuando se necesita ese desglose.

Para registrar un asiento se selecciona obligatoriamente una cuenta activa de
4 dígitos. El selector permite buscarla por código o nombre y, opcionalmente,
elegir sus subcuentas de 6, 8 y 10 dígitos. El importe se registra una sola vez
en el último nivel elegido, incluso si esa cuenta tiene subcuentas. Todos sus
padres deben estar activos. Los movimientos anteriores se conservan. El Libro
Mayor y la balanza muestran únicamente cuentas de 4 dígitos, acumulando sus
movimientos directos y los de todas sus subcuentas una sola vez. Por ejemplo,
`510101` y `51010402` se consolidan en `5101`, aunque tengan distinta
clasificación o naturaleza.

Al abrir un ejercicio de la versión anterior, se agregan los niveles base y
los padres que falten, conservando los identificadores y asientos existentes.
Se archiva una copia del ejercicio anterior dentro de la misma transacción.
La exportación del catálogo incluye solo cuentas de usuario para poder
importarlas en otro ejercicio.

En el formulario del Libro Diario, **Calcular IVA (13%)** se activa por línea y
empieza desmarcado. Ingresa el importe directamente en Debe o Haber y elige
únicamente **IVA crédito fiscal** o **IVA débito fiscal**. El modo activo en
Configuración determina el cálculo: **IVA incluido** separa la base y el impuesto
del total ingresado (113 → 100 + 13); **Más IVA** conserva la base ingresada y suma
el 13% (100 → 100 + 13). El impuesto aparece en el mismo lado que el importe,
independientemente de si es crédito o débito fiscal.
Debajo del importe se muestra la base que se guardará; una fila adicional muestra
el IVA. Los totales suman la base y el impuesto una sola vez. La cuenta de IVA se
reconoce por su nombre en el catálogo; puedes asignarla en Configuración si tu
catálogo usa otro nombre o tiene varias cuentas posibles.
La contrapartida se completa manualmente y el asiento debe cuadrar antes de guardar.

Al editar el importe, cambia su IVA automáticamente. Al desmarcar la casilla se
retira el IVA generado y se conserva el importe ingresado; eliminar la línea
también retira su impuesto. Los aportes y transferencias sin la casilla marcada
mantienen sus importes completos. Solo se guardan los importes finales, sin los
controles del borrador; importar JSON no vuelve a calcular IVA.

Verificación: `npm test`, `npm run typecheck` y `npm run lint`.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
