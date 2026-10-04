/** Copying is only allowed out of form fields (as in v1, the dashboard's figures are not copyable). */
export function blockCopy(event) {
  const t = event.target;
  const tag = t && t.tagName ? t.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea' || (t && t.isContentEditable)) return;
  event.preventDefault();
}
