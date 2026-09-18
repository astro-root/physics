import { Suspense, lazy, useState } from 'react';

const Monaco = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.default })).catch(
    () =>
      ({
        default: () => null,
      }) as unknown as { default: typeof import('@monaco-editor/react').default },
  ),
);

interface Props {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: number;
  label: string;
}

/**
 * Monaco when it is available, a plain textarea when it is not. The editor is a
 * convenience; nothing about correctness or safety depends on it loading.
 */
export function CodeEditor({ value, onChange, language = 'javascript', height = 460, label }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="code-editor">
        <label className="sr-only" htmlFor="code-fallback">{label}</label>
        <textarea
          id="code-fallback"
          className="code-fallback"
          style={{ height }}
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="code-editor" aria-label={label}>
      <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}>エディタを読み込んでいます…</div>}>
        <ErrorCatcher onError={() => setFailed(true)}>
          <Monaco
            height={height}
            language={language}
            theme="vs-dark"
            value={value}
            onChange={(v?: string) => onChange(v ?? '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              tabSize: 2,
              automaticLayout: true,
              wordWrap: 'on',
              renderWhitespace: 'selection',
            }}
          />
        </ErrorCatcher>
      </Suspense>
    </div>
  );
}

import { Component, type ReactNode } from 'react';

class ErrorCatcher extends Component<{ children: ReactNode; onError: () => void }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() { return { broken: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.broken ? null : this.props.children; }
}
