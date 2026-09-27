# 🎬 X-RAY — Official Hackathon Demo Video Script & Teleprompter

> **Target Duration:** 2 Minutes 15 Seconds (Max 2:30)  
> **Theme:** Developer Workflow Intelligence (Code Review, Pre-Flight Testing & Blast Radius Analysis)  
> **Judges Focus:** Application of IBM Bob 2.0 & IBM watsonx.ai (Granite), Business Value, Originality  

---

## 📋 PRE-RECORDING CHECKLIST (Do this 2 minutes before hitting record)

1. **Services Running:**
   - Backend running: `http://localhost:8000` (FastAPI)
   - Frontend running: `http://localhost:5173` (Vite / React)
2. **Browser Window:**
   - Chrome / Edge set to **1080p (Full Screen)** or 1920x1080.
   - Zoom level at **100% or 110%** so graphs and code are razor-sharp.
   - Close all bookmarks bar and unnecessary tabs (`Ctrl + Shift + B` in Chrome hides bookmarks).
   - Have two tabs ready:
     - **Tab 1:** `http://localhost:5173` (X-Ray Dashboard / Graph already analyzed and loaded with repo)
     - **Tab 2:** Slide 1 / Slide 14 of `X_Ray_IBM_Hackathon_Pitch_Deck.pptx` (or full screen in PowerPoint)
3. **Audio Check:**
   - Speak in a calm, confident, clear tone. You don't need to speak super fast—the pacing below gives you room to breathe.
4. **Mouse Pointer:**
   - Move smoothly. Don't shake or circle the mouse rapidly. Hover with intention!

---

## ⏱️ THE SCRIPT (READ ALOUD WITH ACTIONS)

---

### [0:00 - 0:22] ACT 1: THE HOOK & THE PAIN POINT

**🖥️ On Screen:**  
Start on the **PowerPoint Slide 1** (or Tab 1 of the app if recording purely web UI).  
*If starting on Slide 1:* Show title: **X-RAY — Never Merge Code in the Dark Again.**  
*At 0:10:* Transition smoothly to the **X-Ray live web dashboard** (`http://localhost:5173`).

**🎙️ What you say:**
> *"Every software developer and engineering team knows this nightmare:*  
> *You change one innocent utility function. All unit tests pass green. The pull request is merged.*  
> *Two hours later, an unmonitored payment webhook fails in production because nobody knew that file depended on the function you just edited.*  
>  
> *Today, we’re proud to introduce **X-Ray**: Developer Workflow Intelligence powered by **IBM Bob 2.0** and **IBM watsonx.ai**."*

---

### [0:22 - 0:50] ACT 2: ARCHITECTURE & INSTANT GRAPH DISCOVERY

**🖥️ On Screen:**  
- You are on the main **Graph View**.  
- Smoothly drag and zoom slightly into the interactive network graph.  
- Point the mouse at the top summary stats banner: **233 Nodes**, **410 Edges**, **0 circular cycles**.  
- Click on a major node (e.g., `get_db` or `authenticate_user`).  
- Notice the right panel open with caller and callee hierarchy!

**🎙️ What you say:**
> *"X-Ray doesn't just read code—it builds a living architectural digital twin of your codebase.*  
> *With zero configuration, our static AST analyzer and Bob 2.0 engine mapped this repository into **233 interconnected nodes and 410 functional edges**.*  
>  
> *Watch this: when I click on `get_db`, X-Ray instantly isolates its entire blast radius. In one single click, I can see all **54 downstream callers** across the entire microservice without digging through dozens of directory folders."*

---

### [0:50 - 1:25] ACT 3: PULL REQUEST & BLAST RADIUS IMPACT ANALYSIS

**🖥️ On Screen:**  
- Click on the **'Diff / Blast Radius'** tab in the sidebar (or top navigation).  
- Select or show a simulated Git Diff commit (e.g., modifying `recommendation_engine` or `auth_token_generator`).  
- Click **'Analyze Blast Radius'**.  
- Show the visual graph highlight: changed node turns **Amber/Red**, directly impacted files highlight in **Cyan**, and untested dependencies flash with warning badges.  
- Highlight the **Risk Score (e.g. 78/100 - High Risk)**.

