import { Mina, PrivateKey, PublicKey, shutdown, Field, Signature, fetchAccount } from 'snarkyjs';
import fs from 'fs/promises';
import { GithubAccountProof } from './GithubAccountProof.js';

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
type Config = { networks: Record<string, { url: string; keyPath: string }> };
let configJson: Config = JSON.parse(await fs.readFile('config.json', 'utf8'));
let config = configJson.networks[network];
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
const response = await fetch('https://zk-oracle-2qz4wkdima-uc.a.run.app/auth', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    "personal_access_token": "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"
  }),
});
const data = await response.json();
console.log(data)
const isValidUser = Field(data.data.isValidUser);
const signature = Signature.fromJSON(data.signature);

// call update() and send transaction
console.log('build transaction and create proof...');
let privateKeyUser = PrivateKey.fromBase58('EKF8fzoJABdDdo4p5FSnPhMto8GgmG3kJKvxSBMvpiYw92BCCzYT')
let publicKeyUser = PublicKey.fromBase58('B62qqpdfHhiWvv4hPRXvBNMKRUt5avuekKvZoErLSztf1jca6w985GM')
let tx = await Mina.transaction({ feePayerKey: privateKeyUser, fee: 0.1e9 }, () => {
  zkApp.verify(isValidUser, signature, publicKeyUser);
});
console.log(tx.toGraphqlQuery())
await tx.prove();
console.log('send transaction...');
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
