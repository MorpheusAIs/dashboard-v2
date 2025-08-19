// Helper function to safely parse totalStaked for NumberFlow
export const parseStakedAmount = (totalStaked: string): number => {
  try {
    if (!totalStaked || typeof totalStaked !== 'string') {
      return 0;
    }
    const cleanedValue = totalStaked.replace(/,/g, '');
    const parsed = parseFloat(cleanedValue);
    return isNaN(parsed) ? 0 : Math.floor(parsed);
  } catch (error) {
    console.error('Error parsing deposited amount:', error);
    return 0;
  }
};
