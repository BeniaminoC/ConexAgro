// Campo de formulario accesible: etiqueta asociada, error anunciado y ligado con aria-describedby.
export function Field({ id, label, error, hint, children }) {
  const describedBy = [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {typeof children === 'function' ? children({ 'aria-describedby': describedBy, 'aria-invalid': error ? 'true' : undefined }) : children}
      {error && <p id={`${id}-err`} className="error" role="alert">{error}</p>}
    </div>
  );
}
