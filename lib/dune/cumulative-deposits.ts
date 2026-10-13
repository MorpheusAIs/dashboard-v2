const CUMULATIVE_DEPOSITS_QUERY_ID = 3447596;
const DUNE_API_BASE = 'https://api.dune.com/api/v1';
const EXECUTE_POLL_MS = 2000;
const EXECUTE_TIMEOUT_MS = 55_000;

export type CumulativeDepositPoint = {
  date: string;
  cumulativeDeposit: number;
};

export type CumulativeDepositsFetchResult = {
  data: CumulativeDepositPoint[];
  queryId: number;
  executionId?: string;
  source: 'latest' | 'executed';
};

type DuneRowsResponse = {
  execution_id?: string;
  execution_ended_at?: string;
  state?: string;
  error?: { message?: string } | string;
  result?: {
    rows?: Record<string, unknown>[];
  };
};

function getDuneApiKey(): string {
  const apiKey = process.env.DUNE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing DUNE_API_KEY environment variable');
  }
  return apiKey;
}

async function duneFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${DUNE_API_BASE}${path}`, {
    ...init,
    headers: {
      'X-Dune-API-Key': getDuneApiKey(),
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

function extractCumulativeDeposits(result: DuneRowsResponse): CumulativeDepositPoint[] {
  const rows = result.result?.rows ?? [];

  return rows
    .map((row) => ({
      date: String(row.date ?? ''),
      cumulativeDeposit:
        parseFloat(String(row.cumulativeDeposit ?? row.cumulative_deposit ?? 0)) || 0,
    }))
    .filter((item) => item.date !== '');
}

function errorMessageFromDune(payload: DuneRowsResponse | string): string {
  if (typeof payload === 'string') {
    return payload;
  }
  if (typeof payload.error === 'string') {
    return payload.error;
  }
  return payload.error?.message || payload.state || 'Unknown Dune error';
}

async function getLatestCumulativeDeposits(): Promise<DuneRowsResponse | null> {
  const response = await duneFetch(`/query/${CUMULATIVE_DEPOSITS_QUERY_ID}/results?limit=10000`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Dune API request failed: ${response.status} ${body}`);
  }
  return response.json() as Promise<DuneRowsResponse>;
}

async function executeCumulativeDepositsQuery(): Promise<DuneRowsResponse> {
  // This API key rejects medium/large. Send an empty body so Dune uses small.
  const executeResponse = await duneFetch(`/query/${CUMULATIVE_DEPOSITS_QUERY_ID}/execute`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  if (!executeResponse.ok) {
    const body = await executeResponse.text();
    throw new Error(`Dune execute failed: ${executeResponse.status} ${body}`);
  }

  const execution = (await executeResponse.json()) as DuneRowsResponse;
  const executionId = execution.execution_id;
  if (!executionId) {
    throw new Error('Dune execute did not return an execution_id');
  }

  const deadline = Date.now() + EXECUTE_TIMEOUT_MS;
  let status = execution;

  while (status.state === 'QUERY_STATE_PENDING' || status.state === 'QUERY_STATE_EXECUTING') {
    if (Date.now() > deadline) {
      throw new Error(`Dune execution ${executionId} timed out in state ${status.state}`);
    }

    await new Promise((resolve) => setTimeout(resolve, EXECUTE_POLL_MS));

    const statusResponse = await duneFetch(`/execution/${executionId}/status`);
    if (!statusResponse.ok) {
      const body = await statusResponse.text();
      throw new Error(`Dune status failed: ${statusResponse.status} ${body}`);
    }

    status = (await statusResponse.json()) as DuneRowsResponse;
  }

  if (status.state !== 'QUERY_STATE_COMPLETED') {
    throw new Error(
      `Dune execution ${executionId} ended in ${status.state}: ${errorMessageFromDune(status)}`
    );
  }

  const resultsResponse = await duneFetch(`/execution/${executionId}/results?limit=10000`);
  if (!resultsResponse.ok) {
    const body = await resultsResponse.text();
    throw new Error(`Dune results failed: ${resultsResponse.status} ${body}`);
  }

  return resultsResponse.json() as Promise<DuneRowsResponse>;
}

/**
 * Fetch cumulative deposits from Dune.
 *
 * Default path reads the latest saved results (no execution credits).
 * If those results are missing, the saved query is executed as recovery.
 * Pass `forceRefresh` from the daily cron to always re-run the query.
 */
export async function getCumulativeDeposits(
  options: { forceRefresh?: boolean } = {}
): Promise<CumulativeDepositsFetchResult> {
  let source: CumulativeDepositsFetchResult['source'] = 'latest';
  let queryResult: DuneRowsResponse | null = null;

  if (!options.forceRefresh) {
    queryResult = await getLatestCumulativeDeposits();
  }

  const shouldExecute = options.forceRefresh || queryResult === null;

  if (shouldExecute) {
    console.log(
      options.forceRefresh
        ? '🔄 [DUNE CUMULATIVE DEPOSITS] Executing query for a fresh result set'
        : '⚠️ [DUNE CUMULATIVE DEPOSITS] No latest results for the current query version, executing query'
    );
    queryResult = await executeCumulativeDepositsQuery();
    source = 'executed';
  }

  if (!queryResult) {
    throw new Error('Dune query returned no result payload');
  }

  const data = extractCumulativeDeposits(queryResult);
  if (data.length === 0) {
    throw new Error('Dune query returned no valid data rows');
  }

  return {
    data,
    queryId: CUMULATIVE_DEPOSITS_QUERY_ID,
    executionId: queryResult.execution_id,
    source,
  };
}
