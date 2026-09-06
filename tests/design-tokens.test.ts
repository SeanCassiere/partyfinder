import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const stylesDir = join(root, 'src', 'styles');
const tokensFile = join(stylesDir, 'tokens.css');

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return cssFiles(full);
    return name.endsWith('.css') ? [full] : [];
  });
}

/* ------------------------------------------------------------------ *
 * 1. tokens.css is the only place a raw colour literal may appear.
 * ------------------------------------------------------------------ */

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/;

test('no colour literals outside tokens.css', () => {
  const offenders: string[] = [];
  for (const file of cssFiles(stylesDir)) {
    if (file === tokensFile) continue;
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (COLOUR_LITERAL.test(line)) {
          offenders.push(`${file.slice(root.length)}:${index + 1}: ${line.trim()}`);
        }
      });
  }
  assert.deepEqual(
    offenders,
    [],
    `raw colours must live in tokens.css only:\n${offenders.join('\n')}`,
  );
});

test('deleted theme patch files stay deleted', () => {
  const names = cssFiles(stylesDir).map((file) => file.slice(stylesDir.length + 1));
  assert.ok(!names.includes('dark-overrides.css'), 'dark theming must be token-driven');
  assert.ok(!names.includes('responsive-overlays.css'), 'one responsive file only');
});

/* ------------------------------------------------------------------ *
 * 2. Contrast of the documented token pairs, in both themes.
 * ------------------------------------------------------------------ */

type Theme = 'light' | 'dark';

function parseTokens(source: string): Record<Theme, Record<string, string>> {
  const themes: Record<Theme, Record<string, string>> = { light: {}, dark: {} };
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  // Blocks are `selector { ... }`; the dark block is the one keyed on data-theme.
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1]!.trim();
    if (!selector.startsWith(':root')) continue;
    const theme: Theme = selector.includes("data-theme='dark'") ? 'dark' : 'light';
    for (const decl of match[2]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      themes[theme][decl[1]!] = decl[2]!.trim();
    }
  }
  // Dark only redefines what changes; everything else falls through from :root.
  themes.dark = { ...themes.light, ...themes.dark };
  return themes;
}

