# Backup & Disaster Recovery — Barbex

## 1. Backup do banco de dados

O Lovable Cloud (Supabase gerenciado) executa **backups diários automáticos**
com retenção de 7 dias no plano padrão. Para produção séria, o recomendado é:

- **Habilitar PITR (Point-in-Time Recovery)** no painel do Cloud
  (Advanced settings → Backups) — permite restaurar em qualquer segundo dos
  últimos 7–14 dias.
- **Export manual mensal** via **Cloud → Advanced settings → Export data**,
  armazenando o dump em storage externo (S3, Google Drive, disco frio).
  Frequência mínima recomendada: **semanal** enquanto operação < 20 barbearias,
  **diário** acima disso.

## 2. Backup de arquivos (Storage)

Os buckets `avatars`, `support-attachments` e `gallery` estão no Storage do
Supabase. O backup do banco **não inclui** os arquivos binários.

- Configurar rotina mensal (script + cron externo) que baixa via `supabase
  storage download` todos os buckets e envia para armazenamento frio.
- Alternativa: usar o mesmo Export data (inclui metadata dos buckets) +
  espelhamento via [supabase-backup](https://github.com/supabase-community).

## 3. Backup de secrets

Os secrets do Cloud (`STRIPE_*`, `ZAPI_*`, chaves de gateways) não são
exportáveis. Mantenha uma **cópia offline em cofre de senhas** (1Password,
Bitwarden) atualizada a cada rotação.

## 4. Plano de recuperação (RTO/RPO alvo)

| Cenário | RPO | RTO | Procedimento |
|---|---|---|---|
| Corrupção de dados isolada (uma tabela) | 5 min (com PITR) | 30 min | PITR → restore no ponto anterior à corrupção → reexecutar migrations posteriores manualmente se necessário |
| Perda total do projeto Cloud | 24h (backup diário) | 4h | Criar novo projeto Cloud → restaurar dump → reapontar DNS `barbex.shop` / `www.barbex.shop` |
| Perda de storage (arquivos) | 30 dias (backup mensal) | 2h | Recriar buckets → subir arquivos do último dump |
| Vazamento de secret | 0 | 15 min | Rotacionar secret no gateway/serviço → atualizar via `update_secret` no Lovable |

## 5. Checklist mensal

- [ ] Rodar `security--run_security_scan` e revisar findings novos
- [ ] Baixar export completo do banco
- [ ] Baixar dump dos buckets de storage
- [ ] Testar restore em projeto sandbox (uma vez por trimestre)
- [ ] Revisar quem tem acesso ao painel Cloud
- [ ] Revisar `notification_recipients` (staff que recebem alertas)

## 6. Contatos de emergência

- Suporte Lovable/Cloud: via chat do painel Lovable
- Suporte Z-API: painel Z-API → chat
- Stripe: dashboard.stripe.com → Support
