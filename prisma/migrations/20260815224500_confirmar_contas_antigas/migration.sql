-- Contas que já existiam nascem confirmadas.
--
-- A confirmação de e-mail passa a valer de agora em diante. Quem já usava o
-- Beni antes dela não pediu para perder o resumo diário nem para ver um aviso
-- no topo da tela — cobrar retroativamente seria tirar algo que funcionava.
--
-- Vai numa migração separada, e não junto da criação da coluna, porque aquela
-- já tinha sido aplicada: reescrever migração aplicada quebra a soma de
-- verificação de todo mundo que já rodou.
UPDATE "User"
SET "emailVerifiedAt" = "createdAt"
WHERE "emailVerifiedAt" IS NULL;
