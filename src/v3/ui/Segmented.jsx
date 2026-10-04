/** A pill-shaped single-choice control. `options` = [{ value, label }]. Works for ranges, chart styles and tabs. */
export function Segmented({ options, value, onChange, label, small = false, role = 'group', fill = false }) {
  const tabs = role === 'tablist';
  return (
    <div className={`v3-seg${small ? ' sm' : ''}`} role={role} aria-label={label} style={fill ? { display: 'flex', alignSelf: 'stretch' } : undefined}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="v3-segbtn"
          role={tabs ? 'tab' : undefined}
          {...(tabs ? { 'aria-selected': o.value === value } : { 'aria-pressed': o.value === value })}
          onClick={() => onChange(o.value)}
          style={fill ? { flex: '1 1 0' } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
