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
    // this.requireSignature();
  }

  @method verify(isRedditUser: Field, signature: Signature, publicKey: PublicKey) {

    // assert stuff
    const oraclePublicKey = this.oraclePublicKey.get();
    this.oraclePublicKey.assertEquals(oraclePublicKey);

    // verify the data validity
    const validSignature = signature.verify(oraclePublicKey, [isRedditUser]);
    validSignature.assertTrue();

    // check if isRedditUser = '1' and emit an event if so
    isRedditUser.assertEquals(Field(1));
    this.emitEvent('verified', publicKey);
  }
}

// // call the oracle
// const response = await fetch(
//   'https://zk-oracle-2qz4wkdima-uc.a.run.app/auth',
//   {
//     method: 'POST',
//     headers: {
//       'Accept': 'application/json',
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify({
//       username: "ioWxss6",
//       password: "KJHIASd875as6da",
//       clientid: "LGObhaoiF614kjhads-j9a7dsG",
//       clientsecret: "KJhkaghdaf7ghkJHgs8alwerkhfs76"
//     })
//   }
// )
// const data = await response.json()
// get the oracle data
// const isRedditUser = Field(data.data.isRedditUser)
// const publicKey = Field(data.data.publickKey)
// const signature = Signature.fromJSON(data.signature)
