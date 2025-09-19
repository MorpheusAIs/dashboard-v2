// Helper function to safely parse totalStaked for NumberFlow
export const parseStakedAmount = (totalStaked: string): number => {
  try {
    if (!totalStaked || typeof totalStaked !== 'string') {
      console.log(`🐋 PARSE DEBUG: Invalid input:`, { totalStaked, type: typeof totalStaked });
      return 0;
    }
    const cleanedValue = totalStaked.replace(/,/g, '');
    const parsed = parseFloat(cleanedValue);

    // Special logging for WBTC
    if (totalStaked.includes('wBTC') || totalStaked === '0' || totalStaked === 'N/A') {
      console.log(`🐋 PARSE WBTC DEBUG:`, {
        input: totalStaked,
        cleanedValue,
        parsed,
        isNaN: isNaN(parsed)
      });
    }

    return isNaN(parsed) ? 0 : parsed;
  } catch (error) {
    console.error('Error parsing deposited amount:', error);
    return 0;
  }
};
