import katex from 'katex';

export type MathSegment =
  | { type: 'text'; value: string }
  | { type: 'inline-math'; value: string }
  | { type: 'display-math'; value: string };

function isEscaped(str: string, idx: number): boolean {
  let backslashes = 0;
  let pos = idx - 1;
  while (pos >= 0 && str[pos] === '\\') {
    backslashes += 1;
    pos -= 1;
  }
  return backslashes % 2 === 1;
}

export function tokenizeMathText(input: string): MathSegment[] {
  if (!input) return [];

  const segments: MathSegment[] = [];
  let textBuf = '';

  const flushText = () => {
    if (textBuf.length > 0) {
      segments.push({ type: 'text', value: textBuf });
      textBuf = '';
    }
  };

  let i = 0;
  while (i < input.length) {
    // Escaped \$ outside math renders as literal '$'
    if (input[i] === '\\' && input[i + 1] === '$' && !isEscaped(input, i)) {
      textBuf += '$';
      i += 2;
      continue;
    }

    // Display math: $$...$$
    if (input[i] === '$' && input[i + 1] === '$' && !isEscaped(input, i)) {
      let closeIdx = -1;
      for (let j = i + 2; j < input.length - 1; j += 1) {
        if (input[j] === '$' && input[j + 1] === '$' && !isEscaped(input, j)) {
          closeIdx = j;
          break;
        }
      }
      if (closeIdx !== -1) {
        const expr = input.slice(i + 2, closeIdx);
        if (expr.trim().length > 0) {
          flushText();
          segments.push({ type: 'display-math', value: expr.trim() });
          i = closeIdx + 2;
          continue;
        }
      }
      textBuf += '$$';
      i += 2;
      continue;
    }

    // Display math: \[...\]
    if (input[i] === '\\' && input[i + 1] === '[' && !isEscaped(input, i)) {
      let closeIdx = -1;
      for (let j = i + 2; j < input.length - 1; j += 1) {
        if (input[j] === '\\' && input[j + 1] === ']' && !isEscaped(input, j)) {
          closeIdx = j;
          break;
        }
      }
      if (closeIdx !== -1) {
        const expr = input.slice(i + 2, closeIdx);
        if (expr.trim().length > 0) {
          flushText();
          segments.push({ type: 'display-math', value: expr.trim() });
          i = closeIdx + 2;
          continue;
        }
      }
      textBuf += '\\[';
      i += 2;
      continue;
    }

    // Inline math: \(...\)
    if (input[i] === '\\' && input[i + 1] === '(' && !isEscaped(input, i)) {
      let closeIdx = -1;
      for (let j = i + 2; j < input.length - 1; j += 1) {
        if (input[j] === '\\' && input[j + 1] === ')' && !isEscaped(input, j)) {
          closeIdx = j;
          break;
        }
      }
      if (closeIdx !== -1) {
        const expr = input.slice(i + 2, closeIdx);
        if (expr.trim().length > 0) {
          flushText();
          segments.push({ type: 'inline-math', value: expr.trim() });
          i = closeIdx + 2;
          continue;
        }
      }
      textBuf += '\\(';
      i += 2;
      continue;
    }

    // Inline math: $...$
    if (input[i] === '$' && !isEscaped(input, i)) {
      const nextChar = input[i + 1];
      if (
        nextChar !== undefined &&
        nextChar !== '$' &&
        nextChar !== '\r' &&
        nextChar !== '\n' &&
        !/\s/.test(nextChar)
      ) {
        let matched = false;
        for (let j = i + 1; j < input.length; j += 1) {
          if (input[j] === '\r' || input[j] === '\n') {
            break;
          }
          if (input[j] === '$' && !isEscaped(input, j)) {
            const prevChar = input[j - 1];
            const afterChar = input[j + 1] ?? '';
            const expr = input.slice(i + 1, j);
            const validClosing =
              !/\s/.test(prevChar) &&
              !/[0-9]/.test(afterChar) &&
              expr.trim().length > 0;
            if (validClosing) {
              flushText();
              segments.push({ type: 'inline-math', value: expr });
              i = j + 1;
              matched = true;
            }
            break;
          }
        }
        if (matched) continue;
      }

      textBuf += '$';
      i += 1;
      continue;
    }

    textBuf += input[i];
    i += 1;
  }

  flushText();
  return segments;
}

export function renderMathToHtml(expr: string, displayMode: boolean): string {
  return katex.renderToString(expr, {
    displayMode,
    throwOnError: false,
    strict: 'ignore',
    trust: false,
  });
}
