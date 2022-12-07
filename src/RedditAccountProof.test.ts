import { RedditAccountProof } from './RedditAccountProof';
import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Signature,
  isReady,
  shutdown,
} from 'snarkyjs';

/*
 * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
 * with your own tests.
 *
 * See https://docs.minaprotocol.com/zkapps for more info.
 */

let proofsEnabled = false;
await isReady;

describe('RedditAccountProof', () => {
  let deployerAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: RedditAccountProof;

  beforeAll(async () => {
    await isReady;
    if (proofsEnabled) RedditAccountProof.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    deployerAccount = Local.testAccounts[0].privateKey;
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new RedditAccountProof(zkAppAddress);
  });

  afterAll(() => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  async function localDeploy(
    zkAppInstance: RedditAccountProof,
    zkAppPrivatekey: PrivateKey,
    deployerAccount: PrivateKey
  ) {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy({ zkappKey: zkAppPrivatekey });
      zkAppInstance.init(zkAppPrivatekey);
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([zkAppPrivateKey]).send();
  }

  it('generates and deploys the `RedditAccountProof` smart contract', async () => {
    const zkAppInstance = new RedditAccountProof(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const oraclePublicKey = zkApp.oraclePublicKey.get();
    console.log(oraclePublicKey);
    expect(oraclePublicKey).toEqual(
      PublicKey.fromBase58('B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1')
    );
  });

  it('correctly verifies oracle data', async () => {
    const zkAppInstance = new RedditAccountProof(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

    // // call the oracle
    const response = await fetch(
      'https://zk-oracle-2qz4wkdima-uc.a.run.app/auth',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'ioWxss6',
          password: 'KJHIASd875as6da',
          clientid: 'LGObhaoiF614kjhads-j9a7dsG',
          clientsecret: 'KJhkaghdaf7ghkJHgs8alwerkhfs76',
        }),
      }
    );
    const data = await response.json();
    console.log(data);
    const isRedditUser = Field(data.data.isRedditUser);
    const signature = Signature.fromJSON(data.signature);

    // update transaction
    const txn = await Mina.transaction(deployerAccount, () => {
      zkApp.verify(isRedditUser, signature, deployerAccount.toPublicKey());
    });
    await txn.prove();
    await txn.send();
  });
});
