import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { renderMathToHtml, tokenizeMathText } from '@/lib/mathRender';
import { RichMathText } from '@/components/RichMathText';

describe('mathRender & RichMathText', () => {
  it('tokenizes plain text, inline ($...$, \\(...\\)), and display ($$...$$, \\[...\\]) math', () => {
    expect(tokenizeMathText('Plain prose only.')).toEqual([
      { type: 'text', value: 'Plain prose only.' },
    ]);

    expect(tokenizeMathText('Given $x^2 + y^2 = r^2$ and \\(a + b\\):')).toEqual([
      { type: 'text', value: 'Given ' },
      { type: 'inline-math', value: 'x^2 + y^2 = r^2' },
      { type: 'text', value: ' and ' },
      { type: 'inline-math', value: 'a + b' },
      { type: 'text', value: ':' },
    ]);

    expect(tokenizeMathText('Result:\n$$\\int_0^1 x\\,dx$$\nand \\[\\sum_{i=1}^n i\\]')).toEqual([
      { type: 'text', value: 'Result:\n' },
      { type: 'display-math', value: '\\int_0^1 x\\,dx' },
      { type: 'text', value: '\nand ' },
      { type: 'display-math', value: '\\sum_{i=1}^n i' },
    ]);
  });

  it('ignores escaped \\$, bare currency pairs, and whitespace-padded dollar signs', () => {
    expect(tokenizeMathText('Cost is \\$50 total.')).toEqual([
      { type: 'text', value: 'Cost is $50 total.' },
    ]);

    expect(tokenizeMathText('Between $50 and $60 today.')).toEqual([
      { type: 'text', value: 'Between $50 and $60 today.' },
    ]);

    expect(tokenizeMathText('Range $50-$60 applies.')).toEqual([
      { type: 'text', value: 'Range $50-$60 applies.' },
    ]);

    expect(tokenizeMathText('Pay $50 and solve $x + 1 = 0$ now.')).toEqual([
      { type: 'text', value: 'Pay $50 and solve ' },
      { type: 'inline-math', value: 'x + 1 = 0' },
      { type: 'text', value: ' now.' },
    ]);

    expect(tokenizeMathText('$ spaced $ is not math.')).toEqual([
      { type: 'text', value: '$ spaced $ is not math.' },
    ]);
  });

  it('renders valid math via KaTeX and does not throw on malformed LaTeX', () => {
    const html = renderMathToHtml('\\frac{1}{2}', false);
    expect(html).toContain('katex');

    const malformed = renderMathToHtml('\\frac{1}{', true);
    expect(malformed).toContain('katex-error');
  });

  it('renders plain text XSS payloads safely as text nodes without executing or injecting HTML', () => {
    const { container } = render(
      createElement(RichMathText, {
        text: 'Check <script>alert("xss")</script> and <img src=x onerror=alert(1)> with $x^2$.',
      })
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<script>alert("xss")</script>');
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(container.querySelector('.katex')).not.toBeNull();
  });
});
