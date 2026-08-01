-- Padroniza o cadastro de lojas: nome oficial da 211 e remove 8 linhas
-- fantasma (endereços que viraram "loja" por engano em algum sync antigo --
-- confirmado sem nenhum pedido/chamado/caixa/gerente/vendedor/montador
-- vinculado antes de apagar). Maia 2 Mangabeira (206) e Maia CD (213) são
-- reais, ficam como estão.

update stores set name = 'Maia Barão' where id = '211';

delete from stores where id in (
  'ext-av-liberdade',
  'ext-edson-ramalho',
  'ext-josefa-taveira-401',
  'ext-josefa-tavera',
  'ext-mangabeira-jf',
  'ext-mangabeira-jt',
  'ext-r-josefa-tavera',
  'ext-r-santo-elias-centro'
);
