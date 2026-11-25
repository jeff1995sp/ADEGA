# Hora Extra Drinks TV — Android TV
APK independente do navegador. Abre https://adega-digital.jeff1995ssp1.workers.dev/tv.html e reaproveita a página, CSS, logo e API publicados. Apenas o JS da TV é substituído localmente no APK; nenhum arquivo do site, banco ou caixa é alterado. O código da TV é digitado no primeiro acesso, nunca incluído no APK.
- Voz Android pt-BR, preferência por vozes de maior qualidade; segunda tentativa com voz offline, depois áudio local do painel. A disponibilidade de vozes naturais e de gêneros distintos depende do motor instalado; o modo alternativo pode soar eletrônico. Ajuste volume também no aparelho.
- Voz automática após conexão, fila, aviso de atenção, testes de voz e controles de volume e velocidade.
- Alta demanda somente com mais de cinco pedidos received/preparing; alerta visual e sonoro a cada cinco minutos, desligamento ao normalizar. Repetição única do pedido pronto após 30 segundos se ainda estiver pronto.
- Tela cheia, paisagem, tela ligada, reconexão automática. Android 6+; recomenda-se WebView atualizado. A interface e os sons precisam de teste na TV física.
- A cópia local do tv.js acompanha a versão do painel nesta revisão; atualizar a cópia se o HTML ou a API mudar.

## Gerar APK
GitHub Actions > Hora Extra Drinks TV APK > executar na branch apk-hora-extra-tv. Baixar o artefato Hora-Extra-Drinks-TV-APK e extrair app-debug.apk.
Localmente: Java 17, Android SDK 35 e Gradle 8.9; executar gradle -p android-tv :app:assembleDebug.
## Testar
Instalar APK, conectar pelo código, testar voz feminina e masculina, volume e velocidade, pedido em preparação, pronto e retirada, seis pedidos ativos, esperar cinco minutos, reduzir a cinco, desligar rede e reconectar. Não usar pedidos reais para testes sem autorização.
