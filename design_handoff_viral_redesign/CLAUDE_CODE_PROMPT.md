# PROMPT PARA O CLAUDE CODE — copie e cole exatamente isto

> Cole o texto abaixo no Claude Code, com este pacote (`design_handoff_viral_redesign/`) na raiz do repositório.

---

Aplique o redesign "Viral" descrito em `design_handoff_viral_redesign/README.md` **diretamente no app real em `apps/web`**.

REGRAS INEGOCIÁVEIS — leia antes de escrever qualquer código:

1. **NÃO crie nenhuma página nova de demonstração.** Nada de `/viral_redesign`, `/redesign`, `/preview`, `/v2` ou similar. Se alguma rota dessas já existir, **delete-a** neste mesmo trabalho.
2. **Modifique os arquivos existentes do app.** O redesign substitui o visual atual — não convive com ele.
3. Trabalhe em fases, **commitando ao final de cada fase** com a mensagem indicada.

## FASE 1 — Tokens e fontes (re-skina o app inteiro; faça primeiro)

1. Substitua **todo o conteúdo** de `apps/web/src/app/globals.css` pelo conteúdo de `design_handoff_viral_redesign/tokens/globals.css`.
2. Substitua **todo o conteúdo** de `apps/web/tailwind.config.ts` pelo conteúdo de `design_handoff_viral_redesign/tokens/tailwind.config.ts`.
3. Em `apps/web/src/app/layout.tsx`: remova `GeistSans` e configure as três fontes conforme `design_handoff_viral_redesign/tokens/fonts.ts` (next/font/google: Bricolage Grotesque → `--font-bricolage`, Instrument Sans → `--font-instrument`, Spline Sans Mono → `--font-spline-mono`), aplicando as três variáveis no `<html>`. O pacote `geist` pode ser removido do package.json se nada mais o usar.
4. No link "Pular para o conteúdo" do layout: trocar `text-white` por `text-[#10120A]` (texto sobre lime é escuro).
5. Rode `corepack pnpm --filter @viralforge/web build` (ou `typecheck`) e corrija erros.

**Critérios de aceite da Fase 1 (verifique e mostre a saída):**
```bash
grep -rn "14B8A6\|2DD4BF\|0D9488" apps/web/src apps/web/tailwind.config.ts   # deve retornar VAZIO
grep -rn "GeistSans" apps/web/src                                            # deve retornar VAZIO
grep -n "C8F542" apps/web/src/app/globals.css                                # deve encontrar o lime
grep -n "Bricolage" apps/web/src/app/layout.tsx                              # deve encontrar a fonte
```
Commit: `redesign(fase1): tokens lime + fontes Bricolage/Instrument/Spline`

## FASE 2 — Componentes base

1. `apps/web/src/components/ui/Button.tsx`: todas as variantes viram **pill** (`rounded-pill`). Primário: `bg-accent text-[#10120A] font-bold hover:brightness-105`, altura 46px (36px na versão sm). Demais variantes conforme seção "Botões" do README.
2. `apps/web/src/components/layout/Sidebar.tsx`: labels novos (`Projetos→Cortes`, `Analytics→Desempenho`, `Cobrança→Plano`, `Publicações→Postagens`, `Integrações IA` sai do nav principal), botão "+ Novo corte" primário full-width no topo, card de quota no rodapé (barra `bg-progress-viral`), marker losango lime no item ativo. Referência: screenshot `01-dashboard-dark.png`.
3. `apps/web/src/components/layout/Logo.tsx`: quadrado arredondado lime com play escuro + wordmark "viral." em `font-display` 800 lowercase.
4. Headings globais: títulos de página usam `font-display` com `tracking-tight` (Bricolage), pesos 700–800.

Commit: `redesign(fase2): Button pill, Sidebar, Logo`

## FASE 3 — Telas, na ordem (uma por commit)

Para cada tela, siga a seção correspondente do README e o screenshot de mesmo nome:

1. `dashboard/page.tsx` + `ProjectCard.tsx` (screenshot 01) — incluir o card dashed "Mandar vídeo novo" como primeiro item do grid
2. `NewProjectModal.tsx` → vira **página** `dashboard/new/page.tsx` com os 3 passos (screenshots 02–03); manter todos os campos/validações/API calls existentes
3. `ProcessingExperience.tsx` (screenshot 04) — manter o polling existente
4. `dashboard/[id]/page.tsx` + `ClipCard.tsx`/`ClipGrid.tsx` (screenshot 05)
5. Editor `[clipId]/page.tsx` (screenshot 06) — manter toda a lógica, re-skinnar controles em tabs pill
6. `analytics/page.tsx` → Desempenho (07), `templates/page.tsx` (08), `brand/page.tsx` (09), `published/page.tsx` (10), `billing/page.tsx` (11)
7. Landing `page.tsx` (12) e telas de auth (13)

## VERIFICAÇÃO FINAL OBRIGATÓRIA

```bash
git status                          # nada fora de commit
git log --oneline -10               # mostrar os commits das fases
test ! -e apps/web/src/app/viral_redesign && echo "OK: sem pagina demo"
corepack pnpm --filter @viralforge/web build
```

Depois rode o app e descreva (ou capture) o dashboard: fundo `#0C0C11`, botões lime pill, títulos em Bricolage Grotesque. Se qualquer tela ainda mostrar teal `#14B8A6`, a tarefa NÃO está concluída.

**Por fim: `git push`** — o trabalho só conta quando estiver no remoto.
