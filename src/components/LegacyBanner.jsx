/**
 * Marks the previous dashboard as deprecated. Shown on every v1 page (served under /v1) until v1 is removed.
 * A plain anchor, not a router link: the new app lives outside this router.
 */
export default function LegacyBanner() {
  return (
    <div
      role="note"
      style={{
        position: 'sticky', top: 0, zIndex: 2000, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
        padding: '8px 14px', background: '#241000', color: '#FFD08A', borderBottom: '1px solid #FF8A1F', fontSize: 13, fontWeight: 600, textAlign: 'center'
      }}
    >
      <span style={{ background: '#FF8A1F', color: '#241000', borderRadius: 999, padding: '2px 10px', fontSize: 11, letterSpacing: '.06em' }}>V1 · DEPRECATED</span>
      <span>This is the previous dashboard. It is no longer updated and will be removed.</span>
      <a href="/" style={{ color: '#fff', textDecoration: 'underline' }}>Go to the new dashboard</a>
    </div>
  );
}
