# Guía #1 — La Vaquita, S.A. de C.V.

Fuente: `Guia #1.pdf`, página 1. El documento contiene enunciados de operaciones;
estos archivos desarrollan sus asientos para el formato del sistema.

## Cómo importar

1. En Catálogo, importa `catalogo-pdf-importable.json` si todavía no lo has cargado.
2. Comprueba que el período **2026 esté abierto**. Selecciona **IVA incluido** en
   Configuración y pulsa **Guardar configuración**. El JSON declara ese modo
   y el importador exige que coincida con el modo activo.
   Los importes del archivo ya están calculados; no se aplica IVA nuevamente.
3. En Libro Diario, importa `asientos-guia-1.json`.

Todos los códigos utilizados existen en `catalogo-pdf-importable.json`.
Ya no se necesita `catalogo-guia-1-complemento.json` ni agregar cuentas al catálogo.

El archivo contiene 11 asientos normales, con importes finales en dólares y
referencias únicas `GUIA1-2026-001` a `GUIA1-2026-011`. Cada detalle registra
únicamente la cuenta elegida; el sistema acumula sus importes en la cuenta
de mayor de 4 dígitos sin repetir líneas para sus padres.

## Criterios y supuestos de la conversión

- **Año:** la guía no indica año. Se utiliza 2026 como supuesto; si necesitas
  otro período, cambia el año en todas las fechas y referencias antes de importar.
- **Orden:** se ordenaron las operaciones cronológicamente. La venta del 16 de
  febrero aparece antes de la compra de vehículo del 20, aunque el PDF las lista
  en orden inverso.
- **IVA:** para los importes con IVA incluido, base = total / 1.13, redondeada a
  centavos; IVA = total menos base. No se agregó IVA al aporte de los socios,
  depósitos, cobros, cancelaciones de deudas ni al principal del préstamo.
- **Mercadería:** la compra del 5 de enero se registra como ingreso a Inventarios
  `1105`, por $8,849.56 sin IVA. Se utiliza esta cuenta del catálogo del PDF,
  que no contiene una cuenta independiente de Compras `4104`. El aporte inicial
  también se registra en `1105`. No se registran costo de
  ventas ni ajustes de inventario: la guía indica que todavía no se utilicen
  los costos unitarios. No hay inventario final para calcular esos ajustes.
- **Compra del 5 de enero:** se identifica al proveedor como Lácteos Metapán
  a partir del enunciado del pago del 15 de enero. El CCF 1644 se menciona en la
  descripción de la compra; el pago posterior cancela la deuda completa y no
  vuelve a registrar el IVA. Se interpreta la mención «venta de 5 de enero» en
  el enunciado del pago como referencia a esa compra.
- **Cobro del 10 de febrero:** se suponen dos cuotas iguales de $6,000.00 sobre
  la venta por $12,000.00. Queda pendiente una segunda cuota de $6,000.00.
- **Bancos:** pagos por transferencia y cheque se asignan a la cuenta corriente
  genérica `11010201`. Banco Cuscatlán y su cuenta N.º 0001 se conservan en las
  descripciones porque el catálogo no incluye una subcuenta específica para ese
  banco. El desembolso del préstamo se supone depositado
  en una cuenta corriente de Banco Davivienda (`1101020103`).
- **Vehículo:** se paga el 10% del total con IVA ($1,500.00). Los $13,500.00
  pendientes se registran en Otras cuentas por pagar `210314`, con Grupo Q en
  la descripción; la guía no especifica pagaré ni plazo de esa deuda.
- **Préstamo:** comisión = $20,000.00 × 5% = $1,000.00; IVA sobre comisión =
  $130.00. Se supone que ambos se descuentan del préstamo, por lo que el banco
  deposita $18,870.00 y la obligación es de $20,000.00. La comisión se registra
  en `420102` para este ejercicio académico. No se devengan intereses ni se
  separa una porción corriente: la guía no proporciona calendario de cuotas
  ni solicita un ajuste por intereses. La tasa del 18% y los 8 años quedan
  indicados en el concepto del asiento.
- **Capital y ventas:** se utilizan las cuentas de mayor `3101` y `5101`,
  sin suponer una clase de capital ni una sala de ventas que la guía no especifica.

El modo general del JSON es `incluido`. La excepción «comisión del 5% más IVA»
se calcula explícitamente en las líneas del préstamo; el importador recibe
los importes finales y no aplica IVA nuevamente.

## Control de importes

| Referencia | Fecha | Operación | Debe = Haber |
| --- | --- | --- | ---: |
| GUIA1-2026-001 | 01 de enero | Aporte inicial | 36,000.00 |
| GUIA1-2026-002 | 03 de enero | Depósito en Banco Cuscatlán | 20,000.00 |
| GUIA1-2026-003 | 05 de enero | Compra de queso a crédito | 10,000.00 |
| GUIA1-2026-004 | 10 de enero | Venta a crédito | 12,000.00 |
| GUIA1-2026-005 | 15 de enero | Pago al proveedor | 10,000.00 |
| GUIA1-2026-006 | 31 de enero | Compra de escritorios | 300.00 |
| GUIA1-2026-007 | 10 de febrero | Cobro de primera cuota | 6,000.00 |
| GUIA1-2026-008 | 15 de febrero | Compra de laptop | 580.00 |
| GUIA1-2026-009 | 16 de febrero | Venta en efectivo | 5,000.00 |
| GUIA1-2026-010 | 20 de febrero | Compra de vehículo | 15,000.00 |
| GUIA1-2026-011 | 20 de febrero | Préstamo y comisión | 20,000.00 |
| **Total** | | | **134,880.00** |
