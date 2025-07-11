const COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price";

/**
 * Fetches the current price of a given token in a specified currency.
 * @param tokenId The ID of the token on CoinGecko (e.g., 'staked-ether').
 * @param vsCurrency The currency to fetch the price in (e.g., 'usd').
 * @returns The current price of the token, or null if an error occurs.
 */
export async function getTokenPrice(tokenId: string, vsCurrency: string): Promise<number | null> {
    try {
        const response = await fetch(`${COINGECKO_API_URL}?ids=${tokenId}&vs_currencies=${vsCurrency}`);
        
        if (!response.ok) {
            console.error(`Error fetching token price: ${response.statusText}`);
            return null;
        }
        
        const data = await response.json();
        
        if (data[tokenId] && data[tokenId][vsCurrency]) {
            return data[tokenId][vsCurrency];
        } else {
            console.error(`Price data not found for ${tokenId} in ${vsCurrency}`);
            return null;
        }

    } catch (error) {
        console.error("Failed to fetch token price:", error);
        return null;
    }
} 