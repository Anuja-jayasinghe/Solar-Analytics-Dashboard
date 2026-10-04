/** A small status label. tone: gen | good | warn | bad | ceb | (none = neutral). Never colour alone: it always has text. */
export function Pill({ tone, children, title }) {
  return <span className="v3-pill" data-tone={tone} title={title}>{children}</span>;
}
