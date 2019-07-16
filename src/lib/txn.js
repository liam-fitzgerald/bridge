import * as ob from 'urbit-ob';
import { Just } from 'folktale/maybe';
import Tx from 'ethereumjs-tx';
import { toWei, fromWei, toHex } from 'web3-utils';
import * as retry from 'async-retry';

import { NETWORK_TYPES } from './network';
import { ledgerSignTransaction } from './ledger';
import { trezorSignTransaction } from './trezor';
import { WALLET_TYPES, addHexPrefix } from './wallet';

const CHECK_BLOCK_EVERY_MS =
  process.env.NODE_ENV === 'development' ? 1000 : 5000;

const RETRY_OPTIONS = {
  retries: 99999,
  factor: 1,
  minTimeout: CHECK_BLOCK_EVERY_MS,
  randomize: false,
};

const TXN_PURPOSE = {
  SET_MANAGEMENT_PROXY: Symbol('SET_MANAGEMENT_PROXY'),
  SET_TRANSFER_PROXY: Symbol('SET_TRANSFER_PROXY'),
  SET_SPAWN_PROXY: Symbol('SET_SPAWN_PROXY'),
  CREATE_GALAXY: Symbol('CREATE_GALAXY'),
  ISSUE_CHILD: Symbol('ISSUE_CHILD'),
  SET_KEYS: Symbol('SET_KEYS'),
  TRANSFER: Symbol('TRANSFER'),
  CANCEL_TRANSFER: Symbol('CANCEL_TRANSFER'),
};

const renderTxnPurpose = purpose =>
  purpose === TXN_PURPOSE.SET_MANAGEMENT_PROXY
    ? 'set this management proxy'
    : purpose === TXN_PURPOSE.SET_SPAWN_PROXY
    ? 'set this spawn proxy'
    : purpose === TXN_PURPOSE.SET_TRANSFER_PROXY
    ? 'set this transfer proxy'
    : purpose === TXN_PURPOSE.CREATE_GALAXY
    ? 'create this galaxy'
    : purpose === TXN_PURPOSE.ISSUE_CHILD
    ? 'issue this point'
    : purpose === TXN_PURPOSE.SET_KEYS
    ? 'set these network keys'
    : purpose === TXN_PURPOSE.TRANSFER
    ? 'transfer this point'
    : purpose === TXN_PURPOSE.CANCEL_TRANSFER
    ? 'cancel this transfer'
    : 'perform this transaction';

const signTransaction = async config => {
  let {
    wallet,
    walletType,
    walletHdPath,
    networkType,
    txn,
    setStx,
    nonce,
    chainId,
    gasPrice,
    gasLimit,
  } = config;

  //TODO require these in txn object
  nonce = toHex(nonce);
  chainId = toHex(chainId);
  gasPrice = toHex(toWei(gasPrice, 'gwei'));
  gasLimit = toHex(gasLimit);

  const txParams = { nonce, chainId, gasPrice, gasLimit };

  // NB (jtobin)
  //
  // Ledger does not seem to handle EIP-155 automatically.  When using a Ledger,
  // if the block number is at least FORK_BLKNUM = 2675000, one needs to
  // pre-set the ECDSA signature parameters with r = 0, s = 0, and v = chainId
  // prior to signing.
  //
  // The easiest way to handle this is to just branch on the network, since
  // mainnet and Ropsten have obviously passed FORK_BLKNUM.  This is somewhat
  // awkward when dealing with offline transactions, since we might want to
  // test them on a local network as well.
  //
  // The best thing to do is probably to add an 'advanced' tab to offline
  // transaction generation where one can disable the defaulted-on EIP-155
  // settings in this case.  This is pretty low-priority, but is a
  // comprehensive solution.
  //
  // See:
  //
  // See https://github.com/LedgerHQ/ledgerjs/issues/43#issuecomment-366984725
  //
  // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-155.md

  const eip155Params = {
    r: '0x00',
    s: '0x00',
    v: chainId,
  };

  const defaultEip155Networks = [
    NETWORK_TYPES.MAINNET,
    NETWORK_TYPES.ROPSTEN,
    NETWORK_TYPES.OFFLINE,
  ];

  const needEip155Params =
    walletType === WALLET_TYPES.LEDGER &&
    defaultEip155Networks.includes(networkType);

  const signingParams = needEip155Params
    ? Object.assign(txParams, eip155Params)
    : txParams;

  const utx = Object.assign(txn, signingParams);

  const stx = new Tx(utx);

  //TODO should try-catch and display error message to user,
  //     ie ledger's "pls enable contract data"
  //     needs to maybe happen at call-site though
  if (walletType === WALLET_TYPES.LEDGER) {
    await ledgerSignTransaction(stx, walletHdPath);
  } else if (walletType === WALLET_TYPES.TREZOR) {
    await trezorSignTransaction(stx, walletHdPath);
  } else {
    stx.sign(wallet.privateKey);
  }

  setStx(Just(stx));
  return stx;
};

