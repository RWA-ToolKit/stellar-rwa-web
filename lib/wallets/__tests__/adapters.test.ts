import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the underlying freighter lib functions
vi.mock('../../freighter', () => ({
  isConnected: vi.fn(),
  getPublicKey: vi.fn(),
  signTransaction: vi.fn(),
  getNetwork: vi.fn(),
}));

import * as freighterLib from '../../freighter';
import { freighterAdapter } from '../freighter';
import { xbullAdapter } from '../xbull';
import { albedoAdapter } from '../albedo';
import type { WalletAdapter } from '../types';

const mockedFreighter = vi.mocked(freighterLib);

describe('Wallet adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('freighterAdapter', () => {
    it('has the expected metadata', () => {
      expect(freighterAdapter.id).toBe('freighter');
      expect(freighterAdapter.name).toBe('Freighter');
      expect(typeof freighterAdapter.isAvailable).toBe('function');
    });

    it('reports availability based on the freighter global', () => {
      const original = (globalThis as any).freighter;
      (globalThis as any).freighter = { isConnected: vi.fn() };
      expect(freighterAdapter.isAvailable()).toBe(true);

      delete (globalThis as any).freighter;
      expect(freighterAdapter.isAvailable()).toBe(false);

      if (original !== undefined) {
        (globalThis as any).freighter = original;
      }
    });

    it('connect delegates to freighter isConnected and getPublicKey', async () => {
      mockedFreighter.isConnected.mockResolvedValue(true);
      mockedFreighter.getPublicKey.mockResolvedValue('GABC123');

      const result = await freighterAdapter.connect();

      expect(mockedFreighter.isConnected).toHaveBeenCalledTimes(1);
      expect(mockedFreighter.getPublicKey).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ publicKey: 'GABC123' });
    });

    it('connect throws a normalised error when freighter is not connected', async () => {
      mockedFreighter.isConnected.mockResolvedValue(false);

      await expect(freighterAdapter.connect()).rejects.toThrow(/not connected|not installed/i);
      expect(mockedFreighter.getPublicKey).not.toHaveBeenCalled();
    });

    it('connect normalises errors thrown by freighter', async () => {
      mockedFreighter.isConnected.mockRejectedValue(new Error('boom'));

      await expect(freighterAdapter.connect()).rejects.toThrow(/boom|failed/i);
    });

    it('getAddress delegates to freighter getPublicKey', async () => {
      mockedFreighter.getPublicKey.mockResolvedValue('GPUBKEY');

      const address = await freighterAdapter.getAddress();

      expect(mockedFreighter.getPublicKey).toHaveBeenCalledTimes(1);
      expect(address).toBe('GPUBKEY');
    });

    it('getAddress normalises errors', async () => {
      mockedFreighter.getPublicKey.mockRejectedValue(new Error('denied'));

      await expect(freighterAdapter.getAddress()).rejects.toThrow(/denied|failed/i);
    });

    it('signTx delegates to freighter signTransaction', async () => {
      mockedFreighter.signTransaction.mockResolvedValue('signed-xdr');

      const signed = await freighterAdapter.signTx('xdr', {
        networkPassphrase: 'Test SDF Network ; September 2015',
      });

      expect(mockedFreighter.signTransaction).toHaveBeenCalledWith(
        'xdr',
        expect.objectContaining({ networkPassphrase: 'Test SDF Network ; September 2015' }),
      );
      expect(signed).toBe('signed-xdr');
    });

    it('signTx normalises errors', async () => {
      mockedFreighter.signTransaction.mockRejectedValue(new Error('user rejected'));

      await expect(
        freighterAdapter.signTx('xdr', { networkPassphrase: 'Test SDF Network ; September 2015' }),
      ).rejects.toThrow(/rejected|failed/i);
    });
  });

  describe('xbullAdapter', () => {
    const originalXbull = (globalThis as any).xBullSDK;

    afterEach(() => {
      if (originalXbull === undefined) {
        delete (globalThis as any).xBullSDK;
      } else {
        (globalThis as any).xBullSDK = originalXbull;
      }
    });

    it('has the expected metadata', () => {
      expect(xbullAdapter.id).toBe('xbull');
      expect(xbullAdapter.name).toBe('xBull');
    });

    it('reports not available when the global is missing', () => {
      delete (globalThis as any).xBullSDK;
      expect(xbullAdapter.isAvailable()).toBe(false);
    });

    it('reports available when the global is present', () => {
      (globalThis as any).xBullSDK = { connect: vi.fn() };
      expect(xbullAdapter.isAvailable()).toBe(true);
    });

    it('connect throws a normalised not-installed error when missing', async () => {
      delete (globalThis as any).xBullSDK;

      await expect(xbullAdapter.connect()).rejects.toThrow(/not installed/i);
    });

    it('connect returns the public key from the SDK', async () => {
      const connect = vi.fn().mockResolvedValue({ publicKey: 'GXBULL' });
      (globalThis as any).xBullSDK = { connect };

      const result = await xbullAdapter.connect();

      expect(connect).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ publicKey: 'GXBULL' });
    });

    it('connect normalises SDK errors', async () => {
      const connect = vi.fn().mockRejectedValue(new Error('nope'));
      (globalThis as any).xBullSDK = { connect };

      await expect(xbullAdapter.connect()).rejects.toThrow(/nope|failed/i);
    });

    it('getAddress throws a normalised not-installed error when missing', async () => {
      delete (globalThis as any).xBullSDK;

      await expect(xbullAdapter.getAddress()).rejects.toThrow(/not installed/i);
    });

    it('getAddress returns the public key from the SDK', async () => {
      const getPublicKey = vi.fn().mockResolvedValue('GXBULLADDR');
      (globalThis as any).xBullSDK = { getPublicKey };

      const address = await xbullAdapter.getAddress();

      expect(getPublicKey).toHaveBeenCalledTimes(1);
      expect(address).toBe('GXBULLADDR');
    });

    it('getAddress normalises SDK errors', async () => {
      const getPublicKey = vi.fn().mockRejectedValue(new Error('denied'));
      (globalThis as any).xBullSDK = { getPublicKey };

      await expect(xbullAdapter.getAddress()).rejects.toThrow(/denied|failed/i);
    });

    it('signTx throws a normalised not-installed error when missing', async () => {
      delete (globalThis as any).xBullSDK;

      await expect(
        xbullAdapter.signTx('xdr', { networkPassphrase: 'Test SDF Network ; September 2015' }),
      ).rejects.toThrow(/not installed/i);
    });

    it('signTx delegates to the SDK signTransaction', async () => {
      const signTransaction = vi.fn().mockResolvedValue('signed-xbull');
      (globalThis as any).xBullSDK = { signTransaction };

      const signed = await xbullAdapter.signTx('xdr', {
        networkPassphrase: 'Test SDF Network ; September 2015',
      });

      expect(signTransaction).toHaveBeenCalledWith(
        'xdr',
        expect.objectContaining({ networkPassphrase: 'Test SDF Network ; September 2015' }),
      );
      expect(signed).toBe('signed-xbull');
    });

    it('signTx normalises SDK errors', async () => {
      const signTransaction = vi.fn().mockRejectedValue(new Error('rejected'));
      (globalThis as any).xBullSDK = { signTransaction };

      await expect(
        xbullAdapter.signTx('xdr', { networkPassphrase: 'Test SDF Network ; September 2015' }),
      ).rejects.toThrow(/rejected|failed/i);
    });
  });

  describe('albedoAdapter', () => {
    const originalAlbedo = (globalThis as any).albedo;

    afterEach(() => {
      if (originalAlbedo === undefined) {
        delete (globalThis as any).albedo;
      } else {
        (globalThis as any).albedo = originalAlbedo;
      }
    });

    it('has the expected metadata', () => {
      expect(albedoAdapter.id).toBe('albedo');
      expect(albedoAdapter.name).toBe('Albedo');
    });

    it('reports not available when the global is missing', () => {
      delete (globalThis as any).albedo;
      expect(albedoAdapter.isAvailable()).toBe(false);
    });

    it('reports available when the global is present', () => {
      (globalThis as any).albedo = { publicKey: vi.fn() };
      expect(albedoAdapter.isAvailable()).toBe(true);
    });

    it('connect throws a normalised not-installed error when missing', async () => {
      delete (globalThis as any).albedo;

      await expect(albedoAdapter.connect()).rejects.toThrow(/not installed/i);
    });

    it('connect returns the public key from albedo', async () => {
      const publicKey = vi.fn().mockResolvedValue({ pubkey: 'GALBEDO' });
      (globalThis as any).albedo = { publicKey };

      const result = await albedoAdapter.connect();

      expect(publicKey).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ publicKey: 'GALBEDO' });
    });

    it('connect normalises albedo errors', async () => {
      const publicKey = vi.fn().mockRejectedValue(new Error('closed'));
      (globalThis as any).albedo = { publicKey };

      await expect(albedoAdapter.connect()).rejects.toThrow(/closed|failed/i);
    });

    it('getAddress throws a normalised not-installed error when missing', async () => {
      delete (globalThis as any).albedo;

      await expect(albedoAdapter.getAddress()).rejects.toThrow(/not installed/i);
    });

    it('getAddress returns the public key from albedo', async () => {
      const publicKey = vi.fn().mockResolvedValue({ pubkey: 'GALBEDOADDR' });
      (globalThis as any).albedo = { publicKey };

      const address = await albedoAdapter.getAddress();

      expect(publicKey).toHaveBeenCalledTimes(1);
      expect(address).toBe('GALBEDOADDR');
    });

    it('getAddress normalises albedo errors', async () => {
      const publicKey = vi.fn().mockRejectedValue(new Error('denied'));
      (globalThis as any).albedo = { publicKey };

      await expect(albedoAdapter.getAddress()).rejects.toThrow(/denied|failed/i);
    });

    it('signTx throws a normalised not-installed error when missing', async () => {
      delete (globalThis as any).albedo;

      await expect(
        albedoAdapter.signTx('xdr', { networkPassphrase: 'Test SDF Network ; September 2015' }),
      ).rejects.toThrow(/not installed/i);
    });

    it('signTx delegates to albedo tx', async () => {
      const tx = vi.fn().mockResolvedValue({ signed_envelope_xdr: 'signed-albedo' });
      (globalThis as any).albedo = { tx };

      const signed = await albedoAdapter.signTx('xdr', {
        networkPassphrase: 'Test SDF Network ; September 2015',
      });

      expect(tx).toHaveBeenCalledWith(
        expect.objectContaining({
          xdr: 'xdr',
          network_passphrase: 'Test SDF Network ; September 2015',
        }),
      );
      expect(signed).toBe('signed-albedo');
    });

    it('signTx normalises albedo errors', async () => {
      const tx = vi.fn().mockRejectedValue(new Error('rejected'));
      (globalThis as any).albedo = { tx };

      await expect(
        albedoAdapter.signTx('xdr', { networkPassphrase: 'Test SDF Network ; September 2015' }),
      ).rejects.toThrow(/rejected|failed/i);
    });
  });

  describe('adapter contract', () => {
    const adapters: WalletAdapter[] = [freighterAdapter, xbullAdapter, albedoAdapter];

    it.each(adapters.map((a) => [a.id, a] as const))(
      'adapter %s implements the WalletAdapter interface',
      (_id, adapter) => {
        expect(typeof adapter.id).toBe('string');
        expect(typeof adapter.name).toBe('string');
        expect(typeof adapter.isAvailable).toBe('function');
        expect(typeof adapter.connect).toBe('function');
        expect(typeof adapter.getAddress).toBe('function');
        expect(typeof adapter.signTx).toBe('function');
      },
    );
  });
});