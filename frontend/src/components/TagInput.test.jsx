import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagInput from './TagInput';

function Harness({ initial = [] }) {
  const [tags, setTags] = useState(initial);
  return (
    <>
      <TagInput value={tags} onChange={setTags} />
      <output data-testid="tags">{tags.join('|')}</output>
    </>
  );
}

describe('TagInput', () => {
  it('adds keywords with Enter and comma, ignoring duplicates', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Add keyword');
    await user.type(input, 'IPv6{Enter}Routing,ipv6{Enter}');
    expect(screen.getByTestId('tags')).toHaveTextContent('IPv6|Routing');
  });

  it('removes a chip with its × button and the last chip with Backspace', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['SQL', 'Database', 'Normalisation']} />);
    await user.click(screen.getByRole('button', { name: 'Remove keyword Database' }));
    expect(screen.getByTestId('tags')).toHaveTextContent('SQL|Normalisation');

    await user.click(screen.getByLabelText('Add keyword'));
    await user.keyboard('{Backspace}');
    expect(screen.getByTestId('tags')).toHaveTextContent(/^SQL$/);
  });
});
