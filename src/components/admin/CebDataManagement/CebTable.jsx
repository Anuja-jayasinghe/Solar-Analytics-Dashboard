import React from 'react';

/**
 * CEB Data Table Component
 * Displays CEB billing records with inline editing and pagination
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
  loading = false,
  editingId = null,
  editForm = null,
  onEditFormChange = () => {},
  onSaveEdit = () => {},
  onCancelEdit = () => {},
  onPreview = () => {}
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  if (loading && data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
        <p>Loading records...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '3rem',
        color: 'var(--text-secondary)',
        border: '1px dashed var(--border-color)',
        borderRadius: '10px'
      }}>
        <p>No CEB data records found</p>
      </div>
    );
  }

  const headerStyle = {
    textAlign: 'left',
    padding: '0.9rem 1rem',
    color: 'var(--accent)',
    fontWeight: '600',
    fontSize: '12px',
    borderBottom: '2px solid var(--border-color)'
  };

  const cellStyle = {
    padding: '0.8rem 1rem',
    color: 'var(--text-color)',
    fontSize: '13px',
    borderBottom: '1px solid var(--border-color)',
    position: 'relative'
  };

  const inputStyle = {
    width: '100%',
    background: 'var(--card-bg-solid)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-color)',
    padding: '4px 8px',
    fontSize: '13px',
    outline: 'none',
    borderRadius: '4px'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        overflow: 'hidden'
      }}>
        <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
            <tr>
              <th style={headerStyle}>Date</th>
              <th style={headerStyle}>Meter Reading</th>
              <th style={headerStyle}>Units Exported</th>
              <th style={headerStyle}>Earnings</th>
              <th style={headerStyle}>Source</th>
              <th style={headerStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isEditing = editingId === row.id;

              return (
                <tr key={row.id} style={{
                  transition: 'all 0.2s ease',
                  background: isEditing ? 'rgba(255, 122, 0, 0.06)' : 'transparent',
                  borderLeft: isEditing ? '3px solid var(--accent)' : '3px solid transparent'
                }}
                onMouseEnter={(e) => !isEditing && (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={(e) => !isEditing && (e.currentTarget.style.background = 'transparent')}
                >
                  {isEditing ? (
                    <>
                      <td data-label="Date" style={cellStyle}>
                        <input
                          type="date"
                          value={editForm.bill_date}
                          onChange={(e) => onEditFormChange({ ...editForm, bill_date: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td data-label="Meter Reading" style={cellStyle}>
                        <input
                          type="number"
                          value={editForm.meter_reading}
                          onChange={(e) => onEditFormChange({ ...editForm, meter_reading: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td data-label="Units Exported" style={cellStyle}>
                        <input
                          type="number"
                          value={editForm.units_exported}
                          onChange={(e) => onEditFormChange({ ...editForm, units_exported: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td data-label="Earnings" style={cellStyle}>
                        <input
                          type="number"
                          value={editForm.earnings}
                          onChange={(e) => onEditFormChange({ ...editForm, earnings: e.target.value })}
                          style={{ ...inputStyle, color: 'var(--success-color)' }}
                        />
                      </td>
                      <td data-label="Source" style={cellStyle}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fixed</div>
                      </td>
                      <td data-label="Actions" style={{ ...cellStyle, display: 'flex', gap: '0.6rem' }}>
                        <button
                          onClick={onSaveEdit}
                          disabled={loading}
                          style={{
                            background: 'var(--accent)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}
                        >
                          {loading ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={onCancelEdit}
                          disabled={loading}
                          style={{
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td data-label="Date" style={cellStyle}>{row.bill_date}</td>
                      <td data-label="Meter Reading" style={cellStyle}>{String(row.meter_reading || 0).padStart(6, '0')}</td>
                      <td data-label="Units Exported" style={cellStyle}>{row.units_exported || 0}</td>
                      <td data-label="Earnings" style={{ ...cellStyle, color: 'var(--success-color)' }}>
                        {row.earnings ? `LKR ${row.earnings.toLocaleString()}` : 'LKR 00.00'}
                      </td>
                      <td data-label="Source" style={cellStyle}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                               fontSize: '10px',
                               padding: '2px 6px',
                               background: row.data_source === 'manual_entry' ? 'rgba(255,255,255,0.05)' : 'rgba(255, 122, 0, 0.12)',
                               color: row.data_source === 'manual_entry' ? 'var(--text-muted)' : 'var(--accent)',
                               border: `1px solid ${row.data_source === 'manual_entry' ? 'var(--border-color)' : 'var(--accent)'}40`,
                               borderRadius: '4px'
                            }}>
                               {row.data_source === 'manual_entry' ? 'Manual' : 'Parsed'}
                            </span>
                            {row.file_path && (
                               <button
                                  onClick={() => onPreview && onPreview(row.file_path)}
                                  title="View Original Bill"
                                  style={{
                                    color: 'var(--accent)',
                                    fontSize: '14px',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0
                                  }}
                               >
                                  📄
                               </button>
                            )}
                         </div>
                      </td>
                      <td data-label="Actions" style={{ ...cellStyle, display: 'flex', gap: '0.6rem' }}>
                        <button
                          onClick={() => onEdit(row)}
                          disabled={loading}
                          style={{
                            background: 'transparent',
                            color: 'var(--accent)',
                            border: '1px solid var(--accent)',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(row)}
                          disabled={loading}
                          style={{
                            background: 'transparent',
                            color: 'var(--error-color)',
                            border: '1px solid var(--error-color)',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalItems > itemsPerPage && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1rem',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          fontSize: '13px'
        }}>
          <div style={{ color: 'var(--text-secondary)' }}>
            Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              style={{
                padding: '6px 12px',
                background: currentPage === 1 ? 'var(--hover-bg)' : 'var(--accent)',
                color: currentPage === 1 ? 'var(--text-muted)' : '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPage === 1 || loading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              ← Prev
            </button>

            <div style={{ color: 'var(--text-secondary)' }}>
              Page {currentPage} of {totalPages || 1}
            </div>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              style={{
                padding: '6px 12px',
                background: currentPage >= totalPages ? 'var(--hover-bg)' : 'var(--accent)',
                color: currentPage >= totalPages ? 'var(--text-muted)' : '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPage >= totalPages || loading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              Next →
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              disabled={loading}
              style={{
                background: 'var(--card-bg-solid)',
                color: 'var(--text-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '13px',
                cursor: 'pointer'
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
