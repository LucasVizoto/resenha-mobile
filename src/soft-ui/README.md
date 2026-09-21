# Soft Messenger UI

Design system Soft UI para o Soft Messenger (React Native / Expo).

## Direção visual
- Soft UI clean: high border-radius, botões pílula, balões orgânicos, avatares circulares
- Header com curva fluida (onda)
- Sombras difusas, tipografia geométrica sans-serif, espaçamento generoso
- **Paleta:** dark red gradient nos destaques (não azul do mock)
- Light + dark mode com contraste

## Estrutura
```
soft-messenger-ui/
  tokens/          # cores, tipografia, spacing, radii, shadows + design-tokens.json
  theme/           # lightTheme / darkTheme / getTheme()
  components/      # SoftButton, SoftInput, WaveHeader, GoogleButton
  screens/         # LoginScreen
  index.ts
```

## LoginScreen
Campos e ações:
- E-mail
- Senha
- **Login** (gradiente vermelho)
- **Cadastre-se** (link)
- **Continuar com Google**

Props: `onLogin`, `onSignUp`, `onGoogle`, `loading`, `colorScheme`.

## Dependências esperadas no app
- `expo-linear-gradient`
- `react-native-svg`
- `react-native-safe-area-context`

## Uso rápido
```tsx
import { LoginScreen, getTheme } from '../soft-messenger-ui';

<LoginScreen
  onLogin={({ email, password }) => { /* auth */ }}
  onSignUp={() => { /* navegar cadastro */ }}
  onGoogle={() => { /* OAuth Google */ }}
/>
```

## Gradiente brand
- Light: `#6B0F1A` → `#C41E3A` → `#DC3B4E`
- Dark: `#4A0A14` → `#A81B3A` → `#DC3B4E`

Inspiração: `/workspace/soft-messenger/design-inspiration.png` (cores adaptadas).
