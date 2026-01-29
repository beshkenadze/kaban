# SPEC-003: Flexible Datetime Parsing

**Status**: Draft  
**Priority**: P1 (High)  
**Complexity**: Medium  
**Estimated effort**: 1-2 days  
**Source**: daikanban, taskell

---

## 1. Overview

Parse human-readable dates and durations for `dueDate`, `startDate`, and future time-related fields.

### Problem
```
# Currently requires exact date format:
kaban task update 1 --due-date 2024-03-25

# Inconvenient for users and AI
```

### Solution
```
# After:
kaban task update 1 --due "in 3 days"
kaban task update 1 --due "next Tuesday"
kaban task update 1 --due "tomorrow at 5pm"
kaban task update 1 --due "2w 3d"  # taskell-style: 2 weeks 3 days
```

### Goals
- Parse relative dates (`in 2 days`, `tomorrow`, `next week`)
- Parse duration format (`1w 2d 3h`)
- Parse natural language (`next Tuesday`, `end of month`)
- Fallback to ISO format (`2024-03-25`)

### Non-Goals
- Timezone support (uses local timezone)
- Recurring dates (future feature)

---

## 2. Supported Formats

### 2.1 Relative Days

| Input | Output (from today 2024-01-15) |
|-------|-------------------------------|
| `today` | 2024-01-15 |
| `tomorrow` | 2024-01-16 |
| `yesterday` | 2024-01-14 |
| `in 2 days` | 2024-01-17 |
| `in two days` | 2024-01-17 |
| `in 0 days` | 2024-01-15 (same as today) |
| `3 days ago` | 2024-01-12 |
| `in 1 week` | 2024-01-22 |
| `2 weeks from now` | 2024-01-29 |

### 2.2 Duration Format (taskell-style)

| Input | Duration |
|-------|----------|
| `1d` | 1 day |
| `2w` | 2 weeks (14 days) |
| `1w 3d` | 10 days |
| `2h` | 2 hours |
| `30m` | 30 minutes |
| `1w 2d 4h` | 11 days 4 hours |

**Invalid formats:**
- `-3d` → Error (negative durations not allowed)
- `0d` → Valid (means today/now)

### 2.3 Weekdays

| Input | Output (from Monday 2024-01-15) |
|-------|--------------------------------|
| `monday` | 2024-01-15 (this Monday) |
| `next monday` | 2024-01-22 |
| `last monday` | 2024-01-08 |
| `next tue` | 2024-01-23 |
| `this friday` | 2024-01-19 |

**Ambiguity rule for "next [weekday]":**
- If today is Sunday and you say "next Sunday", it means **7 days from now** (not today)
- "this Sunday" on Sunday means today

### 2.4 Named Dates

| Input | Output |
|-------|--------|
| `end of week` / `eow` | Next Sunday |
| `end of month` / `eom` | Last day of current month |
| `end of year` / `eoy` | December 31 |
| `next month` | First day of next month |

### 2.5 With Time

| Input | Output |
|-------|--------|
| `tomorrow at 5pm` | 2024-01-16 17:00 |
| `in 2 days at 14:30` | 2024-01-17 14:30 |
| `next monday 9am` | 2024-01-22 09:00 |

### 2.6 ISO Format (fallback)

| Input | Output |
|-------|--------|
| `2024-03-25` | 2024-03-25 |
| `2024-03-25T14:30` | 2024-03-25 14:30 |
| `03/25/2024` | 2024-03-25 |
| `25.03.2024` | 2024-03-25 |

---

## 3. Edge Cases & DST Handling

### 3.1 Daylight Saving Time

**Problem:** DST transitions can cause issues with time-based parsing.

```
"tomorrow at 2:30am" on March 10, 2024 (US DST starts)
→ 2:30am doesn't exist! Clocks jump from 2:00am to 3:00am

"tomorrow at 2:30am" on November 3, 2024 (US DST ends)  
→ 2:30am happens TWICE!
```

**Solution:** Use date-only storage for most cases, document behavior for time-specific inputs.

```typescript
export interface ParsedDate {
  date: Date;
  hasTime: boolean;  // Whether time was explicitly specified
}

// RECOMMENDATION: Store due dates as DATE-ONLY (midnight UTC) unless time is explicit
// This avoids DST issues for "due tomorrow" type inputs
```

**Behavior during DST transitions:**
- **Non-existent time (spring forward):** Round to next valid time (2:30am → 3:00am)
- **Ambiguous time (fall back):** Use first occurrence (standard behavior of chrono-node)
- **Log a warning** when DST adjustment occurs

### 3.2 Other Edge Cases

