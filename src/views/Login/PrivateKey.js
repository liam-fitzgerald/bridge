import React, { useCallback, useMemo } from 'react';
import cn from 'classnames';
import { Just, Nothing } from 'folktale/maybe';
import { Grid } from 'indigo-react';

import { useWallet } from 'store/wallet';

import { EthereumWallet, WALLET_TYPES, stripHexPrefix } from 'lib/wallet';
import useLoginView from 'lib/useLoginView';

import FormError from 'form/FormError';
import BridgeForm from 'form/BridgeForm';
import { PrivateKeyInput } from 'form/Inputs';
import { composeValidator, buildPrivateKeyValidator } from 'form/validators';

import SubmitButton from 'form/SubmitButton';

export default function PrivateKey({ className, goHome }) {
  useLoginView(WALLET_TYPES.PRIVATE_KEY);

  const { setWallet } = useWallet();

  const validate = useMemo(
    () =>
      composeValidator({
        privateKey: buildPrivateKeyValidator(64),
      }),
    []
  );

  const onValues = useCallback(
    ({ valid, values }) => {
      if (valid) {
        const sec = Buffer.from(stripHexPrefix(values.privateKey), 'hex');
        const newWallet = new EthereumWallet(sec);
        setWallet(Just(newWallet));
      } else {
        setWallet(Nothing());
      }
    },
    [setWallet]
  );

  return (
    <Grid className={cn(className, 'mb4')}>
      <BridgeForm validate={validate} onValues={onValues} afterSubmit={goHome}>
        {({ handleSubmit }) => (
          <>
            <Grid.Item
              full
              as={PrivateKeyInput}
              name="privateKey"
              label="Private key"
            />
            <Grid.Item full as={FormError} />
            <Grid.Item full as={SubmitButton} handleSubmit={handleSubmit}>
              Continue
            </Grid.Item>
          </>
        )}
      </BridgeForm>
    </Grid>
  );
}
