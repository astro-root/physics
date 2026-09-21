// Converts the plain-unicode formula notation used across server/seed/*.js
// (e.g. "R = v₀² sin(2θ) / g") into LaTeX suitable for KaTeX.
//
// Why a converter instead of hand-writing LaTeX for every formula: the seed
// files already contain ~90 formula strings in a fairly consistent unicode
// notation (superscript/subscript digits, Greek letters, √, Σ, overdots for
// time derivatives, ...). Converting programmatically keeps the seed files
// as the single source of truth and means new formulas added later get
// proper typesetting for free, without anyone needing to also write LaTeX
// by hand. Every rule here was validated by actually running the output
// through KaTeX against all existing formulas (zero parse failures) rather
// than by inspection alone -- see the project's dev notes if this needs
// re-validating after editing.

const SUP_MAP: Record<string, string> = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+','ⁿ':'n','ⁱ':'i' };
const SUB_MAP: Record<string, string> = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','ᵢ':'i','ⱼ':'j','ₙ':'n' };
const GREEK_MAP: Record<string, string> = {
  'α':'\\alpha','β':'\\beta','γ':'\\gamma','δ':'\\delta','ε':'\\epsilon','ζ':'\\zeta','η':'\\eta','θ':'\\theta',
  'ι':'\\iota','κ':'\\kappa','λ':'\\lambda','μ':'\\mu','µ':'\\mu','ν':'\\nu','ξ':'\\xi','ο':'o','π':'\\pi','ρ':'\\rho',
  'σ':'\\sigma','τ':'\\tau','υ':'\\upsilon','φ':'\\phi','χ':'\\chi','ψ':'\\psi','ω':'\\omega',
  'Α':'A','Β':'B','Γ':'\\Gamma','Δ':'\\Delta','Ε':'E','Ζ':'Z','Η':'H','Θ':'\\Theta','Ι':'I','Κ':'K',
  'Λ':'\\Lambda','Μ':'M','Ν':'N','Ξ':'\\Xi','Ο':'O','Π':'\\Pi','Ρ':'P','Σ':'\\sum','Τ':'T','Υ':'\\Upsilon',
  'Φ':'\\Phi','Χ':'X','Ψ':'\\Psi','Ω':'\\Omega',
};
const FUNC_WORDS = ['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'ln', 'exp', 'log', 'min', 'max'];
const DOT1 = new Set(['\u0307', '\u02d9']); // combining / spacing "dot above"
const DOT2 = new Set(['\u0308', '\u00a8']); // combining / spacing diaeresis (used here as double-dot)

function isCJK(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x3040 && c <= 0x30ff) || (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef);
}

/** Superscript/subscript unicode runs -> ^{...}/_{...}, on the raw string. */
function applyScripts(str: string): string {
  let out = '';
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (SUP_MAP[ch] !== undefined) {
      let run = '';
      while (i < str.length && SUP_MAP[str[i]] !== undefined) { run += SUP_MAP[str[i]]; i++; }
      out += `^{${run}}`;
    } else if (SUB_MAP[ch] !== undefined) {
      let run = '';
      while (i < str.length && SUB_MAP[str[i]] !== undefined) { run += SUB_MAP[str[i]]; i++; }
      out += `_{${run}}`;
    } else {
      out += ch; i++;
    }
  }
  return out;
}

/** Precomposed dotted letters (ẋ, ẍ, ...) -> placeholder tokens resolved later. */
function applyPrecomposedDots(str: string): string {
  return str
    .replace(/ẍ/g, '\u0000DDOT(x)\u0000').replace(/ẋ/g, '\u0000DOT(x)\u0000')
    .replace(/ÿ/g, '\u0000DDOT(y)\u0000').replace(/ẏ/g, '\u0000DOT(y)\u0000')
    .replace(/z̈/g, '\u0000DDOT(z)\u0000').replace(/ż/g, '\u0000DOT(z)\u0000')
    .replace(/ä/g, '\u0000DDOT(a)\u0000').replace(/ȧ/g, '\u0000DOT(a)\u0000');
}

/**
 * A "unit" (one base letter, already through applyScripts so any subscript is
 * now a literal "_{...}" run immediately after it) followed by a standalone
 * dot-above / diaeresis mark means "time derivative of that unit" (θ₁¨ ->
 * theta-sub-1, double dot). This must run *after* applyScripts, because the
 * dot mark sits after the whole base+subscript group in the source text, and
 * the derivative applies to the base symbol, not to the subscript digit.
 */
