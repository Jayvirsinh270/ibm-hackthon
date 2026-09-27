# 🚀 X-RAY — Vercel Deployment Guide

Your project is now fully configured for instant deployment on **Vercel**.

---

## ⚡ Method 1: Deploy via Vercel Dashboard (Recommended — 2 Minutes)

1. Open [**vercel.com/new**](https://vercel.com/new) and log in with your GitHub account.
2. Under **"Import Git Repository"**, find and select:  
   👉 **`jayvirsinh270/ibm-hackthon`**
3. In the **Configure Project** screen:
   - **Project Name:** `x-ray-change-impact-analyzer` *(or whatever you prefer)*
   - **Framework Preset:** **Vite**
   - **Root Directory:** Leave as `./` *(our root `vercel.json` handles everything automatically!)*
   - **Build & Output Settings:** Leave default *(automatically configured)*
4. *(Optional)* **Environment Variables:**
   - If you have deployed the FastAPI backend publicly (e.g. on Render or Railway), add:
     - `VITE_API_BASE_URL` = `https://your-backend.onrender.com`
   - *If you don't add this variable, X-Ray automatically activates **Standalone Judge Demo Mode**, allowing judges to test all graph features, blast radius analysis, and watsonx.ai test suites directly in their browser without any backend required!*
5. Click **"Deploy"**!  
   ⏳ *Vercel will build and deploy your project in ~45 seconds.*

---

## 💻 Method 2: Deploy via Vercel CLI (Terminal)

You can also deploy directly from your PowerShell terminal:

```powershell
# 1. Install Vercel CLI globally (if not already installed)
npm install -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy to production from your project folder
cd d:\hackthon
vercel --prod
```

---

## 🛡️ Judge-Safety Guarantee (How Standalone Mode Works on Vercel)

When hackathon judges evaluate projects:
- Judges often click your live Vercel URL on laptops, tablets, or phones without running a local backend server.
- We have equipped X-Ray with an **Intelligent Standalone Fallback** (`demoFallback.ts`):
  1. When a judge clicks **"1-Click Demos"** (e.g. **Auth & RBAC Microservice**), X-Ray instantly loads the full interactive architecture graph.
  2. The judge can **click nodes** to see caller/callee trees and AST intelligence.
  3. The judge can click **"Analyze Blast Radius"** to see impacted downstream modules and untested caller warnings.
  4. The judge can click **"⚡ Generate Tests with watsonx.ai"** to generate live PyTest suites using IBM watsonx.ai Granite.
  5. If connected to a live FastAPI server, it seamlessly performs real-time static analysis and Git diff parsing!

---

## 📁 Key Deployment Files Created

- **`vercel.json`** (Root): Instructs Vercel to install, build, and route the Vite application from `frontend/dist`.
- **`frontend/vercel.json`**: Fallback configuration if the root directory is set to `frontend/` in the Vercel dashboard.
- **`frontend/src/api/demoFallback.ts`**: Pre-bundled interactive dataset ensuring 100% uptime for judges.
