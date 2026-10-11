// Creates the game's devnet wallet. Paste the printed secret into Netlify as GLORY_DEVNET_SECRET,
// then fund the printed address with free devnet SOL at https://faucet.solana.com
import { Keypair } from '@solana/web3.js';
const kp = Keypair.generate();
console.log('Address (fund it at https://faucet.solana.com, choose Devnet):\n' + kp.publicKey.toBase58());
console.log('\nGLORY_DEVNET_SECRET (keep it private):\n' + JSON.stringify(Array.from(kp.secretKey)));
