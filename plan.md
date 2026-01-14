# Fix Plan: Resource Drift, Connection Stability, and Research System

## Summary of Issues

1. **Resource Drift (50+ units)**: Frontend and backend calculate resources differently
2. **Connection Crashes**: Socket disconnections causing page crashes
3. **Tech Points Not Saved**: Research is client-only, lost on refresh
4. **No Research Progress Bar**: Research completes instantly without visual feedback

---

## Issue 1: Resource Drift

### Root Cause

**Frontend adds population-based consumption, backend does NOT.**

**Frontend** (`gameStore.ts:552-556`):
```typescript
const popConsumption = state.resources.population;
consumption.food += popConsumption * 0.5;    // +5 at pop 10
consumption.oxygen += popConsumption * 0.3;  // +3 at pop 10
consumption.water += popConsumption * 0.2;   // +2 at pop 10
```

**Backend** (`resource_service.py:83-104`):
- Only sums production/consumption from buildings
- Does NOT add population-based consumption
- Population is treated as static (line 197)

**Result**: Over 30 seconds with population 10:
- Food drifts by: `5 * 0.5 = 2.5` per minute = ~1.25 units
- With multiple resources and time, drift compounds to 50+

### Fix

**File: `backend/app/services/resource_service.py`**

Add population-based consumption in `calculate_production_rates()`:

```python
async def calculate_production_rates(city_id: str) -> ProductionRates:
    # ... existing building loop ...

    # Get current population for consumption calculation
    city_doc = await db.cities.find_one({"_id": ObjectId(city_id)})
    resources = city_doc.get("resources", {})
    population = resources.get("population", 10)

    # Add population-based consumption (must match frontend!)
    consumption["food"] += population * 0.5
    consumption["oxygen"] += population * 0.3
    consumption["water"] += population * 0.2

    # ... rest of function ...
```

Also add population growth/decline logic to `calculate_resources_at_time()` to match frontend.

---

## Issue 2: Connection Crashes

### Root Causes

1. **No error boundaries** - Unhandled socket errors crash React
2. **Memory leaks** - Event listeners not cleaned up properly
3. **Large payloads** - Full city_state on reconnect can timeout
4. **No graceful degradation** - App crashes instead of showing error UI

### Fixes

#### 2.1 Add Error Boundaries (Frontend)

**New file: `frontend/src/components/ErrorBoundary.tsx`**

```typescript
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Game error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
```

#### 2.2 Improve Socket Error Handling

**File: `frontend/src/services/socket.ts`**

```typescript
// Add error event handler
this.socket.on('error', (error) => {
  console.error('Socket error:', error);
  // Don't crash - notify user and attempt recovery
});

// Add disconnect reason handling
this.socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server disconnected us - reconnect manually
    this.socket.connect();
  }
  // 'io client disconnect' means we called disconnect()
  // 'ping timeout' means connection lost
});
```

#### 2.3 Add Reconnection Recovery in App.tsx

**File: `frontend/src/App.tsx`**

```typescript
// Listen for reconnection and re-bootstrap
useEffect(() => {
  const unsubscribe = socketService.onStatusChange((status) => {
    if (status === 'connected' && wasDisconnected) {
      // Re-fetch state from server
      bootstrapDevCityV2().then(hydrateFromBootstrapV2);
    }
  });
  return unsubscribe;
}, []);
```

#### 2.4 Scalability: Add Redis for Socket.IO (Future)

For thousands of users, update `backend/app/sockets/manager.py`:

```python
# For horizontal scaling with multiple backend instances
import socketio

# Use Redis as message broker
mgr = socketio.AsyncRedisManager('redis://redis:6379')
sio = socketio.AsyncServer(
    client_manager=mgr,
    # ... existing config
)
```

---

## Issue 3: Tech Points Not Saved

### Root Cause

Research is **entirely client-side** (`TechTreePanel.tsx:37-46`):
- Deducts tech points locally
- Uses `setTimeout` to complete
- Never calls backend
- Lost on page refresh

### Fix: Use Action System for Research

Research should work exactly like building - use pending_actions.

#### 3.1 Backend: Add Research Action Type

**File: `backend/app/services/action_service.py`**

Add `start_research_action()` and `_complete_research_action()`:

```python
async def start_research_action(city_id: str, player_id: str, tech_id: str):
    # 1. Validate tech_id exists
    # 2. Check prerequisites are met
    # 3. Check tech points available
    # 4. Deduct tech points
    # 5. Create pending action with research time
    # 6. Return action_id, started_at, ends_at

async def _complete_research_action(action, city_doc, now):
    # 1. Add tech_id to unlocked_techs array in city
    # 2. Update city in database
```

