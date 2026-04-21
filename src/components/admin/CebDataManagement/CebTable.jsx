import React, { useContext } from 'react';
import { AdminThemeContext } from '../../../contexts/AdminThemeContext';
import { getAdminTheme } from '../adminTheme';

/**
 * CEB Data Table Component
 * Displays CEB records in a technical grid
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
  onCancelEdit = () => {}
}) {
  const { selectedTheme, adminColorPresets } = useContext(AdminThemeContext);
  const theme = getAdminTheme(adminColorPresets[selectedTheme]);
  
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  if (loading && data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: theme.colors.accent, fontFamily: theme.fonts.mono }}>
        <p>FETCHING_RECORDS [...............]</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem', 
        color: theme.colors.textMuted, 
        fontFamily: theme.fonts.mono,
        border: `1px dashed ${theme.colors.border}`,
        borderRadius: '4px'
      }}>
        <p>NULL_SET: NO CEB DATA RECORDS FOUND</p>
      </div>
    );
  }

  const headerStyle = {
    textAlign: 'left',
    padding: '0.9rem 1rem',
    color: theme.colors.accent,
    fontWeight: '600',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    borderBottom: `2px solid ${theme.colors.borderStrong}`,
    fontFamily: theme.fonts.mono
  };

  const cellStyle = {
    padding: '0.8rem 1rem',
    color: theme.colors.text,
    fontSize: '13px',
    fontFamily: theme.fonts.mono,
    borderBottom: `1px solid ${theme.colors.border}`,
    position: 'relative'
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(0,0,0,0.4)',
    border: `1px solid ${theme.colors.accent}40`,
    color: theme.colors.text,
    padding: '4px 8px',
    fontSize: '12px',
    fontFamily: theme.fonts.mono,
    outline: 'none',
    borderRadius: '1px'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Table Container */}
      <div style={{
        background: 'rgba(0,0,0,0.15)',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
            <tr>
              <th style={headerStyle}>STAMP_DATE</th>
              <th style={headerStyle}>METER_VAL</th>
              <th style={headerStyle}>EXPORT_UNIT</th>
              <th style={headerStyle}>YIELD_LKR</th>
              <th style={headerStyle}>OP_CMDS</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isEditing = editingId === row.id;
              
              return (
                <tr key={row.id} style={{
                  transition: 'all 0.2s ease',
                  background: isEditing ? `${theme.colors.accent}08` : 'transparent',
                  boxShadow: isEditing ? `inset 0 0 20px ${theme.colors.accent}12` : 'none',
                  borderLeft: isEditing ? `3px solid ${theme.colors.accent}` : '3px solid transparent'
                }}
                onMouseEnter={(e) => !isEditing && (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={(e) => !isEditing && (e.currentTarget.style.background = 'transparent')}
                >
                  {isEditing ? (
                    <>
                      {/* IN-LINE EDITING MODE */}
                      <td style={cellStyle}>
                        <div style={{ position: 'absolute', top: '-10px', left: '10px', fontSize: '8px', color: theme.colors.accent, background: '#060d1a', padding: '0 4px', zIndex: 5 }}>EDIT_LOCK</div>
                        <input
                          type="date"
                          value={editForm.bill_date}
                          onChange={(e) => onEditFormChange({ ...editForm, bill_date: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td style={cellStyle}>
                        <input
                          type="number"
                          value={editForm.meter_reading}
                          onChange={(e) => onEditFormChange({ ...editForm, meter_reading: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td style={cellStyle}>
                        <input
                          type="number"
                          value={editForm.units_exported}
                          onChange={(e) => onEditFormChange({ ...editForm, units_exported: e.target.value })}
                          style={inputStyle}
                        />
                      </td>
                      <td style={cellStyle}>
                        <input
                          type="number"
                          value={editForm.earnings}
                          onChange={(e) => onEditFormChange({ ...editForm, earnings: e.target.value })}
                          style={{ ...inputStyle, color: theme.colors.success }}
                        />
                      </td>
                      <td style={{ ...cellStyle, display: 'flex', gap: '0.6rem' }}>
                        <button
                          onClick={onSaveEdit}
                          disabled={loading}
                          style={{
                            background: theme.colors.accent,
                            color: '#000',
                            border: 'none',
                            borderRadius: '1px',
                            padding: '4px 10px',
                            fontSize: '10px',
                            fontFamily: theme.fonts.mono,
                            cursor: 'pointer',
                            fontWeight: '700',
                            textTransform: 'uppercase'
                          }}
                        >
                          {loading ? 'PUSH...' : 'COMMIT'}
                        </button>
                        <button
                          onClick={onCancelEdit}
                          disabled={loading}
                          style={{
                            background: 'transparent',
                            color: theme.colors.textMuted,
                            border: `1px solid ${theme.colors.borderStrong}`,
                            borderRadius: '1px',
                            padding: '4px 10px',
                            fontSize: '10px',
                            fontFamily: theme.fonts.mono,
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                          }}
                        >
                          ROLLBACK
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      {/* STANDARD READ MODE */}
                      <td style={cellStyle}>{row.bill_date}</td>
                      <td style={cellStyle}>{String(row.meter_reading || 0).padStart(6, '0')}</td>
                      <td style={cellStyle}>{row.units_exported || 0}</td>
                      <td style={{ ...cellStyle, color: theme.colors.success }}>
                        {row.earnings ? `LKR ${row.earnings.toLocaleString()}` : 'LKR 00.00'}
                      </td>
                      <td style={{ ...cellStyle, display: 'flex', gap: '0.6rem' }}>
                        <button
                          onClick={() => onEdit(row)}
                          disabled={loading}
                          style={{
                            background: 'transparent',
                            color: theme.colors.accent,
                            border: `1px solid ${theme.colors.accent}60`,
                            borderRadius: '2px',
                            padding: '4px 8px',
                            fontSize: '10px',
                            fontFamily: theme.fonts.mono,
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                          }}
                        >
                          [ EDIT ]
                        </button>
                        <button
                          onClick={() => onDelete(row.id)}
                          disabled={loading}
                          style={{
                            background: 'transparent',
                            color: theme.colors.danger,
                            border: `1px solid ${theme.colors.danger}60`,
                            borderRadius: '2px',
                            padding: '4px 8px',
                            fontSize: '10px',
                            fontFamily: theme.fonts.mono,
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                          }}
                        >
                          [ DROP ]
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

      {/* Pagination Controls */}
      {totalItems > itemsPerPage && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '0.8rem 1rem',
          background: 'rgba(0,0,0,0.2)',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: theme.fonts.mono
        }}>
          <div style={{ color: theme.colors.textMuted }}>
            RANGE: {startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalItems)} / TOTAL: {totalItems}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              style={{
                padding: '4px 10px',
                background: 'transparent',
                color: currentPage === 1 ? '#444' : theme.colors.accent,
                border: `1px solid ${currentPage === 1 ? '#333' : theme.colors.accent}80`,
                borderRadius: '2px',
                cursor: currentPage === 1 || loading ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                textTransform: 'uppercase'
              }}
            >
              {'<< PREV'}
            </button>

            <div style={{ color: theme.colors.text }}>
              SEG: {currentPage} / {totalPages || 1}
            </div>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              style={{
                padding: '4px 10px',
                background: 'transparent',
                color: currentPage >= totalPages ? '#444' : theme.colors.accent,
                border: `1px solid ${currentPage >= totalPages ? '#333' : theme.colors.accent}80`,
                borderRadius: '2px',
                cursor: currentPage >= totalPages || loading ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                textTransform: 'uppercase'
              }}
            >
              {'NEXT >>'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: theme.colors.textMuted }}>SIZE:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              disabled={loading}
              style={{
                background: 'rgba(0,0,0,0.3)',
                color: theme.colors.text,
                border: `1px solid ${theme.colors.borderStrong}`,
                borderRadius: '2px',
                padding: '2px 4px',
                fontSize: '11px',
                fontFamily: theme.fonts.mono,
                cursor: 'pointer'
              }}
            >
              <option value={10}>10_PCS</option>
              <option value={20}>20_PCS</option>
              <option value={50}>50_PCS</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
