# GLORY · Site + jogo (Sorveteria da Laura) · como publicar no Netlify

Este pacote é o **site do GLORY** com o **jogo jogável dentro dele**:
- `index.html` → site (pitch). A seção **"Jogue o demo"** abre o jogo dentro da página.
- `play/` → o jogo (Sorveteria da Laura). Também funciona sozinho em `seusite.netlify.app/play/`.
- `netlify/functions/record-achievement.mjs` → grava o **recorde** (menor tempo para conquistar a coroa) na **Solana devnet**.

> O **Netlify Drop (arrastar a pasta)** publica o site e o jogo, mas **não roda a função da Solana**.
> Para a Solana funcionar, publique pelo **GitHub** (passos abaixo).

## 1. Carteira de teste (devnet, sem dinheiro real)
No computador, com Node.js instalado, dentro desta pasta:
```
npm install
npm run wallet
```
Aparecem o **endereço** e o **GLORY_DEVNET_SECRET** (guarde em segredo).
Coloque SOL de teste grátis no endereço em https://faucet.solana.com (escolha **Devnet**).

## 2. GitHub
Crie um repositório e envie **o conteúdo desta pasta** (GitHub → Add file → Upload files → arraste tudo → Commit).
Obs.: o upload pelo navegador aceita até 100 arquivos por vez; se precisar, envie em duas partes (primeiro a pasta `play`, depois o resto).

## 3. Netlify
1. Add new site → **Import an existing project** → GitHub → escolha o repositório.
2. As configurações vêm do `netlify.toml` (não precisa mudar nada).
3. Site configuration → **Environment variables** → `GLORY_DEVNET_SECRET` = o segredo do passo 1 (o texto inteiro, com os colchetes).
4. Deploys → **Trigger deploy**.

## 4. Testar a Solana (GLORY Coin + recorde)
- **Fim de cada dia:** a comissão de 10% é paga em **GLORY Coin** → aparece o selo **"✓ Solana"** ao lado de "Sua parte (10%)" (abre a transação no Explorer).
- **Loja (botão 🛍️):** cada compra debita GLORY Coin da carteira do jogador → selo **"✓ Solana"** na mensagem da compra.
- **Coroa:** a compra da coroa e o recorde (menor tempo) também são gravados → **"✓ Recorde gravado na Solana · ver ↗"** na tela final.
A primeira transação cria a GLORY Coin automaticamente (pode levar alguns segundos).
Dica para testar rápido: no jogo, abra o console do navegador e digite `BANK.purse = 99` antes de fechar o dia.

## Tecnologias
Solana (devnet), @solana/web3.js, Solana Memo Program, Netlify Functions, Three.js, Blender, Mixamo, Web Audio API.
