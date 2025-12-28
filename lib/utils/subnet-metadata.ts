/**
 * Subnet metadata utilities for parsing API, Agent, and MCP subnet descriptions
 */

export interface SubnetMetadata {
  description: string;
  endpointUrl?: string;
  author?: string;
  inputType?: string;
  outputType?: string;
  skills?: string[];
  type?: 'Agent' | 'API' | 'MCP';
  category?: string;
  timestamp?: number;
}

export interface ParsedSubnetDescription {
  description: string;
  metadata: SubnetMetadata | null;
  isStructured: boolean;
}

/**
 * Parses a subnet description field to detect if it contains structured metadata
 * @param description - The description field from the builder/subnet
 * @returns Parsed description and metadata
 */
export function parseSubnetDescription(description?: string): ParsedSubnetDescription {
  if (!description) {
    return {
      description: '',
      metadata: null,
      isStructured: false,
    };
  }

  try {
    // Try to parse as JSON
    const parsed = JSON.parse(description);
    
    // Check if it has the metadata_ field
    if (parsed.metadata_ && typeof parsed.metadata_ === 'object') {
      return {
        description: parsed.metadata_.description || '',
        metadata: parsed.metadata_,
        isStructured: true,
      };
    }
    
    // It's JSON but not in the expected format, return the original
    return {
      description: description,
      metadata: null,
      isStructured: false,
    };
  } catch {
    // Not JSON, return as plain string
    return {
      description: description,
      metadata: null,
      isStructured: false,
    };
  }
}

/**
 * Formats subnet metadata for display
 */
export function formatMetadataValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  return '';
}
