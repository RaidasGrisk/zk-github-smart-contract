import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  PublicKey,
  Signature,
  PrivateKey,
} from 'snarkyjs';

// constants
const ORACLE_PUBLIC_KEY =
  'B62qphyUJg3TjMKi74T2rF8Yer5rQjBr1UyEG7Wg9XEYAHjaSiSqFv1';

// smart contract
export class RedditAccountProof extends SmartContract {
  @state(PublicKey) oraclePublicKey = State<PublicKey>();

  // Define contract events
  events = {
    verified: PublicKey,
  };

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  init(zkappKey: PrivateKey) {
    super.init(zkappKey);
    this.oraclePublicKey.set(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));

    // not sure if we need this right now
    this.requireSignature();
  }

  @method verify(isRedditUser: Field, signature: Signature, publicKey: PublicKey) {

    // assert stuff
    const oraclePublicKey = this.oraclePublicKey.get();
    this.oraclePublicKey.assertEquals(oraclePublicKey);

    // verify data validity
    const validSignature = signature.verify(oraclePublicKey, [isRedditUser]);
    validSignature.assertTrue();

    // check if isRedditUser = '1' and emit an event if so
    isRedditUser.assertEquals(Field(1));
    this.emitEvent('verified', publicKey);
  }
}
