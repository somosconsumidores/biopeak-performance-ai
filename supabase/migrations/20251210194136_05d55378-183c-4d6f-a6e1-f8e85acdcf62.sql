-- Adicionar colunas para suporte a múltiplos planos ativos
ALTER TABLE training_plans 
ADD COLUMN IF NOT EXISTS is_complementary BOOLEAN DEFAULT false;

ALTER TABLE training_plans 
ADD COLUMN IF NOT EXISTS parent_plan_id UUID REFERENCES training_plans(id) ON DELETE SET NULL;

-- Criar índice para busca eficiente de planos complementares
CREATE INDEX IF NOT EXISTS idx_training_plans_parent_plan_id ON training_plans(parent_plan_id);

-- Criar índice para busca de planos complementares ativos
CREATE INDEX IF NOT EXISTS idx_training_plans_complementary ON training_plans(user_id, is_complementary, status);