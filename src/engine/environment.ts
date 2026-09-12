import type {
  ActionResult,
  AgentAction,
  Condition,
  Effect,
  Observation,
  RoomCase,
  RoomState,
  Rule,
} from "./types";

export const ACTION_TYPES = [
  "inspect",
  "interact",
  "move",
  "use_item",
  "input",
  "take",
  "combine",
  "submit_answer",
] as const;

export function isAgentAction(v: unknown): v is AgentAction {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.action === "string" &&
    (ACTION_TYPES as readonly string[]).includes(a.action) &&
    typeof a.target === "string" &&
    (a.value === null || typeof a.value === "string") &&
    (a.reason === null || typeof a.reason === "undefined" || typeof a.reason === "string")
  );
}

export function cloneState(s: RoomState): RoomState {
  return {
    ...s,
    discoveredObjects: [...s.discoveredObjects],
    hiddenObjects: [...s.hiddenObjects],
    inventory: [...s.inventory],
    objectStates: { ...s.objectStates },
    puzzleStates: { ...s.puzzleStates },
    doorStates: { ...s.doorStates },
    firedRules: [...s.firedRules],
    inspectedObjects: [...s.inspectedObjects],
  };
}

export function initialState(room: RoomCase): RoomState {
  const objectStates: Record<string, string> = {};
  const discovered: string[] = [];
  const hidden: string[] = [];
  for (const o of room.objects) {
    objectStates[o.id] = o.initialState;
    if (o.hidden) hidden.push(o.id);
    else discovered.push(o.id);
  }
  const doorStates: Record<string, "locked" | "open"> = {};
  for (const d of room.doors) doorStates[d.id] = d.locked ? "locked" : "open";
  return {
    currentRoom: room.title,
    discoveredObjects: discovered,
    hiddenObjects: hidden,
    inventory: [],
    objectStates,
    puzzleStates: {},
    doorStates,
    firedRules: [],
    inspectedObjects: [],
    actionCount: 0,
    maxActions: room.maxActions,
    escaped: false,
    failed: false,
  };
}

export function buildObservation(room: RoomCase, state: RoomState, recentEvents: string[]): Observation {
  const visible = state.discoveredObjects.map((id) => {
    const o = room.objects.find((x) => x.id === id)!;
    return { id, name: o.name, kind: o.kind, state: state.objectStates[id] ?? o.initialState };
  });
  return {
    room: room.title,
    description: room.description,
    visible_objects: visible,
    doors: room.doors.map((d) => ({ id: d.id, name: d.name, state: state.doorStates[d.id] })),
    inventory: [...state.inventory],
    recent_events: recentEvents,
    actions_remaining: Math.max(0, state.maxActions - state.actionCount),
    escaped: state.escaped,
  };
}

function conditionMet(state: RoomState, cond: Condition | undefined): boolean {
  if (!cond) return true;
  if (cond.objectState) {
    for (const [k, v] of Object.entries(cond.objectState)) {
      if (state.objectStates[k] !== v) return false;
    }
  }
  if (cond.hasItem) {
    for (const it of cond.hasItem) if (!state.inventory.includes(it)) return false;
  }
  if (cond.puzzleSolved) {
    for (const p of cond.puzzleSolved) if (!state.puzzleStates[p]) return false;
  }
  if (cond.value !== undefined) {
    // value condition is checked against the action value by the caller
    return true;
  }
  return true;
}

function ruleMatches(rule: Rule, action: AgentAction, state: RoomState): boolean {
  if (rule.action !== action.action) return false;
  if (rule.target !== action.target) return false;
  if (rule.once && state.firedRules.includes(rule.id)) return false;
  if (rule.when?.value !== undefined && rule.when.value !== action.value) return false;
  if (rule.when?.valueNot !== undefined && rule.when.valueNot === action.value) return false;
  return conditionMet(state, rule.when);
}

function applyEffect(effect: Effect, room: RoomCase, state: RoomState, changes: string[]): void {
  switch (effect.type) {
    case "setState": {
      if (!effect.target) return;
      const prev = state.objectStates[effect.target];
      if (effect.value && prev !== effect.value) {
        state.objectStates[effect.target] = effect.value;
        const o = room.objects.find((x) => x.id === effect.target);
        changes.push(`${o?.name ?? effect.target}: ${prev} → ${effect.value}`);
      }
      break;
    }
    case "reveal": {
      const id = effect.target;
      if (!id) return;
      const idx = state.hiddenObjects.indexOf(id);
      if (idx >= 0) {
        state.hiddenObjects.splice(idx, 1);
        state.discoveredObjects.push(id);
        const o = room.objects.find((x) => x.id === id);
        changes.push(`Discovered: ${o?.name ?? id}`);
      }
      break;
    }
    case "addItem": {
      const id = effect.target ?? effect.value;
      if (!id || state.inventory.includes(id)) return;
      state.inventory.push(id);
      changes.push(`Inventory +${id}`);
      break;
    }
    case "removeItem": {
      const id = effect.target ?? effect.value;
      if (!id) return;
      const idx = state.inventory.indexOf(id);
      if (idx >= 0) {
        state.inventory.splice(idx, 1);
        changes.push(`Inventory −${id}`);
      }
      break;
    }
    case "unlockPuzzle": {
      const id = effect.target;
      if (!id) return;
      state.puzzleStates[id] = true;
      changes.push(`Puzzle solved: ${id}`);
      break;
    }
    case "openDoor": {
      const id = effect.target;
      if (!id || state.doorStates[id] === "open") return;
      state.doorStates[id] = "open";
      changes.push(`Door opened: ${id}`);
      break;
    }
    case "escape": {
      state.escaped = true;
      changes.push("ESCAPED");
      break;
    }
    case "setMessage":
      break;
  }
}

