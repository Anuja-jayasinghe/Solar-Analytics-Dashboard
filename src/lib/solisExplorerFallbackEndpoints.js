const solisExplorerFallbackEndpoints = [
  {
    key: 'inverterList',
    category: 'Inverter',
    description: 'Get all inverters under the account (paginated)',
    params: {
      pageNo: { type: 'string', default: '1', description: 'Page number' },
      pageSize: { type: 'string', default: '20', description: 'Records per page (max 100)' },
      stationId: { type: 'string', optional: true, description: 'Filter by station ID' },
      nmiCode: { type: 'string', optional: true, description: 'Filter by NMI code' }
    },
    sampleParams: { pageNo: '1', pageSize: '10' },
    formatterKey: 'inverterListFormatter',
    readonly: true,
    enabled: true
  },
  {
    key: 'inverterDetail',
    category: 'Inverter',
    description: 'Get detailed live and historical metrics for one inverter',
    params: {
      id: { type: 'string', required: true, description: 'Inverter ID' },
      sn: { type: 'string', optional: true, description: 'Inverter serial number' }
    },
    sampleParams: { id: '1308675217944611083' },
    formatterKey: 'inverterDetailFormatter',
    readonly: true,
    enabled: true
  },
  {
    key: 'inverterMonth',
    category: 'Inverter',
    description: 'Get monthly energy breakdown for one inverter',
    params: {
      id: { type: 'string', optional: true, description: 'Inverter ID' },
      sn: { type: 'string', optional: true, description: 'Inverter serial number' },
      month: { type: 'string', required: true, description: 'Month (YYYY-MM format)' },
      timeZone: { type: 'string', default: '8', description: 'Timezone offset' },
      money: { type: 'string', optional: true, description: 'Currency code' }
    },
    sampleParams: { sn: '120B40198150131', month: '2024-04', timeZone: '8' },
    formatterKey: 'timeSeriesFormatter',
    readonly: true,
    enabled: true
  },
  {
    key: 'inverterDay',
    category: 'Inverter',
    description: 'Get intraday power curve for one inverter',
    params: {
      id: { type: 'string', optional: true, description: 'Inverter ID' },
      sn: { type: 'string', optional: true, description: 'Inverter serial number' },
      time: { type: 'string', required: true, description: 'Day (YYYY-MM-DD format)' },
      timeZone: { type: 'string', default: '8', description: 'Timezone offset' }
    },
    sampleParams: { sn: '120B40198150131', time: '2024-04-19', timeZone: '8' },
    formatterKey: 'timeSeriesFormatter',
    readonly: true,
    enabled: true
  },
  {
    key: 'userStationList',
    category: 'Station',
    description: 'Get all power stations under the user account',
    params: {
      pageNo: { type: 'string', default: '1', description: 'Page number' },
      pageSize: { type: 'string', default: '20', description: 'Records per page (max 100)' }
    },
    sampleParams: { pageNo: '1', pageSize: '10' },
    formatterKey: 'stationListFormatter',
    readonly: true,
    enabled: true
  },
  {
    key: 'stationDetail',
    category: 'Station',
    description: 'Get full details of one power station',
    params: {
      id: { type: 'string', required: true, description: 'Station ID' },
      nmiCode: { type: 'string', optional: true, description: 'NMI code filter' }
    },
    sampleParams: { id: '1298491919448631809' },
    formatterKey: 'stationDetailFormatter',
    readonly: true,
    enabled: true
  },
  {
    key: 'stationDay',
    category: 'Station',
    description: 'Get intraday power data for entire power station',
    params: {
      id: { type: 'string', required: true, description: 'Station ID' },
      time: { type: 'string', required: true, description: 'Day (YYYY-MM-DD format)' },
      timeZone: { type: 'string', default: '8', description: 'Timezone offset' },
      money: { type: 'string', optional: true, description: 'Currency code' },
      nmiCode: { type: 'string', optional: true, description: 'NMI code filter' }
    },
    sampleParams: { id: '1298491919448631809', time: '2024-04-19', timeZone: '8' },
    formatterKey: 'timeSeriesFormatter',
    readonly: true,
    enabled: true
  },
  {
    key: 'alarmList',
    category: 'Alarm',
    description: 'Get device alarms, warnings, and faults',
    params: {
      pageNo: { type: 'string', default: '1', description: 'Page number' },
      pageSize: { type: 'string', default: '20', description: 'Records per page (max 100)' },
      stationId: { type: 'string', optional: true, description: 'Filter by station ID' },
      alarmDeviceSn: { type: 'string', optional: true, description: 'Filter by device SN' },
      alarmBeginTime: { type: 'string', optional: true, description: 'Start date (YYYY-MM-DD)' },
      alarmEndTime: { type: 'string', optional: true, description: 'End date (YYYY-MM-DD)' },
      state: { type: 'string', optional: true, description: 'Status: 0=pending, 1=processed, 2=resolved' },
      nmiCode: { type: 'string', optional: true, description: 'Filter by NMI code' }
    },
    sampleParams: { pageNo: '1', pageSize: '10' },
    formatterKey: 'alarmListFormatter',
    readonly: true,
    enabled: true
  }
];

export default solisExplorerFallbackEndpoints;
