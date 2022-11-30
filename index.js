import {
  APECOIN_STAKING_ADDRESS,
  initProviders,
  queryLogs,
  loadJSON,
} from "./lib.js";

/**
 * Retrieve ApeCoin Logs
 */
async function getApeCoinLogs(provider) {
  const APECOIN_ABI = await loadJSON("apecoin-staking-abi.json");

  // get logs
  const logs = await queryLogs(
    "ApeCoin_staking",
    (filters) => [], // return all logs
    APECOIN_STAKING_ADDRESS,
    APECOIN_ABI,
    provider,
    16119150 // apecoin staking deploy date
  );

  // parse logs
  const events = logs.map((l) => ({
    blockNumber: l.blockNumber,
    transactionHash: l.transactionHash,
    event: l.event,
    signature: l.eventSignature,
    args: l.args,
  }));
  await persistOutput(
    `ApeCoin_staking_events_formatted.json`,
    JSON.stringify(events, null, 2)
  );
}

// Run Code
(async () => {
  const { ws /* wallet, oss, rsvr */ } = initProviders();

  await getApeCoinLogs(ws);
  // TODO parse logs, retrieving wallet addresses
  
})();
