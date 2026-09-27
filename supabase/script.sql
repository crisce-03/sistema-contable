-- Sistema contable: ejecutar primero este archivo en Supabase SQL Editor.
-- Requiere los roles anon/authenticated/service_role y auth.users de Supabase.
-- Los navegadores solo leen sus datos; Next.js valida cada comando y llama las
-- RPC con service_role. Nunca publique esa clave en NEXT_PUBLIC_*.
-- Instalacion inicial transaccional. No es una migracion destructiva ni un reset.
begin;

create schema if not exists accounting_private;
revoke all on schema accounting_private from public, anon, authenticated;

create table public.catalogo_base (
  codigo text primary key check (codigo ~ '^([0-9]{1,2}|[0-9]{4}|[0-9]{6}|[0-9]{8}|[0-9]{10})$'),
  nombre text not null check (length(btrim(nombre)) > 0),
  padre_codigo text references public.catalogo_base(codigo) deferrable initially deferred,
  check (padre_codigo is distinct from codigo)
);
comment on table public.catalogo_base is 'Plantilla compartida. Cada libro conserva su propia copia editable del catalogo.';

create table public.libros (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  activo boolean not null default true,
  version_local integer not null check (version_local in (2, 3)),
  kardex_presente boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index libros_un_activo_por_usuario on public.libros(usuario_id) where activo;
create index libros_usuario on public.libros(usuario_id, creado_en desc);

create table public.cuentas (
  libro_id uuid not null references public.libros(id) on delete cascade,
  id text not null check (length(id) > 0),
  codigo text not null check (codigo ~ '^([0-9]{1,2}|[0-9]{4}|[0-9]{6}|[0-9]{8}|[0-9]{10})$'),
  nombre text not null,
  familia text not null,
  tipo text not null,
  naturaleza text not null check (naturaleza in ('Deudora', 'Acreedora')),
  rubro text not null,
  padre_codigo text,
  activa boolean not null,
  movimiento boolean not null,
  posicion integer not null check (posicion > 0),
  primary key (libro_id, id),
  unique (libro_id, codigo),
  unique (libro_id, id, codigo),
  unique (libro_id, posicion),
  foreign key (libro_id, padre_codigo) references public.cuentas(libro_id, codigo) deferrable initially deferred,
  check (case when length(codigo) = 1 then padre_codigo is null
    when length(codigo) = 2 then padre_codigo is not null and padre_codigo = left(codigo, 1)
    else padre_codigo is not null and padre_codigo = left(codigo, length(codigo) - 2) end)
);
comment on table public.cuentas is 'IDs text permiten base-1 y UUID importados. Debe, haber y saldo se calculan a partir del diario, nunca se duplican.';

create table public.periodos (
  libro_id uuid not null references public.libros(id) on delete cascade,
  anio integer not null check (anio between 1900 and 2200),
  cerrado boolean not null,
  posicion integer not null check (posicion > 0),
  primary key (libro_id, anio),
  unique (libro_id, posicion)
);

create table public.configuracion_libro (
  libro_id uuid primary key references public.libros(id) on delete cascade,
  modo_iva text not null check (modo_iva in ('mas_iva', 'incluido')),
  modo_inventario text not null check (modo_inventario in ('traslados_compras', 'inventarios_explicitos')),
  cuenta_iva_credito text,
  cuenta_iva_debito text,
  inventario_final_fisico text check (inventario_final_fisico is null or inventario_final_fisico = '' or inventario_final_fisico ~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$'),
  campos_opcionales text[] not null default '{}',
  foreign key (libro_id, cuenta_iva_credito) references public.cuentas(libro_id, codigo) deferrable initially deferred,
  foreign key (libro_id, cuenta_iva_debito) references public.cuentas(libro_id, codigo) deferrable initially deferred,
  check (cuenta_iva_credito is null or cuenta_iva_debito is null or cuenta_iva_credito <> cuenta_iva_debito)
);
comment on column public.configuracion_libro.campos_opcionales is 'Distingue campos omitidos de valores vacios en el formato LibroLocal.';

create table public.cuentas_reporte (
  libro_id uuid not null references public.configuracion_libro(libro_id) on delete cascade,
  rol text not null check (rol in ('inventarios','compras','gastosCompra','devolCompras','ventas','devolVentas','utilidad')),
  codigo_cuenta text,
  primary key (libro_id, rol),
  foreign key (libro_id, codigo_cuenta) references public.cuentas(libro_id, codigo) deferrable initially deferred
);

create table public.asientos (
  libro_id uuid not null references public.libros(id) on delete cascade,
  id text not null check (length(id) > 0),
  referencia text not null check (length(btrim(referencia)) > 0),
  numero integer not null check (numero > 0),
  fecha date not null check (fecha between date '1900-01-01' and date '2200-12-31'),
  anio integer generated always as (extract(year from fecha)::integer) stored,
  concepto text not null,
  tipo text not null check (tipo in ('normal', 'ajuste', 'reversion')),
  reversa_de text,
  modo_iva text check (modo_iva in ('mas_iva', 'incluido')),
  ajuste_inventario text check (ajuste_inventario in ('inicial', 'final')),
  liquidacion_iva text,
  cuadra boolean not null check (cuadra),
  campos_opcionales text[] not null default '{}',
  posicion integer not null check (posicion > 0),
  primary key (libro_id, id),
  unique (libro_id, referencia),
  unique (libro_id, numero),
  unique (libro_id, posicion),
  unique (libro_id, reversa_de),
  foreign key (libro_id, anio) references public.periodos(libro_id, anio) deferrable initially deferred,
  foreign key (libro_id, reversa_de) references public.asientos(libro_id, id) deferrable initially deferred,
  check (reversa_de is null or reversa_de <> id),
  check ((tipo = 'reversion') = (reversa_de is not null))
);
create index asientos_libro_fecha on public.asientos(libro_id, fecha, numero);

create table public.detalles_asiento (
  libro_id uuid not null,
  asiento_id text not null,
  id text not null check (length(id) > 0),
  cuenta_id text not null,
  codigo_cuenta text not null,
  parcial numeric(16,2) not null check (parcial >= 0),
  debe numeric(16,2) not null check (debe >= 0),
  haber numeric(16,2) not null check (haber >= 0),
  descripcion text,
  descripcion_presente boolean not null default false,
  posicion integer not null check (posicion > 0),
  primary key (libro_id, id),
  unique (libro_id, asiento_id, posicion),
  foreign key (libro_id, asiento_id) references public.asientos(libro_id, id) on delete cascade,
  foreign key (libro_id, cuenta_id, codigo_cuenta) references public.cuentas(libro_id, id, codigo) deferrable initially deferred,
  check ((debe > 0 and haber = 0) or (haber > 0 and debe = 0))
);
create index detalles_asiento_diario on public.detalles_asiento(libro_id, asiento_id);
create index detalles_asiento_cuenta on public.detalles_asiento(libro_id, codigo_cuenta);

create table public.kardex_productos (
  libro_id uuid not null references public.libros(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  nombre text not null,
  costo text not null check (costo ~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$' and costo::numeric > 0),
  venta text not null check (venta ~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$' and venta::numeric > 0),
  costo_incluye_iva boolean,
  venta_incluye_iva boolean,
  inicio date not null,
  fin date not null,
  inicial bigint not null check (inicial between 0 and 9007199254740991),
  campos_opcionales text[] not null default '{}',
  posicion integer not null check (posicion > 0),
  primary key (libro_id, id),
  unique (libro_id, posicion),
  check (fin >= inicio),
  check (inicio >= date '1900-01-01' and fin <= date '2200-12-31')
);
comment on column public.kardex_productos.costo is 'Texto decimal validado para preservar exactamente el formato del formulario (p. ej. 1 vs 1.00). Se convierte a numeric para operaciones SQL.';

create table public.kardex_cuentas (
  libro_id uuid not null,
  producto_id text not null,
  rol text not null check (rol in ('compras','ventas','devolCompras','devolVentas')),
  codigo_cuenta text,
  primary key (libro_id, producto_id, rol),
  unique (libro_id, codigo_cuenta),
  foreign key (libro_id, producto_id) references public.kardex_productos(libro_id, id) on delete cascade,
  foreign key (libro_id, codigo_cuenta) references public.cuentas(libro_id, codigo) deferrable initially deferred,
  check (rol not in ('compras', 'ventas') or codigo_cuenta is not null)
);

create table public.kardex_costos_movimiento (
  libro_id uuid not null,
  producto_id text not null,
  clave text not null,
  costo text not null check (costo ~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$' and costo::numeric > 0),
  incluye_iva boolean not null,
  primary key (libro_id, producto_id, clave),
  foreign key (libro_id, producto_id) references public.kardex_productos(libro_id, id) on delete cascade
);
comment on column public.kardex_costos_movimiento.clave is 'Clave opaca del motor: inicial o identificador de movimiento. Puede conservar ajustes de movimientos historicos.';

-- La partida doble se verifica al terminar la transaccion, cuando ya existen
-- todos sus detalles. Tambien protege escrituras administrativas directas.
create function accounting_private.comprobar_asiento()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_libro uuid;
  v_asiento text;
  v_lineas bigint;
  v_debe numeric;
  v_haber numeric;
begin
  v_libro := case when tg_op = 'DELETE' then old.libro_id else new.libro_id end;
  if tg_table_name = 'asientos' then
    v_asiento := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    v_asiento := case when tg_op = 'DELETE' then old.asiento_id else new.asiento_id end;
  end if;
  if not exists (select 1 from public.asientos where libro_id = v_libro and id = v_asiento) then
    return null;
  end if;
  select count(*), coalesce(sum(debe), 0), coalesce(sum(haber), 0)
    into v_lineas, v_debe, v_haber from public.detalles_asiento
    where libro_id = v_libro and asiento_id = v_asiento;
  if v_lineas < 2 or v_debe <= 0 or v_debe <> v_haber then
    raise exception 'El asiento % debe tener al menos dos lineas y cuadrar en Debe/Haber.', v_asiento using errcode = '23514';
  end if;
  -- Si una escritura administrativa mueve una linea, comprueba el origen.
  if tg_table_name = 'detalles_asiento' and tg_op = 'UPDATE' then
    if (old.libro_id, old.asiento_id) is distinct from (new.libro_id, new.asiento_id)
      and exists (select 1 from public.asientos where libro_id = old.libro_id and id = old.asiento_id) then
      select count(*), coalesce(sum(debe), 0), coalesce(sum(haber), 0)
        into v_lineas, v_debe, v_haber from public.detalles_asiento
        where libro_id = old.libro_id and asiento_id = old.asiento_id;
      if v_lineas < 2 or v_debe <= 0 or v_debe <> v_haber then
        raise exception 'El asiento de origen quedo descuadrado.' using errcode = '23514';
      end if;
    end if;
  end if;
  return null;
end;
$$;
create constraint trigger asientos_partida_doble
after insert or update on public.asientos deferrable initially deferred
for each row execute function accounting_private.comprobar_asiento();
create constraint trigger detalles_partida_doble
after insert or update or delete on public.detalles_asiento deferrable initially deferred
for each row execute function accounting_private.comprobar_asiento();

-- Reconstruccion del contrato LibroLocal. Los saldos derivados se recalculan
-- con localCommand(..., 'init', {}) en el servidor antes de responder.
create function accounting_private.estado_libro(p_libro_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'versionLocal', l.version_local,
    'cuentas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'codigo', c.codigo, 'nombre', c.nombre, 'familia', c.familia,
      'tipo', c.tipo, 'naturaleza', c.naturaleza, 'rubro', c.rubro,
      'padreCodigo', c.padre_codigo, 'activa', c.activa, 'movimiento', c.movimiento,
      'saldo', 0, 'debe', 0, 'haber', 0) order by c.posicion)
      from public.cuentas c where c.libro_id = l.id), '[]'::jsonb),
    'periodos', coalesce((select jsonb_agg(jsonb_build_object('anio', p.anio, 'cerrado', p.cerrado) order by p.posicion)
      from public.periodos p where p.libro_id = l.id), '[]'::jsonb),
    'configuracion', (select jsonb_build_object('modoIva', c.modo_iva, 'modoInventario', c.modo_inventario)
      || case when 'cuentaIvaCredito' = any(c.campos_opcionales) then jsonb_build_object('cuentaIvaCredito', coalesce(c.cuenta_iva_credito, '')) else '{}'::jsonb end
      || case when 'cuentaIvaDebito' = any(c.campos_opcionales) then jsonb_build_object('cuentaIvaDebito', coalesce(c.cuenta_iva_debito, '')) else '{}'::jsonb end
      || case when 'inventarioFinalFisico' = any(c.campos_opcionales) then jsonb_build_object('inventarioFinalFisico', c.inventario_final_fisico) else '{}'::jsonb end
      || case when 'cuentasReporte' = any(c.campos_opcionales) then jsonb_build_object('cuentasReporte',
        coalesce((select jsonb_object_agg(r.rol, coalesce(r.codigo_cuenta, '')) from public.cuentas_reporte r where r.libro_id = l.id), '{}'::jsonb)) else '{}'::jsonb end
      from public.configuracion_libro c where c.libro_id = l.id),
    'asientos', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'referencia', a.referencia, 'numero', a.numero, 'fecha', to_char(a.fecha, 'YYYY-MM-DD'),
      'concepto', a.concepto, 'tipo', a.tipo, 'cuadra', a.cuadra,
      'detalles', coalesce((select jsonb_agg(jsonb_build_object(
        'id', d.id, 'cuentaId', d.cuenta_id, 'codigoCuenta', d.codigo_cuenta, 'parcial', d.parcial, 'debe', d.debe, 'haber', d.haber)
        || case when d.descripcion_presente then jsonb_build_object('descripcion', d.descripcion) else '{}'::jsonb end order by d.posicion)
        from public.detalles_asiento d where d.libro_id = l.id and d.asiento_id = a.id), '[]'::jsonb))
      || case when 'reversaDe' = any(a.campos_opcionales) then jsonb_build_object('reversaDe', a.reversa_de) else '{}'::jsonb end
      || case when 'modoIva' = any(a.campos_opcionales) then jsonb_build_object('modoIva', a.modo_iva) else '{}'::jsonb end
      || case when 'ajusteInventario' = any(a.campos_opcionales) then jsonb_build_object('ajusteInventario', a.ajuste_inventario) else '{}'::jsonb end
      || case when 'liquidacionIva' = any(a.campos_opcionales) then jsonb_build_object('liquidacionIva', a.liquidacion_iva) else '{}'::jsonb end order by a.posicion)
      from public.asientos a where a.libro_id = l.id), '[]'::jsonb)
  ) || case when l.kardex_presente then jsonb_build_object('kardex',
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', k.id, 'nombre', k.nombre, 'costo', k.costo, 'venta', k.venta,
      'inicio', to_char(k.inicio, 'YYYY-MM-DD'), 'fin', to_char(k.fin, 'YYYY-MM-DD'), 'inicial', k.inicial,
      'cuentas', coalesce((select jsonb_object_agg(c.rol, coalesce(c.codigo_cuenta, '')) from public.kardex_cuentas c
        where c.libro_id = l.id and c.producto_id = k.id), '{}'::jsonb))
      || case when 'costoIncluyeIva' = any(k.campos_opcionales) then jsonb_build_object('costoIncluyeIva', k.costo_incluye_iva) else '{}'::jsonb end
      || case when 'ventaIncluyeIva' = any(k.campos_opcionales) then jsonb_build_object('ventaIncluyeIva', k.venta_incluye_iva) else '{}'::jsonb end
      || case when 'costosMovimientos' = any(k.campos_opcionales) then jsonb_build_object('costosMovimientos',
        coalesce((select jsonb_object_agg(m.clave, jsonb_build_object('costo', m.costo, 'incluyeIva', m.incluye_iva))
          from public.kardex_costos_movimiento m where m.libro_id = l.id and m.producto_id = k.id), '{}'::jsonb)) else '{}'::jsonb end order by k.posicion)
      from public.kardex_productos k where k.libro_id = l.id), '[]'::jsonb)) else '{}'::jsonb end
  from public.libros l where l.id = p_libro_id;
