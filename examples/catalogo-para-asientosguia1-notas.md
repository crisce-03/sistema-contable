# Catálogo personalizado para asientosguia1.json

Preparado a partir de `C:\Users\ASUS\Desktop\asientosguia1.json`.

`catalogo-para-asientosguia1.json` contiene 23 cuentas: las 18 utilizadas en
los asientos y 5 padres necesarios. Los niveles de 1 y 2 dígitos ya existen
en la aplicación. Todas las cuentas del archivo están activas.

Los nombres se deducen del uso de los códigos en los conceptos y movimientos
del archivo recibido. Esta numeración es personalizada, diferente de la del
catálogo PDF. Por ejemplo, aquí `1102` representa Inventarios, `1103` IVA
crédito fiscal y `2102` IVA débito fiscal.

Importa el catálogo en un ejercicio separado para evitar renombrar cuentas
del catálogo PDF que tengan esos mismos códigos. Selecciona **IVA incluido**
en Configuración, guarda el cambio y abre **2026** antes de importar tus asientos.

## Alcance de la verificación

Se comprobó la importación de los 13 asientos con el validador y el motor local
del proyecto, utilizando únicamente este catálogo y las cuentas predefinidas.
Todos cuadran: Debe y Haber suman **$134,980.00** por lado. Una segunda importación
omite los 13 registros existentes. No se modificaron los códigos, fechas,
referencias ni importes del archivo recibido.

La aplicación todavía asigna clasificaciones internas según prefijos del
catálogo PDF. Cambiar el nombre mediante JSON no cambia esas clasificaciones:
por ejemplo, `1102` sigue clasificado internamente como cuentas por cobrar y
`4102` como gastos administrativos. Este archivo permite registrar los códigos
y agruparlos en el Mayor; el asistente fiscal y los informes que utilicen esas
clasificaciones requieren adaptar esa lógica para esta numeración personalizada.

El código `120101` se denomina Bienes muebles y equipo porque recibe los
escritorios y es padre de `12010101` (laptop) y `12010102` (vehículo).

La validación de importación no corrige el sentido contable de los movimientos.
En particular, el asiento #2 carga Caja y abona Bancos: si representa un depósito
de efectivo en el banco, sus lados están invertidos. Se conservó tal como aparece
en el archivo recibido.
