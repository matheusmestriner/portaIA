# Tela de Login — HTML, CSS e JavaScript Vanilla

Tela de login estática, responsiva e sem dependências externas, preparada para GitHub e Render Static Site.

## Estrutura

```text
/
├── index.html
├── css/
│   └── login.css
├── js/
│   ├── login.js
│   ├── theme.js
│   └── waves.js
└── README.md
```

## Executar localmente

O projeto não exige Node.js. Você pode abrir `index.html` diretamente no navegador, mas para testar em um servidor HTTP local é recomendado usar uma das opções abaixo.

### Python

```bash
python -m http.server 8080
```

Acesse `http://localhost:8080`.

### VS Code

Use uma extensão de servidor estático, como Live Server, apontando para a raiz do projeto.

## Configuração white-label

O arquivo `js/theme.js` aceita uma configuração global `window.clientTheme`. Em produção, o backend ou um script injetado no HTML pode definir a configuração antes de `theme.js` ser carregado.

Exemplo:

```html
<script>
  window.clientTheme = {
    mode: "dark",
    primaryColor: "#2563eb",
    secondaryColor: "#22c55e",
    logo: null
  };
</script>
```

Comportamento:

- `mode: "light"` força tema claro;
- `mode: "dark"` força tema escuro;
- `mode: null` usa `prefers-color-scheme` como fallback;
- `primaryColor` e `secondaryColor` atualizam as CSS variables e as waves;
- `logo` pode receber uma URL ou data URL válida. Se for `null`, o avatar neutro é exibido.

O botão de alternância de tema sobrescreve apenas a preferência em memória da sessão atual da página. Nenhuma senha ou credencial é persistida.

## Integração futura com API

A função pública `login(email, password)` está definida em `js/login.js` e exposta como `window.login`. Para conectar a API real, defina a URL antes do carregamento de `login.js`:

```html
<script>
  window.AUTH_LOGIN_URL = "https://api.seudominio.com/auth/login";
</script>
```

A chamada usa `POST`, JSON, `credentials: "include"` e `cache: "no-store"`. Se a URL não estiver configurada, a interface informa que o backend ainda não está conectado. Em sucesso, é disparado o evento `login:success`, permitindo que a aplicação hospede o redirecionamento sem acoplar essa tela a uma rota específica.

Nunca grave senha em `localStorage`, `sessionStorage`, logs ou código-fonte. Tokens e cookies de autenticação devem ser tratados no backend seguindo a estratégia de segurança do produto.

## Render Free — Static Site

No Render:

1. Crie um novo **Static Site**.
2. Conecte o repositório GitHub.
3. Branch: a branch de produção, por exemplo `main`.
4. Build Command: deixe vazio.
5. Publish Directory: `.`
6. Salve e faça o deploy.

O projeto não exige runtime Node.js.

## Performance

- Canvas com `requestAnimationFrame()`;
- quantidade adaptativa de linhas por largura de viewport;
- `devicePixelRatio` limitado a `1.75` para reduzir custo de renderização;
- interação com mouse apenas em dispositivos com ponteiro fino;
- animação pausada quando `document.visibilityState !== "visible"`;
- `prefers-reduced-motion` reduz fortemente a animação;
- sem Three.js, vídeo, GIF ou dependências externas.

## Checklist de validação

- console sem erros JavaScript;
- responsividade em 320, 375, 390, 768, 1366 e 1920 px;
- dark mode;
- light mode;
- alternância de tema;
- mostrar/ocultar senha;
- loading e bloqueio de múltiplos submits;
- navegação por teclado;
- foco visível;
- validação de e-mail e senha;
- `prefers-reduced-motion`;
- pausa da animação em aba oculta;
- waves sem bloquear cliques (`pointer-events: none`).
