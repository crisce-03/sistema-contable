-- DER PostgreSQL para importar en dbdiagram.io.
-- Generado desde supabase/schema.sql por node scripts/generate-diagram.cjs.
-- SOLO DIAGRAMA: no ejecutar este archivo en Supabase.
-- users representa únicamente la PK de auth.users, administrada por Supabase.
-- Omite CHECK, valores por defecto, índices secundarios, funciones, triggers y RLS.
-- Las reglas ejecutables completas están en schema.sql.

CREATE TABLE "users" (
  "id" uuid NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalogo_base" (
  "codigo" text NOT NULL,
  "nombre" text NOT NULL,
  "padre_codigo" text,
  CONSTRAINT "catalogo_base_padre_codigo_fkey" FOREIGN KEY ("padre_codigo") REFERENCES "catalogo_base" ("codigo") ON DELETE NO ACTION,
  CONSTRAINT "catalogo_base_pkey" PRIMARY KEY ("codigo")
);

CREATE TABLE "libros" (
  "id" uuid NOT NULL,
  "usuario_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "activo" boolean NOT NULL,
  "version_local" integer NOT NULL,
  "kardex_presente" boolean NOT NULL,
  "creado_en" timestamp with time zone NOT NULL,
  "actualizado_en" timestamp with time zone NOT NULL,
  CONSTRAINT "libros_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "libros_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cuentas" (
  "libro_id" uuid NOT NULL,
  "id" text NOT NULL,
  "codigo" text NOT NULL,
  "nombre" text NOT NULL,
  "familia" text NOT NULL,
  "tipo" text NOT NULL,
  "naturaleza" text NOT NULL,
  "rubro" text NOT NULL,
  "padre_codigo" text,
  "activa" boolean NOT NULL,
  "movimiento" boolean NOT NULL,
  "posicion" integer NOT NULL,
  CONSTRAINT "cuentas_libro_id_fkey" FOREIGN KEY ("libro_id") REFERENCES "libros" ("id") ON DELETE CASCADE,
  CONSTRAINT "cuentas_libro_id_padre_codigo_fkey" FOREIGN KEY ("libro_id", "padre_codigo") REFERENCES "cuentas" ("libro_id", "codigo") ON DELETE NO ACTION,
  CONSTRAINT "cuentas_pkey" PRIMARY KEY ("libro_id", "id"),
  CONSTRAINT "cuentas_libro_id_codigo_key" UNIQUE ("libro_id", "codigo"),
  CONSTRAINT "cuentas_libro_id_id_codigo_key" UNIQUE ("libro_id", "id", "codigo"),
  CONSTRAINT "cuentas_libro_id_posicion_key" UNIQUE ("libro_id", "posicion")
);

CREATE TABLE "periodos" (
  "libro_id" uuid NOT NULL,
  "anio" integer NOT NULL,
  "cerrado" boolean NOT NULL,
  "posicion" integer NOT NULL,
  CONSTRAINT "periodos_libro_id_fkey" FOREIGN KEY ("libro_id") REFERENCES "libros" ("id") ON DELETE CASCADE,
  CONSTRAINT "periodos_pkey" PRIMARY KEY ("libro_id", "anio"),
  CONSTRAINT "periodos_libro_id_posicion_key" UNIQUE ("libro_id", "posicion")
);

CREATE TABLE "configuracion_libro" (
  "libro_id" uuid NOT NULL,
  "modo_iva" text NOT NULL,
  "modo_inventario" text NOT NULL,
  "cuenta_iva_credito" text,
  "cuenta_iva_debito" text,
  "inventario_final_fisico" text,
  "campos_opcionales" text[] NOT NULL,
  CONSTRAINT "configuracion_libro_libro_id_cuenta_iva_credito_fkey" FOREIGN KEY ("libro_id", "cuenta_iva_credito") REFERENCES "cuentas" ("libro_id", "codigo") ON DELETE NO ACTION,
  CONSTRAINT "configuracion_libro_libro_id_cuenta_iva_debito_fkey" FOREIGN KEY ("libro_id", "cuenta_iva_debito") REFERENCES "cuentas" ("libro_id", "codigo") ON DELETE NO ACTION,
  CONSTRAINT "configuracion_libro_libro_id_fkey" FOREIGN KEY ("libro_id") REFERENCES "libros" ("id") ON DELETE CASCADE,
  CONSTRAINT "configuracion_libro_pkey" PRIMARY KEY ("libro_id")
);

CREATE TABLE "cuentas_reporte" (
  "libro_id" uuid NOT NULL,
  "rol" text NOT NULL,
  "codigo_cuenta" text,
  CONSTRAINT "cuentas_reporte_libro_id_codigo_cuenta_fkey" FOREIGN KEY ("libro_id", "codigo_cuenta") REFERENCES "cuentas" ("libro_id", "codigo") ON DELETE NO ACTION,
  CONSTRAINT "cuentas_reporte_libro_id_fkey" FOREIGN KEY ("libro_id") REFERENCES "configuracion_libro" ("libro_id") ON DELETE CASCADE,
  CONSTRAINT "cuentas_reporte_pkey" PRIMARY KEY ("libro_id", "rol")
);

