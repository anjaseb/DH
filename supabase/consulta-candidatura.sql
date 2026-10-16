-- ============================================================
-- CONSULTA SEGURA DE CANDIDATURA — Domingos Humba
-- Executar UMA VEZ no Supabase: SQL Editor > New query > Run.
-- Só depois publique o site (o novo concurso.js já envia o "codigo").
-- ============================================================

-- 1) Código de candidatura (segredo forte que o candidato recebe ao submeter)
alter table public.candidaturas add column if not exists codigo text;

-- candidaturas já existentes ganham um código (o admin pode enviá-lo ao candidato)
update public.candidaturas
set codigo = 'DH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5))
          || '-'  || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5))
where codigo is null;

-- candidaturas futuras: se o site não enviar código, a base de dados cria um
alter table public.candidaturas alter column codigo set default
  'DH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5))
        || '-'  || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));

alter table public.candidaturas alter column codigo set not null;
create unique index if not exists candidaturas_codigo_key on public.candidaturas (codigo);

-- 2) Registo de tentativas falhadas (limite de tentativas / anti-adivinhação)
create table if not exists public.consulta_tentativas (
  id         bigint generated always as identity primary key,
  chave      text        not null,
  created_at timestamptz not null default now()
);
create index if not exists consulta_tentativas_idx on public.consulta_tentativas (chave, created_at);

-- RLS ligado e SEM políticas: ninguém lê/escreve esta tabela pela API.
-- Só a função abaixo (security definer) lhe tem acesso.
alter table public.consulta_tentativas enable row level security;
revoke all on public.consulta_tentativas from anon, authenticated;

-- 3) Função pública de consulta — devolve SÓ estado, nunca documentos nem contactos
create or replace function public.consultar_candidatura(
  p_telefone text,
  p_codigo   text default null,
  p_email    text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tel   text := right(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), 9);
  v_cod   text := upper(trim(coalesce(p_codigo, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ip    text := '';
  v_falhas_tel int;
  v_falhas_ip  int;
  v_res   jsonb;
begin
  -- dados mínimos: telefone completo + (código OU email)
  if length(v_tel) < 9 or (v_cod = '' and v_email = '') then
    return jsonb_build_object('ok', false, 'motivo', 'dados_invalidos');
  end if;

  begin
    v_ip := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;

  delete from public.consulta_tentativas where created_at < now() - interval '1 day';

  select count(*) into v_falhas_tel from public.consulta_tentativas
   where chave = 'tel:' || v_tel and created_at > now() - interval '15 minutes';
  select count(*) into v_falhas_ip from public.consulta_tentativas
   where v_ip <> '' and chave = 'ip:' || v_ip and created_at > now() - interval '15 minutes';

  if v_falhas_tel >= 5 or v_falhas_ip >= 20 then
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'vaga',   coalesce(v.title, 'Vaga removida'),
           'estado', c.status,
           'data',   to_char(c.created_at, 'YYYY-MM-DD'),
           'nome',   split_part(trim(c.full_name), ' ', 1)
         ) order by c.created_at desc), '[]'::jsonb)
    into v_res
    from public.candidaturas c
    left join public.vagas v on v.id = c.vaga_id
   where right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 9) = v_tel
     and (
          (v_cod <> '' and c.codigo = v_cod)
       or (v_cod = '' and v_email <> '' and lower(trim(coalesce(c.email, ''))) = v_email)
     );

  if jsonb_array_length(v_res) = 0 then
    insert into public.consulta_tentativas (chave) values ('tel:' || v_tel);
    if v_ip <> '' then
      insert into public.consulta_tentativas (chave) values ('ip:' || v_ip);
    end if;
    -- mesma resposta para "telefone errado", "código errado" ou "não existe"
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrada');
  end if;

  return jsonb_build_object('ok', true, 'candidaturas', v_res);
end;
$$;

revoke all on function public.consultar_candidatura(text, text, text) from public;
grant execute on function public.consultar_candidatura(text, text, text) to anon, authenticated;
