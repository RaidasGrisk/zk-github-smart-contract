import { GithubAccountProof } from './GithubAccountProof';
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

describe('GithubAccountProof', () => {
  let deployerAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: GithubAccountProof;

  beforeAll(async () => {
    await isReady;
    if (proofsEnabled) GithubAccountProof.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    deployerAccount = Local.testAccounts[0].privateKey;
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new GithubAccountProof(zkAppAddress);
  });

  afterAll(() => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  async function localDeploy(
    zkAppInstance: GithubAccountProof,
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

  it('generates and deploys the `GithubAccountProof` smart contract', async () => {
    const zkAppInstance = new GithubAccountProof(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    const oraclePublicKey = zkApp.oraclePublicKey.get();
    console.log(oraclePublicKey);
    expect(oraclePublicKey).toEqual(
      PublicKey.fromBase58('B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1')
    );
  });

  it('correctly verifies oracle data', async () => {
    const zkAppInstance = new GithubAccountProof(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

    // // call the oracle
    const response = await fetch(
      'https://zk-oracle-2qz4wkdima-uc.a.run.app/auth',
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personal_access_token: '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7Kd'
        }),
      }
    );
    const data = await response.json();
    console.log(data);
    const isValidUser = Field(data.data.isValidUser);
    const signature = Signature.fromJSON(data.signature);

    // update transaction
    let publicKeyToEvent = PrivateKey.random()
    const txn = await Mina.transaction(deployerAccount, () => {
      zkApp.verify(isValidUser, signature, publicKeyToEvent.toPublicKey());
    });
    await txn.prove();
    await txn.send();
  });
});
