-- Mantém o conteúdo dos prompts já aplicados alinhado ao rebrand.
-- As migrations anteriores são preservadas como histórico imutável.
UPDATE public.prompt_modelos
SET prompt_template = replace(prompt_template, 'Mutirão de Dados', 'Mutirão de Dados')
WHERE prompt_template LIKE '%Mutirão de Dados%';
