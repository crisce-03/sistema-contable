"use client";

import { useState, type FormEvent } from "react";
import { useAuthSession } from "@/components/accounting/session";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export default function UsuariosPage() {
  const { user } = useAuthSession();
  const [nombre, setNombre] = useState(
    typeof user.user_metadata.nombre === "string" ? user.user_metadata.nombre : "",
  );
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [guardando, setGuardando] = useState<"nombre" | "password" | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function guardar(event: FormEvent<HTMLFormElement>, tipo: "nombre" | "password") {
    event.preventDefault();
    setError("");
    setAviso("");
    if (tipo === "password" && password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setGuardando(tipo);
    try {
      const result = await getSupabaseBrowser().auth.updateUser(
        tipo === "nombre" ? { data: { nombre: nombre.trim() } } : { password },
      );
      if (result.error) throw result.error;
      if (tipo === "password") {
        setPassword("");
        setConfirmacion("");
      }
      setAviso(tipo === "nombre" ? "Nombre actualizado." : "Contraseña actualizada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el cambio.");
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans text-zinc-900 pb-12">
      <div className="border-b border-zinc-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Mi cuenta</h1>
        <p className="text-sm text-zinc-500 mt-1">Administra tu perfil y contraseña de acceso.</p>
      </div>
      <p className="border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
        Cada cuenta tiene sus propios ejercicios contables. Esta pantalla permite
        administrar tu cuenta; los accesos compartidos y la asignación de roles no
        están habilitados.
      </p>
      <dl className="space-y-3 bg-white border border-zinc-200 p-5 text-sm">
        <div><dt className="text-zinc-500">Correo electrónico</dt><dd className="break-all mt-1">{user.email}</dd></div>
        <div><dt className="text-zinc-500">Identificador de usuario</dt><dd className="break-all font-mono text-xs mt-1">{user.id}</dd></div>
      </dl>
      {error && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {aviso && <p role="status" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{aviso}</p>}
      <div className="grid gap-6 md:grid-cols-2">
        <form className="border border-zinc-200 bg-white p-5 space-y-4" onSubmit={(event) => void guardar(event, "nombre")}>
          <h2 className="font-semibold">Perfil</h2>
          <label className="block text-sm">Nombre
            <input className="field" autoComplete="name" value={nombre} maxLength={120} onChange={(event) => setNombre(event.target.value)} disabled={guardando !== null} />
          </label>
          <button className="primary" type="submit" disabled={guardando !== null}>{guardando === "nombre" ? "Guardando…" : "Guardar nombre"}</button>
        </form>
        <form className="border border-zinc-200 bg-white p-5 space-y-4" onSubmit={(event) => void guardar(event, "password")}>
          <h2 className="font-semibold">Cambiar contraseña</h2>
          <label className="block text-sm">Contraseña nueva
            <input className="field" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} disabled={guardando !== null} />
            <span className="text-xs text-zinc-500">Mínimo 8 caracteres.</span>
          </label>
          <label className="block text-sm">Confirmar contraseña
            <input className="field" type="password" autoComplete="new-password" required minLength={8} value={confirmacion} onChange={(event) => setConfirmacion(event.target.value)} disabled={guardando !== null} />
          </label>
          <button className="primary" type="submit" disabled={guardando !== null}>{guardando === "password" ? "Guardando…" : "Actualizar contraseña"}</button>
        </form>
      </div>
    </div>
  );
}
