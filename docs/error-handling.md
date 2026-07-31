# Tratamento de erros

A mensagem global de erro responde quatro perguntas:

1. **O que aconteceu:** um título orientado ao domínio.
2. **Por que aconteceu:** a causa recebida do processo responsável.
3. **O que foi preservado:** estado salvo e proteção contra conclusão parcial.
4. **Como resolver:** uma ação concreta para recuperação.

O renderer reconhece autenticação, créditos insuficientes, limite temporário,
timeout, rede, workspace e persistência. Erros desconhecidos usam um fallback
acionável que recomenda nova tentativa e diagnóstico sanitizado.

Operações recuperáveis iniciadas pelo composer oferecem **Tentar novamente**.
A repetição mantém o modo e os anexos da tentativa anterior e só é permitida na
mesma conversa, quando não há outra execução ativa. Problemas que exigem uma
decisão externa — credencial, créditos, autorização ou recuperação do banco —
não oferecem repetição automática.