const sendSignedTransaction = (web3, stx, doubtNonceError) => {
  const rawTx = hexify(stx.serialize());

  return new Promise(async (resolve, reject) => {
    web3.eth
      .sendSignedTransaction(rawTx)
      .on('transactionHash', hash => {
        resolve(hash);
      })
      .on('error', err => {
        // if there's a nonce error, but we used the gas tank, it's likely
        // that it's because the tank already submitted our transaction.
        // we just wait for first confirmation here.
        console.error(err);
        const isKnownError = (err.message || '').includes(
          'known transaction: '
        );
        const isNonceError = (err.message || '').includes(
          "the tx doesn't have the correct nonce."
        );
        if (isKnownError || (doubtNonceError && isNonceError)) {
          console.log(
            'tx send error likely from gas tank submission, ignoring'
          );
          const txHash = web3.utils.keccak256(rawTx);
          resolve(txHash);
        } else {
          reject(err.message || 'Transaction sending failed!');
        }
      });
  });
};

// returns a Promise<bool>, where the bool indicates tx success/failure
const waitForTransactionConfirm = (web3, txHash) => {
  return retry(async (bail, n) => {
    const receipt = await web3.eth.getTransactionReceipt(txHash);
    const confirmed = receipt !== null;
    if (confirmed) return receipt.status === true;
    else throw new Error('retrying');
  }, RETRY_OPTIONS);
};

// returns a Promise that resolves when all stxs have been sent & confirmed
const sendAndAwaitAll = (web3, stxs, doubtNonceError) => {
  return Promise.all(
    stxs.map(async tx => {
      const txHash = await sendSignedTransaction(web3, tx, doubtNonceError);
      await waitForTransactionConfirm(web3, txHash);
    })
  );
};

const hexify = val => addHexPrefix(val.toString('hex'));

const renderSignedTx = stx => ({
  messageHash: hexify(stx.hash()),
  v: hexify(stx.v),
  s: hexify(stx.s),
  r: hexify(stx.r),
  rawTransaction: hexify(stx.serialize()),
});

const getTxnInfo = async (web3, addr) => {
  let nonce = await web3.eth.getTransactionCount(addr);
  let chainId = await web3.eth.net.getId();
  let gasPrice = await web3.eth.getGasPrice();
  return {
    nonce: nonce,
    chainId: chainId,
    gasPrice: fromWei(gasPrice, 'gwei'),
  };
};

const canDecodePatp = p => {
  try {
    ob.patp2dec(p);
    return true;
  } catch (_) {
    return false;
  }
};

export {
  RETRY_OPTIONS,
  signTransaction,
  sendSignedTransaction,
  waitForTransactionConfirm,
  sendAndAwaitAll,
  TXN_PURPOSE,
  getTxnInfo,
  renderTxnPurpose,
  hexify,
  renderSignedTx,
  toHex,
  toWei,
  fromWei,
  canDecodePatp,
};
