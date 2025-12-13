# Local Clerk Authentication Development Guide

## Problem Statement
`npm run dev` with Vite doesn't properly support Clerk authentication for local testing, requiring frequent deployments to test changes. This guide provides **3 proven options** to test Clerk locally without deploying.

---

## Option 1: Ngrok + Local Vite Dev Server ⭐ RECOMMENDED

### Why This Option?
- ✅ Real Clerk authentication without deployment
- ✅ Tests actual Clerk callbacks and webhooks
- ✅ Closest to production environment
- ✅ Fastest iteration cycle
- ✅ Free tier available

### Setup Steps

#### 1. Install Ngrok
```bash
# Download from https://ngrok.com/download
# Or install via package manager
choco install ngrok  # Windows with Chocolatey
```

#### 2. Create Ngrok Config File
Create `ngrok.yml` in your home directory:

```yaml
# ~/.ngrok2/ngrok.yml (Windows: %APPDATA%/.ngrok2/ngrok.yml)
authtoken: <YOUR_NGROK_AUTH_TOKEN>
tunnels:
  vite:
    proto: http
    addr: localhost:5173
    bind_tls: true
```

Get your auth token from: https://dashboard.ngrok.com/

#### 3. Add Scripts to package.json
```json
{
  "scripts": {
    "dev": "vite",
    "dev:ngrok": "ngrok start vite",
    "dev:local": "npm run dev & npm run dev:ngrok"
  }
}
```

#### 4. Update Clerk Dashboard
1. Go to https://dashboard.clerk.com/
2. In **Allowed origins**, add your ngrok URL: `https://xxxxx.ngrok.io`
3. In **Redirect URLs**, add: `https://xxxxx.ngrok.io/auth/callback`
4. Save changes

#### 5. Update .env.local (Optional but Recommended)
```env
# .env.local - ignored by git, local overrides
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_APP_URL=https://xxxxx.ngrok.io
```

#### 6. Run Local Development
```bash
# Terminal 1: Start Vite
npm run dev

# Terminal 2: Start Ngrok (waits for Vite to be ready)
npm run dev:ngrok
```

#### 7. Access Your App
Visit the ngrok URL shown in Terminal 2:
```
https://xxxxx.ngrok.io
```

### Testing Workflow
```
Make changes → Save → Browser auto-reloads → Clerk auth works → No redeploy needed
```

### Pros & Cons
| Pros | Cons |
|------|------|
| Real Clerk environment | Ngrok URL changes frequently |
| Tests callbacks/webhooks | Requires ngrok.com account |
| Fast iteration | Slight latency from tunnel |
| Production-like testing | Free tier has connection limits |

---

## Option 2: Vite Dev Server + Localhost Auth Bypass

### Why This Option?
- ✅ No external services needed
- ✅ Fastest local testing
- ✅ Perfect for UI/UX iterations
- ❌ Can't test actual Clerk callbacks
- ❌ Limited real authentication testing

### Setup Steps

#### 1. Create Local Auth Mock
Create `src/lib/localAuth.js`:

```javascript
// src/lib/localAuth.js
// Local development Clerk mock for testing UI without real auth

export const createLocalAuthContext = () => {
  return {
    isSignedIn: true,
    user: {
      id: "user_local_dev",
      primaryEmailAddress: { emailAddress: "dev@example.com" },
      firstName: "Dev",
      lastName: "User",
      publicMetadata: {
        role: "admin",
        dashboardAccess: "real"
      }
    },
    getToken: async () => "local_dev_token_" + Date.now(),
    signOut: () => console.log("Sign out called")
  };
};

export const useAuthLocal = () => {
  const auth = JSON.parse(localStorage.getItem('localAuth') || '{}');
  
  return {
    isSignedIn: auth.isSignedIn ?? true,
    user: auth.user ?? {
      id: "user_local_dev",
      primaryEmailAddress: { emailAddress: "dev@example.com" },
      firstName: "Dev",
      lastName: "User",
      publicMetadata: {
        role: "admin",
        dashboardAccess: "real"
      }
    },
    sessionId: "local_dev_session",
    isLoaded: true
  };
};

export const mockClerkUser = (overrides = {}) => {
  const defaultUser = {
    id: "user_local_dev",
    primaryEmailAddress: { emailAddress: "dev@example.com" },
    firstName: "Dev",
    lastName: "User",
    publicMetadata: {
      role: "admin",
      dashboardAccess: "real"
    }
  };
  
  const user = { ...defaultUser, ...overrides };
  localStorage.setItem('localAuth', JSON.stringify({
    isSignedIn: true,
    user
  }));
  window.dispatchEvent(new Event('local-auth-change'));
};

// Quick role change for testing
export const setLocalRole = (role) => {
  mockClerkUser({ publicMetadata: { role, dashboardAccess: "real" } });
};

export const setLocalAccess = (access) => {
  const currentUser = JSON.parse(localStorage.getItem('localAuth') || '{}').user || {};
  mockClerkUser({ 
    publicMetadata: { 
      ...currentUser.publicMetadata, 
      dashboardAccess: access 
    } 
  });
};
```

