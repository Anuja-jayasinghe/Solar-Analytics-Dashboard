/**
 * Response Formatters for SolisCloud Explorer
 * 
 * Adapters for displaying different Solis API response shapes as:
 * - Paginated tables
 * - Time-series charts/tables
 * - Detail cards with grouped sections
 */

import { formatDateDDMMYYYY } from './dateFormatter';

/**
 * Format a paginated list response into table data
 * E.g., inverterList, userStationList, alarmList
 */
export function formatListResponse(response) {
  if (!response?.data) {
    return { type: 'empty', items: [] };
  }

  // Handle paginated response structure
  if (response.data.page?.records) {
    const { records, total, current, size } = response.data.page;
    return {
      type: 'paginated-list',
      items: records || [],
      pagination: {
        total,
        currentPage: current,
        pageSize: size,
      },
      summar: response.data.inverterStatus || response.data.collectionStatusVo || null,
    };
  }

  // Handle direct array response
  if (Array.isArray(response.data)) {
    return {
      type: 'array-list',
      items: response.data,
    };
  }

  return { type: 'unknown', items: [] };
}

/**
 * Format a time-series response (daily/monthly data)
 * E.g., inverterMonth, inverterDay, stationDay
 */
export function formatTimeSeriesResponse(response) {
  if (!response?.data) {
    return { type: 'empty', items: [] };
  }

  // Handle array of time-series records
  if (Array.isArray(response.data)) {
    return {
      type: 'time-series-array',
      items: response.data.map((item) => ({
        timestamp: item.date || item.time || item.dataTimestamp,
        timestampStr: item.dateStr || item.timeStr,
        value: item.energy || item.power || item.pac,
        valueStr: item.energyStr || item.powerStr || item.pacStr,
        ...item, // Include all original fields for detailed view
      })),
    };
  }

  // Handle single object response wrapped in array
  if (response.data.dataTimestamp || response.data.dateStr) {
    return {
      type: 'time-series-single',
      items: [{ ...response.data }],
    };
  }

  return { type: 'unknown', items: [] };
}

/**
 * Format detail response (single object with many fields)
 * E.g., inverterDetail, stationDetail
 */
