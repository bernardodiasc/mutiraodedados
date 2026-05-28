REVOKE EXECUTE ON FUNCTION
  public.cobertura_cgu(),
  public.cobertura_pncp(),
  public.cobertura_transferegov(),
  public.cobertura_transferegov_emendas(text),
  public.cobertura_siconfi(),
  public.cobertura_camara_ceap(),
  public.cobertura_camara_votacoes(),
  public.cobertura_senado_ceaps(),
  public.cobertura_senado_votacoes(),
  public.handle_new_user()
FROM PUBLIC, anon, authenticated;