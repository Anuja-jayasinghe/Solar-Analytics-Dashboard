import React from 'react';

/**
 * CEB Data Table Component
 * Displays CEB records in a table with pagination
 */
export default function CebTable({
  data = [],
  currentPage = 1,
  itemsPerPage = 20,
  totalItems = 0,
  onPageChange = () => {},
  onItemsPerPageChange = () => {},
  onEdit = () => {},
  onDelete = () => {},
  loading = false
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  if (loading && data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
        <p>🔄 Loading CEB data...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
        <p>📊 No CEB data found. Add your first record above!</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Table */}
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 0 20px var(--card-shadow)',
      }}>
        <table style={tableStyle}>
          <thead style={{ background: 'var(--card-border)' }}>
            <tr>
              <th>Date</th>
              <th>Meter Reading</th>
              <th>Units Exported</th>
              <th>Earnings (LKR)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={row.id} style={{
                borderBottom: idx === data.length - 1 ? 'none' : '1px solid var(--border-color)'
              }}>
                <td>{row.bill_date}</td>
                <td>{row.meter_reading || 0}</td>
                <td>{row.units_exported || 0}</td>
                <td>{row.earnings ? `LKR ${row.earnings.toLocaleString()}` : 'LKR 0'}</td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => onEdit(row)}
                    disabled={loading}
                    style={editButtonStyle}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => onDelete(row.id)}
                    disabled={loading}
                    style={deleteButtonStyle}
                  >
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalItems > itemsPerPage && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1rem',
          background: 'var(--card-bg)',
          borderRadius: '8px',
          fontSize: '13px',
          boxShadow: '0 0 20px var(--card-shadow)',
        }}>
          <div style={{ color: 'var(--text-secondary)' }}>
            Showing {Math.min(startIndex + 1, totalItems)}-{Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              style={{
                padding: '6px 12px',
                backgroundColor: currentPage === 1 ? '#f0f0f0' : 'var(--accent)',
                color: currentPage === 1 ? '#999' : 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentPage === 1 || loading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              ← Prev
            </button>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Page {currentPage} of {totalPages || 1}
            </div>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              style={{
                padding: '6px 12px',
                backgroundColor: currentPage >= totalPages ? '#f0f0f0' : 'var(--accent)',
                color: currentPage >= totalPages ? '#999' : 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentPage >= totalPages || loading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              Next →
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Per page:
            </label>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              disabled={loading}
              style={{
                padding: '6px 8px',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                fontSize: '13px',
                backgroundColor: 'var(--card-bg-solid)',
                color: 'var(--text-color)',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'left',
  fontSize: '14px',
};

const editButtonStyle = {
  background: 'var(--accent-secondary)',
  color: '#fff',
  border: 'none',
  padding: '6px 10px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 'bold',
  transition: 'all 0.2s ease'
};

const deleteButtonStyle = {
  background: 'var(--error-color)',
  color: '#fff',
  border: 'none',
  padding: '6px 10px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 'bold',
  transition: 'all 0.2s ease'
};