| Edge Case | Behavior |
|-----------|----------|
| `in 0 days` | Same as `today` |
| `-3d` | Error: "Negative durations not supported" |
| `in -2 days` | Error: "Negative values not supported" |
| `next Sunday` on Sunday | 7 days from now (not today) |
| `this Sunday` on Sunday | Today |
| `end of month` on Jan 31 | Jan 31 (current day) |
| `end of month` on Feb 28 (leap year) | Feb 29 |
| Empty string `""` | `null` (clears date) |
| Invalid input | Error with suggestion |

---

## 4. Implementation

### 4.1 Dependencies

```json
{
  "chrono-node": "^2.7.0"  // Natural language date parser
}
```

**Why chrono-node:**
- Mature, well-tested library
- Supports multiple languages
- Handles relative dates, weekdays, times
- 2.5M weekly downloads
- ~500KB (consider lazy loading for CLI performance)

### 4.2 Date Parser Module

```typescript
// packages/core/src/utils/date-parser.ts

import * as chrono from 'chrono-node';

export interface ParsedDate {
  date: Date;
  hasTime: boolean;  // Whether time was explicitly specified
  dstAdjusted?: boolean;  // True if DST adjustment was made
}

export interface DateParseOptions {
  referenceDate?: Date;  // Default: now
  timezone?: string;     // Default: local
}

export class DateParseError extends Error {
  constructor(
    message: string,
    public readonly input: string,
    public readonly suggestion?: string
  ) {
    super(message);
    this.name = 'DateParseError';
  }
}

/**
 * Parse human-readable date string
 */
export function parseDate(input: string, options?: DateParseOptions): ParsedDate | null {
  if (!input || input.trim() === '') {
    return null;  // Empty input clears the date
  }

  const ref = options?.referenceDate ?? new Date();
  const trimmed = input.trim().toLowerCase();
  
  // Check for negative durations (not supported)
  if (trimmed.startsWith('-') || trimmed.includes('in -')) {
    throw new DateParseError(
      'Negative durations are not supported',
      input,
      'Use "X days ago" for past dates'
    );
  }
  
  // 1. Try taskell-style duration first (1w 2d)
  const duration = parseDuration(trimmed);
  if (duration !== null) {
    const date = new Date(ref.getTime() + duration);
    return { date, hasTime: false };
  }
  
  // 2. Preprocess: convert word numbers
  const processed = convertWordNumbers(trimmed);
  
  // 3. Try chrono-node for natural language
  const results = chrono.parse(processed, ref, { forwardDate: true });
  if (results.length > 0) {
    const result = results[0];
    const parsed: ParsedDate = {
      date: result.date(),
      hasTime: result.start.isCertain('hour'),
    };
    
    // Check for DST adjustment
    if (parsed.hasTime) {
      const originalHour = result.start.get('hour');
      const actualHour = parsed.date.getHours();
      if (originalHour !== actualHour) {
        parsed.dstAdjusted = true;
        console.warn(`DST adjustment: requested ${originalHour}:00, using ${actualHour}:00`);
      }
    }
    
    return parsed;
  }
  
  // 4. Try ISO format
  const isoDate = new Date(input);
  if (!isNaN(isoDate.getTime())) {
    return { 
      date: isoDate, 
      hasTime: input.includes('T') || input.includes(':') 
    };
  }
  
  // 5. Failed to parse
  throw new DateParseError(
    `Cannot parse date: "${input}"`,
    input,
    'Try formats like "tomorrow", "in 3 days", "2w", or "2024-03-25"'
  );
}

/**
 * Parse taskell-style duration: "1w 2d 3h 30m"
 * Returns milliseconds or null if not a duration format
 */
export function parseDuration(input: string): number | null {
  const pattern = /^(?:(\d+(?:\.\d+)?)\s*w)?(?:\s*(\d+(?:\.\d+)?)\s*d)?(?:\s*(\d+(?:\.\d+)?)\s*h)?(?:\s*(\d+(?:\.\d+)?)\s*m)?$/i;
  const match = input.trim().match(pattern);
  
  if (!match || match.slice(1).every(g => g === undefined)) {
    return null;
  }
  
  const [, weeks, days, hours, minutes] = match;
  
  // Check for negative values (already handled in parseDate, but double-check)
  const values = [weeks, days, hours, minutes].filter(Boolean).map(parseFloat);
  if (values.some(v => v < 0)) {
    return null;
  }
  
  let ms = 0;
  if (weeks) ms += parseFloat(weeks) * 7 * 24 * 60 * 60 * 1000;
  if (days) ms += parseFloat(days) * 24 * 60 * 60 * 1000;
  if (hours) ms += parseFloat(hours) * 60 * 60 * 1000;
  if (minutes) ms += parseFloat(minutes) * 60 * 1000;
  
  return ms;
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  
  const parts: string[] = [];
  if (days >= 7) {
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    parts.push(`${weeks}w`);
    if (remainingDays) parts.push(`${remainingDays}d`);
  } else if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) parts.push(`${hours}h`);
  
  return parts.join(' ') || '0d';
}

// Word number conversion
const WORD_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4,
  five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12,
};

function convertWordNumbers(input: string): string {
  return input.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi,
    (match) => String(WORD_NUMBERS[match.toLowerCase()])
  );
}
```