#### 2. Update AuthContext.jsx
Add environment check:

```javascript
// In src/contexts/AuthContext.jsx - add at top of file
import { useAuthLocal, mockClerkUser, setLocalRole, setLocalAccess } from '../lib/localAuth';

const IS_LOCAL_DEV = import.meta.env.MODE === 'development' && !window.location.hostname.includes('ngrok');

export const AuthProvider = ({ children }) => {
  // ... existing code ...
  
  useEffect(() => {
    if (IS_LOCAL_DEV) {
      // Use mock local auth
      const mockUser = useAuthLocal();
      setCurrentUser(mockUser);
      setIsAdmin(mockUser.user?.publicMetadata?.role === 'admin');
      setSession({ sessionId: 'local' });
      setLoading(false);
      return;
    }
    
    // ... existing Clerk auth logic ...
  }, []);
};
```

#### 3. Create Dev Tools Panel
Create `src/components/DevToolsPanel.jsx`:

```javascript
import React, { useState } from 'react';
import { setLocalRole, setLocalAccess, mockClerkUser } from '../lib/localAuth';

const IS_LOCAL_DEV = import.meta.env.MODE === 'development';

export const DevToolsPanel = () => {
  const [isOpen, setIsOpen] = useState(false);

  if (!IS_LOCAL_DEV) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 10000,
      fontFamily: 'monospace',
      fontSize: '12px'
    }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 12px',
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: isOpen ? '10px' : '0'
        }}
      >
        🔧 Dev Tools {isOpen ? '▼' : '▶'}
      </button>

      {isOpen && (
        <div style={{
          background: '#f5f5f5',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '12px',
          minWidth: '200px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>Mock User Roles</div>
          
          <button 
            onClick={() => setLocalRole('admin')}
            style={{ display: 'block', width: '100%', marginBottom: '5px', padding: '5px' }}
          >
            👑 Make Admin
          </button>
          
          <button 
            onClick={() => setLocalRole('user')}
            style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '5px' }}
          >
            👤 Make User
          </button>

          <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>Dashboard Access</div>
          
          <button 
            onClick={() => setLocalAccess('real')}
            style={{ display: 'block', width: '100%', marginBottom: '5px', padding: '5px' }}
          >
            ✅ Grant Real Access
          </button>
          
          <button 
            onClick={() => setLocalAccess('demo')}
            style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '5px' }}
          >
            🧪 Set to Demo
          </button>

          <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>Test Users</div>
          
          <button 
            onClick={() => mockClerkUser({
              firstName: 'Admin',
              lastName: 'User',
              publicMetadata: { role: 'admin', dashboardAccess: 'real' }
            })}
            style={{ display: 'block', width: '100%', marginBottom: '5px', padding: '5px', fontSize: '11px' }}
          >
            👑 Admin (Real)
          </button>

          <button 
            onClick={() => mockClerkUser({
              firstName: 'Demo',
              lastName: 'User',
              publicMetadata: { role: 'user', dashboardAccess: 'demo' }
            })}
            style={{ display: 'block', width: '100%', padding: '5px', fontSize: '11px' }}
          >
            🧪 Demo User
          </button>
        </div>
      )}
    </div>
  );
};

export default DevToolsPanel;
```

#### 4. Add Panel to App.jsx
```javascript
import DevToolsPanel from './components/DevToolsPanel';

// In your App component's JSX:
<>
  {/* ... existing content ... */}
  <DevToolsPanel />
</>
```

#### 5. Run Normally
```bash
npm run dev
```

Access at `http://localhost:5173`

### Testing Workflow
```
Change role → Dev Tools Panel → Button click → Instant role change → UI updates
```

### Pros & Cons
| Pros | Cons |
|------|------|
| No external setup | Can't test real Clerk auth |
| Instant local testing | Can't test webhooks |
| Perfect for UI work | Limited to development |
| No environment switches | False sense of security |

---

## Option 3: Docker + Compose (Advanced)

### Why This Option?
- ✅ Isolated environment
- ✅ Tests full stack locally
- ✅ Can simulate production
- ❌ Requires Docker installation
- ❌ More complex setup

### Setup Steps

#### 1. Create Dockerfile
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173 3000

