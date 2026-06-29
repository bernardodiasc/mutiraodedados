
-- Public SELECT for published articles
CREATE POLICY "artigos publicos leitura"
  ON public.artigos FOR SELECT
  TO anon, authenticated
  USING (publico = true);

GRANT SELECT ON public.artigos TO anon;

-- Public SELECT for QA findings
CREATE POLICY "qa_findings leitura publica"
  ON public.qa_findings FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.qa_findings TO anon;
