"use client";

import { useId, useState } from "react";
import type { Cuenta } from "@/lib/types";

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function JournalAccountSelector({
  accounts,
  value,
  onChange,
  lineNumber,
}: {
  accounts: Cuenta[];
  value: string;
  onChange: (code: string) => void;
  lineNumber: number | string;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  // The parent supplies only accounts with an active, complete hierarchy.
  const selected = accounts.find((c) => c.codigo === value);
  const majorCode = selected?.codigo.slice(0, 4) ?? "";
  const majors = accounts.filter((c) => c.codigo.length === 4);
  const query = normalize(search.trim());
  const matches = majors.filter((c) =>
    normalize(`${c.codigo} ${c.nombre}`).includes(query),
  );
  const options = majors.filter((c) =>
    c.codigo === majorCode || matches.includes(c),
  );

  return (
    <div className="min-w-72 max-w-md space-y-2 whitespace-normal text-left">
      <label htmlFor={`${id}-search`} className="block text-xs text-zinc-600">
        Buscar cuenta de mayor
        <input
          id={`${id}-search`}
          type="search"
          className="field"
          aria-label={`Buscar cuenta de mayor, línea ${lineNumber}`}
          placeholder="Código o nombre, ej. 1101 o efectivo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <label htmlFor={`${id}-major`} className="block text-xs font-medium">
        Cuenta de 4 dígitos · obligatoria
        <select
          id={`${id}-major`}
          className="field"
          aria-label={`Cuenta de 4 dígitos, línea ${lineNumber}`}
          value={majorCode}
          required
          onChange={(e) => {
            onChange(e.target.value);
            setSearch("");
          }}
        >
          <option value="">Seleccionar cuenta de mayor…</option>
          {options.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.codigo} · {c.nombre}
            </option>
          ))}
        </select>
      </label>
      {!majors.length ? (
        <p className="text-xs text-zinc-600">Agrega cuentas activas en el Catálogo para registrar asientos.</p>
      ) : query && !matches.length ? (
        <p role="status" className="text-xs text-zinc-600">No hay coincidencias. Prueba otro código o nombre.</p>
      ) : null}
      {[6, 8, 10].map((digits) => {
        if (!selected || selected.codigo.length < digits - 2) return null;
        const parent = selected.codigo.slice(0, digits - 2);
        const children = accounts.filter((c) => c.padreCodigo === parent);
        if (!children.length) return null;
        return (
          <label key={digits} htmlFor={`${id}-${digits}`} className="block text-xs text-zinc-600">
            Subcuenta de {digits} dígitos · opcional
            <select
              id={`${id}-${digits}`}
              className="field"
              aria-label={`Subcuenta de ${digits} dígitos, línea ${lineNumber}`}
              value={selected.codigo.length >= digits ? selected.codigo.slice(0, digits) : ""}
              onChange={(e) => onChange(e.target.value || parent)}
            >
              <option value="">Sin subcuenta · usar {parent}</option>
              {children.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.codigo} · {c.nombre}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      {selected && (
        <p className="text-xs text-blue-800">
          Se registrará en: <strong>{selected.codigo} · {selected.nombre}</strong>
        </p>
      )}
    </div>
  );
}