function applyPostScriptDots(str: string): string {
  let out = '';
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    let j = i + 1;
    if (str[j] === '_' && str[j + 1] === '{') {
      const close = str.indexOf('}', j);
      if (close !== -1) j = close + 1;
    }
    const markerChar = str[j];
    if (markerChar && DOT2.has(markerChar)) {
      out += `\u0000DDOT(${GREEK_MAP[ch] || ch}${str.slice(i + 1, j)})\u0000`;
      i = j + 1;
      continue;
    }
    if (markerChar && DOT1.has(markerChar)) {
      out += `\u0000DOT(${GREEK_MAP[ch] || ch}${str.slice(i + 1, j)})\u0000`;
      i = j + 1;
      continue;
    }
    out += ch; i++;
  }
  return out;
}

function resolveDotPlaceholders(str: string): string {
  return str
    .replace(/\u0000DDOT\(([^)]*)\)\u0000/g, '\\ddot{$1}')
    .replace(/\u0000DOT\(([^)]*)\)\u0000/g, '\\dot{$1}');
}

/** Converts one formula's plain-unicode text into a LaTeX string for KaTeX. */
export function formulaToTex(raw: string): string {
  let s = raw;
  // ASCII "sqrt(...)" (used by a few formulas alongside the unicode √ form)
  // -> the same unicode radical, so the single √-handling pass below covers both.
  s = s.replace(/\bsqrt\(/g, '√(');
  s = applyPrecomposedDots(s);
  s = applyScripts(s);
  s = applyPostScriptDots(s);
  s = resolveDotPlaceholders(s);

  // Greek letters and remaining symbols, char by char, skipping over any
  // \command we've already produced (dot/ddot) so it isn't re-translated.
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') {
      out += s[i]; i++;
      while (i < s.length && /[a-zA-Z]/.test(s[i])) { out += s[i]; i++; }
      i--; continue;
    }
    out += GREEK_MAP[s[i]] !== undefined ? GREEK_MAP[s[i]] + ' ' : s[i];
  }
  s = out;

  s = s
    .replace(/√/g, '\\sqrt')
    .replace(/×/g, '\\times ')
    .replace(/·/g, '\\cdot ')
    .replace(/−/g, '-')
    .replace(/±/g, '\\pm ')
    .replace(/≈/g, '\\approx ')
    .replace(/≠/g, '\\neq ')
    .replace(/≥/g, '\\geq ')
    .replace(/≤/g, '\\leq ')
    .replace(/∝/g, '\\propto ')
    .replace(/⟨/g, '\\langle ')
    .replace(/⟩/g, '\\rangle ')
    .replace(/∫/g, '\\int ')
    .replace(/∂/g, '\\partial ')
    .replace(/∇/g, '\\nabla ')
    .replace(/½/g, '\\tfrac{1}{2}')
    .replace(/ħ/g, '\\hbar ')
    .replace(/…/g, '\\ldots ')
    .replace(/⊥/g, '\\perp ')
    .replace(/⇩/g, '\\downarrow ');

  // \sqrt applied to a parenthesised group -> \sqrt{...}; else to the next token.
  s = s.replace(/\\sqrt\(([^()]*)\)/g, '\\sqrt{$1}');
  s = s.replace(/\\sqrt([A-Za-z0-9])/g, '\\sqrt{$1}');

  // Known function names as proper upright operators (word-boundary only).
  for (const fn of FUNC_WORDS) {
    s = s.replace(new RegExp(`\\b${fn}\\b`, 'g'), `\\${fn} `);
  }

  // Wrap remaining CJK runs, and remaining ASCII word-runs of 3+ letters that
  // are not already a LaTeX command, in \text{...} so they render upright
  // (as words/units) instead of as a string of italic single-letter
  // variables. Two-letter runs (GM, dt, ...) are left as adjacent italic
  // variables, matching normal physics notation.
  let final = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') {
      final += s[i]; i++;
      while (i < s.length && /[a-zA-Z]/.test(s[i])) { final += s[i]; i++; }
      i--; continue;
    }
    if (isCJK(s[i])) {
      let run = '';
      while (i < s.length && isCJK(s[i])) { run += s[i]; i++; }
      i--;
      final += `\\text{${run}}`;
      continue;
    }
    if (/[A-Za-z]/.test(s[i])) {
      let j = i;
      let run = '';
      while (j < s.length && /[A-Za-z]/.test(s[j])) { run += s[j]; j++; }
      if (run.length >= 3) { final += `\\text{${run}}`; i = j - 1; continue; }
      final += s[i];
      continue;
    }
    final += s[i];
  }
  return final.replace(/\s+/g, ' ').trim();
}
