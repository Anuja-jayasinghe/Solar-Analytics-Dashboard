/**
 * Request Validator for SolisCloud Explorer
 * 
 * Validates endpoint keys and parameters before forwarding to Solis API
 */

import solisEndpointsConfig from '../config/solisEndpointsConfig.js';

class SolisExplorerValidator {
  /**
   * Validate that endpoint is allowed
   */
  validateEndpointKey(endpointKey) {
    if (!endpointKey || typeof endpointKey !== 'string') {
      return { valid: false, error: 'Endpoint key must be a non-empty string' };
    }

    const config = solisEndpointsConfig.getEndpointConfig(endpointKey);
    if (!config) {
      return { valid: false, error: `Endpoint not found: ${endpointKey}` };
    }

    if (!config.enabled) {
      return { valid: false, error: `Endpoint is disabled: ${endpointKey}` };
    }

    if (!config.readonly) {
      return { valid: false, error: `Endpoint is not read-only (mutation protection): ${endpointKey}` };
    }

    return { valid: true };
  }

  /**
   * Validate request parameters
   */
  validateParams(endpointKey, params) {
    if (!params || typeof params !== 'object') {
      return { valid: false, errors: ['Params must be an object'] };
    }

    const result = solisEndpointsConfig.validateParams(endpointKey, params);
    return result;
  }

  /**
   * Full request validation
   */
  validateRequest(endpointKey, params) {
    // Check endpoint
    const endpointValidation = this.validateEndpointKey(endpointKey);
    if (!endpointValidation.valid) {
      return { valid: false, error: endpointValidation.error };
    }

    // Check params
    const paramsValidation = this.validateParams(endpointKey, params);
    if (!paramsValidation.valid) {
      return {
        valid: false,
        error: 'Invalid parameters',
        errors: paramsValidation.errors,
      };
    }

    return {
      valid: true,
      endpoint: solisEndpointsConfig.getEndpointConfig(endpointKey),
      params: paramsValidation.validated,
    };
  }

  /**
   * Get list of enabled endpoints (for UI)
   */
  getEndpoints() {
    return solisEndpointsConfig.getAllEnabledEndpoints();
  }

  /**
   * Get single endpoint config
   */
  getEndpoint(key) {
    const config = solisEndpointsConfig.getEndpointConfig(key);
    if (!config) return null;
    return { key, ...config };
  }
}

export default new SolisExplorerValidator();
