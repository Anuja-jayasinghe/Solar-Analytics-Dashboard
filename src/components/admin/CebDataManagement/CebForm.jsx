import React, { useContext } from 'react';
import { AdminThemeContext } from '../../../contexts/AdminThemeContext';
import { getAdminTheme } from '../adminTheme';

/**
 * CEB Data Form Component
 * Technical interface for adding/editing CEB records
 */
export default function CebForm({
  form = { bill_date: '', meter_reading: '', units_exported: '', earnings: '' },
  onFormChange = () => {},
  onSubmit = () => {},
  loading = false,
  editingId = null,
  onCancelEdit = () => {}
}) {
  const { selectedTheme, adminColorPresets } = useContext(AdminThemeContext);
  const theme = getAdminTheme(adminColorPresets[selectedTheme]);

  const inputStyle = {
    padding: '10px',
    borderRadius: '2px',
    border: `1px solid ${theme.colors.borderStrong}`,
    background: 'rgba(0,0,0,0.3)',
    color: theme.colors.text,
    fontSize: '13px',
    fontFamily: theme.fonts.mono,
    outline: 'none',
    transition: 'border-color 0.2s ease'
  };

  const buttonStyle = {
    background: theme.colors.accent,
    color: '#000',
    border: 'none',
    padding: '10px',
    borderRadius: '2px',
    cursor: 'pointer',
    fontWeight: '700',
    fontFamily: theme.fonts.mono,
    fontSize: '12px',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase'
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '2rem',
        background: 'rgba(0,0,0,0.15)',
        padding: '1.25rem',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '4px',
        position: 'relative'
      }}
    >
      <div style={{ position: 'absolute', top: '-10px', left: '15px', background: theme.colors.background, padding: '0 8px', fontSize: '10px', fontFamily: theme.fonts.mono, color: theme.colors.accent }}>
        DATA_INPUT_STREAM
      </div>

      <input
        type="date"
        value={form.bill_date}
        onChange={(e) => onFormChange({ ...form, bill_date: e.target.value })}
        required
        style={inputStyle}
      />
      <input
        type="number"
        placeholder="METER_READING"
        value={form.meter_reading}
        onChange={(e) => onFormChange({ ...form, meter_reading: e.target.value })}
        required
        style={inputStyle}
      />
      <input
        type="number"
        placeholder="UNITS_EXPORTED"
        value={form.units_exported}
        onChange={(e) => onFormChange({ ...form, units_exported: e.target.value })}
        required
        style={inputStyle}
      />
      <input
        type="number"
        placeholder="EARNINGS_LKR"
        value={form.earnings}
        onChange={(e) => onFormChange({ ...form, earnings: e.target.value })}
        required
        style={inputStyle}
      />
      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? 'PUSHING...' : editingId ? '[ UPDATE_RECORD ]' : '[ COMMIT_RECORD ]'}
      </button>
      {editingId && (
        <button
          type="button"
          onClick={onCancelEdit}
          disabled={loading}
          style={{ ...buttonStyle, background: 'rgba(255,255,255,0.05)', color: theme.colors.textMuted, border: `1px solid ${theme.colors.border}` }}
        >
          [ ABORT ]
        </button>
      )}
    </form>
  );
}
