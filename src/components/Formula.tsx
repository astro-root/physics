import { useEffect, useMemo, useState } from 'react';
import 'katex/dist/katex.min.css';
import { formulaToTex } from '../lib/formula-tex';

/**
 * Renders one formula string (in the plain-unicode notation used across
 * server/seed/*.js, e.g. "R = v₀² sin(2θ) / g") as real math typesetting via
 * KaTeX, instead of as a line of monospace unicode text.
 *
 * KaTeX (plus its font files) is a non-trivial chunk of a page's weight, and
 * most pages in this app (catalog, landing, admin) never show a formula at
 * all -- so it's imported dynamically here rather than at the top of the
 * module, keeping it out of the shared bundle that every route pays for.
 *
 * Conversion can, in principle, fail on notation this converter doesn't
 * handle yet (see formula-tex.ts). Rather than let that take the whole page
 * down, or silently swallow the error, we fall back to the original plain
 * text for that one formula -- every existing formula in the catalogue has
 * already been verified to convert cleanly (see dev notes), so a fallback
 * firing at all would itself be a signal that a newly added formula needs
 * attention.
 */
export default function Formula({ text, display = false }: { text: string; display?: boolean }) {
  const [renderer, setRenderer] = useState<typeof import('katex') | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('katex').then((mod) => { if (!cancelled) setRenderer(mod); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const html = useMemo(() => {
    if (!renderer) return null;
    try {
      return renderer.default.renderToString(formulaToTex(text), {
        throwOnError: true,
        displayMode: display,
        strict: 'ignore',
      });
    } catch {
      return null;
    }
  }, [renderer, text, display]);

  if (html === null) return <span className="mono">{text}</span>;
  // eslint-disable-next-line react/no-danger -- KaTeX's own output, not user input.
  return <span className="formula" dangerouslySetInnerHTML={{ __html: html }} />;
}
