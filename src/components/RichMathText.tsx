import { Fragment } from 'react';
import { renderMathToHtml, tokenizeMathText } from '@/lib/mathRender';

interface RichMathTextProps {
  text: string;
  className?: string;
  as?: 'span' | 'div' | 'p';
}

export function RichMathText({ text, className, as = 'span' }: RichMathTextProps) {
  const segments = tokenizeMathText(text);
  const Wrapper = as;

  return (
    <Wrapper className={className}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return <Fragment key={idx}>{seg.value}</Fragment>;
        }
        if (seg.type === 'display-math') {
          return (
            <span
              key={idx}
              className="math-display my-2 block overflow-x-auto text-center"
              dangerouslySetInnerHTML={{ __html: renderMathToHtml(seg.value, true) }}
            />
          );
        }
        return (
          <span
            key={idx}
            className="math-inline"
            dangerouslySetInnerHTML={{ __html: renderMathToHtml(seg.value, false) }}
          />
        );
      })}
    </Wrapper>
  );
}
