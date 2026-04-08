# Discounty Admin Panel

> Web-based admin dashboard for managing the Discounty platform.

**Part of:** [github.com/abdullahbalabel/DiscountyV2](https://github.com/abdullahbalabel/DiscountyV2)

---

## About

The Discounty Admin Panel is a **Next.js 16** web application that provides administrative controls for the Discounty platform, including provider approval, user management, deal oversight, and platform analytics.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| UI Components | [shadcn/ui](httpsui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Charts | [Recharts](https://recharts.org/) |
| Backend | [Supabase](https://supabase.com/) |
| Validation | [Zod](https://zod.dev/) |
| Notifications | [Sonner](https://sonner.emilkowal.ski/) |
| Icons | [Lucide React](https://lucide.dev/) |
| i18n | i18next / react-i18next |
| Theming | next-themes (dark/light mode) |
| Language | TypeScript |

---

## Prerequisites

- **Node.js** >= 22
- **npm** >= 10

---

## Installation

### 1. Navigate to the admin-web directory

```bash
cd admin-web
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

Create or verify `.env.local` with the following:

```env
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.2.2 | Framework |
| `react` | 19.2.4 | UI library |
| `react-dom` | 19.2.4 | React DOM |
| `@supabase/supabase-js` | ^2.101.1 | Supabase client |
| `shadcn` | ^4.1.2 | UI component system |
| `recharts` | ^3.8.1 | Charts |
| `zod` | ^4.3.6 | Schema validation |
| `sonner` | ^2.0.7 | Toast notifications |
| `next-themes` | ^0.4.6 | Theme switching |
| `i18next` | ^26.0.3 | Internationalization |
| `react-i18next` | ^17.0.2 | React i18n bindings |
| `lucide-react` | ^1.7.0 | Icons |
| `class-variance-authority` | ^0.7.1 | Variant styling |
| `clsx` | ^2.1.1 | Class merging |
| `tailwind-merge` | ^3.5.0 | Tailwind class merging |
| `tw-animate-css` | ^1.4.0 | CSS animations |
| `emoji-picker-react` | ^4.18.0 | Emoji picker |

### Radix UI Components

| Package | Version |
|---------|---------|
| `@radix-ui/react-avatar` | ^1.1.11 |
| `@radix-ui/react-dialog` | ^1.1.15 |
| `@radix-ui/react-dropdown-menu` | ^2.1.16 |
| `@radix-ui/react-label` | ^2.1.8 |
| `@radix-ui/react-select` | ^2.2.6 |
| `@radix-ui/react-separator` | ^1.1.8 |
| `@radix-ui/react-slot` | ^1.2.4 |
| `@radix-ui/react-switch` | ^1.2.6 |
| `@radix-ui/react-tabs` | ^1.1.13 |
| `@radix-ui/react-toast` | ^1.2.15 |
| `@radix-ui/react-tooltip` | ^1.2.8 |
| `@radix-ui/react-visually-hidden` | ^1.2.4 |
| `@base-ui/react` | ^1.3.0 |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5 | TypeScript compiler |
| `@types/node` | ^20 | Node.js types |
| `@types/react` | ^19 | React types |
| `@types/react-dom` | ^19 | React DOM types |
| `eslint` | ^9 | Linting |
| `eslint-config-next` | 16.2.2 | Next.js ESLint config |
| `tailwindcss` | ^4 | CSS framework |
| `@tailwindcss/postcss` | ^4 | PostCSS plugin |

---

## Project Structure

```
admin-web/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # Shared UI components
│   ├── hooks/            # Custom React hooks
│   ├── i18n/             # Translations
│   └── lib/              # Utilities and Supabase client
├── public/               # Static assets
├── .env.local            # Environment variables
├── next.config.ts        # Next.js configuration
├── tailwind.config.ts    # Tailwind configuration
├── tsconfig.json         # TypeScript configuration
└── components.json       # shadcn/ui configuration
```
