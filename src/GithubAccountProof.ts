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
export class GithubAccountProof extends SmartContract {
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

  @method verify(isValidUser: Field, signature: Signature, publicKey: PublicKey) {

    // assert stuff
    const oraclePublicKey = this.oraclePublicKey.get();
    this.oraclePublicKey.assertEquals(oraclePublicKey);
    isValidUser.assertEquals(Field(1));

    // assert data validity
    const validSignature = signature.verify(oraclePublicKey, [isValidUser]);
    validSignature.assertTrue();

    // emit an event if all is fine
    this.emitEvent('verified', publicKey);
  }
}
