import { expect, test } from 'bun:test';
import { shareFile } from '../lib/backup';

test('in the installed app a failed share is an error, never a silent download', async () => {
  const file = new File(['{}'], 'b.json', { type: 'application/json' });
  Object.assign(navigator, { canShare: () => true, share: async () => { throw new DOMException('no', 'NotAllowedError'); } });
  await expect(shareFile(file, true)).rejects.toThrow('share sheet');
});
