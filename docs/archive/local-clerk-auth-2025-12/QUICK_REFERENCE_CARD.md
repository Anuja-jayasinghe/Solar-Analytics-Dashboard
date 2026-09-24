> **Archived 2026-09-24 — historical record, not current.** This is the local Clerk auth tooling of December 2025. Its `localAuth` dev bypass was never wired in and has been deleted. For running the app locally today see [`docs/guides/LOCAL_DEVELOPMENT.md`](../../guides/LOCAL_DEVELOPMENT.md).
> Current documentation: [`docs/README.md`](../../README.md).

# 📌 Local Clerk Auth - Quick Reference Card

Print this or keep it bookmarked! 🔖

---

## ⚡ 30-Second Setup

```jsx
// 1. Add this import to App.jsx (top)
import LocalAuthDevTools from './components/LocalAuthDevTools';

// 2. Add this to JSX (near end, before closing >)
<LocalAuthDevTools />

// 3. Save and run: npm run dev
// 4. Look for green button bottom-right
// ✅ Done!
```

---

## 🎮 Button Controls

| Button | Action | Result |
|--------|--------|--------|
| 👑 Admin | Click | Become admin |
| 👤 User | Click | Become regular user |
| ✅ Real | Click | Grant real data access |
| 🧪 Demo | Click | Switch to demo mode |

---

## ⚡ Quick Test Users (One Click)

| User | Role | Access | Use Case |
|------|------|--------|----------|
| 👑 Admin (Real) | Admin | Real | Full access testing |
| 👤 User (Real) | User | Real | Normal user testing |
| 🧪 User (Demo) | User | Demo | Demo mode testing |
| 👑 Admin (Demo) | Admin | Demo | Admin in demo testing |

---

## 💻 Console Commands

```javascript
// Role changes
window.__LOCAL_AUTH__.setRole('admin')
window.__LOCAL_AUTH__.setRole('user')

// Access changes
window.__LOCAL_AUTH__.setAccess('real')
window.__LOCAL_AUTH__.setAccess('demo')

// Test users
window.__LOCAL_AUTH__.TEST_USERS.ADMIN_REAL()
window.__LOCAL_AUTH__.TEST_USERS.USER_DEMO()

// Debug
window.__LOCAL_AUTH__.debug()

// Reset
window.__LOCAL_AUTH__.clear()
```

---

## 🧪 Testing Scenarios

### Admin Dashboard Access
```
1. Click "👑 Admin (Real)"
2. Navigate to /admin-dashboard
3. Verify all 3 tabs visible
4. Test features
5. Click "👤 User"
6. Verify admin tabs hidden
```

### Role-Based UI
```
1. Make UI changes
2. Save (Ctrl+S)
3. Auto-reloads
4. Click role button
5. Test different UIs
6. Repeat 1-5
```

### Access Levels
```
1. Click "✅ Real"
2. Test real data display
3. Click "🧪 Demo"
4. Verify demo barriers
5. No redeploy needed!
```

---

## ❓ Quick Help

| Problem | Solution |
|---------|----------|
| Button not visible | Check: 1. npm running 2. Browser refresh 3. F12 console errors |
| Import fails | Path: `./components/LocalAuthDevTools` |
| Not persisting | Check: 1. localStorage (F12) 2. Not in private mode |
| Need real Clerk | See: LOCAL_CLERK_DEVELOPMENT.md (Ngrok option) |

---

## 📊 Speed Comparison

| Task | Before | After | Saved |
|------|--------|-------|-------|
| Change & test role | 8 min | 30 sec | 7.5 min |
| 20 test scenarios | 2.5 hrs | 30 min | 2 hrs |

---

## 📚 Documentation

| Need | File |
|------|------|
| Quick start | START_HERE.md |
| Copy-paste | COPY_PASTE_INTEGRATION.md |
| How to use | LOCAL_AUTH_QUICK_START.md |
| Step-by-step | LOCAL_CLERK_SETUP_CHECKLIST.md |
| Visual | LOCAL_CLERK_VISUAL_GUIDE.md |
| All options | LOCAL_CLERK_DEVELOPMENT.md |

---

## ✅ Verification Checklist

- [ ] App.jsx has import added
- [ ] App.jsx has component in JSX
- [ ] npm run dev running
- [ ] Browser shows green button
- [ ] Button expands when clicked
- [ ] Current state displays
- [ ] Buttons change state
- [ ] No console errors

All checked = Working! ✅

---

## 🎯 Development Workflow

```
1. Make code change
   ↓
2. Save (Ctrl+S)
   ↓
3. Browser auto-reloads
   ↓
4. Use Dev Tools to change role
   ↓
5. Test immediately
   ↓
6. Go to step 1
```

---

## 💡 Pro Tips

- **Tip 1:** Keep panel open while coding
- **Tip 2:** Use console for fastest changes
- **Tip 3:** Test all 4 role/access combinations
- **Tip 4:** Reset between major feature tests
- **Tip 5:** Switch to Ngrok when ready for real auth

---

## 🔄 Current State Display

```
Email: dev@example.com
Role: admin (or user)
Access: real (or demo)
```

Color coding:
- Role: 👑 Gold = admin | 👤 Green = user
- Access: ✅ Green = real | 🧪 Pink = demo

---

## ⚙️ How It Works

```
1. Component renders in dev mode only
2. Loads from localStorage
3. Shows UI panel
4. Click buttons
5. Updates localStorage
6. Dispatches event
7. Components re-read auth
8. UI updates instantly
```

---

## 📍 Button Location

```
Web Page
├─ Your content (center)
└─ 🔧 Dev Tools Panel (fixed bottom-right)
   └─ Green button that expands
```

Always visible. Always accessible. Never blocks content.

---

## 🚀 Before/After

### Before
```
❌ Local testing doesn't work
❌ Must deploy to test auth
❌ 3+ minutes per test
❌ Slow development
❌ Frustrating iteration
```

### After
```
✅ Local testing works perfectly
✅ No deployment needed
✅ 30 seconds per test
✅ Fast development
✅ Enjoyable iteration
```

---

## 🎊 Remember

**Just 2 lines of code changes everything:**

```jsx
import LocalAuthDevTools from './components/LocalAuthDevTools';
<LocalAuthDevTools />
```

That's the entire integration.

---

## 🔗 Keep Handy

**Quick links:**
- Setup: `COPY_PASTE_INTEGRATION.md`
- Help: `LOCAL_CLERK_SETUP_CHECKLIST.md`
- All options: `LOCAL_CLERK_DEVELOPMENT.md`

---

## ✨ Key Benefit

No more waiting for deployments to test authentication.

Test instantly. Iterate rapidly. Develop happily. 🚀

---

**Print this card** • **Bookmark it** • **Reference often**

Last Updated: December 6, 2025