---

## 5. Schema Updates

### 5.1 Add Date Fields to Task

```typescript
// packages/core/src/db/schema.ts

export const tasks = sqliteTable("tasks", {
  // ... existing fields
  dueDate: integer("due_date", { mode: "timestamp" }),      // NEW
  startDate: integer("start_date", { mode: "timestamp" }),  // Already exists as started_at
  // Note: started_at is when work began, startDate is planned start
});
```

### 5.2 Update AddTaskInput

```typescript
// packages/core/src/schemas.ts

export const AddTaskInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  columnId: z.string().optional(),
  dueDate: z.union([z.date(), z.string()]).optional().nullable(),  // Accept Date, string, or null
  startDate: z.union([z.date(), z.string()]).optional().nullable(),
  // ... rest
}).transform((input) => ({
  ...input,
  dueDate: input.dueDate ? parseDateField(input.dueDate) : undefined,
  startDate: input.startDate ? parseDateField(input.startDate) : undefined,
}));

function parseDateField(value: Date | string | null): Date | null | undefined {
  if (value === null) return null;  // Explicitly clear
  if (value instanceof Date) return value;
  
  const parsed = parseDate(value);
  return parsed?.date ?? undefined;
}
```

---

## 6. CLI Integration

### 6.1 Task Commands

```bash
# Create with due date
kaban task add "Fix bug" --due "tomorrow"
kaban task add "Review PR" --due "in 2 days"
kaban task add "Sprint planning" --due "next monday 10am"

# Update due date
kaban task update 12 --due "end of week"
kaban task update 12 --due "2w"  # 2 weeks from now

# Clear due date
kaban task update 12 --due ""
```

### 6.2 CLI Option

```typescript
// packages/cli/src/commands/task.ts

import { parseDate, DateParseError } from '@kaban-board/core';

const dueDateOption = new Option('--due <date>', 'Due date (e.g., "tomorrow", "in 3 days", "2024-03-25")')
  .argParser((value) => {
    if (!value || value === '') return null;  // Clear date
    
    try {
      const parsed = parseDate(value);
      if (!parsed) return null;
      return parsed.date;
    } catch (error) {
      if (error instanceof DateParseError) {
        throw new InvalidArgumentError(
          `${error.message}${error.suggestion ? `\nHint: ${error.suggestion}` : ''}`
        );
      }
      throw error;
    }
  });

taskCommand
  .command('add <title>')
  .addOption(dueDateOption)
  .action(async (title, options) => {
    await taskService.addTask({
      title,
      dueDate: options.due,
    });
  });
```

---

## 7. MCP Integration

### 7.1 Tool Parameters

```typescript
// MCP tool accepts string, parses internally
{
  name: "kaban_add_task",
  parameters: {
    title: { type: "string", required: true },
    dueDate: { 
      type: "string", 
      description: "Due date. Accepts: ISO date (2024-03-25), relative ('in 3 days', 'tomorrow'), duration ('2w'), natural ('next Tuesday', 'end of month'). Empty string clears the date."
    }
  }
}
```

### 7.2 Example AI Interaction

```
User: Create a task to review the PR, due in 3 days

AI: I'll create that task for you.
[calls kaban_add_task with dueDate="in 3 days"]

Result: Task #15 created with due date 2024-01-18
```

---

## 8. Display Formatting

### 8.1 Relative Display

```typescript
// packages/core/src/utils/date-format.ts

export function formatRelativeDate(date: Date, now = new Date()): string {
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays > 0 && diffDays < 7) return `in ${diffDays} days`;
  if (diffDays < 0 && diffDays > -7) return `${-diffDays} days ago`;
  if (diffDays >= 7 && diffDays < 14) return 'next week';
  
  return date.toLocaleDateString();
}
```

### 8.2 CLI Output

```
# kaban task show 12

Task #12: Fix authentication bug
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Column:   in-progress
Due:      tomorrow (2024-01-16)
Labels:   bug, urgent
```

---

## 9. Testing

