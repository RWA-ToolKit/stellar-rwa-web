import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  toCsv,
  downloadCsv,
  holdersToCsv,
  distributionsToCsv,
} from '../csv';

describe('toCsv', () => {
  it('produces a header row followed by data rows', () => {
    const csv = toCsv(
      ['name', 'amount'],
      [
        ['Alice', '100'],
        ['Bob', '200'],
      ],
    );
    expect(csv).toBe('name,amount\nAlice,100\nBob,200');
  });

  it('returns only the header row when there are no rows', () => {
    const csv = toCsv(['a', 'b'], []);
    expect(csv).toBe('a,b');
  });

  it('quotes values containing commas', () => {
    const csv = toCsv(['name'], [['Doe, John']]);
    expect(csv).toBe('name\n"Doe, John"');
  });

  it('escapes double quotes by doubling them', () => {
    const csv = toCsv(['name'], [['He said "hi"']]);
    expect(csv).toBe('name\n"He said ""hi"""');
  });

  it('quotes values containing newlines', () => {
    const csv = toCsv(['note'], [['line1\nline2']]);
    expect(csv).toBe('note\n"line1\nline2"');
  });

  it('quotes values containing carriage returns', () => {
    const csv = toCsv(['note'], [['line1\r\nline2']]);
    expect(csv).toBe('note\n"line1\r\nline2"');
  });

  it('quotes header values that need escaping', () => {
    const csv = toCsv(['a,b'], [['1']]);
    expect(csv).toBe('"a,b"\n1');
  });

  it('handles empty string values without quoting', () => {
    const csv = toCsv(['a', 'b'], [['', 'x']]);
    expect(csv).toBe('a,b\n,x');
  });
});

describe('downloadCsv', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();
    // @ts-expect-error - test shim
    globalThis.URL.createObjectURL = createObjectURL;
    // @ts-expect-error - test shim
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    clickSpy = vi.fn();
    originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        (el as HTMLAnchorElement).click = clickSpy as unknown as () => void;
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a Blob and triggers an anchor download', () => {
    downloadCsv('holders.csv', 'a,b\n1,2');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toContain('text/csv');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('sets the download filename on the anchor', () => {
    let capturedAnchor: HTMLAnchorElement | null = null;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        capturedAnchor = el as HTMLAnchorElement;
        (el as HTMLAnchorElement).click = clickSpy as unknown as () => void;
      }
      return el;
    });

    downloadCsv('my-file.csv', 'x');
    expect(capturedAnchor).not.toBeNull();
    expect((capturedAnchor as unknown as HTMLAnchorElement).download).toBe(
      'my-file.csv',
    );
  });
});

describe('holdersToCsv', () => {
  it('produces the expected CSV shape for sample holder data', () => {
    const holders = [
      { address: 'GAAA...1111', balance: '1000.5', share: '10.00' },
      { address: 'GBBB...2222', balance: '500', share: '5.00' },
    ];

    const csv = holdersToCsv(holders);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Address,Balance,Share (%)');
    expect(lines[1]).toBe('GAAA...1111,1000.5,10.00');
    expect(lines[2]).toBe('GBBB...2222,500,5.00');
    expect(lines).toHaveLength(3);
  });

  it('escapes holder values containing commas', () => {
    const holders = [{ address: 'G,1', balance: '1', share: '1' }];
    const csv = holdersToCsv(holders);
    expect(csv.split('\n')[1]).toBe('"G,1",1,1');
  });

  it('produces only a header row for an empty holder list', () => {
    const csv = holdersToCsv([]);
    expect(csv).toBe('Address,Balance,Share (%)');
  });
});

describe('distributionsToCsv', () => {
  it('produces the expected CSV shape for sample distribution data', () => {
    const distributions = [
      {
        date: '2024-01-15',
        amount: '250.00',
        asset: 'USDC',
        recipients: 12,
        status: 'Completed',
      },
      {
        date: '2024-02-15',
        amount: '300.00',
        asset: 'USDC',
        recipients: 12,
        status: 'Pending',
      },
    ];

    const csv = distributionsToCsv(distributions);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Date,Amount,Asset,Recipients,Status');
    expect(lines[1]).toBe('2024-01-15,250.00,USDC,12,Completed');
    expect(lines[2]).toBe('2024-02-15,300.00,USDC,12,Pending');
    expect(lines).toHaveLength(3);
  });

  it('escapes distribution values containing quotes and newlines', () => {
    const distributions = [
      {
        date: '2024-01-15',
        amount: '250.00',
        asset: 'USDC',
        recipients: 1,
        status: 'Note "x"\nsecond line',
      },
    ];
    const csv = distributionsToCsv(distributions);
    const dataRow = csv.slice(csv.indexOf('\n') + 1);
    expect(dataRow).toBe('2024-01-15,250.00,USDC,1,"Note ""x""\nsecond line"');
  });

  it('produces only a header row for an empty distribution list', () => {
    const csv = distributionsToCsv([]);
    expect(csv).toBe('Date,Amount,Asset,Recipients,Status');
  });
});