export function formatDetailResponse(response) {
  if (!response?.data) {
    return { type: 'empty', sections: [] };
  }

  const data = response.data;
  const sections = [];

  // Identity section
  if (data.id || data.sn || data.stationName) {
    sections.push({
      title: 'Identity',
      fields: [
        { label: 'ID', value: data.id },
        { label: 'Serial Number', value: data.sn },
        { label: 'Name', value: data.stationName || data.name },
        { label: 'Address', value: data.addr },
      ].filter((f) => f.value !== undefined),
    });
  }

  // Status section
  if (data.state !== undefined || data.collectorState !== undefined || data.status !== undefined) {
    const stateMap = { 1: 'Online', 2: 'Offline', 3: 'Alarm' };
    sections.push({
      title: 'Status',
      fields: [
        {
          label: 'State',
          value: stateMap[data.state] || stateMap[data.collectorState] || stateMap[data.status] || 'Unknown',
          badge: true,
        },
        { label: 'Last Updated', value: data.dataTimestamp ? formatDateDDMMYYYY(data.dataTimestamp, null) : null },
      ].filter((f) => f.value !== undefined),
    });
  }

  // Energy section
  if (data.eToday !== undefined || data.dayEnergy !== undefined || data.power) {
    sections.push({
      title: 'Energy & Power',
      fields: [
        { label: 'Today', value: data.eToday || data.dayEnergy, unit: data.etodayStr || data.dayEnergyStr },
        { label: 'This Month', value: data.eMonth || data.monthEnergy, unit: data.eMonthStr || data.monthEnergyStr },
        { label: 'This Year', value: data.eYear || data.yearEnergy, unit: data.eYearStr || data.yearEnergyStr },
        { label: 'Total', value: data.eTotal || data.allEnergy, unit: data.etotalStr || data.allEnergyStr },
        { label: 'Realtime Power', value: data.pac, unit: data.pacStr },
      ].filter((f) => f.value !== undefined),
    });
  }

  // Battery section (if applicable)
  if (data.batteryCapacitySoc !== undefined || data.batteryHealthSoh !== undefined) {
    sections.push({
      title: 'Battery',
      fields: [
        { label: 'SOC', value: data.batteryCapacitySoc, unit: '%' },
        { label: 'SOH', value: data.batteryHealthSoh, unit: '%' },
        { label: 'Battery Power', value: data.batteryPower, unit: data.batteryPowerStr },
        { label: 'Battery Voltage', value: data.batteryVoltage, unit: data.batteryVoltageStr },
      ].filter((f) => f.value !== undefined),
    });
  }

  // Electrical section
  if (data.iAc1 !== undefined || data.uAc1 !== undefined) {
    sections.push({
      title: 'Grid Connection',
      fields: [
        { label: 'Frequency', value: data.fac, unit: data.facStr },
        { label: 'Phase A Voltage', value: data.uAc1 },
        { label: 'Phase A Current', value: data.iAc1 },
        { label: 'Phase B Voltage', value: data.uAc2 },
        { label: 'Phase B Current', value: data.iAc2 },
        { label: 'Phase C Voltage', value: data.uAc3 },
        { label: 'Phase C Current', value: data.iAc3 },
        { label: 'Power Factor', value: data.powerFactor },
      ].filter((f) => f.value !== undefined),
    });
  }

  // Environmental section
  if (data.powerStationNumTree !== undefined || data.powerStationAvoidedCo2 !== undefined) {
    sections.push({
      title: 'Environmental Impact',
      fields: [
        { label: 'Trees Equivalent', value: data.powerStationNumTree, unit: data.powerStationNumTreeUnitString },
        {
          label: 'CO₂ Avoided',
          value: data.powerStationAvoidedCo2,
          unit: data.powerStationAvoidedCo2UnitString,
        },
      ].filter((f) => f.value !== undefined),
    });
  }

  // Weather section
  if (data.weather || data.condTxtD) {
    const weather = data.weather || data;
    sections.push({
      title: 'Weather',
      fields: [
        { label: 'Day Condition', value: weather.condTxtD },
        { label: 'Night Condition', value: weather.condTxtN },
        { label: 'Temperature Max', value: weather.tmpMax },
        { label: 'Temperature Min', value: weather.tmpMin },
        { label: 'Humidity', value: weather.hum },
        { label: 'Wind Speed', value: weather.windSpd },
      ].filter((f) => f.value !== undefined),
    });
  }

  return {
    type: 'detail-object',
    sections,
    rawData: data,
  };
}

/**
 * Format alarm response
 */
export function formatAlarmResponse(response) {
  const formatted = formatListResponse(response);

  if (formatted.items.length > 0) {
    const levelMap = { 1: 'Tip', 2: 'General', 3: 'Emergency' };
    const stateMap = { 0: 'Pending', 1: 'Processed', 2: 'Resolved' };

    formatted.items = formatted.items.map((alarm) => ({
      ...alarm,
      alarmLevelName: levelMap[alarm.alarmLevel] || alarm.alarmLevel,
      stateName: stateMap[alarm.state] || alarm.state,
    }));
  }

  return formatted;
}

/**
 * Auto-detect response type and apply appropriate formatter
 */
export function formatResponse(response, formatterKey) {
  if (!response) return { type: 'empty' };

  // Route to appropriate formatter
  if (formatterKey === 'timeSeriesFormatter' || formatterKey === 'inverterDayFormatter') {
    return formatTimeSeriesResponse(response);
  }

  if (formatterKey === 'alarmListFormatter') {
    return formatAlarmResponse(response);
  }

  if (formatterKey === 'inverterDetailFormatter' || formatterKey === 'stationDetailFormatter') {
    return formatDetailResponse(response);
  }

  // Default: try to detect from response structure
  if (Array.isArray(response.data) && response.data[0]?.timestamp) {
    return formatTimeSeriesResponse(response);
  }

  if (response.data?.page?.records || Array.isArray(response.data?.records)) {
    if (formatterKey === 'alarmListFormatter' || response.data?.records?.[0]?.alarmCode) {
      return formatAlarmResponse(response);
    }
    return formatListResponse(response);
  }

  if (typeof response.data === 'object' && !Array.isArray(response.data) && response.data.id) {
    return formatDetailResponse(response);
  }

  return { type: 'unknown', data: response.data };
}

export default {
  formatListResponse,
  formatTimeSeriesResponse,
  formatDetailResponse,
  formatAlarmResponse,
  formatResponse,
};
