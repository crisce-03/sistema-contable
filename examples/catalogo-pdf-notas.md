# Catálogo extraído del PDF comercial

Fuente: `MANUAL-DE-APLICACION-DE-CUENTAS-COMERCIAL.pdf`, catálogo de las páginas 4 a 19.

## Archivos

- `catalogo-pdf-completo.json`: las 493 cuentas del catálogo, incluidos grupos y rubros de 1 y 2 dígitos, y auxiliares de 10 y 11 dígitos. Conserva los códigos y nombres del documento; `padreCodigo` se obtiene del ancestro existente con el prefijo más largo. Es la transcripción de referencia, no el archivo para importar en el sistema actual.
- `catalogo-pdf-importable.json`: 461 cuentas para importar en el módulo Catálogo, con códigos de 4, 6, 8 y 10 dígitos. Incluye los 24 auxiliares de 10 dígitos del PDF. Excluye los 20 grupos y rubros que ya están predefinidos en el sistema y los 12 auxiliares de 11 dígitos, que permanecen en el archivo completo sin modificar sus códigos.

Ambos usan `version: 1`, `cuentas`, `codigo`, `nombre`, `padreCodigo` y `activa`. Los códigos son texto y `activa` se establece en `true` como valor inicial para la aplicación; el PDF no especifica ese estado.

## Particularidades del documento

El PDF imprime `41021` (página 14) y `41031` (página 16) para los gastos de viáticos, viajes y representación. Sus hijos son `41021001`–`41021012` y `41031001`–`41031012`. El archivo completo conserva esos códigos de 5 dígitos. Solo en el importable se normalizan a `410210` y `410310`, respectivamente, para satisfacer la jerarquía de 6 a 8 dígitos. Esta normalización se deduce de los códigos de los hijos.

Los nombres conservan las mayúsculas, acentos y redacción del PDF, incluso repeticiones como «Cliente numero 1» en `11020101001` y `11020101003`. Se unen los textos partidos en varias líneas y se eliminan los espacios de composición dentro de códigos y palabras.

Ejemplo de la jerarquía transcrita:

```text
1101       EFECTIVO Y EQUIVALENTES DE EFECTIVO
  110101   CAJA
    11010101 Caja General
    11010102 Caja Chica
  110102   BANCOS MONEDA NACIONAL
    11010201 CUENTA CORRIENTE
      1101020101 Banco de América Central, S.A.
      1101020103 Banco Davivienda, S.A.
      1101020105 Banco Agrícola, S.A.
      1101020106 Banco Promerica
```

El botón **Descargar catálogo del PDF (JSON)** de la vista Catálogo entrega
`catalogo-pdf-importable.json`, incluidas sus 24 cuentas de 10 dígitos. Para
agregarlas a un ejercicio que tenía la versión de 437 cuentas, importa este
archivo actualizado desde **Importar catálogo JSON**. Se mantienen los
identificadores de las cuentas existentes y los asientos guardados.

Se transcribió el catálogo del PDF, sin agregar las cuentas `4104 Compras` ni `4105 Devolución sobre Compra` de los ejemplos anteriores del proyecto, porque no aparecen en este documento.
