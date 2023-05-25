import { GithubAccountProof } from './GithubAccountProof';
import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Signature,
  shutdown,
} from 'snarkyjs';
import dotenv from 'dotenv';

/*
 * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
 * with your own tests.
 *
 * See https://docs.minaprotocol.com/zkapps for more info.
 */

let proofsEnabled = false;

dotenv.config();
const ORACLE_URL = 'https://zk-oracle-2qz4wkdima-uc.a.run.app/auth';
const ORACLE_PUBLIC_KEY = 'B62qqJQ4ys9ZwsBXTBNWopXUJswAh91pYXhpvFW6pCnWQoeGq9FqVSZ';
const PERSONAL_ACCESS_TOKEN = process.env.PERSONAL_ACCESS_TOKEN;
console.log(process.env.PERSONAL_ACCESS_TOKEN)

describe('GithubAccountProof', () => {
  let deployerAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: GithubAccountProof;

  beforeAll(async () => {
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
      PublicKey.fromBase58(ORACLE_PUBLIC_KEY)
    );
  });

  it('correctly verifies oracle data', async () => {
    const zkAppInstance = new GithubAccountProof(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);

    // // call the oracle
    const response = await fetch(
      ORACLE_URL,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personal_access_token: PERSONAL_ACCESS_TOKEN
        }),
      }
    );
    const data = await response.json();
    console.log('Oracle response: ', data);
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
