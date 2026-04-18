/**
 * SolisCloud API Endpoints Configuration
 * 
 * Single source of truth for:
 * - Allowlist of safe, read-only endpoints
 * - Parameter validation schemas
 * - Response formatter hints
 * - UI display metadata
 */

export const solisEndpointsConfig = {
  // MVP endpoints - Phase 1 (all read-only, verified safe)
  inverterList: {
    path: '/v1/api/inverterList',
    category: 'Inverter',
    readonly: true,
    description: 'Get all inverters under the account (paginated)',
    params: {
      pageNo: { type: 'string', default: '1', description: 'Page number' },
      pageSize: { type: 'string', default: '20', description: 'Records per page (max 100)' },
      stationId: { type: 'string', optional: true, description: 'Filter by station ID' },
      nmiCode: { type: 'string', optional: true, description: 'Filter by NMI code' },
    },
    sampleParams: { pageNo: '1', pageSize: '10' },
    formatterKey: 'inverterListFormatter',
    enabled: true,
  },

  inverterDetail: {
    path: '/v1/api/inverterDetail',
    category: 'Inverter',
    readonly: true,
    description: 'Get detailed live and historical metrics for one inverter',
    params: {
      id: { type: 'string', required: true, description: 'Inverter ID' },
      sn: { type: 'string', optional: true, description: 'Inverter serial number' },
    },
    sampleParams: { id: '1308675217944611083' },
    formatterKey: 'inverterDetailFormatter',
    enabled: true,
  },

  inverterMonth: {
    path: '/v1/api/inverterMonth',
    category: 'Inverter',
    readonly: true,
    description: 'Get monthly energy breakdown for one inverter',
    params: {
      id: { type: 'string', optional: true, description: 'Inverter ID' },
      sn: { type: 'string', optional: true, description: 'Inverter serial number' },
      month: { type: 'string', required: true, description: 'Month (YYYY-MM format)' },
      timeZone: { type: 'string', default: '8', description: 'Timezone offset' },
      money: { type: 'string', optional: true, description: 'Currency code' },
    },
    sampleParams: { sn: '120B40198150131', month: '2024-04', timeZone: '8' },
    formatterKey: 'timeSeriesFormatter',
    enabled: true,
  },

  inverterDay: {
    path: '/v1/api/inverterDay',
    category: 'Inverter',
    readonly: true,
    description: 'Get intraday power curve for one inverter',
    params: {
      id: { type: 'string', optional: true, description: 'Inverter ID' },
      sn: { type: 'string', optional: true, description: 'Inverter serial number' },
      time: { type: 'string', required: true, description: 'Day (YYYY-MM-DD format)' },
      timeZone: { type: 'string', default: '8', description: 'Timezone offset' },
    },
    sampleParams: { sn: '120B40198150131', time: '2024-04-19', timeZone: '8' },
    formatterKey: 'timeSeriesFormatter',
    enabled: true,
  },

  userStationList: {
    path: '/v1/api/userStationList',
    category: 'Station',
    readonly: true,
    description: 'Get all power stations under the user account',
    params: {
      pageNo: { type: 'string', default: '1', description: 'Page number' },
      pageSize: { type: 'string', default: '20', description: 'Records per page (max 100)' },
    },
    sampleParams: { pageNo: '1', pageSize: '10' },
    formatterKey: 'stationListFormatter',
    enabled: true,
  },

  stationDetail: {
    path: '/v1/api/stationDetail',
    category: 'Station',
    readonly: true,
    description: 'Get full details of one power station',
    params: {
      id: { type: 'string', required: true, description: 'Station ID' },
      nmiCode: { type: 'string', optional: true, description: 'NMI code filter' },
    },
    sampleParams: { id: '1298491919448631809' },
    formatterKey: 'stationDetailFormatter',
    enabled: true,
  },

  stationDay: {
    path: '/v1/api/stationDay',
    category: 'Station',
    readonly: true,
    description: 'Get intraday power data for entire power station',
    params: {
      id: { type: 'string', required: true, description: 'Station ID' },
      time: { type: 'string', required: true, description: 'Day (YYYY-MM-DD format)' },
      timeZone: { type: 'string', default: '8', description: 'Timezone offset' },
      money: { type: 'string', optional: true, description: 'Currency code' },
      nmiCode: { type: 'string', optional: true, description: 'NMI code filter' },
    },
    sampleParams: { id: '1298491919448631809', time: '2024-04-19', timeZone: '8' },
    formatterKey: 'timeSeriesFormatter',
    enabled: true,
  },

  alarmList: {
    path: '/v1/api/alarmList',
    category: 'Alarm',
    readonly: true,
    description: 'Get device alarms, warnings, and faults',
    params: {
      pageNo: { type: 'string', default: '1', description: 'Page number' },
      pageSize: { type: 'string', default: '20', description: 'Records per page (max 100)' },
      stationId: { type: 'string', optional: true, description: 'Filter by station ID' },
      alarmDeviceSn: { type: 'string', optional: true, description: 'Filter by device SN' },
      alarmBeginTime: { type: 'string', optional: true, description: 'Start date (YYYY-MM-DD)' },
      alarmEndTime: { type: 'string', optional: true, description: 'End date (YYYY-MM-DD)' },
      state: { type: 'string', optional: true, description: 'Status: 0=pending, 1=processed, 2=resolved' },
      nmiCode: { type: 'string', optional: true, description: 'Filter by NMI code' },
    },
    sampleParams: { pageNo: '1', pageSize: '10' },
    formatterKey: 'alarmListFormatter',
    enabled: true,
  },

  // Metadata and helpers
  getEndpointConfig(key) {
    return this[key] || null;
  },

  getAllEnabledEndpoints() {
    return Object.entries(this)
      .filter(([key, val]) => val.enabled === true && typeof val === 'object' && val.path)
      .map(([key, val]) => ({ key, ...val }));
  },

  isReadonly(key) {
    const config = this[key];
    return config && config.readonly === true;
  },

  isEnabled(key) {
    const config = this[key];
    return config && config.enabled === true;
  },

  validateParams(endpointKey, params) {
    const config = this[endpointKey];
    if (!config) return { valid: false, errors: ['Endpoint not found'] };

    const errors = [];
    const validated = {};

    for (const [paramKey, paramDef] of Object.entries(config.params)) {
      const value = params[paramKey];

      if (paramDef.required && !value) {
        errors.push(`Missing required parameter: ${paramKey}`);
      } else if (value) {
        // Type coercion/validation
        if (paramDef.type === 'string' && typeof value !== 'string') {
          errors.push(`Parameter ${paramKey} must be a string, got ${typeof value}`);
        }
        validated[paramKey] = value;
      } else if (paramDef.default && !value) {
        validated[paramKey] = paramDef.default;
      }
    }

    return { valid: errors.length === 0, errors, validated };
  },
};

export default solisEndpointsConfig;
