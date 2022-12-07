import { Mina, PrivateKey, shutdown, Field, Signature, fetchAccount } from 'snarkyjs';
import fs from 'fs/promises';
import { RedditAccountProof } from './RedditAccountProof.js';

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
let zkApp = new RedditAccountProof(zkAppAddress);

// compile the contract to create prover keys
console.log('compile the contract...');
await RedditAccountProof.compile();


// warm the cache, or else "to_affine_exn: Got identity"?
// https://github.com/o1-labs/snarkyjs/issues/530
await fetchAccount({ publicKey: zkAppAddress });

// // call the oracle
const response = await fetch('https://zk-oracle-2qz4wkdima-uc.a.run.app/auth', {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: "ioWxss6",
    password: "KJHIASd875as6da",
    clientid: "LGObhaoiF614kjhads-j9a7dsG",
    clientsecret: "KJhkaghdaf7ghkJHgs8alwerkhfs76"
  }),
});
const data = await response.json();
console.log(data)
const isRedditUser = Field(data.data.isRedditUser);
const signature = Signature.fromJSON(data.signature);

// call update() and send transaction
console.log('build transaction and create proof...');
let publicKeyToEvent = PrivateKey.random().toPublicKey()
console.log(publicKeyToEvent, publicKeyToEvent.toBase58())
let tx = await Mina.transaction({ feePayerKey: zkAppKey, fee: 0.1e9 }, () => {
  zkApp.verify(isRedditUser, signature, publicKeyToEvent);
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