CMD ["npm", "run", "dev"]
```

#### 2. Create Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5173:5173"
      - "3000:3000"
    environment:
      - VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
      - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
    volumes:
      - .:/app
      - /app/node_modules
    networks:
      - local-dev

networks:
  local-dev:
    driver: bridge
```

#### 3. Run
```bash
docker-compose up
```

Access at `http://localhost:5173`

---

## Comparison Table

| Feature | Ngrok | Local Mock | Docker |
|---------|-------|-----------|--------|
| Real Clerk Auth | ✅ | ❌ | ✅ |
| Test Webhooks | ✅ | ❌ | ✅ |
| Setup Time | 5 min | 10 min | 15 min |
| External Services | 1 | 0 | 0 |
| Cost | Free | Free | Free |
| Best For | Production Testing | UI/UX | Full Stack |

---

## Recommended Setup (Hybrid Approach)

### Development Workflow
```
UI/UX Development
  ↓
npm run dev (Option 2: Local Mock)
  ↓
Feature Complete?
  ↓
Real Clerk Testing
  ↓
npm run dev (Option 1: Ngrok)
  ↓
Deploy to Vercel
```

### Script Configuration
```json
{
  "scripts": {
    "dev": "vite",
    "dev:mock": "VITE_MODE=mock vite",
    "dev:ngrok": "ngrok start vite",
    "dev:production-like": "npm run dev & npm run dev:ngrok",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

---

## Troubleshooting

### Ngrok Issues

**Problem:** Clerk rejects ngrok URL
```
Solution: Add to Clerk dashboard allowed origins
https://xxxxx.ngrok.io
```

**Problem:** CORS errors
```
Solution: Add headers in vercel.json or vite.config.js
```

**Problem:** Ngrok URL changes
```
Solution: Update .env or use paid plan for static URL
```

### Local Mock Issues

**Problem:** Auth not persisting
```javascript
// Fix: Check localStorage
localStorage.getItem('localAuth')
```

**Problem:** Dev Tools not showing
```javascript
// Fix: Ensure IS_LOCAL_DEV is true
console.log(import.meta.env.MODE); // Should be 'development'
```

---

## Quick Start Commands

### Option 1: Ngrok (Recommended for Real Testing)
```bash
# Terminal 1
npm run dev

# Terminal 2 (after noting ngrok URL)
ngrok start vite
```

### Option 2: Local Mock (Recommended for UI Development)
```bash
npm run dev
# Dev Tools Panel appears in bottom-right
# Use buttons to change roles/access instantly
```

### Option 3: Docker
```bash
docker-compose up
```

---

## Testing Checklist

### For Each Option
- [ ] Login works
- [ ] Admin dashboard accessible
- [ ] User access management functions
- [ ] Admin role changes save
- [ ] API calls return correct data
- [ ] Metadata updates reflected
- [ ] Errors handled gracefully
- [ ] No console errors

### Specific to Ngrok
- [ ] Clerk callbacks execute
- [ ] Webhooks received
- [ ] Email verification works
- [ ] Session persists correctly

### Specific to Local Mock
- [ ] Dev Tools Panel visible
- [ ] Role changes instant
- [ ] Access level changes work
- [ ] localStorage properly set

---

## Environment Variables Reference

### Required for All Options
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
VITE_USE_CLERK_AUTH=true
```

### Optional for Ngrok
```env
VITE_APP_URL=https://xxxxx.ngrok.io
```

### Optional for Local Dev
```env
VITE_DEV_MODE=local_mock
```

---

## Performance Tips

### For Ngrok
- 🔧 Adjust tunnel timeout in ngrok.yml
- 🔧 Use paid tier for stability
- 🔧 Keep terminal visible for logs

### For Local Mock
- 🔧 Dev Tools panel can be toggled off
- 🔧 localStorage is automatically cleared on browser cache clear
- 🔧 Use browser DevTools to inspect auth state

### For Docker
- 🔧 Use volumes for hot reload
- 🔧 Mount node_modules as volume
- 🔧 Use .dockerignore to skip build files

---

## Next Steps

1. **Choose your primary option**: Ngrok (real testing) or Local Mock (fast dev)
2. **Set up scripts** in package.json
3. **Test the workflow** with your admin dashboard changes
4. **Document findings** for team

---

## Resources

- [Ngrok Documentation](https://ngrok.com/docs)
- [Clerk Development Environment](https://clerk.com/docs/deployments/clerk-local-development)
- [Vite Server Configuration](https://vitejs.dev/config/server-options.html)
- [Docker Documentation](https://docs.docker.com/)

---

**Last Updated:** December 6, 2025
**Created For:** Admin Dashboard Refactoring Testing
