
export class JSONDepthError extends Error {
  constructor(depth: number) {
    super(`JSON object exceeds maximum allowed depth of ${depth}`);
    this.name = 'JSONDepthError';
  }
}

/**
 * Validates the depth of a parsed JSON object/array.
 * Throws JSONDepthError if depth exceeds maxDepth.
 * 
 * @param item The parsed JSON item to check
 * @param maxDepth Maximum allowed nesting depth (default: 20)
 * @returns The original item if valid
 */
export function validateJSONDepth(item: any, maxDepth = 20): any {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const stack: { item: any; depth: number }[] = [{ item, depth: 1 }];

  while (stack.length > 0) {
    const { item: current, depth } = stack.pop()!;

    if (depth > maxDepth) {
      throw new JSONDepthError(maxDepth);
    }

    if (current && typeof current === 'object') {
      const values = Array.isArray(current) ? current : Object.values(current);
      for (const value of values) {
        if (value && typeof value === 'object') {
          stack.push({ item: value, depth: depth + 1 });
        }
      }
    }
  }

  return item;
}

/**
 * Safe replacement for request.json() that validates nesting depth.
 * 
 * @param request The NextRequest object
 * @param maxDepth Maximum allowed nesting depth (default: 20)
 * @returns Parsed JSON body
 */
export async function safeJsonParse(request: Request, maxDepth = 20): Promise<any> {
  const body = await request.json();
  return validateJSONDepth(body, maxDepth);
}
