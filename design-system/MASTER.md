# Syncra (LingoMeet) Design System — Premium Enterprise Edition

This is the global source of truth for Syncra's visual and user experience design. It is built using principles from the `frontend-design` and `ui-ux-pro-max` guidelines, avoiding generic AI defaults in favor of a highly legible, premium, and modern communication interface inspired by high-end enterprise SaaS products.

---

## 1. Subject & Goal

*   **Subject**: Real-time cross-language voice/video calling for English-speaking managers and French-speaking Benin staff.
*   **Single Job**: To allow the manager to read highly accurate, real-time English translations of their staff's French speech during a live VoIP call on a mobile device, and vice versa.
*   **Audience**: Remote managers and West African field staff. The interface must be extremely clean, legible under sunlight (if outdoors), and optimized for mobile browsers.

---

## 2. Token System

### Colors (HSL Calibrated)

We utilize a precise HSL color scale to ensure perfect contrast, accessibility, and visual harmony.

*   **Brand Primary**: `hsl(224, 89%, 55%)` (Vibrant Electric Blue)
    *   *Hover state*: `hsl(224, 89%, 48%)`
    *   *Subtle background*: `hsl(224, 100%, 97%)` (Soft blue wash)
*   **Success (Active/Live)**: `hsl(150, 84%, 37%)` (Emerald Green)
    *   *Subtle background*: `hsl(150, 84%, 97%)`
*   **Danger (Destructive)**: `hsl(0, 84%, 60%)` (Crimson)
*   **Neutral Palette (Slate)**:
    *   `--neutral-50`: `hsl(210, 40%, 98%)` (Canvas background)
    *   `--neutral-100`: `hsl(210, 40%, 96%)` (Sidebar background / borders)
    *   `--neutral-200`: `hsl(210, 32%, 91%)` (Subtle borders)
    *   `--neutral-500`: `hsl(215, 16%, 47%)` (Muted/Secondary text)
    *   `--neutral-700`: `hsl(215, 25%, 27%)` (Main body text)
    *   `--neutral-900`: `hsl(222, 47%, 11%)` (Headings, titles)

### Typography Hierarchy

We enforce tight letter-spacing and proportional line-heights to achieve an editorial, premium look.

*   **Display Font**: `Plus Jakarta Sans`
    *   *Hero Headings*: `font-weight: 700; letter-spacing: -0.03em; line-height: 1.2;`
    *   *Section Titles*: `font-weight: 600; letter-spacing: -0.02em; line-height: 1.3;`
*   **Body Font**: `Inter`
    *   *Primary Body*: `font-weight: 400; letter-spacing: -0.01em; line-height: 1.5; color: var(--neutral-700);`
    *   *Interactive Labels*: `font-weight: 500; letter-spacing: -0.01em;`
*   **Data Font**: `JetBrains Mono`
    *   *Monospace Labels*: `font-weight: 500; letter-spacing: 0; font-size: 0.75rem;`

### Spacing & Layout

We use an **8px grid system** for consistent spacing and touch-target compliance:
*   `--space-xs`: `4px`
*   `--space-sm`: `8px`
*   `--space-md`: `16px`
*   `--space-lg`: `24px`
*   `--space-xl`: `32px`

### Depth & Elevation (Layered Shadows)
We use a three-layer shadow technique to simulate realistic light diffusion and physical depth:

```css
/* Ambient Lift (Cards) */
--shadow-elevation-low: 
  0px 1px 2px rgba(0, 0, 0, 0.01),
  0px 2px 4px rgba(0, 0, 0, 0.015),
  0px 8px 16px rgba(0, 0, 0, 0.02);

/* Active Lift (Hover states & Modals) */
--shadow-elevation-high: 
  0px 2px 4px rgba(30, 91, 240, 0.02),
  0px 8px 16px rgba(30, 91, 240, 0.03),
  0px 24px 48px rgba(30, 91, 240, 0.06),
  0px 1px 2px rgba(0, 0, 0, 0.01);
```

### Fluid Micro-Animations
All interactive elements must transition using a custom cubic-bezier curve that mimics organic acceleration:
*   `transition: all 200ms cubic-bezier(0.2, 0.8, 0.2, 1);`

---

## 3. Wireframe & Interface Layout

### Split-Pane Workspace

```
+-----------------------------------------------------------------------------+
| [Logo] Syncra      | [Search...]                          (Bell) (History) [AV] |
| ENTERPRISE V2.4    |                                                        |
+--------------------+--------------------------------------------------------+
|                    |                                                        |
|  +--------------+  |  Welcome back, Manager.                                |
|  | + New Proj.  |  |  Here's your translation workspace overview.           |
|  +--------------+  |                                                        |
|                    |  +------------------------+  +----------------------+  |
|  (D) Dashboard  |  |  | Start Instant Call   |  | Upcoming Meetings    |  |
|  (P) Projects   |  |  | [Icon]                 |  |                      |  |
|  (T) Memory     |  |  +------------------------+  | [OCT] Q4 APAC Sync   |  |
|  (G) Glossary   |  |  | Schedule Meeting     |  | [24]  EN -> JA       |  |
|  (A) Analytics  |  |  | [Icon]                 |  |                      |  |
|                    |  +------------------------+  +----------------------+  |
|                    |                                                        |
|  (S) Settings   |  |  +--------------------------------------------------+  |
|  (?) Support    |  |  | Transcript Vault                         [Filter] |  |
|                    |  | DATE         TITLE            LANGUAGES   ACTION |  |
|                    |  | Oct 20, 2024 Product Launch   EN ⇄ FR     [Doc]  |  |
|                    |  +--------------------------------------------------+  |
+--------------------+--------------------------------------------------------+
```

---

## 4. UI/UX & Accessibility Guardrails

*   **Touch Targets**: All buttons (mute, camera, leave, join) are a minimum of `48px x 48px` (in practice `52px` or `56px` pills) with `8px` padding.
*   **Accessibility**: Focus rings (`outline: 2px solid var(--primary)`) are enabled. Icons use SVG (Lucide) with `aria-label` attributes.
*   **Contrast**: Text contrast is tested to be above `4.5:1` against all surface colors (Slate-900 on white/light gray).
*   **Safe Areas**: Safe-area insets (`env(safe-area-inset-bottom)`) are respected for mobile devices with notches.
