// GLORY Coin · the game's own stable currency on Solana (devnet).
// 1 GLORY Coin = 1 USD of in-game value (2 decimals). Planned for the MVP: backed 1:1 by USDC in an on-chain reserve.
//
// The game server signs everything, so players never manage keys:
//   - "treasury" (the ice-cream shop) = the game's devnet wallet (GLORY_DEVNET_SECRET) and mint authority
//   - the GLORY Coin mint address is derived deterministically from the treasury secret (created on first use)
//   - each player gets a custodial wallet derived from (secret + anonymous player id); no personal data on-chain
//
// Actions (POST JSON):
//   { action: "pay", player, cents, day }   -> mints the day's 10% commission to the player's wallet
//   { action: "buy", player, cents, item }  -> transfers coins from the player's wallet back to the shop
//   { action: "balance", player }           -> current on-chain balance
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram, sendAndConfirmTransaction, clusterApiUrl } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, MINT_SIZE, getMinimumBalanceForRentExemptMint, createInitializeMint2Instruction, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, createTransferInstruction, getAccount } from '@solana/spl-token';
import { createHash } from 'node:crypto';

const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const DECIMALS = 2;
const seed = (...parts) => createHash('sha256').update(parts.join('|')).digest().subarray(0, 32);
const memo = (text, signer) => new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [{ pubkey: signer, isSigner: true, isWritable: false }], data: Buffer.from(text, 'utf8') });
const explorer = (sig) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

async function ensureMint(connection, treasury, mint) {
  if (await connection.getAccountInfo(mint.publicKey)) return;
  const lamports = await getMinimumBalanceForRentExemptMint(connection);
  const tx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: treasury.publicKey, newAccountPubkey: mint.publicKey, space: MINT_SIZE, lamports, programId: TOKEN_PROGRAM_ID }),
    createInitializeMint2Instruction(mint.publicKey, DECIMALS, treasury.publicKey, null),
    memo('GLORY Coin created · stable in-game currency (1 coin = 1 USD of value)', treasury.publicKey));
  await sendAndConfirmTransaction(connection, tx, [treasury, mint]);
}

export default async (req) => {
  if (req.method === 'GET') {   // health check: open this URL in a browser to see if everything is set up
    const info = { function: 'ok', secretSet: !!process.env.GLORY_DEVNET_SECRET, rpc: process.env.SOLANA_RPC || 'devnet' };
    try {
      const s = process.env.GLORY_DEVNET_SECRET; if (!s) throw new Error('GLORY_DEVNET_SECRET is not set');
      const t = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(s)));
      const c = new Connection(process.env.SOLANA_RPC || clusterApiUrl('devnet'), 'confirmed');
      const m = Keypair.fromSeed(seed(s, 'glory-coin-mint-v1')).publicKey;
      Object.assign(info, { treasury: t.publicKey.toBase58(), treasurySOL: (await c.getBalance(t.publicKey)) / 1e9,
        mint: m.toBase58(), mintCreated: !!(await c.getAccountInfo(m)) });
      info.ready = info.treasurySOL > 0;
    } catch (e) { info.error = String(e.message || e); }
    return Response.json(info);
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let body = {}; try { body = await req.json(); } catch {}
  const player = String(body.player || '').replace(/[^a-z0-9-]/gi, '').slice(0, 24);
  const action = String(body.action || '');
  const cents = Math.max(0, Math.min(1000000, Math.round(Number(body.cents) || 0)));
  if (!player || !['pay', 'buy', 'balance'].includes(action)) return Response.json({ error: 'invalid request' }, { status: 400 });

  const secret = process.env.GLORY_DEVNET_SECRET;
  if (!secret) return Response.json({ error: 'GLORY_DEVNET_SECRET is not set' }, { status: 500 });
  const treasury = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
  const mint = Keypair.fromSeed(seed(secret, 'glory-coin-mint-v1'));
  const kid = Keypair.fromSeed(seed(secret, 'player', player));
  const connection = new Connection(process.env.SOLANA_RPC || clusterApiUrl('devnet'), 'confirmed');
  const kidAta = getAssociatedTokenAddressSync(mint.publicKey, kid.publicKey);
  const shopAta = getAssociatedTokenAddressSync(mint.publicKey, treasury.publicKey);
  const out = { mint: mint.publicKey.toBase58(), wallet: kid.publicKey.toBase58(),
    walletExplorer: `https://explorer.solana.com/address/${kidAta.toBase58()}?cluster=devnet` };

  try {
    await ensureMint(connection, treasury, mint);
    if (action === 'balance') {
      let amount = 0; try { amount = Number((await getAccount(connection, kidAta)).amount); } catch {}
      return Response.json({ ...out, balanceCents: amount });
    }
    if (!cents) return Response.json({ error: 'amount must be > 0' }, { status: 400 });
    const tx = new Transaction();
    if (action === 'pay') {
      const day = Math.max(0, Math.min(999, parseInt(body.day) || 0));
      tx.add(createAssociatedTokenAccountIdempotentInstruction(treasury.publicKey, kidAta, kid.publicKey, mint.publicKey),
        createMintToInstruction(mint.publicKey, kidAta, treasury.publicKey, cents),
        memo(`GLORY · day ${day} commission (10% of sales) · ${(cents / 100).toFixed(2)} GLORY Coin · player ${player}`, treasury.publicKey));
      const signature = await sendAndConfirmTransaction(connection, tx, [treasury]);
      return Response.json({ ...out, signature, explorer: explorer(signature) });
    }
    // buy: coins go from the player's wallet back to the shop (the game pays the network fee)
    const item = String(body.item || 'item').replace(/[^a-z0-9 -]/gi, '').slice(0, 32);
    tx.add(createAssociatedTokenAccountIdempotentInstruction(treasury.publicKey, shopAta, treasury.publicKey, mint.publicKey),
      createTransferInstruction(kidAta, shopAta, kid.publicKey, cents),
      memo(`GLORY · bought "${item}" · ${(cents / 100).toFixed(2)} GLORY Coin · player ${player}`, treasury.publicKey));
    tx.feePayer = treasury.publicKey;
    const signature = await sendAndConfirmTransaction(connection, tx, [treasury, kid]);
    return Response.json({ ...out, signature, explorer: explorer(signature) });
  } catch (e) {
    return Response.json({ ...out, error: String(e.message || e) }, { status: 502 });
  }
};