function luminance(hex: string): number {
  const raw = hex.replace('#', '');
  assert.ok(/^[0-9a-fA-F]{6}$/.test(raw), `expected a 6-digit hex, got "${hex}"`);
  const channels = (raw.match(/../g) as string[]).map((pair) => {
    const value = parseInt(pair, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
}

const tokens = parseTokens(readFileSync(tokensFile, 'utf8'));

/**
 * The contrast contract. This list doubles as documentation: it is the set of
 * foreground/background combinations the stylesheets are allowed to produce.
 *
 * - `text`   -> WCAG 1.4.3 body text, 4.5:1
 * - `large`  -> WCAG 1.4.3 large text (>=18.66px bold / >=24px), 3:1
 * - `ui`     -> WCAG 1.4.11 non-text contrast (borders, focus rings, icons), 3:1
 */
type Kind = 'text' | 'large' | 'ui';
const THRESHOLD: Record<Kind, number> = { text: 4.5, large: 3, ui: 3 };

const PAIRS: Array<{ fg: string; bg: string; kind: Kind; where: string }> = [
  // Body text on the content surface
  { fg: '--text', bg: '--bg', kind: 'text', where: 'row names, headings, inputs' },
  { fg: '--text-muted', bg: '--bg', kind: 'text', where: 'secondary cells, buttons' },
  { fg: '--text-subtle', bg: '--bg', kind: 'text', where: 'placeholders, hints — the floor' },
  // Body text on the recessed surface (sidebar, table header, hover)
  { fg: '--text', bg: '--surface', kind: 'text', where: 'sidebar brand, hovered row name' },
  { fg: '--text-muted', bg: '--surface', kind: 'text', where: 'nav items, column headers' },
  { fg: '--text-subtle', bg: '--surface', kind: 'text', where: 'nav labels, scope note' },
  // Body text on floating layers
  { fg: '--text', bg: '--surface-raised', kind: 'text', where: 'menu items, dialog body, toast' },
  { fg: '--text-muted', bg: '--surface-raised', kind: 'text', where: 'menu hint, dialog copy' },
  { fg: '--text-subtle', bg: '--surface-raised', kind: 'text', where: 'dialog placeholders' },
  // Selection
  { fg: '--text', bg: '--accent-subtle', kind: 'text', where: 'selected row name' },
  { fg: '--text-muted', bg: '--accent-subtle', kind: 'text', where: 'selected row metadata' },
  { fg: '--text-subtle', bg: '--accent-subtle', kind: 'text', where: 'selected row hints' },
  { fg: '--accent', bg: '--accent-subtle', kind: 'ui', where: 'accent bar on a selected row' },
  { fg: '--accent', bg: '--bg', kind: 'text', where: 'accent used as a link/label colour' },
  { fg: '--accent', bg: '--surface', kind: 'text', where: 'active nav icon' },
  { fg: '--accent-fg', bg: '--accent', kind: 'text', where: 'primary button label' },
  // Status
  { fg: '--danger', bg: '--bg', kind: 'text', where: 'destructive menu item' },
  { fg: '--danger', bg: '--surface-raised', kind: 'text', where: 'destructive item in the menu' },
  { fg: '--danger', bg: '--danger-subtle', kind: 'text', where: 'error box' },
  { fg: '--danger-fg', bg: '--danger', kind: 'text', where: 'delete button label' },
  { fg: '--warning', bg: '--warning-subtle', kind: 'text', where: 'search limit notice' },
  { fg: '--success', bg: '--surface', kind: 'ui', where: 'connection status dot' },
  // Structure and controls (1.4.11)
  { fg: '--border', bg: '--bg', kind: 'ui', where: 'panel and row hairlines' },
  { fg: '--border', bg: '--surface', kind: 'ui', where: 'sidebar and header hairlines' },
  { fg: '--border', bg: '--surface-raised', kind: 'ui', where: 'menu and dialog outline' },
  { fg: '--border-strong', bg: '--bg', kind: 'ui', where: 'input and checkbox boundary' },
  { fg: '--border-strong', bg: '--surface-raised', kind: 'ui', where: 'dialog input boundary' },
  // Focus ring — must read against every surface it can land on
  { fg: '--focus', bg: '--bg', kind: 'ui', where: 'focus ring on content' },
  { fg: '--focus', bg: '--surface', kind: 'ui', where: 'focus ring on the sidebar/header' },
  { fg: '--focus', bg: '--surface-raised', kind: 'ui', where: 'focus ring in menus/dialogs' },
  { fg: '--focus', bg: '--accent-subtle', kind: 'ui', where: 'focus ring on a selected row' },
  // Icon hues (meaningful graphics, 1.4.11)
  { fg: '--folder', bg: '--bg', kind: 'ui', where: 'folder icon' },
  { fg: '--folder', bg: '--surface', kind: 'ui', where: 'folder icon on a hovered row' },
  { fg: '--icon-default', bg: '--bg', kind: 'ui', where: 'generic file icon' },
  { fg: '--icon-default', bg: '--surface', kind: 'ui', where: 'generic file icon, hovered' },
  { fg: '--icon-image', bg: '--bg', kind: 'ui', where: 'image file icon' },
  { fg: '--icon-image', bg: '--surface', kind: 'ui', where: 'image file icon, hovered' },
  { fg: '--icon-video', bg: '--bg', kind: 'ui', where: 'video file icon' },
  { fg: '--icon-video', bg: '--surface', kind: 'ui', where: 'video file icon, hovered' },
  { fg: '--icon-audio', bg: '--bg', kind: 'ui', where: 'audio file icon' },
  { fg: '--icon-audio', bg: '--surface', kind: 'ui', where: 'audio file icon, hovered' },
  { fg: '--icon-archive', bg: '--bg', kind: 'ui', where: 'archive file icon' },
  { fg: '--icon-archive', bg: '--surface', kind: 'ui', where: 'archive file icon, hovered' },
  { fg: '--icon-code', bg: '--bg', kind: 'ui', where: 'code file icon' },
  { fg: '--icon-code', bg: '--surface', kind: 'ui', where: 'code file icon, hovered' },
  { fg: '--icon-doc', bg: '--bg', kind: 'ui', where: 'document file icon' },
  { fg: '--icon-doc', bg: '--surface', kind: 'ui', where: 'document file icon, hovered' },
];

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} theme meets the contrast contract`, () => {
    const failures: string[] = [];
    for (const pair of PAIRS) {
      const fg = tokens[theme][pair.fg];
      const bg = tokens[theme][pair.bg];
      assert.ok(fg, `${theme}: missing ${pair.fg}`);
      assert.ok(bg, `${theme}: missing ${pair.bg}`);
      const ratio = contrast(fg, bg);
      if (ratio < THRESHOLD[pair.kind]) {
        failures.push(
          `${pair.fg} on ${pair.bg} = ${ratio.toFixed(2)}:1 ` +
            `(needs ${THRESHOLD[pair.kind]}:1 — ${pair.where})`,
        );
      }
    }
    assert.deepEqual(failures, [], `${theme} contrast failures:\n${failures.join('\n')}`);
  });
}

test('both themes define the same token names and set color-scheme', () => {
  const css = readFileSync(tokensFile, 'utf8');
  assert.match(css, /:root\s*\{[^}]*color-scheme:\s*light/s);
  assert.match(css, /:root\[data-theme='dark'\]\s*\{[^}]*color-scheme:\s*dark/s);
  for (const name of Object.keys(tokens.light)) {
    assert.ok(tokens.dark[name], `dark theme is missing ${name}`);
  }
});

test('the scales are the agreed sizes', () => {
  const names = Object.keys(tokens.light);
  const spacing = names.filter((name) => /^--space-\d+$/.test(name));
  const type = names.filter((name) => /^--text-(xs|sm|base|md|lg|xl)$/.test(name));
  assert.equal(spacing.length, 8, `eight spacing steps, got ${spacing.join(', ')}`);
  assert.equal(type.length, 6, `six type steps, got ${type.join(', ')}`);
  assert.deepEqual(
    ['--radius-sm', '--radius', '--radius-full'].filter((name) => tokens.light[name]).length,
    3,
    'exactly three radii',
  );
  assert.ok(tokens.light['--shadow-menu'], '--shadow-menu is defined');
  assert.ok(tokens.light['--shadow-dialog'], '--shadow-dialog is defined');
  assert.ok(tokens.light['--motion-fast'], '--motion-fast is defined');
  assert.ok(tokens.light['--font-sans'], '--font-sans is defined');
  assert.ok(tokens.light['--font-mono'], '--font-mono is defined');
});

test('stylesheets use only the 400/500/600 weights and the three radii', () => {
  const weightOffenders: string[] = [];
  const radiusOffenders: string[] = [];
  for (const file of cssFiles(stylesDir)) {
    if (file === tokensFile) continue;
    const css = readFileSync(file, 'utf8');
    for (const match of css.matchAll(/font-weight:\s*([^;]+);/g)) {
      const value = match[1]!.trim();
      if (!/^(inherit|var\(--weight-(normal|medium|strong)\))$/.test(value)) {
        weightOffenders.push(`${file.slice(root.length)}: ${value}`);
      }
    }
    for (const match of css.matchAll(/border-radius:\s*([^;]+);/g)) {
      const value = match[1]!.trim();
      if (!/^var\(--radius(-sm|-full)?\)$/.test(value)) {
        radiusOffenders.push(`${file.slice(root.length)}: ${value}`);
      }
    }
  }
  assert.deepEqual(weightOffenders, [], weightOffenders.join('\n'));
  assert.deepEqual(radiusOffenders, [], radiusOffenders.join('\n'));
});

test('focus is never removed and floating layers own the only shadows', () => {
  const shadowAllowed = new Set(['menu.css', 'dialog.css', 'utilities.css']);
  for (const file of cssFiles(stylesDir)) {
    if (file === tokensFile) continue;
    const css = readFileSync(file, 'utf8');
    const name = file
      .slice(stylesDir.length + 1)
      .split('/')
      .at(-1)!;
    assert.doesNotMatch(css, /outline:\s*(0|none)/, `${name} removes a focus outline`);
    for (const match of css.matchAll(/box-shadow:\s*([^;]+);/g)) {
      const value = match[1]!.trim();
      const floating = /^var\(--shadow-(menu|dialog)\)$/.test(value);
      const insetSelectionBar = value.startsWith('inset ');
      assert.ok(
        floating || insetSelectionBar,
        `${name}: shadows belong to floating layers only, found "${value}"`,
      );
      assert.ok(
        floating ? shadowAllowed.has(name) : true,
        `${name}: unexpected elevation outside menu/dialog/toast`,
      );
    }
  }
  const reset = readFileSync(join(stylesDir, 'reset.css'), 'utf8');
  assert.match(reset, /:focus-visible\s*\{\s*outline:\s*2px solid var\(--focus\);/);
  assert.match(reset, /@media \(prefers-reduced-motion: reduce\)/);
});

test('the theme-color meta and writer track --bg', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const picker = readFileSync(join(root, 'src', 'components', 'ThemePicker.tsx'), 'utf8');
  assert.ok(html.includes(`content="${tokens.light['--bg']}"`), 'index.html theme-color is --bg');
  assert.ok(picker.includes(`'${tokens.dark['--bg']}'`), 'ThemePicker writes the dark --bg');
  assert.ok(picker.includes(`'${tokens.light['--bg']}'`), 'ThemePicker writes the light --bg');
});