/**
 * Validate & execute one action against the ground-truth state.
 * Pure function: returns a NEW state plus the result. Never mutates input.
 */
export function executeAction(
  room: RoomCase,
  prev: RoomState,
  action: AgentAction
): { state: RoomState; result: ActionResult } {
  const state = cloneState(prev);

  if (state.escaped) {
    return {
      state,
      result: { success: false, message: "You already escaped.", invalid: true, events: [], stateChanges: [] },
    };
  }
  if (state.actionCount >= state.maxActions) {
    state.failed = true;
    return {
      state,
      result: { success: false, message: "No actions remaining. Experiment failed.", invalid: true, events: [], stateChanges: [], failed: true },
    };
  }

  const targetKnown =
    state.discoveredObjects.includes(action.target) ||
    state.doorStates[action.target] !== undefined ||
    state.inventory.includes(action.target);

  if (!targetKnown) {
    state.actionCount += 1;
    return {
      state,
      result: {
        success: false,
        message: `Unknown target "${action.target}". You cannot act on something you have not observed.`,
        invalid: true,
        events: [],
        stateChanges: [],
      },
    };
  }

  // Doors: "move" onto an open door = escape; "use_item"/"interact" handled by rules.
  const isDoor = state.doorStates[action.target] !== undefined;

  const changes: string[] = [];
  const events: string[] = [];
  state.actionCount += 1;

  // Find all matching rules (in declaration order).
  const matched = room.rules.filter((r) => ruleMatches(r, action, state));

  if (matched.length === 0) {
    // Built-in fallbacks per action type.
    if (action.action === "inspect") {
      const o = room.objects.find((x) => x.id === action.target);
      if (!state.inspectedObjects.includes(action.target)) state.inspectedObjects.push(action.target);
      const st = state.objectStates[action.target];
      const text = o?.inspectByState?.[st ?? ""] ?? o?.inspect ?? (isDoor ? `The door is ${state.doorStates[action.target]}.` : "Nothing unusual.");
      return {
        state,
        result: { success: true, message: text, events, stateChanges: changes },
      };
    }
    if (action.action === "move" && isDoor) {
      if (state.doorStates[action.target] === "open") {
        state.escaped = true;
        changes.push("ESCAPED");
        return {
          state,
          result: { success: true, message: "The door swings open. You step through. ESCAPED.", events, stateChanges: changes, escaped: true },
        };
      }
      return {
        state,
        result: { success: false, message: "The door is locked.", events, stateChanges: changes },
      };
    }
    if (action.action === "take") {
      const o = room.objects.find((x) => x.id === action.target);
      if (o?.takeable && state.discoveredObjects.includes(o.id)) {
        state.inventory.push(o.id);
        const idx = state.discoveredObjects.indexOf(o.id);
        if (idx >= 0) state.discoveredObjects.splice(idx, 1);
        changes.push(`Inventory +${o.id}`);
        return { state, result: { success: true, message: `You take the ${o.name}.`, events, stateChanges: changes } };
      }
      return { state, result: { success: false, message: "You cannot take this.", events, stateChanges: changes } };
    }
    return {
      state,
      result: {
        success: false,
        message: failureMessage(action),
        events,
        stateChanges: changes,
      },
    };
  }

  // Apply every matched rule.
  let critical = false;
  let allSuccess = true;
  for (const rule of matched) {
    if (rule.success === false) allSuccess = false;
    state.firedRules.push(rule.id);
    if (rule.critical) critical = true;
    if (rule.when?.consumeItem) {
      for (const it of rule.when.consumeItem) {
        const idx = state.inventory.indexOf(it);
        if (idx >= 0) {
          state.inventory.splice(idx, 1);
          changes.push(`Inventory −${it}`);
        }
      }
    }
    for (const eff of rule.effects) applyEffect(eff, room, state, changes);
    events.push(rule.message);
  }

  const msg = events.join(" ");
  return {
    state,
    result: {
      success: allSuccess,
      message: msg,
      events,
      stateChanges: changes,
      escaped: state.escaped,
      failed: state.failed,
      criticalMistake: critical || undefined,
    },
  };
}

function failureMessage(action: AgentAction): string {
  switch (action.action) {
    case "interact":
      return "Nothing happens. The object cannot be interacted with this way.";
    case "input":
      return "There is nothing to input a code into here.";
    case "use_item":
      return "Using this item here has no effect.";
    case "combine":
      return "These things cannot be combined.";
    case "move":
      return "You cannot move this.";
    case "submit_answer":
      return "There is nothing listening for an answer here.";
    default:
      return "That action has no effect.";
  }
}
