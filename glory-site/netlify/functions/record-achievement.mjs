// GLORY · records a kid's achievement on Solana devnet.
// The game (this function) signs with its own devnet wallet, so the kid never touches a wallet.
// Only an anonymous player id is written on-chain: no personal data.
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction, clusterApiUrl } from '@solana/web3.js';

const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const ACHIEVEMENTS = { 'crown-goal': 'Golden Crown Goal (record: fewest work days)', 'first-sale': 'First Sale', 'daily-goal': 'Daily Profit Goal', 'zero-waste': 'Zero-Waste Day', 'gull-guard': 'Ice-Cream Guardian', 'first-savings': 'First Savings',
  'speedy-scooper': 'Speedy Scooper', 'smart-thinker': 'Smart Thinker', 'ice-cream-master': 'Ice-Cream Master' };

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let body = {};
  try { body = await req.json(); } catch {}
  const name = ACHIEVEMENTS[body.achievement];
  const player = String(body.player || '').replace(/[^a-z0-9-]/gi, '').slice(0, 16);
  if (!name || !player) return Response.json({ error: 'invalid achievement or player' }, { status: 400 });

  const secret = process.env.GLORY_DEVNET_SECRET;
  if (!secret) return Response.json({ error: 'GLORY_DEVNET_SECRET is not set' }, { status: 500 });
  const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
  const connection = new Connection(process.env.SOLANA_RPC || clusterApiUrl('devnet'), 'confirmed');

  const served = Math.max(0, Math.min(999, parseInt(body.served) || 0));
  const days = Math.max(0, Math.min(999, parseInt(body.days) || 0)), seconds = Math.max(0, Math.min(99999, parseInt(body.seconds) || 0));
  const memo = JSON.stringify({ app: 'GLORY', achievement: name, player, served, ...(days ? { days, seconds } : {}), at: new Date().toISOString() });
  const tx = new Transaction().add(new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }], data: Buffer.from(memo, 'utf8') }));

  try {
    const signature = await sendAndConfirmTransaction(connection, tx, [payer]);
    return Response.json({ signature, memo, explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet` });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
};
