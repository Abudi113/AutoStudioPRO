# AutoStudioPRO - Deployment Guide

This document explains how to deploy AutoStudioPRO to **Netlify** (frontend) and **Supabase** (backend).

## 📁 Project Structure

```
autostudio-pro-ai/
├── src/                          # Frontend source code
├── supabase/
│   ├── config.toml              # Supabase configuration
│   └── functions/
│       └── process-image/       # Edge Function for Gemini API
├── netlify.toml                 # Netlify build configuration
├── .env.example                 # Environment variables template
└── package.json
```

---

## 🚀 Step-by-Step Deployment

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **"New Project"**
3. Choose an organization and set:
   - **Project name**: `autostudio-pro` (or your preference)
   - **Database Password**: Save this securely
   - **Region**: Choose closest to your users
4. Wait for the project to be created (~2 minutes)

### Step 2: Get Supabase Credentials

1. In your Supabase dashboard, go to **Settings → API**
2. Copy these values (you'll need them later):
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon public** key → `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Step 3: Install Supabase CLI

```bash
# Using npm
npm install -g supabase

# Or using Homebrew (macOS/Linux)
brew install supabase/tap/supabase
```

### Step 4: Link Your Project

```bash
cd autostudio-pro-ai

# Login to Supabase
supabase login

# Link to your project (get project ref from dashboard URL)
supabase link --project-ref your-project-ref
```

### Step 5: Set the Gemini API Key as a Secret

```bash
# Set your Gemini API key securely on Supabase
supabase secrets set GEMINI_API_KEY=your-gemini-api-key
```

### Step 6: Deploy the Edge Function

```bash
supabase functions deploy process-image
```

### Step 7: Prepare for Netlify

1. Create a **GitHub/GitLab repository** for your project
2. Push your code:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/autostudio-pro.git
git push -u origin main
```

### Step 8: Deploy to Netlify

1. Go to [netlify.com](https://netlify.com) and sign in
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect to your GitHub/GitLab repository
4. Configure build settings (should auto-detect from `netlify.toml`):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Add environment variables in Netlify:
   - `VITE_SUPABASE_URL` = Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key
6. Click **"Deploy site"**

---

## 🔒 Security Notes

- **Gemini API Key**: Stored securely in Supabase Edge Function secrets (not exposed to browser)
- **Supabase Anon Key**: Safe to expose (it's designed for client-side use with Row Level Security)
- **CORS**: Update the Edge Function's `Access-Control-Allow-Origin` header in production

---

## 🧪 Local Development

### Frontend Only (No AI Processing)

```bash
npm install
npm run dev
```

### Full Stack (With Supabase)

1. Create `.env.local` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

2. Start the dev server:
```bash
npm run dev
```

### Testing Edge Functions Locally

```bash
# Start Supabase locally (requires Docker)
supabase start

# Serve functions locally
supabase functions serve process-image --env-file .env.local
```

---

## 🔄 Future Enhancements

With Supabase, you can easily add:

- **User Authentication**: `supabase.auth.signIn()`
- **Database**: Store orders, processing history, user preferences
- **Storage**: Store processed images in Supabase Storage
- **Real-time**: Live updates for processing status

---

## 🐛 Troubleshooting

### "Supabase not configured" error
- Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Check Netlify environment variables if deployed

### Edge Function returns 500 error
- Check Supabase dashboard → Functions → Logs
- Verify `GEMINI_API_KEY` secret is set: `supabase secrets list`

### CORS errors
- Update `Access-Control-Allow-Origin` in the Edge Function to your Netlify domain

---

## 📚 Resources

- [Netlify Docs](https://docs.netlify.com)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Google Gemini API](https://ai.google.dev/docs)
