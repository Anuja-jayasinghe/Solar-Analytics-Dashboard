/** The frosted tile every card is built on. `as` lets a tile be a section, article, etc. */
export function Glass({ as, card = false, className = '', children, ...rest }) {
  const Tag = as ?? 'section';
  return (
    <Tag className={`v3-glass${card ? ' v3-card' : ''}${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </Tag>
  );
}
