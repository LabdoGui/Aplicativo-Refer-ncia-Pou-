/** Entrada da demonstração no navegador: instala o servidor simulado e abre o app. */
// Sem top-level await: num arquivo único ele pausaria a avaliação do restante do
// código, e uma página aberta direto pelo endereço tentaria carregar antes de existir.
import './install';
import '../main';
