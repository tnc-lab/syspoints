# Syspoints ⠎⠽⠎⠏⠕⠊⠝⠞⠎

![Syspoints](https://i.ibb.co/fY7fhskW/syspoints-banner.png)

| [🇺🇸 English](../README.md) | [🇪🇸 Español](README.es.md) | 🇧🇷 Português

**Syspoints** é uma plataforma de reputação e avaliações baseada em blockchain construída na **Syscoin**. Ela incentiva usuários com **Tokens Syspoints** por contribuírem com avaliações confiáveis e imutáveis através de um modelo exclusivo de **Review-to-Earn**.

## Funções Principais

- **Avaliações Descentralizadas:** Envie feedback imutável para lojas e estabelecimentos diretamente na Syscoin NEVM, garantindo a integridade dos dados pro meio de contratos inteligentes compatíveis com Ethereum.
- **Participação Incentivada:** Ganhe **Tokens Syspoints** como recompensa por avaliações verificadas e de alta qualidade.
- **Reputação Transparente:** Aproveite a transparência da blockchain para garantir que todas as avaliações sejam autênticas e invioláveis.

## Documentação do Projeto 

- **[Arquitetura](architecture.md):** Visão geral da infraestrutura do sistema e organização dos compenentes usando **diagramas C4 Container**.
- **[Regras de Negócio](business_rules.md):** Mapeamento detalhado dos fluxos lógicos e das regras centrais que governam a aplicação via **fluxogramas**.
- **[Modelo de Dados](data_model.md):** Documentação do esquema do banco de dados apresentando **diagrams de Entidade-Relacionamento (ER)**.
- **[Integração Syscoin](syscoin_integration.md):** Guia técnico sobre protocolos de comunicação blockchain e **diagramas de sequência de transações**.

## Uso

A seguir, apresentamos um caso de uso básico do Hardhat. Ele inclui um contrato de exemplo, um teste para esse contrato e um módulo Hardhat Ignition que implementa esse contrato.

Experimente executar algumas das seguintes tarefas:

```shell
# Exibe o manual do Hardhat
npx hardhat help

# Execute testes para garantir que a lógica de revisão funcione
npx hardhat test

# Gerar um relatório detalhado sobre o consumo de gas
REPORT_GAS=true npx hardhat test

# Inicie um nó local para desenvolvimento.
npx hardhat node

# Implante o contrato Syspoints
npx hardhat ignition deploy ./ignition/modules/Lock.js
```

## Links Úteis

- **Documentação de Rede:** [Syscoin Docs](https://docs.syscoin.org)
- **Explorador de Blocos:** [Syscoin Explorer](https://explorer.syscoin.org)

## Licença

Este projeto está licenciado sob a [Licença MIT](https://opensource.org) - veja o arquivo [LICENÇA](../LICENSE) para detalhes.