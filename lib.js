import { WebSocketProvider, Contract } from "ethers";
import path from "path";
import readline from 'readline';
import fs from "fs-extra";
import pLimit from 'p-limit';
import { EOL } from 'os';

export const APECOIN_STAKING_ADDRESS =
  "0x5954ab967bc958940b7eb73ee84797dc8a2afbb9";

// BigInt JSON support
BigInt.prototype.toJSON = function () {
  return this.toString();
};

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
 * Load a large jsonLd log file
 * @param {*} filename 
 */
export function loadJsonLd(filename) {
  return new Promise((resolve) => {
    const results = [];

    // read log file
    const rl = readline.createInterface({
      input: fs.createReadStream(path.join(process.cwd(), `/output/`, filename)),
      crlfDelay: Infinity
    });

    rl.on('line', async (line) => {
      // convert to json
      const parsed = JSON.parse(line.replace(EOL, ''));
      // handle row
      results.push(parsed);
    });

    rl.on('close', () => resolve(results));
  });
}

/**
 * Write a file to `/.out`.
 * @param {string} filename
 * @param {*} data
 * @param {*} options
 */
export async function persistOutput(filename, data, options) {
  await fs.outputFile(
    path.join(process.cwd(), `/output/`, filename),
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
  const CONCURRENCY = 100; // TODO can change if this returns too many logs at once
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
  let requests = [];
  
  const doRequest = (startBlock, endBlock) => {
    return async () => {
      console.log(`${label} - `, 'retrieving logs: ', startBlock, 'to', endBlock);
      const formatted = [];
      let filtered = await contract.queryFilter(f, startBlock, endBlock);
      // format logs for JSON parsing
      for (let i = 0; i < filtered.length; i++) {
        formatted.push({
          blockNumber: filtered[i].blockNumber,
          blockHash: filtered[i].blockHash,
          transactionIndex: filtered[i].transactionIndex,
          removed: filtered[i].removed,
          address: filtered[i].address,
          data: filtered[i].data,
          topics: filtered[i].topics,
          transactionHash: filtered[i].transactionHash,
          logIndex: filtered[i].logIndex,
          args: filtered[i].args.map(a => a),
          fragment: JSON.parse(filtered[i].fragment.format('json'))
        });
      }
      console.log(`${label} - `, 'found', formatted.length, 'logs in blocks', startBlock, 'to', endBlock);
      return formatted;
    };
  }

  while (startBlock <= END_BLOCK) {
    requests.push(doRequest(startBlock, startBlock + CONCURRENCY));
    startBlock = startBlock + CONCURRENCY + 1;
  }

  // Limit concurrency of RPC requests
  console.log('running', requests.length, `requests, max of ${CONCURRENCY} at a time...`);
  const limit = pLimit(CONCURRENCY);
  requests = requests.map((doRequest) => limit(() => doRequest()));
  const settled = await Promise.allSettled(requests);
  console.log('completed', settled.length, 'requests');

  // flatten & persist results
  const results = settled.map(s => s.value).flat();
  const stream = fs.createWriteStream(path.join(process.cwd(), `/output/`, `${label}_events.jsonld`), {flags:'a'});
  results.forEach(r => stream.write(JSON.stringify(r) + '\n'));
  stream.end();

  // return results
  return results;
}

/**
 * Get logs for a specific filter
 * @param {array} requests { method: string, args: array }[]
 * @param {array} args 
 * @param {string} address 
 * @param {string} ABI 
 * @param {object} provider 
 */
export async function bulkCallContract(
  label,
  calls,
  address,
  ABI,
  provider
) {
  const CONCURRENCY = 100;

  // init contract
  const contract = new Contract(address, ABI, provider);

  const doRequest = (method, args) => {
    return async () => {
      console.log(`${label} - `, 'calling', method, 'with args', args);
      const result = await contract[method](...args);
      return {
        method,
        args,
        result
      };
    };
  }

  
  const limit = pLimit(CONCURRENCY);
  let requests = calls.map(c => doRequest(c.method, c.args));
  console.log('running', requests.length, `requests, max of ${CONCURRENCY} at a time...`);
  requests = requests.map((doRequest) => limit(() => doRequest()));
  const settled = await Promise.allSettled(requests);
  console.log('completed', settled.length, 'RPC requests');

  // flatten & persist results
  const results = settled.map(s => s.value);
  await persistOutput(`${label}_contract_calls.json`, JSON.stringify(results, null, 2));

  return results;
}
