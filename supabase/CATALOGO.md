# Catálogo inicial

`data.sql` instala la plantilla de la guía personalizada `asientosguia1.json`: **43 cuentas**, formadas por 20 grupos/rubros de uno y dos dígitos y 23 cuentas operativas de cuatro, seis y ocho dígitos. Los códigos se guardan como texto y cada cuenta conserva su padre inmediato.

La fuente de las 23 cuentas es [`examples/catalogo-para-asientosguia1.json`](../examples/catalogo-para-asientosguia1.json). Incluye los 18 códigos utilizados por la guía y sus cinco padres adicionales. La plantilla no carga operaciones de ejemplo, períodos históricos, productos ni saldos iniciales.

Ejecuta `script.sql` y luego `data.sql` en el SQL Editor antes de crear tu primer libro en la aplicación. Repetir `data.sql` actualiza los nombres y padres de estos 43 códigos **solo en la plantilla**. Los libros existentes conservan su catálogo y sus asientos. La plantilla se copia al crear libros nuevos; modificarla no sincroniza cambios con libros ya creados. No ejecutes este archivo sobre una plantilla comercial o personalizada diferente: dejaría códigos de ambas numeraciones.

El archivo se regenera con `node scripts/generate-catalog.cjs`. Esta generación verifica códigos únicos y padres existentes.

## Correspondencia de la guía

La numeración de esta guía difiere de la del catálogo comercial que también está incluido en `examples`:

| Función | Código de la guía | Código comercial |
|---|---|---|
| Inventarios | `1102` | `1105` |
| IVA crédito fiscal | `1103` | `1109` |
| Clientes | `110401` | Descendientes de `1102` |
| Proveedores | `210101` | Descendientes de `2102` |
| IVA débito fiscal | `2102` | `2108` |
| Compras | `4101` | `4104` del seed básico |
| Devoluciones sobre ventas | `4102` | `51010402` |
| Gastos financieros | `4103` | `4201` |
| Ventas | `5101` | `5101` y sus auxiliares |
| Devoluciones sobre compras | `5102` | `4105` del seed básico |

La configuración inicial está en [`lib/supabase/default-config.json`](../lib/supabase/default-config.json): IVA incluido, inventarios explícitos y asignación de las cuentas anteriores para IVA e informes. Los códigos no deben deducirse de una plantilla distinta. La guía no aporta una cuenta de gastos sobre compras ni una cuenta de utilidad: no se inventan asignaciones. El procedimiento existente de saldar resultados puede crear las cuentas de cierre necesarias.

Para cargar los asientos de la guía recibida, selecciona el ejercicio **2026** y conserva **IVA incluido**. Una copia del archivo está en [asientos-guia1-personalizado.json](../examples/asientos-guia1-personalizado.json): contiene 13 asientos, 38 líneas y un total de **$134,980.00 en cada lado**. Sus referencias e importes se conservan al importarlo desde Libro Diario. `examples/asientos-guia-1.json` es otro ejemplo del repositorio: tiene 11 asientos y no reemplaza al archivo de 13 asientos.

No se establece inventario final físico ni Kardex porque la guía no proporciona un conteo final, unidades y costos suficientes para completarlos. Registra esos datos cuando corresponda para elaborar el cierre. El asiento #2 del archivo original carga Caja y abona Bancos: representa esa dirección del movimiento; si la operación pretendida era depositar efectivo en el banco, debe corregirse explícitamente mediante los mecanismos del diario.

## Alternativa comercial

[`examples/catalogo-pdf-importable.json`](../examples/catalogo-pdf-importable.json) contiene 461 cuentas compatibles con la jerarquía de la aplicación. Con los 20 grupos/rubros predefinidos y las cuentas `4104 Compras` y `4105 Devolución sobre Compra` de `lib/accounting/seed.json`, un catálogo comercial para el flujo periódico sumaría **483 cuentas**.

Ese catálogo puede importarse desde Catálogo en un libro independiente preparado para esa numeración. No lo importes encima del catálogo de la guía: los códigos repetidos renombrarían cuentas y cambiarían su significado. Para usarlo como plantilla inicial de toda la instalación, prepara una instalación separada o sustituye la plantilla antes de crear libros y adapta también `lib/supabase/default-config.json` a sus cuentas. La aplicación permite asignar las cuentas de IVA e informes en Configuración.

El archivo `catalogo-pdf-completo.json` conserva 493 cuentas de referencia, incluidas longitudes que la aplicación no admite. Para importar utiliza la versión `importable`. Los detalles de la transcripción están en [`examples/catalogo-pdf-notas.md`](../examples/catalogo-pdf-notas.md).