**🎙️ What you say:**
> *"Now let's look at the real game changer: **The Pre-Flight Blast Radius Analyzer**.*  
> *Before you commit or approve a Pull Request, X-Ray runs an AST change impact inspection.*  
>  
> *Here, a developer made a simple 3-line change inside `recommendation_engine`.*  
> *Traditional CI/CD only runs tests marked for this single file. But X-Ray tracks the dependency tree and detects that **5 critical downstream API endpoints** depend on this output, and **two of them have zero test coverage!**"*  
>  
> *X-Ray automatically flags this as High Risk before this code can even touch a staging environment."*

---

### [1:25 - 1:55] ACT 4: IBM WATSONX.AI 1-CLICK TEST GENERATOR

**🖥️ On Screen:**  
- In the Impact panel, point to the untested caller.  
- Click the glowing button: **'⚡ Generate Tests with watsonx.ai'**.  
- The **Test Generator Modal** pops open.  
- Show the **Watsonx Granite Badge** (`ibm/granite-13b-chat-v2`).  
- Click **'Generate Test Suite'**.  
- The spinner runs for 2-3 seconds, and then a clean, syntactically complete `pytest` suite streams into the code viewer with fixtures, mocks, edge cases, and assertions.  
- Click **'Copy Code'** (checkmark feedback appears).

**🎙️ What you say:**
> *"Showing what might break is good. Fixing it automatically is revolutionary.*  
> *With our new **1-Click Test Generator**, powered by **IBM watsonx.ai Granite models**, X-Ray takes the exact AST caller-callee context and feeds it directly into watsonx.*  
>  
> *In under 4 seconds, watsonx generates a fully structured, runnable PyTest suite—complete with mock database sessions, error boundary conditions, and parameter verification.*  
> *What previously took a developer 45 minutes of manual test writing now happens before they even push their commit."*

---

### [1:55 - 2:20] ACT 5: THE DEVELOPER WORKFLOW & BUSINESS IMPACT

**🖥️ On Screen:**  
- Toggle the **Dependency Hierarchy Tree** mode (showing the neat top-down tree).  
- Click **Exit Tree / Reset to Default** (watch the nodes animate back into place smoothly).  
- Switch to the final slide (Slide 14: **'From Blind Commits to Complete Visibility'**) or stay on the clean dashboard overview.

**🎙️ What you say:**
> *"Think about the business value:*  
> *- **Senior engineers** save 3 to 5 hours every week during code reviews.*  
> *- **Junior developers** can onboard and contribute safely without fear of breaking unfamiliar modules.*  
> *- And **enterprises** prevent catastrophic downtime by catching regression leaks before deployment.*  
>  
> *By combining **IBM Bob 2.0** with **watsonx.ai**, X-Ray transforms code reviews from blind guesswork into an exact, visual science."*

---

### [2:20 - 2:30] CONCLUSION & CALL TO ACTION

**🖥️ On Screen:**  
Show Slide 14 or repository landing card with team credentials and github link:  
**X-Ray: Developer Workflow Intelligence.**  
*IBM Bob 2.0 × IBM watsonx.ai*

**🎙️ What you say:**
> *"Never merge code in the dark again.*  
> *Thank you, judges!"*

---

## 💡 PRO TIPS FOR A WINNING RECORDING

1. **Audio Clarity is 60% of the Impression:** Use a decent mic, or sit in a quiet room. Avoid background noise.
2. **Move Slow, Speak Clear:** Whenever you click a button (like 'Generate Tests'), pause for 1 second so the judge's eyes follow your mouse.
3. **If You Stumble:** Don't stop recording! Just pause for 2 seconds, take a breath, and re-read the sentence. You can easily trim the pause in Windows Clipchamp or CapCut in 10 seconds.
4. **Video Resolution:** Export in 1080p (MP4). Upload as an **Unlisted YouTube Video** or **Loom Link** so judges can click and play instantly without downloading large files.
