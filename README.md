# Sistema de Gestão de Clientes

Sistema web simples e funcional para gerenciamento de clientes com envio automático de mensagens de aniversário via WhatsApp.

## Funcionalidades

### 📋 Cadastro de Clientes
- **Campos obrigatórios**: Nome, Data de Nascimento, Telefone e Email
- **Campos opcionais**: CPF
- **Campos dinâmicos**: Múltiplos telefones e emails podem ser adicionados
- Validação de campos obrigatórios

### 🏢 Perfil da Empresa
- Upload e visualização da logo da empresa
- Cadastro de dados da empresa:
  - Nome da empresa
  - Nome do proprietário
  - Contato do proprietário
  - Email do proprietário
  - Data de nascimento do proprietário
  - Endereço
  - Descrição

### ✏️ Edição de Clientes
- Editar todos os dados dos clientes cadastrados
- Adicionar ou remover telefones e emails
- Interface modal para edição

### 🎂 Sistema de Aniversários
- **Envio automático**: Verifica automaticamente às 00:00 se há clientes fazendo aniversário
- **Envio manual**: Botão "Enviar Felicitações" para envio imediato
- Mensagens personalizadas com o nome da empresa
- Integração com WhatsApp Web

### 📊 Dashboard
- Estatísticas de clientes cadastrados
- Contador de aniversários do dia
- Interface moderna e responsiva

## Como Usar

1. **Abrir o sistema**: Abra o arquivo `index.html` no seu navegador
2. **Configurar empresa**: Vá em "Perfil da Empresa" e preencha os dados
3. **Cadastrar clientes**: Use o menu "Cadastrar Cliente" para adicionar novos clientes
4. **Visualizar clientes**: Acesse "Clientes" para ver todos os cadastrados
5. **Editar clientes**: Clique em "Editar" no card do cliente desejado
6. **Enviar felicitações**: Use o botão "Enviar Felicitações" para enviar mensagens de aniversário

## Armazenamento de Dados

Todos os dados são armazenados localmente no navegador usando `localStorage`. Os dados persistem mesmo após fechar o navegador.

## Tecnologias Utilizadas

- HTML5
- CSS3 (com gradientes e animações)
- JavaScript (ES6+)
- LocalStorage API
- WhatsApp Web API

## Observações Importantes

- O envio automático de mensagens verifica a cada minuto se chegou à meia-noite
- As mensagens são abertas em novas abas do WhatsApp Web
- É necessário ter o WhatsApp Web aberto ou o aplicativo instalado no dispositivo
- Os telefones devem estar no formato internacional (sem espaços ou caracteres especiais no número)

## Estrutura de Arquivos

```
PROJETO/
├── index.html      # Estrutura HTML principal
├── styles.css      # Estilos e design
├── script.js       # Lógica e funcionalidades
└── README.md       # Documentação
```

## Personalização

Você pode personalizar:
- Cores e gradientes no arquivo `styles.css`
- Mensagem de aniversário no arquivo `script.js` (função `sendBirthdayMessages`)
- Campos adicionais nos formulários

## Compatibilidade

- Navegadores modernos (Chrome, Firefox, Edge, Safari)
- Responsivo para desktop, tablet e mobile
- Funciona offline (após carregar a primeira vez)

