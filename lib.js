import { WebSocketProvider, Contract } from "ethers";
import path from "path";
import fs from "fs-extra";

export const APECOIN_STAKING_ADDRESS =
  "0x5954ab967bc958940b7eb73ee84797dc8a2afbb9";

/**
 * Load a JSON file
 *
 * @param {string} filename
 * @param {} options
 */
export async function loadJSON(filename, options) {
  return JSON.parse(
    await fs.promises.readFile(path.join(process.cwd(), filename), options)
  );
}

/**
 * Write a file to `/.out`.
 * @param {string} filename
 * @param {*} data
 * @param {*} options
 */
export async function persistOutput(filename, data, options) {
  await fs.outputFile(
    path.join(process.cwd(), `output`, filename),
    data,
    options
  );
}

/**
 * Init a wallet provider
 * @returns
 */
export function initProviders() {
  // --- Create a wallet provider
  // const rpcProvider = new JsonRpcProvider('https://rpc.flashbots.net');
  // const w = new Wallet.fromMnemonic(process.env.MNEMONIC);
  // const wallet = w.connect(rpcProvider);

  // --- Create a websocket provider
  const ws = new WebSocketProvider(
    `wss://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  );

  // --- Reservoir client
  // const rsvr = reservoir.createClient({
  //     apiBase: "https://api.reservoir.tools",
  //     apiKey: process.env.RESERVOIR_KEY,
  //     source: "YOUR.SOURCE"
  // });

  // --- OpenSea Stream Client
  // const oss = new OpenSeaStreamClient({
  //     token: process.env.OPENSEA_KEY,
  //     connectOptions: {
  //         transport: WebSocket
  //     },
  //     onError: (obj) => console.error(obj.message, obj.error),
  // });
  // oss.connect();

  return {
    // wallet,
    // rsvr,
    // oss,
    ws,
  };
}

/**
 * Get logs for a specific filter
 * @param {string} label
 * @param {*} filter
 * @param {*} address
 * @param {*} ABI
 * @param {*} provider
 */
export async function queryLogs(
  label,
  filter,
  address,
  ABI,
  provider,
  sBlock,
  eBlock
) {
  // backfill logs
  const DEPLOY_BLOCK = sBlock || 14400533;
  const END_BLOCK = eBlock || (await provider.getBlockNumber());

  // init contract
  const contract = new Contract(address, ABI, provider);

  // get filter
  const f =
    typeof filter === "function"
      ? filter(contract.filters)
      : contract.filters[filter]();

  let startBlock = DEPLOY_BLOCK;
  let events = [];
  while (startBlock <= END_BLOCK) {
    // deploy block
    const filtered = await contract.queryFilter(f, startBlock, startBlock + 75);

    // NOTE: o(n)^2 :(
    // for (let i = 0; i < filtered.length; i++) {
    // fix annoying ethers args array
    // if (filtered[i].args) {
    //   filtered[i].args = Object.assign(
    //     ...Object.keys(filtered[i]?.args || {})
    //       .map((k) => {
    //         if (Number.isNaN(Number(k))) {
    //           return { [k]: filtered[i].args[k] };
    //         }
    //         return null;
    //       })
    //       .filter((l) => l)
    //   );
    // }
    // }
    events = events.concat(filtered);
    startBlock = startBlock + 100;
    console.log(startBlock, ` - ${label}:`, events.length, "events");
  }

  await persistOutput(`${label}_events.json`, JSON.stringify(events, null, 2));

  return events;
}