$$;

create function public.accounting_load(p_user_id uuid, p_book_id uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', l.id, 'revision', l.revision, 'estado', accounting_private.estado_libro(l.id))
  from public.libros l where l.usuario_id = p_user_id
    and ((p_book_id is null and l.activo) or l.id = p_book_id);
$$;

create function public.accounting_archives(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', l.id, 'book', accounting_private.estado_libro(l.id))
    order by l.creado_en desc, l.id), '[]'::jsonb)
  from public.libros l where l.usuario_id = p_user_id and not l.activo;
$$;

create function public.accounting_commit(
  p_user_id uuid,
  p_book_id uuid,
  p_revision bigint,
  p_estado jsonb,
  p_action text default 'save',
  p_target_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_current public.libros%rowtype;
  v_target public.libros%rowtype;
  v_id uuid;
  v_config jsonb;
begin
  if p_user_id is null then
    raise exception 'Se requiere el usuario autenticado.' using errcode = '22023';
  end if;
  if p_action is null or p_action not in ('save', 'new', 'switch') then
    raise exception 'Accion de persistencia invalida.' using errcode = '22023';
  end if;
  -- Serializa tambien la primera creacion, cuando no hay filas para FOR UPDATE.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into v_current from public.libros where usuario_id = p_user_id and activo for update;
  if v_current.id is null then
    if p_action <> 'new' or p_book_id is not null or p_revision is not null then
      raise exception 'El libro cambio. Recarga antes de guardar.' using errcode = '40001';
    end if;
  elsif p_book_id is distinct from v_current.id or p_revision is distinct from v_current.revision then
    raise exception 'El libro cambio en otra sesion. Recarga antes de guardar.' using errcode = '40001';
  end if;

  if p_action = 'switch' then
    select * into v_target from public.libros where id = p_target_id and usuario_id = p_user_id for update;
    if v_target.id is null then
      raise exception 'Libro archivado no encontrado.' using errcode = '22023';
    end if;
    if v_target.id <> v_current.id then
      update public.libros set activo = false, revision = revision + 1, actualizado_en = now() where id = v_current.id;
      update public.libros set activo = true, revision = revision + 1, actualizado_en = now() where id = v_target.id;
    end if;
    return public.accounting_load(p_user_id);
  end if;

  if p_estado is null or jsonb_typeof(p_estado) is distinct from 'object'
    or jsonb_typeof(p_estado->'cuentas') is distinct from 'array'
    or jsonb_typeof(p_estado->'asientos') is distinct from 'array'
    or jsonb_typeof(p_estado->'periodos') is distinct from 'array'
    or jsonb_typeof(p_estado->'configuracion') is distinct from 'object'
    or (p_estado ? 'kardex' and jsonb_typeof(p_estado->'kardex') is distinct from 'array') then
    raise exception 'Estado contable invalido.' using errcode = '22023';
  end if;
  v_config := p_estado->'configuracion';
  if p_action = 'new' then
    if v_current.id is not null then
      update public.libros set activo = false, revision = revision + 1, actualizado_en = now() where id = v_current.id;
    end if;
    insert into public.libros(usuario_id, version_local, kardex_presente)
      values (p_user_id, (p_estado->>'versionLocal')::integer, p_estado ? 'kardex') returning id into v_id;
  else
    v_id := v_current.id;
    update public.libros set revision = revision + 1, version_local = (p_estado->>'versionLocal')::integer,
      kardex_presente = p_estado ? 'kardex', actualizado_en = now() where id = v_id;
    -- Reemplazo relacional dentro de UNA transaccion, preservando IDs y orden.
    -- Las FK diferidas permiten reconstruir relaciones circulares/jerarquicas.
    delete from public.kardex_productos where libro_id = v_id;
    delete from public.configuracion_libro where libro_id = v_id;
    delete from public.asientos where libro_id = v_id;
    delete from public.cuentas where libro_id = v_id;
    delete from public.periodos where libro_id = v_id;
  end if;

  insert into public.cuentas(libro_id,id,codigo,nombre,familia,tipo,naturaleza,rubro,padre_codigo,activa,movimiento,posicion)
    select v_id, e->>'id',e->>'codigo',e->>'nombre',e->>'familia',e->>'tipo',e->>'naturaleza',e->>'rubro',e->>'padreCodigo',
      (e->>'activa')::boolean,(e->>'movimiento')::boolean, n::integer
    from jsonb_array_elements(p_estado->'cuentas') with ordinality as x(e,n);
  insert into public.periodos(libro_id,anio,cerrado,posicion)
    select v_id,(e->>'anio')::integer,(e->>'cerrado')::boolean,n::integer
    from jsonb_array_elements(p_estado->'periodos') with ordinality as x(e,n);
  insert into public.configuracion_libro(libro_id,modo_iva,modo_inventario,cuenta_iva_credito,cuenta_iva_debito,inventario_final_fisico,campos_opcionales)
    values (v_id,v_config->>'modoIva',v_config->>'modoInventario',nullif(v_config->>'cuentaIvaCredito',''),
      nullif(v_config->>'cuentaIvaDebito',''),v_config->>'inventarioFinalFisico',
      array(select k from jsonb_object_keys(v_config) k where k in ('cuentaIvaCredito','cuentaIvaDebito','inventarioFinalFisico','cuentasReporte')));
  insert into public.cuentas_reporte(libro_id,rol,codigo_cuenta)
    select v_id,k,nullif(v,'') from jsonb_each_text(coalesce(v_config->'cuentasReporte','{}'::jsonb)) as x(k,v);

  insert into public.asientos(libro_id,id,referencia,numero,fecha,concepto,tipo,reversa_de,modo_iva,ajuste_inventario,liquidacion_iva,cuadra,campos_opcionales,posicion)
    select v_id,e->>'id',e->>'referencia',(e->>'numero')::integer,(e->>'fecha')::date,e->>'concepto',e->>'tipo',
      e->>'reversaDe',e->>'modoIva',e->>'ajusteInventario',e->>'liquidacionIva',(e->>'cuadra')::boolean,
      array(select k from jsonb_object_keys(e) k where k in ('reversaDe','modoIva','ajusteInventario','liquidacionIva')),n::integer
    from jsonb_array_elements(p_estado->'asientos') with ordinality as x(e,n);
  insert into public.detalles_asiento(libro_id,asiento_id,id,cuenta_id,codigo_cuenta,parcial,debe,haber,descripcion,descripcion_presente,posicion)
    select v_id,a->>'id',d->>'id',d->>'cuentaId',d->>'codigoCuenta',(d->>'parcial')::numeric,
      (d->>'debe')::numeric,(d->>'haber')::numeric,d->>'descripcion',d ? 'descripcion',n::integer
    from jsonb_array_elements(p_estado->'asientos') a
    cross join lateral jsonb_array_elements(a->'detalles') with ordinality as x(d,n);

  insert into public.kardex_productos(libro_id,id,nombre,costo,venta,costo_incluye_iva,venta_incluye_iva,inicio,fin,inicial,campos_opcionales,posicion)
    select v_id,e->>'id',e->>'nombre',e->>'costo',e->>'venta',(e->>'costoIncluyeIva')::boolean,(e->>'ventaIncluyeIva')::boolean,
      (e->>'inicio')::date,(e->>'fin')::date,(e->>'inicial')::bigint,
      array(select k from jsonb_object_keys(e) k where k in ('costoIncluyeIva','ventaIncluyeIva','costosMovimientos')),n::integer
    from jsonb_array_elements(coalesce(p_estado->'kardex','[]'::jsonb)) with ordinality as x(e,n);
  insert into public.kardex_cuentas(libro_id,producto_id,rol,codigo_cuenta)
    select v_id,p->>'id',k,nullif(v,'') from jsonb_array_elements(coalesce(p_estado->'kardex','[]'::jsonb)) p
    cross join lateral jsonb_each_text(p->'cuentas') as x(k,v);
  insert into public.kardex_costos_movimiento(libro_id,producto_id,clave,costo,incluye_iva)
    select v_id,p->>'id',k,v->>'costo',(v->>'incluyeIva')::boolean
    from jsonb_array_elements(coalesce(p_estado->'kardex','[]'::jsonb)) p
    cross join lateral jsonb_each(coalesce(p->'costosMovimientos','{}'::jsonb)) as x(k,v);

  return public.accounting_load(p_user_id);
end;
$$;

-- Toda tabla expuesta tiene RLS. SELECT queda limitado al propietario.
-- No existen politicas ni privilegios de escritura para sesiones del cliente.
alter table public.catalogo_base enable row level security;
create policy catalogo_base_lectura on public.catalogo_base for select to authenticated using (true);
alter table public.libros enable row level security;
create policy libros_lectura on public.libros for select to authenticated using (usuario_id = (select auth.uid()));
do $$
declare v_table text;
begin
  foreach v_table in array array['cuentas','periodos','configuracion_libro','cuentas_reporte','asientos','detalles_asiento','kardex_productos','kardex_cuentas','kardex_costos_movimiento'] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('create policy propietario_lectura on public.%I for select to authenticated using (libro_id in (select id from public.libros where usuario_id = (select auth.uid())))', v_table);
  end loop;
end;
$$;

revoke all on public.catalogo_base, public.libros, public.cuentas, public.periodos, public.configuracion_libro,
  public.cuentas_reporte, public.asientos, public.detalles_asiento, public.kardex_productos,
  public.kardex_cuentas, public.kardex_costos_movimiento from public, anon, authenticated, service_role;
grant select on public.catalogo_base, public.libros, public.cuentas, public.periodos, public.configuracion_libro,
  public.cuentas_reporte, public.asientos, public.detalles_asiento, public.kardex_productos,
  public.kardex_cuentas, public.kardex_costos_movimiento to authenticated, service_role;
revoke all on function accounting_private.comprobar_asiento(), accounting_private.estado_libro(uuid) from public, anon, authenticated;
revoke all on function public.accounting_load(uuid,uuid), public.accounting_archives(uuid),
  public.accounting_commit(uuid,uuid,bigint,jsonb,text,uuid) from public, anon, authenticated;
grant execute on function public.accounting_load(uuid,uuid), public.accounting_archives(uuid),
  public.accounting_commit(uuid,uuid,bigint,jsonb,text,uuid) to service_role;

commit;
