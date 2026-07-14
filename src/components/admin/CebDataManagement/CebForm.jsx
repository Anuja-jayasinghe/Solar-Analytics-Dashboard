import React from 'react';

/**
 * CEB Data Form Component
 * Manual entry form for new CEB billing records
 */
export default function CebForm({
  form = { bill_date: '', meter_reading: '', units_exported: '', earnings: '', account_number: '', billing_month: '' },
  onFormChange = () => {},
  onSubmit = () => {},
  loading = false
}) {
  const inputStyle = {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    background: 'var(--card-bg-solid)',
    color: 'var(--text-color)',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s ease'
  };

  const buttonStyle = {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    opacity: loading ? 0.7 : 1,
    transition: 'all 0.2s ease'
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '2rem',
        background: 'var(--card-bg)',
        padding: '1.25rem',
        border: '1px solid var(--border-color)',
        borderRadius: '10px'
      }}
    >
      <div style={{
        gridColumn: '1 / -1',
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--accent)'
      }}>
        Add New Record
      </div>

      <input
        type="date"
        value={form.bill_date}
        onChange={(e) => {
           const date = e.target.value;
           let derivedMonth = form.billing_month;
           if (date && !form.billing_month) {
              const d = new Date(date);
              const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
              derivedMonth = `${d.getFullYear()} ${months[d.getMonth()]}`;
           }
           onFormChange({ ...form, bill_date: date, billing_month: derivedMonth });
        }}
        required
        style={inputStyle}
      />
      <input
        type="text"
        placeholder="Account Number"
        value={form.account_number}
        onChange={(e) => onFormChange({ ...form, account_number: e.target.value })}
        required
        style={inputStyle}
      />
      <input
        type="text"
        placeholder="Billing Month (YYYY MMM)"
        value={form.billing_month}
        onChange={(e) => onFormChange({ ...form, billing_month: e.target.value })}
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
        placeholder="Earnings (LKR)"
        value={form.earnings}
        onChange={(e) => onFormChange({ ...form, earnings: e.target.value })}
        required
        style={inputStyle}
      />
      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? 'Saving...' : 'Add Record'}
      </button>
    </form>
  );
}
