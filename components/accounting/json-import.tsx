"use client";
import { useState } from "react";
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function JsonImport({
  label,
  validate,
  commit,
  busy,
}: {
  label: string;
  validate: (v: unknown) => unknown;
  commit: (v: unknown) => Promise<string>;
  busy: boolean;
}) {
  const [reading, setReading] = useState(false),
    [text, setText] = useState(""),
    [preview, setPreview] = useState<unknown>(null),
    [message, setMessage] = useState("");
  async function read(file?: File) {
    setPreview(null);
    setText("");
    setMessage("");
    if (!file) return;
    if (file.size > 2_000_000) {
      setMessage("Máximo 2 MB.");
      return;
    }
    setReading(true);
    try {
      setText(await file.text());
    } catch {
      setMessage("No se pudo leer el archivo. Vuelve a seleccionarlo.");
    } finally {
      setReading(false);
    }
  }
  function check() {
    setPreview(null);
    try {
      if (new Blob([text]).size > 2_000_000) throw new Error("Máximo 2 MB.");
      const result = validate(JSON.parse(text));
      setPreview(result);
      setMessage(
        "Validación local correcta. Revisa el contenido antes de importar; se volverá a validar antes de guardarlo en este navegador.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function save() {
    try {
      const result = await commit(preview);
      setMessage(result);
      setPreview(null);
      setText("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <details className="border bg-white p-4 rounded space-y-3">
      <summary className="cursor-pointer font-medium">{label}</summary>
      <label className="block text-sm">
        Archivo JSON
        <input
          aria-label={label}
          className="field"
          type="file"
          accept=".json,application/json"
          disabled={busy || reading}
          onChange={(e) => void read(e.target.files?.[0])}
        />
      </label>
      <textarea
        aria-label="Contenido JSON"
        disabled={busy || reading}
        className="field h-32 font-mono"
        placeholder="Pega aquí el JSON o selecciona un archivo"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
          setMessage("");
        }}
      />
      <button
        type="button"
        className="primary"
        disabled={busy || reading || !text}
        onClick={check}
      >
        Validar y previsualizar
      </button>
      {message && (
        <p role="status" className="text-sm whitespace-pre-wrap">
          {message}
        </p>
      )}
      {preview !== null && (
        <>
          <pre className="text-xs bg-zinc-50 p-3 max-h-72 overflow-auto">
            {JSON.stringify(preview, null, 2)}
          </pre>
          <button
            type="button"
            className="primary"
            disabled={busy || reading}
            onClick={() => void save()}
          >
            {busy ? "Guardando…" : "Importar lote completo"}
          </button>
        </>
      )}
    </details>
  );
}
