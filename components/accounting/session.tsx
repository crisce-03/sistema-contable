"use client";

import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Session as SupabaseSession, User } from "@supabase/supabase-js";
import { useAccountingStore } from "@/lib/store/accountingStore";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/browser";

interface AuthContextValue {
  user: User;
  cerrandoSesion: boolean;
  cerrarSesion: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthSession() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("No hay una sesión autenticada.");
  return value;
}

function mensajeError(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}

function AuthPanel({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <section className="w-full max-w-md bg-white border border-zinc-200 p-8 space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Sistema Contable</p>
        {children}
      </section>
    </main>
  );
}

function AccessForm({ initialError }: { initialError: string }) {
  const [modo, setModo] = useState<"login" | "registro" | "recuperar">("login");
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(initialError);
  const [aviso, setAviso] = useState("");

  function cambiarModo(nuevoModo: typeof modo) {
    setModo(nuevoModo);
    setPassword("");
    setError("");
    setAviso("");
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOcupado(true);
    setError("");
    setAviso("");
    try {
      const supabase = getSupabaseBrowser();
      if (modo === "recuperar") {
        const result = await supabase.auth.resetPasswordForEmail(correo.trim(), { redirectTo: window.location.origin });
        if (result.error) throw result.error;
        setAviso("Si el correo está registrado, recibirás un enlace para cambiar tu contraseña.");
      } else if (modo === "registro") {
        const result = await supabase.auth.signUp({
          email: correo.trim(),
          password,
          options: { data: { nombre: nombre.trim() }, emailRedirectTo: window.location.origin },
        });
        if (result.error) throw result.error;
        setPassword("");
        if (!result.data.session) {
          setModo("login");
          setAviso("Revisa tu correo y confirma tu cuenta antes de iniciar sesión.");
        }
      } else {
        const result = await supabase.auth.signInWithPassword({ email: correo.trim(), password });
        if (result.error) throw result.error;
      }
    } catch (cause) {
      setError(mensajeError(cause));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <AuthPanel>
      <h1 className="text-2xl font-semibold">{modo === "registro" ? "Crear cuenta" : modo === "recuperar" ? "Recuperar contraseña" : "Iniciar sesión"}</h1>
      <p className="text-sm text-zinc-600">Accede a tus ejercicios contables guardados en la base de datos.</p>
      <form className="space-y-4" onSubmit={(event) => void enviar(event)}>
        {modo === "registro" && (
          <label className="block text-sm">Nombre
            <input className="field" autoComplete="name" value={nombre} maxLength={120} onChange={(event) => setNombre(event.target.value)} disabled={ocupado} />
          </label>
        )}
        <label className="block text-sm">Correo electrónico
          <input className="field" type="email" autoComplete="email" required value={correo} onChange={(event) => setCorreo(event.target.value)} disabled={ocupado} />
        </label>
        {modo !== "recuperar" && (
          <label className="block text-sm">Contraseña
            <input className="field" type="password" autoComplete={modo === "registro" ? "new-password" : "current-password"} minLength={modo === "registro" ? 8 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={ocupado} />
            {modo === "registro" && <span className="text-xs text-zinc-500">Mínimo 8 caracteres.</span>}
          </label>
        )}
        {error && <p role="alert" className="text-sm text-red-700 break-words">{error}</p>}
        {aviso && <p role="status" className="text-sm text-emerald-700">{aviso}</p>}
        <button className="primary w-full" disabled={ocupado} type="submit">{ocupado ? "Procesando…" : modo === "registro" ? "Crear cuenta" : modo === "recuperar" ? "Enviar enlace" : "Entrar"}</button>
      </form>
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <button type="button" className="underline" disabled={ocupado} onClick={() => cambiarModo(modo === "login" ? "registro" : "login")}>{modo === "login" ? "Crear una cuenta" : "Volver a iniciar sesión"}</button>
        {modo === "login" && <button type="button" className="underline" disabled={ocupado} onClick={() => cambiarModo("recuperar")}>Olvidé mi contraseña</button>}
      </div>
    </AuthPanel>
  );
}

function RecoveryForm({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setOcupado(true);
    setError("");
    try {
      const result = await getSupabaseBrowser().auth.updateUser({ password });
      if (result.error) throw result.error;
      onComplete();
    } catch (cause) {
      setError(mensajeError(cause));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <AuthPanel>
      <h1 className="text-2xl font-semibold">Nueva contraseña</h1>
      <form className="space-y-4" onSubmit={(event) => void guardar(event)}>
        <label className="block text-sm">Contraseña nueva (mínimo 8 caracteres)<input className="field" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={ocupado} /></label>
        <label className="block text-sm">Confirmar contraseña<input className="field" type="password" autoComplete="new-password" minLength={8} required value={confirmacion} onChange={(event) => setConfirmacion(event.target.value)} disabled={ocupado} /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" className="primary w-full" disabled={ocupado}>{ocupado ? "Guardando…" : "Guardar contraseña y continuar"}</button>
      </form>
    </AuthPanel>
  );
}

export function Session({ children }: { children: ReactNode }) {
  const { listo, ocupado, error, cargar, reiniciar } = useAccountingStore();
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [comprobado, setComprobado] = useState(false);
  const [authError, setAuthError] = useState("");
  const [recuperando, setRecuperando] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const identidad = useRef<string | null | undefined>(undefined);
  const configurado = isSupabaseConfigured();
  const userId = session?.user.id;

  useEffect(() => {
    if (!configurado) return;
    let activo = true;
    let revision = 0;
    let cancelar = () => {};

    function recibirSesion(nuevaSesion: SupabaseSession | null) {
      if (!activo) return;
      const nuevoId = nuevaSesion?.user.id ?? null;
      if (identidad.current !== nuevoId) {
        reiniciar();
        identidad.current = nuevoId;
      }
      setSession(nuevaSesion);
      setComprobado(true);
    }

    async function iniciar() {
      try {
        const supabase = getSupabaseBrowser();
        const { data } = supabase.auth.onAuthStateChange((evento, nuevaSesion) => {
          if (!activo) return;
          revision += 1;
          recibirSesion(nuevaSesion);
          if (evento === "PASSWORD_RECOVERY") setRecuperando(true);
          if (evento === "SIGNED_OUT") setRecuperando(false);
          setAuthError("");
        });
        cancelar = () => data.subscription.unsubscribe();
        const revisionInicial = revision;
        const result = await supabase.auth.getSession();
        if (!activo || revision !== revisionInicial) return;
        if (result.error) throw result.error;
        recibirSesion(result.data.session);
      } catch (cause) {
        if (activo) {
          setAuthError(mensajeError(cause));
          setComprobado(true);
        }
      }
    }

    void iniciar();
    return () => {
      activo = false;
      cancelar();
    };
  }, [configurado, reiniciar]);

  useEffect(() => {
    if (!userId) return;
    let activo = true;
    const actualizar = () => {
      void cargar().catch((cause: unknown) => {
        if (activo) setAuthError(mensajeError(cause));
      });
    };
    actualizar();
    window.addEventListener("focus", actualizar);
    return () => {
      activo = false;
      window.removeEventListener("focus", actualizar);
    };
  }, [userId, cargar]);

  async function cerrarSesion() {
    setCerrandoSesion(true);
    setAuthError("");
    try {
      const result = await getSupabaseBrowser().auth.signOut({ scope: "local" });
      if (result.error) throw result.error;
      reiniciar();
      identidad.current = null;
      setSession(null);
      setRecuperando(false);
    } catch (cause) {
      setAuthError(mensajeError(cause));
    } finally {
      setCerrandoSesion(false);
    }
  }

  if (!configurado) {
    return (
      <AuthPanel>
        <h1 className="text-2xl font-semibold">Configuración pendiente</h1>
        <p className="text-sm text-zinc-600">El sistema aún no está listo para iniciar sesión. Contacta al administrador para completar la configuración del servicio.</p>
      </AuthPanel>
    );
  }
  if (!comprobado) return <AuthPanel><p role="status">Comprobando sesión…</p></AuthPanel>;
  if (!session) return <AccessForm initialError={authError} />;
  if (recuperando) return <RecoveryForm onComplete={() => setRecuperando(false)} />;
  if (!listo) {
    return (
      <AuthPanel>
        <h1 className="text-2xl font-semibold">{error ? "No se pudo abrir el ejercicio" : "Abriendo ejercicio…"}</h1>
        <p className="text-sm text-zinc-600 break-all">{session.user.email}</p>
        {(error || authError) && <p role="alert" className="text-sm text-red-700">{error || authError}</p>}
        <div className="flex gap-4">
          <button className="primary" disabled={ocupado} onClick={() => void cargar().catch((cause: unknown) => setAuthError(mensajeError(cause)))}>Reintentar</button>
          <button className="text-sm underline" disabled={cerrandoSesion} onClick={() => void cerrarSesion()}>Cerrar sesión</button>
        </div>
      </AuthPanel>
    );
  }
  return (
    <AuthContext.Provider value={{ user: session.user, cerrandoSesion, cerrarSesion }}>
      {authError && <p role="alert" className="bg-red-50 px-6 py-3 text-sm text-red-700">{authError}</p>}
      {children}
    </AuthContext.Provider>
  );
}
