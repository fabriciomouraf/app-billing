-- Adiciona coluna password à tabela users.
-- Usuários existentes recebem a senha default 'q1w2e3r4t5'.
ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT 'q1w2e3r4t5';
