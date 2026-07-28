import '@testing-library/jest-dom';

// Mock Stellar SDK modules globally to avoid ESM import issues
jest.mock('@stellar/freighter-api', () => ({
  connect: jest.fn(),
  getConnectedAddress: jest.fn(),
  getWalletNetwork: jest.fn(),
  isFreighterInstalled: jest.fn(),
  signTx: jest.fn(),
  watchWallet: jest.fn(() => jest.fn()),
}), { virtual: true });

jest.mock('@stellar/stellar-sdk', () => ({
  Account: class MockAccount {},
  Asset: class MockAsset {},
  BASE_FEE: '100',
  Keypair: {
    fromSecret: jest.fn(),
    random: jest.fn(),
  },
  Memo: {
    text: jest.fn(),
  },
  Operation: {},
  TransactionBuilder: class MockTxBuilder {
    addOperation() { return this; }
    setTimeout() { return this; }
    build() { return this; }
    toXDR() { return 'xdr'; }
  },
  rpc: {
    Server: class MockServer {
      simulateTransaction() { return Promise.resolve({}); }
    },
  },
}), { virtual: true });
