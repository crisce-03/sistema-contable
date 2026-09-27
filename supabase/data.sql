-- Catálogo inicial de la guía asientosguia1: 20 grupos/rubros y 23 cuentas.
-- Generado por: node scripts/generate-catalog.cjs
-- Fuentes: lib/accounting/families.json y examples/catalogo-para-asientosguia1.json.
-- Ejecutar después de script.sql, antes de crear el primer libro.
-- Solo actualiza la plantilla de libros futuros; no modifica cuentas ni asientos existentes.
-- No combinar con el catálogo comercial: varios códigos tienen significados distintos.
-- Repetir el script restablece los nombres y padres de estos 43 códigos de la plantilla.

BEGIN;

INSERT INTO public.catalogo_base (codigo, nombre, padre_codigo)
VALUES
  ('1', 'Activo', NULL),
  ('2', 'Pasivo', NULL),
  ('3', 'Patrimonio', NULL),
  ('4', 'Cuentas de resultado deudoras', NULL),
  ('5', 'Cuentas de resultado acreedoras', NULL),
  ('6', 'Cuenta de cierre', NULL),
  ('7', 'Cuentas de orden', NULL),
  ('11', 'Activo corriente', '1'),
  ('12', 'Activo no corriente', '1'),
  ('21', 'Pasivo corriente', '2'),
  ('22', 'Pasivo no corriente', '2'),
  ('31', 'Capital y reservas', '3'),
  ('32', 'Resultados por aplicar', '3'),
  ('41', 'Costos y gastos de operación', '4'),
  ('42', 'Otros costos y gastos', '4'),
  ('51', 'Ingresos por ventas y servicios', '5'),
  ('52', 'Otros productos', '5'),
  ('61', 'Cuenta liquidadora', '6'),
  ('71', 'Cuentas de orden', '7'),
  ('72', 'Cuentas de orden por el contrario', '7'),
  ('1101', 'Efectivo y equivalentes de efectivo', '11'),
  ('1102', 'Inventarios', '11'),
  ('1103', 'IVA - Crédito fiscal', '11'),
  ('1104', 'Cuentas por cobrar', '11'),
  ('1201', 'Propiedades, planta y equipo', '12'),
  ('2101', 'Cuentas por pagar', '21'),
  ('2102', 'IVA - Débito fiscal', '21'),
  ('2201', 'Préstamos por pagar a largo plazo', '22'),
  ('3101', 'Capital social', '31'),
  ('4101', 'Compras', '41'),
  ('4102', 'Devoluciones sobre ventas', '41'),
  ('4103', 'Gastos financieros', '41'),
  ('5101', 'Ventas', '51'),
  ('5102', 'Devoluciones sobre compras', '51'),
  ('110101', 'Caja', '1101'),
  ('110102', 'Bancos', '1101'),
  ('110401', 'Clientes', '1104'),
  ('120101', 'Bienes muebles y equipo', '1201'),
  ('210101', 'Proveedores', '2101'),
  ('220101', 'Préstamos bancarios a largo plazo', '2201'),
  ('410301', 'Comisiones bancarias', '4103'),
  ('12010101', 'Equipo de cómputo', '120101'),
  ('12010102', 'Equipo de transporte', '120101')
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  padre_codigo = EXCLUDED.padre_codigo;

COMMIT;