#### 3.2 Backend: Store unlocked_techs in City

**File: `backend/app/services/city_service.py`**

Add to city document:
```python
"unlocked_techs": ["basic_construction", "life_support", ...],  # Default tier 1
"current_research": None,
```

#### 3.3 Frontend: Update TechTreePanel

**File: `frontend/src/components/game/TechTreePanel.tsx`**

```typescript
const handleStartResearch = async (techId: string) => {
  // Call backend action system
  const result = await startAction(cityId, 'research', { tech_id: techId });

  // Store action for progress tracking
  addServerPendingAction(result);

  // Set up completion timer
  scheduleActionComplete(result.action_id, result.ends_at);
};
```

#### 3.4 Frontend: Load unlocked_techs from Server

**File: `frontend/src/stores/gameStore.ts`**

In `hydrateFromServer()`, load `unlocked_techs` from city state.

---

## Issue 4: No Research Progress Bar

### Root Cause

- `researchTime` exists in techTree.ts (120-720 seconds)
- But UI doesn't show progress
- Research completes via `setTimeout(..., time * 10)` - 10x speed

### Fix: Add Progress Bar UI

#### 4.1 Track Research Progress in State

**File: `frontend/src/stores/gameStore.ts`**

```typescript
// Already exists but needs to be used:
currentResearch: string | null;
researchProgress: number; // 0-100

// Add action for updating progress
updateResearchProgress: () => {
  const state = get();
  if (!state.currentResearch) return;

  const action = state.serverPendingActions.get(/* research action id */);
  if (!action) return;

  const elapsed = Date.now() - action.startedAt;
  const total = action.endsAt - action.startedAt;
  const progress = Math.min(100, (elapsed / total) * 100);

  set({ researchProgress: progress });
};
```

#### 4.2 Add Progress Bar to TechTreePanel

**File: `frontend/src/components/game/TechTreePanel.tsx`**

```typescript
{isResearching && (
  <div className="mt-2">
    <div className="w-full h-2 bg-gray-800 rounded-full">
      <div
        className="h-full bg-cyan-500 rounded-full transition-all"
        style={{ width: `${researchProgress}%` }}
      />
    </div>
    <span className="text-xs text-cyan-400">
      {Math.floor(researchProgress)}% - {formatTimeRemaining(timeLeft)}
    </span>
  </div>
)}
```

#### 4.3 Update Progress in Resource Tick

**File: `frontend/src/stores/gameStore.ts`**

In `startResourceTick()`, add call to update research progress:

```typescript
tickInterval = window.setInterval(() => {
  // ... existing code ...
  state.updateResearchProgress();  // Add this
}, 100);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/app/services/resource_service.py` | Add population consumption to match frontend |
| `backend/app/services/action_service.py` | Add research action type |
| `backend/app/services/city_service.py` | Add unlocked_techs to city document |
| `backend/app/api/v1/dev.py` | Include unlocked_techs in bootstrap response |
| `frontend/src/components/ErrorBoundary.tsx` | New - error handling |
| `frontend/src/services/socket.ts` | Add error handlers, improve recovery |
| `frontend/src/App.tsx` | Add error boundary, reconnection recovery |
| `frontend/src/stores/gameStore.ts` | Add research progress tracking |
| `frontend/src/components/game/TechTreePanel.tsx` | Use action system, add progress bar |

---

## Implementation Order

1. **Fix resource drift** - Backend population consumption (highest impact, quickest fix)
2. **Add error boundary** - Prevent crashes from propagating
3. **Improve socket handling** - Better error recovery
4. **Implement research action** - Backend + frontend
5. **Add research progress bar** - UI improvement

---

## Verification Plan

1. **Resource drift test:**
   - Open game, note resource values
   - Wait 60 seconds
   - Check console for drift warnings
   - Drift should be < 5 units (tolerance)

2. **Connection test:**
   - Stop backend while game is open
   - Verify error UI shows (not crash)
   - Restart backend
   - Verify game recovers automatically

3. **Research test:**
   - Start research on a tech
   - Verify progress bar shows
   - Refresh page mid-research
   - Verify research continues from where it was
   - Wait for completion
   - Refresh again
   - Verify tech is still unlocked

4. **Scalability test (manual):**
   - Open multiple browser tabs
   - Verify all stay connected
   - Verify resource sync works across all