CREATE TABLE "asientos" (
  "libro_id" uuid NOT NULL,
  "id" text NOT NULL,
  "referencia" text NOT NULL,
  "numero" integer NOT NULL,
  "fecha" date NOT NULL,
  "anio" integer,
  "concepto" text NOT NULL,
  "tipo" text NOT NULL,
  "reversa_de" text,
  "modo_iva" text,
  "ajuste_inventario" text,
  "liquidacion_iva" text,
  "cuadra" boolean NOT NULL,
  "campos_opcionales" text[] NOT NULL,
  "posicion" integer NOT NULL,
  CONSTRAINT "asientos_libro_id_anio_fkey" FOREIGN KEY ("libro_id", "anio") REFERENCES "periodos" ("libro_id", "anio") ON DELETE NO ACTION,
  CONSTRAINT "asientos_libro_id_fkey" FOREIGN KEY ("libro_id") REFERENCES "libros" ("id") ON DELETE CASCADE,
  CONSTRAINT "asientos_libro_id_reversa_de_fkey" FOREIGN KEY ("libro_id", "reversa_de") REFERENCES "asientos" ("libro_id", "id") ON DELETE NO ACTION,
  CONSTRAINT "asientos_pkey" PRIMARY KEY ("libro_id", "id"),
  CONSTRAINT "asientos_libro_id_numero_key" UNIQUE ("libro_id", "numero"),
  CONSTRAINT "asientos_libro_id_posicion_key" UNIQUE ("libro_id", "posicion"),
  CONSTRAINT "asientos_libro_id_referencia_key" UNIQUE ("libro_id", "referencia"),
  CONSTRAINT "asientos_libro_id_reversa_de_key" UNIQUE ("libro_id", "reversa_de")
);

CREATE TABLE "detalles_asiento" (
  "libro_id" uuid NOT NULL,
  "asiento_id" text NOT NULL,
  "id" text NOT NULL,
  "cuenta_id" text NOT NULL,
  "codigo_cuenta" text NOT NULL,
  "parcial" numeric(16,2) NOT NULL,
  "debe" numeric(16,2) NOT NULL,
  "haber" numeric(16,2) NOT NULL,
  "descripcion" text,
  "descripcion_presente" boolean NOT NULL,
  "posicion" integer NOT NULL,
  CONSTRAINT "detalles_asiento_libro_id_asiento_id_fkey" FOREIGN KEY ("libro_id", "asiento_id") REFERENCES "asientos" ("libro_id", "id") ON DELETE CASCADE,
  CONSTRAINT "detalles_asiento_libro_id_cuenta_id_codigo_cuenta_fkey" FOREIGN KEY ("libro_id", "cuenta_id", "codigo_cuenta") REFERENCES "cuentas" ("libro_id", "id", "codigo") ON DELETE NO ACTION,
  CONSTRAINT "detalles_asiento_pkey" PRIMARY KEY ("libro_id", "id"),
  CONSTRAINT "detalles_asiento_libro_id_asiento_id_posicion_key" UNIQUE ("libro_id", "asiento_id", "posicion")
);

CREATE TABLE "kardex_productos" (
  "libro_id" uuid NOT NULL,
  "id" text NOT NULL,
  "nombre" text NOT NULL,
  "costo" text NOT NULL,
  "venta" text NOT NULL,
  "costo_incluye_iva" boolean,
  "venta_incluye_iva" boolean,
  "inicio" date NOT NULL,
  "fin" date NOT NULL,
  "inicial" bigint NOT NULL,
  "campos_opcionales" text[] NOT NULL,
  "posicion" integer NOT NULL,
  CONSTRAINT "kardex_productos_libro_id_fkey" FOREIGN KEY ("libro_id") REFERENCES "libros" ("id") ON DELETE CASCADE,
  CONSTRAINT "kardex_productos_pkey" PRIMARY KEY ("libro_id", "id"),
  CONSTRAINT "kardex_productos_libro_id_posicion_key" UNIQUE ("libro_id", "posicion")
);

CREATE TABLE "kardex_cuentas" (
  "libro_id" uuid NOT NULL,
  "producto_id" text NOT NULL,
  "rol" text NOT NULL,
  "codigo_cuenta" text,
  CONSTRAINT "kardex_cuentas_libro_id_codigo_cuenta_fkey" FOREIGN KEY ("libro_id", "codigo_cuenta") REFERENCES "cuentas" ("libro_id", "codigo") ON DELETE NO ACTION,
  CONSTRAINT "kardex_cuentas_libro_id_producto_id_fkey" FOREIGN KEY ("libro_id", "producto_id") REFERENCES "kardex_productos" ("libro_id", "id") ON DELETE CASCADE,
  CONSTRAINT "kardex_cuentas_pkey" PRIMARY KEY ("libro_id", "producto_id", "rol"),
  CONSTRAINT "kardex_cuentas_libro_id_codigo_cuenta_key" UNIQUE ("libro_id", "codigo_cuenta")
);

CREATE TABLE "kardex_costos_movimiento" (
  "libro_id" uuid NOT NULL,
  "producto_id" text NOT NULL,
  "clave" text NOT NULL,
  "costo" text NOT NULL,
  "incluye_iva" boolean NOT NULL,
  CONSTRAINT "kardex_costos_movimiento_libro_id_producto_id_fkey" FOREIGN KEY ("libro_id", "producto_id") REFERENCES "kardex_productos" ("libro_id", "id") ON DELETE CASCADE,
  CONSTRAINT "kardex_costos_movimiento_pkey" PRIMARY KEY ("libro_id", "producto_id", "clave")
);
