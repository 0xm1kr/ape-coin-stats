import { Contract } from "ethers";
import {
  APECOIN_STAKING_ADDRESS,
  initProviders,
  queryLogs,
  bulkCallContract,
  loadJSON,
  loadJsonLd,
  persistOutput
} from "./lib.js";

// NOTE: change this to the lastest block # in the 
// output + 1 in order to do incremental updates.
const START_BLOCK = 16119150; // ApeCoin staking contract deploy block
// const START_BLOCK = 17498230; // recent block

// -----------------------------------------------------------------

// Run
(async () => {
  const { ws /* wallet, oss, rsvr */ } = initProviders();

  const APECOIN_ABI = await loadJSON("apecoin-staking-abi.json");

  // get all apecoin staking log events concurrently 
  await queryLogs(
    "ApeCoin_staking",
    (filters) => [], // return all logs
    APECOIN_STAKING_ADDRESS,
    APECOIN_ABI,
    ws,
    START_BLOCK
  );
  
  // parse unique wallet addresses from logs
  const logs = await loadJsonLd("ApeCoin_staking_events.jsonld");
  const events = ['Deposit', 'DepositNft', 'DepositPairNft'];
  const addresses = logs.filter((log) => (~events.indexOf(log.fragment.name))).map((log) => log.args[0]);
  const uniqueAddresses = [...new Set(addresses)];

  // get current wallet stakes concurrently
  // NOTE: this is easier than calculating current stakes based on all deposit - withdrawal events
  console.log('determining staked balances for', uniqueAddresses.length, 'wallets...');
  await bulkCallContract(
    'ApeCoin_staking', 
    uniqueAddresses.map(a => ({ method: 'getAllStakes', args: [a] })),
    APECOIN_STAKING_ADDRESS, 
    APECOIN_ABI, 
    ws
  );

  // filter addresses with balances
  const calls = await loadJSON('output/ApeCoin_staking_contract_calls.json');
  const balances = calls.filter((s) => {
    // DashboardStake(APECOIN_POOL_ID, tokenId, deposited, unclaimed, rewards24Hrs, NULL_PAIR)[];
    return !!s.result.find(s => (s[2] !== '0'));
  });
  console.log('found', balances.length, 'wallets with staked balances.');
  
  // save the final wallet staking data
  await persistOutput('ApeCoin_staking_wallets.json', JSON.stringify(balances, null, 2));
})();
