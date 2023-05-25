import { Mina, PrivateKey, PublicKey, shutdown, Field, Signature, fetchAccount } from 'snarkyjs';
import fs from 'fs/promises';
import { GithubAccountProof } from './GithubAccountProof.js';
import dotenv from 'dotenv';

dotenv.config();
const PRIVATE_KEY_TEST_USER = process.env.PRIVATE_KEY_TEST_USER ?? '';
const PUBLIC_KEY_TEST_USER = process.env.PUBLIC_KEY_TEST_USER ?? '';
const ORACLE_URL = 'https://zk-oracle-2qz4wkdima-uc.a.run.app/auth';
const PERSONAL_ACCESS_TOKEN = process.env.PERSONAL_ACCESS_TOKEN;
console.log(process.env.PERSONAL_ACCESS_TOKEN)

// check command line arg
let network = process.argv[2];
if (!network)
  throw Error(`Missing <network> argument.

Usage:
node build/src/interact.js <network>

Example:
node build/src/interact.js berkeley
`);
Error.stackTraceLimit = 1000;

// parse config and private key from file
type Config = { deployAliases: Record<string, { url: string; keyPath: string }> };
let configJson: Config = JSON.parse(await fs.readFile('config.json', 'utf8'));
let config = configJson.deployAliases[network];
let key: { privateKey: string } = JSON.parse(
  await fs.readFile(config.keyPath, 'utf8')
);
let zkAppKey = PrivateKey.fromBase58(key.privateKey);

// set up Mina instance and contract we interact with
const Network = Mina.Network(config.url);
Mina.setActiveInstance(Network);
let zkAppAddress = zkAppKey.toPublicKey();
let zkApp = new GithubAccountProof(zkAppAddress);

// compile the contract to create prover keys
console.log('compile the contract...');
await GithubAccountProof.compile();

// warm the cache, or else "to_affine_exn: Got identity"?
// https://github.com/o1-labs/snarkyjs/issues/530
await fetchAccount({ publicKey: zkAppAddress });

// // call the oracle
const response = await fetch(ORACLE_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    "personal_access_token": PERSONAL_ACCESS_TOKEN
  }),
});
const data = await response.json();
console.log(data)
const isValidUser = Field(data.data.isValidUser);
const signature = Signature.fromJSON(data.signature);

// call update() and send transaction
console.log('build transaction and create proof...');
let privateKeyUser = PrivateKey.fromBase58(PRIVATE_KEY_TEST_USER)
let publicKeyUser = PublicKey.fromBase58(PUBLIC_KEY_TEST_USER)
// let privateKeyUser = PrivateKey.random()
// let publicKeyUser = privateKeyUser.toPublicKey()
let tx = await Mina.transaction({ feePayerKey: privateKeyUser, fee: 0.1e9 }, () => {
  zkApp.verify(isValidUser, signature, publicKeyUser);
});
// console.log(tx.toGraphqlQuery())
await tx.prove();
console.log('send transaction...');
console.log('TX JSON', tx.toJSON())
let sentTx = await tx.send();

if (sentTx.hash() !== undefined) {
  console.log(`
Success! Update transaction sent.

Your smart contract state will be updated
as soon as the transaction is included in a block:
https://berkeley.minaexplorer.com/transaction/${sentTx.hash()}
`);
}
shutdown();