```typescript
describe('parseDate', () => {
  const refDate = new Date('2024-01-15T12:00:00');

  describe('relative days', () => {
    it('parses "today"', () => {
      const result = parseDate('today', { referenceDate: refDate });
      expect(result?.date.toDateString()).toBe(refDate.toDateString());
    });

    it('parses "tomorrow"', () => {
      const result = parseDate('tomorrow', { referenceDate: refDate });
      expect(result?.date.toDateString()).toBe('Tue Jan 16 2024');
    });

    it('parses "in 3 days"', () => {
      const result = parseDate('in 3 days', { referenceDate: refDate });
      expect(result?.date.toDateString()).toBe('Thu Jan 18 2024');
    });

    it('parses "in two days" (word number)', () => {
      const result = parseDate('in two days', { referenceDate: refDate });
      expect(result?.date.toDateString()).toBe('Wed Jan 17 2024');
    });

    it('parses "in 0 days" as today', () => {
      const result = parseDate('in 0 days', { referenceDate: refDate });
      expect(result?.date.toDateString()).toBe(refDate.toDateString());
    });
  });

  describe('duration format', () => {
    it('parses "1w"', () => {
      const result = parseDate('1w', { referenceDate: refDate });
      expect(result?.date.toDateString()).toBe('Mon Jan 22 2024');
    });

    it('parses "1w 2d"', () => {
      const result = parseDate('1w 2d', { referenceDate: refDate });
      expect(result?.date.toDateString()).toBe('Wed Jan 24 2024');
    });

    it('parses "2d 4h"', () => {
      const result = parseDate('2d 4h', { referenceDate: refDate });
      expect(result?.date.getTime()).toBe(refDate.getTime() + 2*24*60*60*1000 + 4*60*60*1000);
    });

    it('parses "0d" as now', () => {
      const result = parseDate('0d', { referenceDate: refDate });
      expect(result?.date.getTime()).toBe(refDate.getTime());
    });
  });

  describe('weekdays', () => {
    it('parses "next monday"', () => {
      const result = parseDate('next monday', { referenceDate: refDate });
      expect(result?.date.toDateString()).toBe('Mon Jan 22 2024');
    });

    it('parses "this friday"', () => {
      const result = parseDate('this friday', { referenceDate: refDate });
      expect(result?.date.toDateString()).toBe('Fri Jan 19 2024');
    });

    it('parses "next sunday" on Sunday as 7 days later', () => {
      const sunday = new Date('2024-01-14T12:00:00'); // Sunday
      const result = parseDate('next sunday', { referenceDate: sunday });
      expect(result?.date.toDateString()).toBe('Sun Jan 21 2024');
    });
  });

  describe('with time', () => {
    it('parses "tomorrow at 5pm"', () => {
      const result = parseDate('tomorrow at 5pm', { referenceDate: refDate });
      expect(result?.date.getHours()).toBe(17);
      expect(result?.hasTime).toBe(true);
    });
  });

  describe('ISO format', () => {
    it('parses "2024-03-25"', () => {
      const result = parseDate('2024-03-25');
      expect(result?.date.toDateString()).toBe('Mon Mar 25 2024');
    });
  });

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      const result = parseDate('');
      expect(result).toBeNull();
    });

    it('returns null for whitespace only', () => {
      const result = parseDate('   ');
      expect(result).toBeNull();
    });

    it('throws on negative duration', () => {
      expect(() => parseDate('-3d')).toThrow(DateParseError);
      expect(() => parseDate('-3d')).toThrow(/negative/i);
    });

    it('throws on "in -2 days"', () => {
      expect(() => parseDate('in -2 days')).toThrow(DateParseError);
    });

    it('provides suggestion on invalid input', () => {
      try {
        parseDate('gibberish');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DateParseError);
        expect((error as DateParseError).suggestion).toBeDefined();
      }
    });
  });
});

describe('parseDuration', () => {
  it('returns null for non-duration', () => {
    expect(parseDuration('tomorrow')).toBeNull();
    expect(parseDuration('in 3 days')).toBeNull();
  });

  it('parses weeks', () => {
    expect(parseDuration('2w')).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it('parses combined', () => {
    expect(parseDuration('1w 2d 3h')).toBe(
      (7 + 2) * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000
    );
  });

  it('parses 0d as 0', () => {
    expect(parseDuration('0d')).toBe(0);
  });
});
```

---

## 10. Migration

```sql
-- drizzle/0006_due_date.sql

-- Add due_date column if not exists
ALTER TABLE tasks ADD COLUMN due_date INTEGER;

-- Note: start_date already exists as started_at (rename optional)
```

---

## 11. Acceptance Criteria

- [ ] `parseDate()` handles all documented formats
- [ ] Duration format (`1w 2d`) works
- [ ] Word numbers (`in two days`) work
- [ ] CLI `--due` option accepts flexible dates
- [ ] MCP tools accept flexible date strings
- [ ] Invalid dates throw `DateParseError` with helpful message
- [ ] Empty string clears the date (returns `null`)
- [ ] Negative durations are rejected with clear error
- [ ] DST edge cases are handled (logged warning, adjusted time)
- [ ] Dates display in relative format when appropriate
- [ ] Tests cover all formats and edge cases
