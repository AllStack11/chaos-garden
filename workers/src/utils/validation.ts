/**
 * Input Validation Utilities
 *
 * Validates and sanitizes user input to prevent security vulnerabilities
 * and ensure data integrity.
 */

/**
 * Validates that a value is a safe integer within specified bounds
 */
export function validateInteger(
  value: unknown,
  options: {
    min?: number;
    max?: number;
    fieldName?: string;
  } = {}
): { valid: boolean; value: number; error?: string } {
  const { min, max, fieldName = 'value' } = options;

  if (value === null || value === undefined) {
    return {
      valid: false,
      value: 0,
      error: `${fieldName} is required`,
    };
  }

  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);

  if (!Number.isInteger(parsed) || !Number.isFinite(parsed)) {
    return {
      valid: false,
      value: 0,
      error: `${fieldName} must be a valid integer`,
    };
  }

  if (min !== undefined && parsed < min) {
    return {
      valid: false,
      value: 0,
      error: `${fieldName} must be at least ${min}`,
    };
  }

  if (max !== undefined && parsed > max) {
    return {
      valid: false,
      value: 0,
      error: `${fieldName} must be at most ${max}`,
    };
  }

  return {
    valid: true,
    value: parsed,
  };
}

/**
 * Validates that a value is a positive integer
 */
export function validatePositiveInteger(
  value: unknown,
  fieldName = 'value'
): { valid: boolean; value: number; error?: string } {
  return validateInteger(value, { min: 1, fieldName });
}

/**
 * Validates that a value is a non-negative integer
 */
export function validateNonNegativeInteger(
  value: unknown,
  fieldName = 'value'
): { valid: boolean; value: number; error?: string } {
  return validateInteger(value, { min: 0, fieldName });
}

/**
 * Sanitizes a string by removing potentially dangerous characters
 */
export function sanitizeString(value: unknown, maxLength = 1000): string {
  if (typeof value !== 'string') {
    return '';
  }

  // Remove null bytes and limit length
  return value.replace(/\0/g, '').slice(0, maxLength);
}

/**
 * Validates URL search parameters for common API query parameters
 */
export interface ValidatedQueryParams {
  windowTicks?: number;
  limit?: number;
  offset?: number;
}

export function validateQueryParams(
  searchParams: URLSearchParams,
  defaults: ValidatedQueryParams = {}
): { valid: boolean; params: ValidatedQueryParams; errors: string[] } {
  const errors: string[] = [];
  const params: ValidatedQueryParams = { ...defaults };

  // Validate windowTicks if present
  const windowTicksRaw = searchParams.get('windowTicks');
  if (windowTicksRaw !== null) {
    const result = validateInteger(windowTicksRaw, {
      min: 1,
      max: 1000,
      fieldName: 'windowTicks',
    });
    if (result.valid) {
      params.windowTicks = result.value;
    } else {
      errors.push(result.error!);
    }
  }

  // Validate limit if present
  const limitRaw = searchParams.get('limit');
  if (limitRaw !== null) {
    const result = validateInteger(limitRaw, {
      min: 1,
      max: 500,
      fieldName: 'limit',
    });
    if (result.valid) {
      params.limit = result.value;
    } else {
      errors.push(result.error!);
    }
  }

  // Validate offset if present
  const offsetRaw = searchParams.get('offset');
  if (offsetRaw !== null) {
    const result = validateNonNegativeInteger(offsetRaw, 'offset');
    if (result.valid) {
      params.offset = result.value;
    } else {
      errors.push(result.error!);
    }
  }

  return {
    valid: errors.length === 0,
    params,
    errors,
  };
}
