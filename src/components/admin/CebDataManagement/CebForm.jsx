import React from 'react';

/**
 * CEB Data Form Component
 * Handles form for adding/editing CEB records
 */
export default function CebForm({
  form = { bill_date: '', meter_reading: '', units_exported: '', earnings: '' },
  onFormChange = () => {},
  onSubmit = () => {},
  loading = false,
  editingId = null,
  onCancelEdit = () => {}
}) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '10px',
        marginBottom: '2rem',
        background: 'var(--card-bg)',
        padding: '1rem',
        borderRadius: '12px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 0 20px var(--card-shadow)',
      }}
    >
      <input
        type="date"
        value={form.bill_date}
        onChange={(e) => onFormChange({ ...form, bill_date: e.target.value })}
        required
        style={inputStyle}
      />
      <input
        type="number"
        placeholder="Meter Reading"
        value={form.meter_reading}
        onChange={(e) => onFormChange({ ...form, meter_reading: e.target.value })}
        required
        style={inputStyle}
      />
      <input
        type="number"
        placeholder="Units Exported"
        value={form.units_exported}
        onChange={(e) => onFormChange({ ...form, units_exported: e.target.value })}
        required
        style={inputStyle}
      />
      <input
        type="number"
        placeholder="Earnings (from bill)"
        value={form.earnings}
        onChange={(e) => onFormChange({ ...form, earnings: e.target.value })}
        required
        style={inputStyle}
      />
      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? '⏳ Saving...' : editingId ? '✏️ Update' : '➕ Add Record'}
      </button>
      {editingId && (
        <button
          type="button"
          onClick={onCancelEdit}
          disabled={loading}
          style={{ ...buttonStyle, background: '#6c757d' }}
        >
          ✕ Cancel
        </button>
      )}
    </form>
  );
}

const inputStyle = {
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid var(--border-color)',
  background: 'var(--card-bg-solid)',
  color: 'var(--text-color)',
  fontSize: '14px',
};

const buttonStyle = {
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  padding: '10px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  transition: 'all 0.2s ease',
};
