import React, { useEffect, useState, useContext } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ThemeContext } from '../components/ThemeContext';

const Settings = () => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const { theme, setTheme } = useContext(ThemeContext);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    console.log('🔍 Fetching settings from system_settings table...');
    
    const { data, error } = await supabase.from('system_settings').select('*');
    
    if (error) {
      console.error('❌ Settings fetch error:', error);
      setMessage(`❌ Database error: ${error.message}`);
      
      // Check if it's a table not found error
      if (error.message.includes('relation "system_settings" does not exist')) {
        setMessage('❌ system_settings table does not exist. Please create it first.');
      } else if (error.message.includes('permission denied')) {
        setMessage('❌ Permission denied. Check your database permissions.');
      } else {
        setMessage(`❌ Database connection failed: ${error.message}`);
      }
    } else {
      console.log('✅ Settings fetched successfully:', data);
      setSettings(data || []);
      
      if (data && data.length === 0) {
        setMessage('⚠️ No settings found in database. You need to add some settings first.');
      } else {
        setMessage('');
        // Don't auto-apply theme from database on mount - respect user's current theme
        // Only sync if database value differs from current localStorage/context
      }
    }
    setLoading(false);
  };

  const handleChange = (id, value) => {
    setSettings(prev =>
      prev.map(s => (s.id === id ? { ...s, setting_value: value } : s))
    );
  };

  const handleSave = async (setting) => {
    const { id, setting_value } = setting;
    const { error } = await supabase
      .from('system_settings')
      .update({ setting_value, updated_at: new Date() })
      .eq('id', id);
    if (error) {
      console.error('Save error:', error);
      setMessage(`❌ Failed to save ${setting.setting_name}: ${error.message}`);
    } else {
      setMessage(`✅ ${setting.setting_name} updated successfully`);
      // apply theme immediately if changed
      if (setting.setting_name === 'theme') {
        setTheme(setting_value);
        // Also update the ThemeContext
        if (setting_value === 'light') {
          document.body.classList.add('light-theme');
        } else {
          document.body.classList.remove('light-theme');
        }
      }
      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const addDefaultSettings = async () => {
    setLoading(true);
    setMessage('🔄 Adding default settings...');
    
    const defaultSettings = [
      { setting_name: 'theme', setting_value: 'dark', description: 'Application theme (dark, light, orange)' },
      { setting_name: 'rate_per_kwh', setting_value: '50', description: 'Default rate per kWh in LKR for calculations' }
    ];

    try {
      const { error } = await supabase
        .from('system_settings')
        .insert(defaultSettings);
      
      if (error) {
        console.error('Insert error:', error);
        setMessage(`❌ Failed to add settings: ${error.message}`);
      } else {
        setMessage('✅ Default settings added successfully!');
        fetchSettings(); // Refresh the settings list
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setMessage(`❌ Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ padding: "2rem", textAlign: "center", color: "var(--accent)" }}>
      <p>🔄 Loading settings...</p>
    </div>
  );

  return (
    <div style={{ 
      padding: "2rem", 
      maxWidth: "1200px", 
      margin: "0 auto", 
      color: "var(--text-color)",
      minHeight: "100vh"
    }}>
      <h1 style={{ 
        color: "var(--accent)", 
        marginBottom: "2rem", 
        fontSize: "2rem",
        fontWeight: "bold",
        marginTop: "70px"
      }}>
        ⚙️ Settings
      </h1>

      {message && (
        <div style={{
          padding: "1rem",
          marginBottom: "1rem",
          borderRadius: "8px",
          background: message.includes("❌") ? "rgba(220, 53, 69, 0.1)" : "rgba(40, 167, 69, 0.1)",
          border: `1px solid ${message.includes("❌") ? "#dc3545" : "#28a745"}`,
          color: message.includes("❌") ? "#dc3545" : "#28a745"
        }}>
          {message}
        </div>
      )}

      <div className="settings-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "1.5rem"
      }}>
        {settings.map(setting => (
          <div
            key={setting.id}
            style={{
              padding: "1.5rem",
              background: "var(--card-bg)",
              borderRadius: "12px",
              backdropFilter: "blur(10px)",
              boxShadow: `0 4px 20px var(--card-shadow)`,
              border: `1px solid var(--card-border)`
            }}
          >
            <label style={{ 
              display: "block", 
              fontWeight: "bold", 
              color: "var(--accent)",
              marginBottom: "0.5rem",
              fontSize: "1.1rem"
            }}>
              {setting.setting_name}
            </label>
            
            {setting.setting_name === 'theme' ? (
              <select
                value={setting.setting_value}
                onChange={(e) => handleChange(setting.id, e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  background: "var(--card-bg-solid)",
                  color: "var(--text-color)",
                  border: "1px solid var(--border-color)",
                  marginBottom: "0.5rem"
                }}
              >
                <option value="dark">🌙 Dark</option>
                <option value="light">☀️ Light</option>
              </select>
            ) : setting.setting_name === 'rate_per_kwh' ? (
              <input
                type="number"
                value={setting.setting_value}
                onChange={(e) => handleChange(setting.id, e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  background: "var(--card-bg-solid)",
                  color: "var(--text-color)",
                  border: "1px solid var(--border-color)",
                  marginBottom: "0.5rem"
                }}
                min="0"
                step="0.01"
                placeholder="Enter rate per kWh"
              />
            ) : (
              <input
                type="text"
                value={setting.setting_value}
                onChange={(e) => handleChange(setting.id, e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  background: "var(--card-bg-solid)",
                  color: "var(--text-color)",
                  border: "1px solid var(--border-color)",
                  marginBottom: "0.5rem"
                }}
              />
            )}
            
            {setting.description && (
              <p style={{ 
                fontSize: "0.9rem", 
                color: "var(--text-secondary)", 
                marginBottom: "1rem",
                fontStyle: "italic"
              }}>
                {setting.description}
              </p>
            )}
            
            <button
              onClick={() => handleSave(setting)}
              style={{
                background: "var(--accent)",
                color: "#000",
                border: "none",
                padding: "10px 20px",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold",
                transition: "all 0.2s ease"
              }}
              onMouseOver={(e) => e.target.style.background = "#ff8c00"}
              onMouseOut={(e) => e.target.style.background = "var(--accent)"}
            >
              💾 Save
            </button>
          </div>
        ))}
      </div>

      {settings.length === 0 && !loading && (
        <div style={{ 
          textAlign: "center", 
          padding: "2rem", 
          color: "var(--text-secondary)",
          background: "var(--card-bg)",
          borderRadius: "12px",
          border: "1px solid var(--card-border)"
        }}>
          <p style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>
            📊 No settings found in database
          </p>
          <p style={{ marginBottom: "1.5rem", color: "var(--text-muted)" }}>
            You need to add some initial settings to your database.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={addDefaultSettings}
              style={{
                background: "var(--accent)",
                color: "#000",
                border: "none",
                padding: "10px 20px",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              🚀 Add Default Settings
            </button>
            <button
              onClick={fetchSettings}
              style={{
                background: "var(--hover-bg)",
                color: "var(--text-color)",
                border: "none",
                padding: "10px 20px",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
