export function Note({ tone, children }) {
  return <div className="v3-note" data-tone={tone} role={tone === 'bad' ? 'alert' : 'status'}>{children}</div>;
}
