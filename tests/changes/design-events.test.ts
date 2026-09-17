import { expect, test } from 'vitest';
import { DesignEventDecodeError, decodeDesignReviewEvent, latestDesignReviewContext, latestDesignReviewReceipt } from '../../packages/cli/src/changes/design-events.js';
import type { ControllerBatchOperation } from '../../packages/cli/src/state/snapshot.js';

const hash = (character: string) => character.repeat(64);
const context = {
  changeId: 'change-1', specHash: hash('a'), planHash: hash('b'), designPath: 'docs/design.md',
  designHash: hash('c'), designSourceBase64: Buffer.from('# Design\n').toString('base64'), producerSession: 'producer-1',
};
const receipt = {
  receiptId: 'receipt-1', provenance: 'human-confirmed', actorLabel: 'reviewer', changeId: 'change-1',
  specHash: hash('a'), planHash: hash('b'), designHash: hash('c'), producerSession: 'producer-1',
  findingsHash: hash('d'), verdict: 'pass', timestamp: '2020-01-01T00:00:00.000Z', expiresAt: '2020-01-02T00:00:00.000Z',
};

// Mutant caught: treating a design receipt as current-time valid makes recovery
// reject a receipt that was valid when its controller batch was prepared.
test('decodes persisted design events structurally, including both writer receipt envelopes', () => {
  expect(decodeDesignReviewEvent({ type: 'controller.design.review.requested', payload: { ...context, preservedWriterField: true } }))
    .toMatchObject({ type: 'controller.design.review.requested', payload: { ...context, preservedWriterField: true } });
  expect(decodeDesignReviewEvent({ type: 'receipt.design-review.ingested', payload: { receipt, issuerAuthenticated: false } }))
    .toMatchObject({ type: 'receipt.design-review.ingested', payload: { receipt, issuerAuthenticated: false } });
  expect(decodeDesignReviewEvent({ type: 'receipt.design-review.ingested', payload: {
    receipt, issuerAuthenticated: false, receiptSource: { relativePath: '.leo-dev/receipt.json', sha256: hash('e'), bytesBase64: Buffer.from(JSON.stringify(receipt)).toString('base64') },
  } })).toMatchObject({ type: 'receipt.design-review.ingested', payload: { receipt } });
  const pendingOperation: ControllerBatchOperation = { type: 'receipt.design-review.ingested', payload: { receipt, issuerAuthenticated: false } };
  expect(decodeDesignReviewEvent(pendingOperation)).toMatchObject({ type: 'receipt.design-review.ingested', payload: { receipt } });
  expect(decodeDesignReviewEvent({ type: 'controller.unrelated', payload: { anything: true } })).toBeUndefined();
});

// Mutant caught: returning the first recognized event makes a later legitimate
// design revision invisible to admission and recovery consumers.
test('selects the newest valid event of each recognized design kind', () => {
  const laterContext = { ...context, producerSession: 'producer-2' };
  const laterReceipt = { ...receipt, receiptId: 'receipt-2', findingsHash: hash('e') };
  expect(latestDesignReviewContext([
    { type: 'controller.design.review.requested', payload: context },
    { type: 'controller.design.review.requested', payload: laterContext },
  ])).toMatchObject(laterContext);
  expect(latestDesignReviewReceipt([
    { type: 'receipt.design-review.ingested', payload: { receipt, issuerAuthenticated: false } },
    { type: 'receipt.design-review.ingested', payload: { receipt: laterReceipt, issuerAuthenticated: false } },
  ])).toMatchObject(laterReceipt);
});

// Mutant caught: scanning past the newest recognized event silently resurrects
// an older approval after a malformed durable event is appended.
test('refuses malformed recognized events and never falls back to an older design approval', () => {
  const older = { type: 'controller.design.review.requested', payload: context };
  const malformed = { type: 'controller.design.review.requested', payload: { ...context, producerSession: 7 } };
  expect(() => decodeDesignReviewEvent({ type: 'receipt.design-review.ingested', payload: { receipt, issuerAuthenticated: 'false' } })).toThrow(DesignEventDecodeError);
  expect(() => latestDesignReviewContext([older, malformed])).toThrow(DesignEventDecodeError);
  expect(() => latestDesignReviewReceipt([
    { type: 'receipt.design-review.ingested', payload: { receipt, issuerAuthenticated: false } },
    { type: 'receipt.design-review.ingested', payload: { receipt: { ...receipt, verdict: 'unknown' }, issuerAuthenticated: false } },
  ])).toThrow(DesignEventDecodeError);
});
