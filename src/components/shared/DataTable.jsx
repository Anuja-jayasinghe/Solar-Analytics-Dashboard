import React from 'react';

/**
 * Reusable Data Table Component
 * Handles pagination, sorting, and row rendering
 */
export default function DataTable({
  columns = [],
  data = [],
  currentPage = 1,
  itemsPerPage = 20,
  totalItems = 0,
  onPageChange = () => {},
  onItemsPerPageChange = () => {},
  loading = false,
  onRowClick = null,
  renderCell = (value) => value,
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #ddd' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px',
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '12px',
                    textAlign: col.align || 'left',
                    fontWeight: '600',
                    color: '#333',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => onRowClick && onRowClick(row)}
                style={{
                  borderBottom: '1px solid #eee',
                  backgroundColor: onRowClick ? '#fafafa' : 'white',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) e.currentTarget.style.backgroundColor = '#f0f0f0';
                }}
                onMouseLeave={(e) => {
                  if (onRowClick) e.currentTarget.style.backgroundColor = '#fafafa';
                }}
              >
                {columns.map((col) => (
                  <td
                    key={`${idx}-${col.key}`}
                    style={{
                      padding: '12px',
                      textAlign: col.align || 'left',
                      color: '#555',
                    }}
                  >
                    {renderCell ? renderCell(row[col.key], row, col.key) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '12px 0',
        borderTop: '1px solid #eee',
      }}>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Showing {Math.min(startIndex + 1, totalItems)}-{Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            style={{
              padding: '6px 12px',
              backgroundColor: currentPage === 1 ? '#f0f0f0' : '#1976d2',
              color: currentPage === 1 ? '#999' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === 1 || loading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
            }}
          >
            ← Prev
          </button>

          <div style={{
            display: 'flex',
            gap: '4px',
            alignItems: 'center',
            padding: '0 8px',
          }}>
            <span style={{ fontSize: '13px', color: '#666' }}>
              Page {currentPage} of {totalPages || 1}
            </span>
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            style={{
              padding: '6px 12px',
              backgroundColor: currentPage >= totalPages ? '#f0f0f0' : '#1976d2',
              color: currentPage >= totalPages ? '#999' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage >= totalPages || loading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
            }}
          >
            Next →
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#666' }}>
            Show per page:
          </label>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            disabled={loading}
            style={{
              padding: '6px 8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </div>
  );
}
