# Super Scraper

Minerador da Biblioteca de Anúncios da Meta para infoprodutos, estúdio de agentes de
copy e traqueamento de vendas por UTM. Roda local, sem custo de infra.

> **Aviso.** A coleta usa o site público da Ad Library, o que contraria os Termos de
> Uso da Meta: a API oficial (`ads_archive`) só devolve anúncios políticos. O código
> roda no seu próprio IP, devagar e em volume moderado. Avalie o risco antes de usar
> em escala ou comercialmente.

## Setup

```bash
npm install
npx prisma db push
```

Suba o app (`npm run dev`) e abra **Configurações**. Cole as chaves lá — não precisa
mexer em arquivo.

**Uma chave do Groq já basta para tudo.** Ele é o único que transcreve VSL, e também
serve de provider de IA. É grátis e sem cartão: https://console.groq.com/keys

O Gemini é alternativa opcional de provider (https://aistudio.google.com/apikey).
Você escolhe **um** provider de IA em Configurações; não precisa dos dois.

| | Gemini | Groq | Anthropic |
|---|---|---|---|
| Copy dos agentes | ✅ | ✅ | ✅ (melhor, pago) |
| Classificação dos anúncios | ✅ | ✅ | ✅ |
| **Transcrição de VSL** | ❌ | ✅ **só ele** | ❌ |

Cada chave tem um botão **Testar** que faz uma chamada real ao provider. Vale usar:
chave sintaticamente válida mas sem cota é o erro mais comum, e só um teste de
verdade distingue os dois casos.

Sem chave a mineração funciona, mas classificação e transcrição ficam parados.

### Onde as chaves ficam

Banco primeiro, `.env` como fallback — então o `.env` continua valendo para scripts
e CI, e a interface ganha precedência quando você salva algo por lá.

Valores secretos são cifrados com AES-256-GCM antes de ir para o SQLite. A chave
mestra fica em `~/.scrapper/master.key`, fora do projeto: um backup do banco ou um
commit acidental do `dev.db` não expõe nada.

Conferir de onde cada valor está vindo:

```bash
npm run config
```

## Uso

Precisa de **dois terminais**:

```bash
npm run dev
```

Abre a interface em http://localhost:3000 — banco de anúncios, detalhe com VSL e funis.

```bash
npm run worker
```

Processa a fila: baixa criativos, transcreve VSLs, classifica com IA, mapeia funis.
Deixe rodando enquanto usa o app.

Para minerar um nicho, use o painel no topo do Banco de Anúncios. A coleta roda
**dentro do worker, headless**: nenhuma janela aparece na tela. Se o worker
estiver parado, o painel avisa e bloqueia o botão.

### O limite conta NOVIDADE, não repetição

Pedir "40" significa 40 anúncios **inéditos**, não 40 vistos. O que já está no
banco é pulado e a rolagem continua mais fundo.

Isso existe porque a Ad Library sempre devolve os mesmos resultados no topo para
um dado termo. Contando o total visto, repetir uma busca já feita parava nos
primeiros cards e voltava de mãos vazias: numa medição real, pedir 10 em
"Emagrecimento" trouxe **zero** novos. Com a contagem por novidade, a mesma busca
passou por 150 conhecidos e trouxe 12 inéditos.

Dois freios impedem rolagem infinita: 6 rolagens sem carregar mais nada (fim da
lista) e um teto de anúncios vistos por coleta.

Quando um termo esgota, as saídas são: outro termo, outro país, ou o recorte por
data de início (`startedAfter`), que pede à Meta só o que começou a rodar depois
de uma data.

Também dá pela linha de comando:

```bash
npm run mine -- "curso de confeitaria" --limit 40 --country BR
```

Abre uma janela do Chrome e coleta. **Não feche a janela** — ela é a coleta.

```bash
npm run stats            # diagnóstico do banco
npm run audit            # ranking de infoScore, para calibrar o filtro
npm run reclassify       # recalcula infoScore depois de mexer nas regras
npm run funnels          # funis mapeados
npm run runs             # histórico de minerações
npm run threads          # conversas dos agentes
npm run jobs             # estado da fila
npm run jobs -- --retry  # devolve os jobs falhos para a fila
npm run errors enrich    # erros de um tipo de job
npm run probe            # quais modelos Gemini sua chave libera
npm run db:studio        # navegar o banco visualmente
```

> Não rode `npm run build` com o `npm run dev` ligado — os dois escrevem na mesma
> pasta `.next` e o dev server quebra. Se acontecer: pare tudo, apague `.next`, suba de novo.

## Filtro de infoproduto

Buscar "curso de confeitaria" traz 90% de escola técnica de bairro. O que separa
não é o texto — os dois falam de "curso", "vagas", "inscrições". É **para onde o
clique vai**:

| Sinal | Peso |
|---|---|
| Checkout de plataforma (Hotmart, Kiwify, Monetizze...) | +45 |
| CTA para WhatsApp / Messenger | −45 |
| Caminho de funil (`/vsl`, `/cadastro`, `/oferta`...) | +25 |
| Destino é a própria rede social | −25 |
| Nome do anunciante indica unidade física | −20 |
| Subdomínio de funil (`lp.`, `pay.`, `quero...`) | +12 |
| Termos de oferta digital vs. operação presencial | ±20 |

Corte em 60. O score é calculado na ingestão com a `ctaUrl` e **recalculado pelo
job de funil** com a URL final, que é bem mais confiável.

As regras foram calibradas num universo pequeno (dois nichos). Rode `npm run audit`
depois de minerar nichos novos e ajuste as listas em `src/lib/infoproduct.ts` —
o script mostra o ranking inteiro com os destinos, que é onde os erros aparecem.

## Traqueamento

Atribuição por UTM: você põe `utm_campaign` e `utm_content` no link do anúncio, a
plataforma de checkout repassa no webhook, e o app casa venda com criativo.

Formato do link no anúncio:

```
https://pay.suaplataforma.com/seu-produto?utm_source=facebook&utm_medium=cpc&utm_campaign=bolos-frio-01&utm_content=vsl-depoimento-a
```

`utm_campaign` = a campanha. `utm_content` = o criativo. É isso que responde
"qual criativo está vendendo", que é a pergunta que importa.

### Ligar a plataforma

1. Configurações → **Gerar** um token de webhook → Salvar
2. Traqueamento → copie a URL da sua plataforma
3. Cole no painel de webhooks da Kiwify/Cakto, marcando compra aprovada, reembolso
   e chargeback

O endpoint é público, por isso o token: sem ele qualquer um injetaria venda falsa
no seu dashboard. Requisições sem token válido levam 401.

Erro de processamento devolve 200 de propósito — 500 faz a plataforma reenviar em
loop. O payload cru fica salvo em `WebhookEvent` para você reprocessar depois.

### Contas

Só `paid` vira receita; reembolso e chargeback são subtraídos. Gasto de anúncio é
lançado à mão por campanha e por dia: a plataforma de checkout só conhece a
receita, então sem esse lançamento não existe ROAS nem lucro, e o app mostra
"sem gasto" em vez de inventar número.

| Indicador | Fórmula |
|---|---|
| Faturamento líquido | pagas − reembolsos − chargebacks |
| Imposto | alíquota (Configurações) × faturamento líquido |
| Lucro | faturamento líquido − gasto − imposto |
| ROAS | faturamento líquido ÷ gasto |
| ROI | lucro ÷ gasto |
| Margem | lucro ÷ faturamento líquido |
| ARPU | faturamento líquido ÷ compradores |
| Reembolso % | reembolsos ÷ vendas pagas |

### O gráfico de pagamentos

Rosca em SVG puro, sem biblioteca. A ordem das cores (azul, laranja, verde-água,
amarelo) **não é decorativa**: é o que garante que fatias vizinhas continuem
distinguíveis para quem tem daltonismo. Foi validada com o script do skill
`dataviz` contra a superfície escura do app, incluindo o par que fecha o círculo.
Ao mexer nessas cores, revalide antes.

A legenda está sempre presente e traz o rótulo escrito, então a identidade da
fatia nunca depende só da cor.

Valores em centavos no banco. A unidade de cada plataforma é declarada, nunca
inferida: Kiwify manda centavos, Cakto manda reais, e em JavaScript `197.0` é
idêntico a `197` — qualquer heurística acabaria virando R$ 197,00 em R$ 1,97.

### Testar sem plataforma

```bash
npm run fake-sale     # dispara webhooks de teste com UTM
npm run webhooks      # o que chegou
npm run webhooks -- --failed   # payload inteiro do que falhou
npm run clear-sales   # limpa os dados de teste
```

## Login

Na primeira execução o app abre em `/instalar` e pede a conta de administrador.
Depois disso, tudo fica protegido.

```bash
npm run usuarios                                     # lista contas
npm run usuarios -- add email@x.com "Nome" senha     # cria
npm run usuarios -- senha email@x.com novasenha      # troca (encerra as sessões)
npm run usuarios -- rm email@x.com                   # remove
npm run test-auth                                    # confere as rotas protegidas
```

Como funciona, e por quê:

- Senha com **scrypt** e sal por usuário. SHA direto é rápido demais, e o que é
  rápido de calcular é rápido de quebrar em lote.
- Comparação em **tempo constante**, senão a duração da resposta vaza o quanto do
  hash bateu.
- No banco fica o **hash do token de sessão**, não o token. Vazou o banco,
  ninguém entra com o que está lá.
- Erro de login é genérico ("e-mail ou senha incorretos") e o scrypt roda mesmo
  sem usuário: dizer "este e-mail não existe" entrega quais contas existem.
- Cookie `httpOnly`, então JavaScript da página não lê e XSS não rouba a sessão.

A checagem acontece em dois lugares, de propósito. O `middleware.ts` roda no edge
e só verifica se o cookie existe, porque o Prisma não roda lá. Quem valida o token
de verdade é `(app)/layout.tsx`, em Node, cobrindo toda página filha.

Ficam abertas sem sessão apenas `/api/webhook/*` (quem chama é a plataforma de
checkout) e `/p/*` (as páginas clonadas, que precisam abrir em qualquer navegador).

## Histórico

Cada coleta grava um `AdSnapshot`. Comparar o snapshot mais antigo com o mais
recente dentro da janela responde o que interessa num espião de anúncios:

| Seção | O que significa |
|---|---|
| Escalando agora | ganharam variações; ninguém produz variação do que não vende |
| Perdendo força | cortaram variações, sinal de criativo cansado |
| Saíram do ar | estavam rodando e pararam |
| Mudaram de preço | o concorrente testou outro valor |
| Novos no radar | vistos numa coleta só, sem comparação possível |

Anúncio com uma coleta só nunca aparece como "subiu": sem dois pontos não existe
tendência, e apresentá-lo como crescimento seria inventar. Pela mesma razão o mini
gráfico na página do anúncio diz "aparece a partir da segunda coleta" em vez de
desenhar uma reta.

Para o histórico encher, **minere o mesmo nicho de novo depois de alguns dias**.

## Páginas clonadas

Baixa a página do concorrente, hospeda em `/p/{slug}` e faz duas limpezas que
mudam tudo:

**Remove os rastreadores dele.** Clonar com o Pixel intacto faz cada visita sua
alimentar o público de remarketing do concorrente, com o seu dinheiro. É o erro
mais caro de quem clona página.

**Neutraliza os links de compra.** Página clonada com o checkout original manda a
sua venda para ele. Aqui viram `#`, marcados com `data-checkout-original` para
você achar e trocar.

```bash
npm run clones        # estado dos clones
npm run test-clone    # confere que nenhum rastreador sobreviveu
```

> O clone serve para estudar estrutura. Publicar cópia literal de página alheia é
> violação de direito autoral: troque textos, imagens e oferta antes de usar.

## Modelagem

O fluxo central do app:

```
Banco de Anúncios  ->  Modelar esta oferta  ->  Estúdio de Agentes  ->  Criativos
```

Clicar em **Modelar esta oferta** num anúncio cria um projeto já preenchido: título
tirado do nicho e da headline, o anúncio anexado como referência e marcado como
`modeledAd`. Modelar o mesmo anúncio duas vezes reabre o projeto existente.

A partir daí os três agentes recebem no system prompt um dossiê montado por
`buildModelBrief()`: copy real, transcrição da VSL, preço praticado, ângulo
detectado, sinal de escala e plataforma de checkout do concorrente. O usuário não
digita nada disso.

Cada agente abre com um botão **Começar direto**, que dispara o prompt certo para
aquele papel. E o botão **Rodar os 3 em sequência** executa Optimus, Lapidador e
Fábrica em ordem, sem digitar nada.

### A esteira

Os agentes não trabalham isolados. `buildHandoff()` injeta no contexto de cada um
a última entrega dos outros dois, então a Fábrica recebe a estrutura do Optimus e
o diagnóstico do Lapidador em vez de recomeçar do zero.

Duas regras no prompt compartilhado sustentam isso:

- **Autonomia.** Nunca parar para perguntar dado que dá para inferir. Se a oferta
  não estiver descrita, o agente deriva uma do anúncio modelado, declara a
  suposição em uma linha e entrega o trabalho completo. Perguntar "qual é o seu
  produto?" e parar é falha.
- **Nunca inventar prova.** Número de alunos, anos de mercado, depoimento e
  prêmio só entram se você tiver informado. Faltando, o agente escreve
  `[INSERIR Nº REAL DE ALUNOS]` em vez de chutar. Suposição sobre a oferta é
  aceitável e vem declarada; prova social falsa é propaganda enganosa.

Você continua podendo escrever à mão a qualquer momento: a caixa de mensagem
funciona normalmente, o automático é só o atalho.

### Status do projeto

Três estados, trocáveis com um clique tanto na lista quanto dentro do projeto:

| Status | Significa |
|---|---|
| `rascunho` | criado, ainda não trabalhado |
| `ativo` | você está produzindo neste |
| `concluido` | encerrado; sai da lista "Em aberto" |

O único efeito real é a filtragem da lista. Não existe publicação: nada aqui vai
para fora do seu app. O status serve para o projeto terminado parar de poluir a
tela quando você tiver dezenas deles.

### Excluir projeto

Botão `excluir` no card, com confirmação que diz exatamente o que será perdido.
Apaga conversas, criativos gerados e as imagens em disco. **Não apaga os anúncios
minerados**: eles pertencem ao banco de anúncios e podem estar em outros projetos.

### A nossa oferta

Campo no topo do projeto com o que você vende, para quem e por quanto. Sem ele os
agentes conhecem o concorrente e não conhecem você, e a copy sai genérica. Entra
no contexto de toda resposta e da fábrica de criativos.

### Fábrica de criativos

Aba **Criativos** do projeto. Escolha um criativo do concorrente como molde e gere
5 variações para a sua oferta: ângulo, hook de 3 segundos, roteiro, texto do
anúncio, headline e prompt visual.

O molde é a estrutura, nunca o texto: hook, ritmo, ordem dos argumentos e tipo de
prova. Copiar o texto literal derruba a conta de anúncios e ainda converte pior,
porque o público já viu.

Quando o criativo escolhido é vídeo, entram duas camadas no contexto:

1. **A transcrição**, ou seja, tudo o que é falado.
2. **A análise visual do arquivo** (`describeVideo`), que descreve o vídeo cena a
   cena: enquadramento, cenário, texto na tela, ritmo de corte e como termina.

A segunda camada existe porque a transcrição só conta o que se fala, e boa parte
do que faz um criativo funcionar está no que aparece. Com ela, cada variação sai
com um **storyboard de gravação** espelhando a estrutura do concorrente com
conteúdo nosso.

A análise visual usa Gemini, o único dos providers que aceita vídeo como entrada.
Sem chave dele (ou sem cota), o gerador cai de volta para a transcrição e o
storyboard fica mais genérico.

**Geração de imagem** também depende do Gemini: Groq e Anthropic não geram imagem.

### Vídeo

Cada criativo gerado tem um botão **Gerar vídeo**, que produz um mp4 vertical
1080x1920 pronto para subir como anúncio.

Não é geração generativa (Veo, Kling e afins, todas pagas). O vídeo é **montado**
com peças gratuitas:

| Etapa | Como |
|---|---|
| Roteiro em cenas | o LLM já configurado quebra o criativo em 4 a 7 cenas |
| Narração | `edge-tts`, vozes neurais da Microsoft em pt-BR |
| Cenas | HTML renderizado no Chrome via Playwright, um print por cena |
| Montagem | `ffmpeg-static` |

Cada cena dura **exatamente o tempo da narração dela**, medido no áudio gerado.
Chutar duração fixa dessincroniza o vídeo.

Dependências, ambas já instaladas:

```bash
pip install edge-tts
npm install ffmpeg-static
```

> Não use o ffmpeg que vem com o Playwright. É uma build reduzida para gravar
> tela: só tem VP8 e nenhum encoder de áudio, então não monta mp4 com narração.

Testar sem passar pela interface:

```bash
npm run test-video -- --fake   # cenas fixas, testa só a montagem
npm run test-video             # planeja as cenas com IA
npm run video-debug            # erro do último render
```

**Geração de imagem** depende de uma chave do **Gemini**, independente do provider
escolhido: Groq e Anthropic não geram imagem.

## Estúdio de Agentes

Três agentes, cada um com uma thread por projeto:

- **Optimus** — monta a estrutura da oferta e termina propondo o próximo passo binário
- **Lapidador** — recebe copy pronta e devolve diagnóstico + versão lapidada + teste A/B
- **Fábrica de Criativos** — gera lotes de variações, cada uma num ângulo psicológico diferente

O que os separa de um ChatGPT com prompt bonito: abra um anúncio no banco e clique
em **Usar como referência**. A copy real, a transcrição da VSL e o preço do
concorrente entram no contexto da conversa.

## Como funciona a coleta

A API oficial da Meta (`ads_archive`) só devolve anúncios políticos. Anúncios de
infoproduto só existem no site público, que é um SPA React.

Em vez de raspar o DOM (que a Meta reescreve toda semana), o scraper abre a busca
num Chrome real e **intercepta as respostas GraphQL que a própria página faz**. O
payload é bem mais estável que o HTML.

Roda no seu IP residencial, com pausas aleatórias e perfil de browser persistente —
o que a Meta menos bloqueia. Em troca: volume moderado. Centenas de anúncios por
dia, não dezenas de milhares.

Headless por padrão, com duas máscaras necessárias: o user-agent é reescrito (o
Chrome headless se anuncia como `HeadlessChrome`) e `navigator.webdriver` é
apagado. Se algum dia a Meta pedir captcha ou login, ponha `SCRAPER_HEADFUL=1` no
`.env`, resolva na mão uma vez e volte ao normal — o perfil é persistente.

## A fila

Prioridade por tipo, porque FIFO puro deixa o usuário esperando pelo que não
interessa:

| Job | Prioridade | Por quê |
|---|---|---|
| `mine` | 10 | ação sua; não pode esperar trabalho de fundo |
| `video`, `clone` | 9 | ação sua, com você olhando a tela |
| `media` | 8 | sem ela não há miniatura nem download; rápida e sem API |
| `transcribe` | 8 | empatada com media: cada vídeo é transcrito logo após baixar |
| `funnel` | 5 | descobre o destino, o preço e se é infoproduto; **não usa API** |
| `enrich` | 2 | é o único que trava quando a cota de IA acaba |

O `funnel` já esteve em último por ser o job mais caro (abre um browser, ~15s por
anúncio). Foi um erro de julgamento: ele é o que descobre **para onde o anúncio
manda**, e é o único job pesado que não depende de cota de IA. Atrás do `enrich`,
o dado mais importante ficava refém de um serviço externo que pode estar
esgotado, e na prática nunca rodava.

Depois de mexer nessa tabela, rode `npm run repair` para reaplicar na fila
existente.

## Manutenção

```bash
npm run diag      # o que está faltando: sem criativo, sem funil, jobs presos
npm run repair    # conserta tudo que o diag apontar
```

O `repair` resolve quatro coisas: recria criativos perdidos, reaplica
prioridades, devolve à fila os jobs presos em `running` de um worker que morreu,
e encerra as transcrições de vídeo sem áudio (que só falhariam de novo).

O worker também devolve os órfãos à fila sozinho, toda vez que sobe.

## Criativos duplicados

As URLs da Meta são assinadas e mudam a cada coleta, e o mesmo vídeo ainda vem em
versão HD e SD. Por isso a identidade de um criativo é o **MD5 do arquivo baixado**,
não a URL: se o conteúdo já existe no anúncio, o registro novo é descartado.

Além disso, o scraper nunca soma `snapshot.cards` com `snapshot.videos`. Quando
existe carrossel a Meta repete a mesma mídia nos dois lugares, e somar traria cada
vídeo duas vezes.

Para limpar duplicatas de um banco antigo:

```bash
npm run dedupe
npm run ad-media -- NomeDoAnunciante   # confere os criativos de um anúncio
```

Diagnóstico da cadeia de VSL (baixou? transcreveu?):

```bash
npm run vsl
npm run find-vsl          # anúncios que já têm VSL transcrita, com o link
npm run test-transcribe   # transcreve um vídeo agora, para testar a chave
```

## Notas desta máquina

Duas coisas quebraram aqui e já estão contornadas no código:

- O Chromium empacotado do Playwright não sobe (falta o VC++ Redistributable), então
  tudo usa `channel: "chrome"` — o Chrome instalado. Também é melhor contra anti-bot.
- O `user-data-dir` não pode ficar dentro do OneDrive nem em caminho com acento;
  o perfil do browser vive em `~/.scrapper/browser-profile`.

E sobre o Gemini: versões numeradas (`gemini-2.0-flash`) devolvem 429 com `limit: 0`
nesta conta. O código usa `gemini-flash-latest`, que funciona. Confira com `npm run probe`.

## Score de escala

A Ad Library não expõe gasto. `src/lib/scale-score.ts` estima escala a partir do
que é observável — nº de variações (45%), longevidade (30%), amplitude de
plataformas/países (15%) e persistência entre coletas (10%). É ordenação, não
medição de faturamento.

## Estado

| Parte | Status |
|---|---|
| Scraper Ad Library | ✅ funcionando |
| Ingestão + score de escala | ✅ |
| Download de criativos | ✅ |
| Mapeamento de funil | ✅ |
| Classificação por IA | ✅ |
| UI web (banco, detalhe, funis) | ✅ |
| Filtro de infoproduto | ✅ |
| Configurações / chaves de API pela interface | ✅ |
| Busca de nicho pela interface | ✅ |
| Agentes (Optimus / Lapidador / Fábrica) | ✅ |
| Modelagem: anúncio vira briefing dos agentes | ✅ |
| Fábrica de criativos a partir do criativo original | ✅ |
| Geração de imagem do criativo | ⚙️ pronta, precisa de chave Gemini com cota |
| Montagem de vídeo (narração + cenas + ffmpeg) | ✅ grátis |
| Vídeo generativo (Veo / Kling / avatar UGC) | ⬜ pago, não decidido |
| Transcrição de VSL | ✅ |
| Clonagem + hospedagem de página | ✅ |
| Traqueamento de vendas (Kiwify + Cakto) | ✅ |
| Histórico de concorrentes minerados | ✅ |
| Login e contas | ✅ |

## Hospedar na Vercel

O app **não roda inteiro** na Vercel, e é importante saber disso antes de tentar:

| Parte | Vercel |
|---|---|
| Interface, dashboard, webhooks, agentes | ✅ funciona |
| Worker (fila, download, transcrição) | ❌ serverless não tem processo contínuo |
| Scraper da Ad Library | ❌ Playwright + IP de datacenter = bloqueio da Meta |
| SQLite | ❌ disco efêmero — precisa migrar para Postgres |

O caminho é dividir: interface e webhooks na Vercel, mineração e worker no seu PC
ou numa VPS, os dois apontando para o mesmo Postgres. A troca de banco é mudar o
`provider` no `schema.prisma` e rodar a migração — o código não muda.

O login já existe, então expor o app na internet não deixa mais o dashboard e as
chaves de API abertos para quem tiver a URL.
